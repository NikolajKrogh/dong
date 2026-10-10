-- Social aggregates never grant underlying separate-game access.
DO $preflight$
DECLARE conflicting_sessions uuid[];
BEGIN
  SELECT array_agg(id) INTO conflicting_sessions FROM (
    SELECT s.id FROM public.game_sessions s WHERE s.state='completed' AND (
      (s.join_code !~ '^[0-9]{6}$' AND s.join_code NOT LIKE 'IMP-%')
      OR (s.join_code ~ '^[0-9]{6}$' AND (
        s.started_at IS NULL OR s.completed_at IS NULL
        OR EXISTS (SELECT 1 FROM public.gameplay_events e WHERE e.session_id=s.id
          AND (e.idempotency_key LIKE 'legacy-import:%' OR e.payload->>'imported'='true'))
        OR EXISTS (SELECT 1 FROM public.matches m WHERE m.session_id=s.id AND m.source_provider='legacy_import')
      ))
    ) ORDER BY s.id LIMIT 20
  ) conflicts;
  IF conflicting_sessions IS NOT NULL THEN
    RAISE EXCEPTION 'social_history_origin_preflight_failed: inspect completed session provenance before rollout'
      USING DETAIL='First conflicting session IDs: ' || array_to_string(conflicting_sessions, ',');
  END IF;
END $preflight$;

CREATE VIEW private.social_history_participants WITH (security_invoker=true) AS
SELECT p.*,s.completed_at
FROM private._history_completed_participants p JOIN public.game_sessions s ON s.id=p.session_id
WHERE p.account_id IS NOT NULL AND p.membership_type='registered'
  AND s.started_at IS NOT NULL AND s.completed_at IS NOT NULL AND s.join_code ~ '^[0-9]{6}$'
  AND NOT EXISTS (SELECT 1 FROM public.gameplay_events e WHERE e.session_id=s.id
    AND (e.idempotency_key LIKE 'legacy-import:%' OR e.payload->>'imported'='true'))
  AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.session_id=s.id AND m.source_provider='legacy_import');
REVOKE ALL ON private.social_history_participants FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.get_personal_history_stats() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.social_actor(); result jsonb;
BEGIN
  SELECT jsonb_build_object('account_id',actor,'username',a.username,
    'games_participated',count(p.session_id),'total_drinks',COALESCE(sum(p.current_drink_total),0),
    'average_drinks',avg(p.current_drink_total)) INTO result
  FROM public.accounts a LEFT JOIN private.social_history_participants p ON p.account_id=a.id
  WHERE a.id=actor GROUP BY a.username;
  RETURN result;
END $$;
CREATE FUNCTION public.get_personal_history_stats() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.get_personal_history_stats(); $$;
REVOKE ALL ON FUNCTION private.get_personal_history_stats(),public.get_personal_history_stats() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.get_personal_history_stats(),public.get_personal_history_stats() TO authenticated;

CREATE FUNCTION private.social_history_actor(target uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.social_actor();
BEGIN
  IF target IS NULL OR target=actor THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.accounts WHERE id=target AND username IS NOT NULL) THEN
    RAISE EXCEPTION 'target_unavailable';
  END IF;
  IF NOT private.are_accounts_friends(actor,target) THEN RAISE EXCEPTION 'comparison_not_allowed'; END IF;
  RETURN actor;
END $$;

