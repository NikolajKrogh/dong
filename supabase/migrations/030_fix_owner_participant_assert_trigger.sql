-- 030_fix_owner_participant_assert_trigger.sql
-- Fix a latent bug in private.assert_session_owner_participant() introduced in 025.
--
-- The function is attached as a DEFERRABLE constraint trigger to BOTH public.participants
-- (which has a session_id column) and public.game_sessions (whose primary key is id, with
-- NO session_id column). It resolved the session id via COALESCE(NEW.session_id, OLD.session_id)
-- in the DECLARE block, which raises `record "new" has no field "session_id"` for every
-- COMMITTED insert/update into game_sessions. It went unnoticed because the deferred trigger
-- only fires at COMMIT, while the pgTAP suite always rolls back.
--
-- Fix: resolve the session id from the triggering table (game_sessions.id vs participants.session_id).

CREATE OR REPLACE FUNCTION private.assert_session_owner_participant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
	v_session_id uuid;
BEGIN
	IF TG_TABLE_NAME = 'game_sessions' THEN
		v_session_id := COALESCE(NEW.id, OLD.id);
	ELSE
		v_session_id := COALESCE(NEW.session_id, OLD.session_id);
	END IF;

	IF v_session_id IS NULL THEN
		RETURN COALESCE(NEW, OLD);
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.game_sessions game_sessions
		WHERE game_sessions.id = v_session_id
			AND NOT EXISTS (
				SELECT 1
				FROM public.participants participants
				WHERE participants.session_id = game_sessions.id
					AND participants.account_id = game_sessions.owner_account_id
					AND participants.session_role = 'owner'::public.participant_session_role
					AND participants.membership_type = 'registered'::public.participant_membership_type
			)
	) THEN
		RAISE EXCEPTION 'session owner must remain a registered owner participant for session %',
			v_session_id;
	END IF;

	RETURN COALESCE(NEW, OLD);
END;
$$;
