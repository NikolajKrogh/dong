CREATE OR REPLACE FUNCTION private.social_command(command text, target uuid, operation uuid, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := private.social_actor();
  input jsonb := jsonb_build_object('command',command,'target',target,'payload',payload);
  receipt private.social_receipts%ROWTYPE;
  f public.friendships%ROWTYPE;
  target_name text;
  replayed boolean := false;
  v_disposition text;
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
      v_disposition := 'existing';
    ELSIF f.id IS NULL THEN
      INSERT INTO public.friendships(requester_account_id,addressee_account_id)
        VALUES(actor,target);
      v_disposition := 'sent';
    ELSE
      UPDATE public.friendships SET requester_account_id=actor, addressee_account_id=target,
        status='pending', request_id=gen_random_uuid(), requested_at=now(), responded_at=NULL, updated_at=now()
        WHERE id=f.id;
      v_disposition := 'sent';
    END IF;
  WHEN 'respond' THEN
    IF payload->>'decision' IS NULL OR payload->>'decision' NOT IN ('accept','decline') THEN RAISE EXCEPTION 'invalid_input'; END IF;
    IF f.id IS NULL OR f.request_id::text IS DISTINCT FROM payload->>'request_id' OR f.status <> 'pending' THEN RAISE EXCEPTION 'request_conflict'; END IF;
    IF f.addressee_account_id <> actor THEN RAISE EXCEPTION 'request_not_allowed'; END IF;
    UPDATE public.friendships SET status=CASE WHEN payload->>'decision'='accept' THEN 'accepted'::public.friendship_status ELSE 'declined'::public.friendship_status END,
      responded_at=now(), updated_at=now() WHERE id=f.id;
    v_disposition := CASE WHEN payload->>'decision'='accept' THEN 'accepted' ELSE 'declined' END;
  WHEN 'cancel' THEN
    IF payload->>'expected_status' IS NULL OR payload->>'expected_status' NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'invalid_input'; END IF;
    IF f.id IS NULL OR f.request_id::text IS DISTINCT FROM payload->>'request_id' OR f.status::text IS DISTINCT FROM payload->>'expected_status' THEN RAISE EXCEPTION 'request_conflict'; END IF;
    IF f.status='pending' AND f.requester_account_id <> actor THEN RAISE EXCEPTION 'request_not_allowed'; END IF;
    UPDATE public.friendships SET status='canceled', responded_at=now(), updated_at=now() WHERE id=f.id;
    v_disposition := CASE WHEN f.status='accepted' THEN 'unfriended' ELSE 'canceled' END;
  WHEN 'block' THEN
    INSERT INTO private.account_blocks(blocker_account_id,blocked_account_id) VALUES(actor,target) ON CONFLICT DO NOTHING;
    UPDATE public.friendships SET status='canceled', responded_at=now(), updated_at=now()
      WHERE id=f.id AND status IN ('pending','accepted');
    v_disposition := 'blocked';
  WHEN 'unblock' THEN
    DELETE FROM private.account_blocks WHERE blocker_account_id=actor AND blocked_account_id=target AND block_id::text=payload->>'block_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'request_conflict'; END IF;
    v_disposition := 'unblocked';
  END CASE;
  UPDATE private.social_receipts SET disposition=v_disposition WHERE actor_id=actor AND operation_id=operation;
  RETURN jsonb_build_object('operation_id',operation,'replayed',false,'disposition',v_disposition)
    || private.social_projection(actor,target);
END $$;