CREATE FUNCTION private.social_history_page(target uuid,cursor text,page_size integer,timeline boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.social_history_actor(target); cursor_at timestamptz; cursor_id uuid; token jsonb; result jsonb;
BEGIN
  IF page_size IS NULL OR page_size<1 OR page_size>(CASE WHEN timeline THEN 100 ELSE 50 END) THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF cursor IS NOT NULL THEN
    BEGIN
      IF length(cursor)>300 THEN RAISE EXCEPTION 'invalid_input'; END IF;
      token := cursor::jsonb;
      cursor_at := (token->>'completed_at')::timestamptz; cursor_id := (token->>'session_id')::uuid;
      IF cursor_at IS NULL OR cursor_id IS NULL OR NOT isfinite(cursor_at) THEN RAISE EXCEPTION 'invalid_input'; END IF;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_input'; END;
  END IF;
  WITH common AS (
    SELECT a.session_id,a.completed_at,a.current_drink_total AS viewer_drinks,b.current_drink_total AS target_drinks,
      a.left_at AS viewer_left_at,b.left_at AS target_left_at
    FROM private.social_history_participants a JOIN private.social_history_participants b ON b.session_id=a.session_id
    WHERE a.account_id=actor AND b.account_id=target
      AND (cursor IS NULL OR (a.completed_at,a.session_id)<(cursor_at,cursor_id))
    ORDER BY a.completed_at DESC,a.session_id DESC LIMIT page_size+1
  ), numbered AS (
    SELECT *,row_number() OVER (ORDER BY completed_at DESC,session_id DESC) AS n FROM common
  ), items AS (
    SELECT n,completed_at,session_id,
      CASE WHEN timeline THEN jsonb_build_object('session_id',session_id,'completed_at',completed_at,
        'viewer_drinks',viewer_drinks,'target_drinks',target_drinks,'viewer_left_at',viewer_left_at,'target_left_at',target_left_at)
      ELSE (SELECT to_jsonb(summary) FROM public.completed_session_summaries summary WHERE summary.session_id=numbered.session_id)
      END AS item FROM numbered WHERE n<=page_size
  )
  SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(item ORDER BY n) FROM items),'[]'::jsonb),
    'next_cursor',CASE WHEN EXISTS(SELECT 1 FROM numbered WHERE n>page_size) THEN
      (SELECT jsonb_build_object('completed_at',completed_at,'session_id',session_id)::text FROM items WHERE n=page_size)
      ELSE NULL END) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION private.get_social_history(target_account_id uuid,page_size integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.social_history_actor(target_account_id); result jsonb;
BEGIN
  WITH all_results AS (
    SELECT account_id,count(*)::integer AS games,COALESCE(sum(current_drink_total),0) AS drinks,avg(current_drink_total) AS average
    FROM private.social_history_participants WHERE account_id IN(actor,target_account_id) GROUP BY account_id
  ), subjects AS (
    SELECT a.id,jsonb_build_object('account_id',a.id,'username',a.username,'games_participated',COALESCE(r.games,0),
      'total_drinks',COALESCE(r.drinks,0),'average_drinks',r.average) AS stats
    FROM public.accounts a LEFT JOIN all_results r ON r.account_id=a.id WHERE a.id IN(actor,target_account_id)
  ), common AS (
    SELECT a.current_drink_total AS v,b.current_drink_total AS t
    FROM private.social_history_participants a JOIN private.social_history_participants b ON a.session_id=b.session_id
    WHERE a.account_id=actor AND b.account_id=target_account_id
  )
  SELECT jsonb_build_object('scope','all_time_completed_online','viewer',(SELECT stats FROM subjects WHERE id=actor),
    'target',(SELECT stats FROM subjects WHERE id=target_account_id),'shared',
    jsonb_build_object('shared_games',count(*),'viewer_total_drinks',COALESCE(sum(v),0),
      'target_total_drinks',COALESCE(sum(t),0),'viewer_average_drinks',avg(v),'target_average_drinks',avg(t),
      'viewer_higher_count',count(*) FILTER(WHERE v>t),'target_higher_count',count(*) FILTER(WHERE t>v),
      'tied_count',count(*) FILTER(WHERE v=t)),
    'games',private.social_history_page(target_account_id,NULL,page_size,false))
  INTO result FROM common;
  RETURN result;
END $$;

CREATE FUNCTION private.list_social_shared_games(target_account_id uuid,cursor text,page_size integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.social_history_page(target_account_id,cursor,page_size,false);
$$;
CREATE FUNCTION private.list_social_shared_timeline(target_account_id uuid,cursor text,page_size integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.social_history_page(target_account_id,cursor,page_size,true);
$$;

CREATE FUNCTION private.get_history_coplayer_context(target_account_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.social_actor(); result jsonb;
BEGIN
  IF target_account_ids IS NULL OR cardinality(target_account_ids)>100
    OR array_position(target_account_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('account_id',a.id,'username',a.username,
    'relationship',projection->>'current_relationship','request_id',projection->>'request_id')),'[]'::jsonb)
  INTO result FROM public.accounts a
  CROSS JOIN LATERAL (SELECT private.social_projection(actor,a.id) AS projection) relation
  WHERE a.id=ANY(target_account_ids) AND a.id<>actor AND a.username IS NOT NULL
    AND NOT private.social_blocked(actor,a.id)
    AND EXISTS (
      SELECT 1 FROM public.participants own JOIN public.participants other ON other.session_id=own.session_id
      JOIN public.game_sessions s ON s.id=own.session_id
      WHERE own.account_id=actor AND other.account_id=a.id AND s.join_code ~ '^[0-9]{6}$'
        AND s.started_at IS NOT NULL
        AND s.state IN('completed','in_progress')
        AND (own.left_at IS NULL OR own.left_at>=s.started_at)
        AND (other.left_at IS NULL OR other.left_at>=s.started_at)
        AND (s.state='completed' OR own.left_at IS NOT NULL)
        AND NOT EXISTS(SELECT 1 FROM public.gameplay_events e WHERE e.session_id=s.id
          AND (e.idempotency_key LIKE 'legacy-import:%' OR e.payload->>'imported'='true'))
        AND NOT EXISTS(SELECT 1 FROM public.matches m WHERE m.session_id=s.id AND m.source_provider='legacy_import')
    );
  RETURN result;
END $$;

CREATE FUNCTION public.get_social_history(target_account_id uuid,page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.get_social_history(target_account_id,page_size); $$;
CREATE FUNCTION public.list_social_shared_games(target_account_id uuid,cursor text DEFAULT NULL,page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.list_social_shared_games(target_account_id,cursor,page_size); $$;
CREATE FUNCTION public.list_social_shared_timeline(target_account_id uuid,cursor text DEFAULT NULL,page_size integer DEFAULT 50) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.list_social_shared_timeline(target_account_id,cursor,page_size); $$;
CREATE FUNCTION public.get_history_coplayer_context(target_account_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.get_history_coplayer_context(target_account_ids); $$;

REVOKE ALL ON FUNCTION private.social_history_actor(uuid),private.social_history_page(uuid,text,integer,boolean),
  private.get_social_history(uuid,integer),private.list_social_shared_games(uuid,text,integer),
  private.list_social_shared_timeline(uuid,text,integer),private.get_history_coplayer_context(uuid[])
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.get_social_history(uuid,integer),private.list_social_shared_games(uuid,text,integer),
  private.list_social_shared_timeline(uuid,text,integer),private.get_history_coplayer_context(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_social_history(uuid,integer),public.list_social_shared_games(uuid,text,integer),
  public.list_social_shared_timeline(uuid,text,integer),public.get_history_coplayer_context(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_history(uuid,integer),public.list_social_shared_games(uuid,text,integer),
  public.list_social_shared_timeline(uuid,text,integer),public.get_history_coplayer_context(uuid[]) TO authenticated;
