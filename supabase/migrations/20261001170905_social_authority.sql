-- All social mutations reserve their receipt, then serialize one ordered pair.
-- Direct table writes are no longer an alternate command path.
ALTER TABLE public.friendships ADD COLUMN request_id uuid NOT NULL DEFAULT gen_random_uuid();
REVOKE ALL ON public.friendships FROM anon, authenticated;
DROP POLICY friendships_requester_insert ON public.friendships;
DROP POLICY friendships_requester_cancel_pending ON public.friendships;
DROP POLICY friendships_addressee_respond_pending ON public.friendships;
DROP POLICY friendships_participants_cancel_accepted ON public.friendships;

CREATE TABLE private.account_blocks (
  blocker_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  blocked_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  block_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_account_id, blocked_account_id),
  CHECK (blocker_account_id <> blocked_account_id)
);
CREATE INDEX account_blocks_target ON private.account_blocks(blocked_account_id, blocker_account_id);
CREATE TABLE private.social_receipts (
  actor_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  target_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  input jsonb NOT NULL,
  disposition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation_id)
);
ALTER TABLE private.account_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.social_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_blocks, private.social_receipts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.social_actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = actor AND username IS NOT NULL) THEN
    RAISE EXCEPTION 'username_required';
  END IF;
  RETURN actor;
END $$;

CREATE FUNCTION private.social_blocked(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.account_blocks
    WHERE (blocker_account_id = a AND blocked_account_id = b)
       OR (blocker_account_id = b AND blocked_account_id = a));
$$;

CREATE FUNCTION private.are_accounts_friends(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT private.social_blocked(a, b) AND EXISTS (SELECT 1 FROM public.friendships f
    WHERE least(f.requester_account_id, f.addressee_account_id) = least(a,b)
      AND greatest(f.requester_account_id, f.addressee_account_id) = greatest(a,b)
      AND f.status = 'accepted');
$$;

CREATE FUNCTION private.social_projection(actor uuid, target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.friendships%ROWTYPE; own_block uuid;
BEGIN
  SELECT block_id INTO own_block FROM private.account_blocks
    WHERE blocker_account_id = actor AND blocked_account_id = target;
  IF private.social_blocked(actor, target) THEN
    RETURN jsonb_build_object('current_relationship', 'unavailable', 'own_block_id', own_block);
  END IF;
  SELECT * INTO f FROM public.friendships
    WHERE least(requester_account_id, addressee_account_id) = least(actor,target)
      AND greatest(requester_account_id, addressee_account_id) = greatest(actor,target);
  RETURN jsonb_build_object('current_relationship', CASE
    WHEN f.status = 'accepted' THEN 'friends'
    WHEN f.status = 'pending' AND f.requester_account_id = actor THEN 'outgoing'
    WHEN f.status = 'pending' THEN 'incoming' ELSE 'none' END,
    'request_id', f.request_id, 'own_block_id', own_block);
END $$;

CREATE FUNCTION private.social_command(command text, target uuid, operation uuid, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := private.social_actor();
  input jsonb := jsonb_build_object('command',command,'target',target,'payload',payload);
  receipt private.social_receipts%ROWTYPE;
  f public.friendships%ROWTYPE;
  target_name text;
  replayed boolean := false;
  disposition text;
BEGIN
  IF operation IS NULL OR target IS NULL OR target = actor OR command NOT IN ('send','respond','cancel','block','unblock') THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = target AND username IS NOT NULL) THEN
    RAISE EXCEPTION 'target_unavailable';
  END IF;
  INSERT INTO private.social_receipts(actor_id,operation_id,target_id,input)
    VALUES(actor,operation,target,input) ON CONFLICT DO NOTHING;
  SELECT * INTO receipt FROM private.social_receipts
    WHERE actor_id = actor AND operation_id = operation FOR UPDATE;
  IF receipt.input <> input THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  replayed := receipt.disposition IS NOT NULL;

  PERFORM pg_advisory_xact_lock(hashtextextended('dong:social:' || least(actor,target)::text || ':' || greatest(actor,target)::text, 0));
  -- Hold both account identities in deterministic order against concurrent deletion/rename.
  PERFORM id FROM public.accounts WHERE id IN (actor,target) ORDER BY id FOR SHARE;
  PERFORM private.social_actor();
  SELECT username INTO target_name FROM public.accounts WHERE id = target;
  IF target_name IS NULL THEN RAISE EXCEPTION 'target_unavailable'; END IF;
  IF replayed THEN
    RETURN jsonb_build_object('operation_id', operation, 'replayed', true, 'disposition', receipt.disposition)
      || private.social_projection(actor,target);
  END IF;
  IF command IN ('send','respond','cancel') AND private.social_blocked(actor,target) THEN
    RAISE EXCEPTION 'target_unavailable';
  END IF;
  SELECT * INTO f FROM public.friendships
    WHERE least(requester_account_id,addressee_account_id) = least(actor,target)
      AND greatest(requester_account_id,addressee_account_id) = greatest(actor,target) FOR UPDATE;

  CASE command
  WHEN 'send' THEN
    IF payload->>'expected_username' IS DISTINCT FROM target_name THEN RAISE EXCEPTION 'target_changed'; END IF;
    IF f.status IN ('pending','accepted') THEN
      disposition := 'existing';
    ELSIF f.id IS NULL THEN
      INSERT INTO public.friendships(requester_account_id,addressee_account_id)
        VALUES(actor,target);
      disposition := 'sent';
    ELSE
      UPDATE public.friendships SET requester_account_id=actor, addressee_account_id=target,
        status='pending', request_id=gen_random_uuid(), requested_at=now(), responded_at=NULL, updated_at=now()
        WHERE id=f.id;
      disposition := 'sent';
    END IF;
  WHEN 'respond' THEN
    IF payload->>'decision' IS NULL OR payload->>'decision' NOT IN ('accept','decline') THEN RAISE EXCEPTION 'invalid_input'; END IF;
    IF f.id IS NULL OR f.request_id::text IS DISTINCT FROM payload->>'request_id' OR f.status <> 'pending' THEN RAISE EXCEPTION 'request_conflict'; END IF;
    IF f.addressee_account_id <> actor THEN RAISE EXCEPTION 'request_not_allowed'; END IF;
    UPDATE public.friendships SET status=CASE WHEN payload->>'decision'='accept' THEN 'accepted'::public.friendship_status ELSE 'declined'::public.friendship_status END,
      responded_at=now(), updated_at=now() WHERE id=f.id;
    disposition := CASE WHEN payload->>'decision'='accept' THEN 'accepted' ELSE 'declined' END;
  WHEN 'cancel' THEN
    IF payload->>'expected_status' IS NULL OR payload->>'expected_status' NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'invalid_input'; END IF;
    IF f.id IS NULL OR f.request_id::text IS DISTINCT FROM payload->>'request_id' OR f.status::text IS DISTINCT FROM payload->>'expected_status' THEN RAISE EXCEPTION 'request_conflict'; END IF;
    IF f.status='pending' AND f.requester_account_id <> actor THEN RAISE EXCEPTION 'request_not_allowed'; END IF;
    UPDATE public.friendships SET status='canceled', responded_at=now(), updated_at=now() WHERE id=f.id;
    disposition := CASE WHEN f.status='accepted' THEN 'unfriended' ELSE 'canceled' END;
  WHEN 'block' THEN
    INSERT INTO private.account_blocks(blocker_account_id,blocked_account_id) VALUES(actor,target) ON CONFLICT DO NOTHING;
    UPDATE public.friendships SET status='canceled', responded_at=now(), updated_at=now()
      WHERE id=f.id AND status IN ('pending','accepted');
    disposition := 'blocked';
  WHEN 'unblock' THEN
    DELETE FROM private.account_blocks WHERE blocker_account_id=actor AND blocked_account_id=target AND block_id::text=payload->>'block_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'request_conflict'; END IF;
    disposition := 'unblocked';
  END CASE;
  UPDATE private.social_receipts SET disposition=social_command.disposition WHERE actor_id=actor AND operation_id=operation;
  RETURN jsonb_build_object('operation_id',operation,'replayed',false,'disposition',disposition)
    || private.social_projection(actor,target);
END $$;

CREATE FUNCTION private.search_accounts_by_username_prefix(prefix text)
RETURNS TABLE(account_id uuid, username text, relationship text, request_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := private.social_actor(); normalized text := private.normalize_username(prefix); key text;
BEGIN
  IF NOT private.username_is_valid(normalized) THEN RETURN; END IF;
  key := private.username_lookup_key(normalized);
  RETURN QUERY SELECT a.id, a.username,
    CASE WHEN f.status='accepted' THEN 'friends' WHEN f.status='pending' AND f.requester_account_id=actor THEN 'outgoing'
      WHEN f.status='pending' THEN 'incoming' ELSE 'none' END,
    CASE WHEN f.status IN ('pending','accepted') THEN f.request_id ELSE NULL END
    FROM public.accounts a LEFT JOIN public.friendships f
      ON least(f.requester_account_id,f.addressee_account_id)=least(actor,a.id)
      AND greatest(f.requester_account_id,f.addressee_account_id)=greatest(actor,a.id)
    WHERE a.id <> actor AND a.username IS NOT NULL AND starts_with(a.username_key,key)
      AND NOT private.social_blocked(actor,a.id)
    ORDER BY a.username_key COLLATE "C",a.id LIMIT 20;
END $$;

CREATE FUNCTION private.list_social(kind text, cursor text, page_size integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := private.social_actor(); cursor_at timestamptz; cursor_id uuid; result jsonb;
BEGIN
  IF kind IS NULL OR kind NOT IN ('friends','incoming','outgoing','blocks') OR page_size IS NULL OR page_size < 1 OR page_size > 100 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF cursor IS NOT NULL THEN
    BEGIN
      IF array_length(string_to_array(cursor,'|'),1) <> 2 THEN RAISE EXCEPTION 'invalid_input'; END IF;
      cursor_at := split_part(cursor,'|',1)::timestamptz;
      cursor_id := split_part(cursor,'|',2)::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_input'; END;
  END IF;
  WITH rows AS (
    SELECT b.block_id AS row_id,b.blocked_account_id AS account_id,a.username,b.created_at AS ordered_at,
      NULL::uuid AS request_id,b.block_id,'blocked'::text AS relationship
    FROM private.account_blocks b JOIN public.accounts a ON a.id=b.blocked_account_id
    WHERE kind='blocks' AND b.blocker_account_id=actor
    UNION ALL
    SELECT f.id, a.id,a.username,f.requested_at,f.request_id,NULL::uuid,
      CASE WHEN f.status='accepted' THEN 'friends' WHEN f.requester_account_id=actor THEN 'outgoing' ELSE 'incoming' END
    FROM public.friendships f JOIN public.accounts a ON a.id=CASE WHEN f.requester_account_id=actor THEN f.addressee_account_id ELSE f.requester_account_id END
    WHERE (f.requester_account_id=actor OR f.addressee_account_id=actor) AND a.username IS NOT NULL AND NOT private.social_blocked(actor,a.id)
      AND ((kind='friends' AND f.status='accepted') OR (kind='incoming' AND f.status='pending' AND f.addressee_account_id=actor)
        OR (kind='outgoing' AND f.status='pending' AND f.requester_account_id=actor))
  ), page AS (
    SELECT * FROM rows WHERE cursor IS NULL OR (ordered_at,row_id) > (cursor_at,cursor_id)
      ORDER BY ordered_at,row_id LIMIT page_size+1
  ), visible AS (SELECT * FROM page ORDER BY ordered_at,row_id LIMIT page_size)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('account_id',account_id,'username',username,'request_id',request_id,
    'block_id',block_id,'relationship',relationship,'created_at',ordered_at) ORDER BY ordered_at,row_id) FROM visible),'[]'::jsonb),
    'next_cursor',CASE WHEN (SELECT count(*) FROM page)>page_size THEN (SELECT ordered_at::text || '|' || row_id::text FROM visible ORDER BY ordered_at DESC,row_id DESC LIMIT 1) ELSE NULL END) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.search_accounts_by_username_prefix(prefix text)
RETURNS TABLE(account_id uuid, username text, relationship text, request_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT * FROM private.search_accounts_by_username_prefix(prefix); $$;
CREATE FUNCTION public.list_social_relationships(kind text, cursor text DEFAULT NULL, page_size integer DEFAULT 50) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT private.list_social(kind,cursor,page_size); $$;
CREATE FUNCTION public.list_account_blocks(cursor text DEFAULT NULL,page_size integer DEFAULT 50) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT private.list_social('blocks',cursor,page_size); $$;
CREATE FUNCTION public.send_friend_request(target_account_id uuid,expected_username text,operation_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.social_command('send',target_account_id,operation_id,jsonb_build_object('expected_username',expected_username)); $$;

REVOKE ALL ON FUNCTION private.social_actor(),private.social_blocked(uuid,uuid),private.are_accounts_friends(uuid,uuid),private.social_projection(uuid,uuid),private.social_command(text,uuid,uuid,jsonb),private.search_accounts_by_username_prefix(text),private.list_social(text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.search_accounts_by_username_prefix(text),public.list_social_relationships(text,text,integer),public.list_account_blocks(text,integer),public.send_friend_request(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.social_command(text,uuid,uuid,jsonb),private.search_accounts_by_username_prefix(text),private.list_social(text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_accounts_by_username_prefix(text),public.list_social_relationships(text,text,integer),public.list_account_blocks(text,integer),public.send_friend_request(uuid,text,uuid) TO authenticated;
