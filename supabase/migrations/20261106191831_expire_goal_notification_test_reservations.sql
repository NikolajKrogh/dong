-- Use the same deadline for test replay, provider handoff, and the cooldown.
create or replace function private.reserve_goal_notification_test(
  p_id uuid, p_control bytea, p_generation bigint, p_environment text, p_request uuid,
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_proof_digest bytea
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_installation private.goal_notification_installations%rowtype;
  v_subscription private.goal_notification_subscriptions%rowtype;
  v_owner uuid;
  v_now timestamptz;
  v_previous_deadline timestamptz;
begin
  select * into v_installation from private.goal_notification_installations
  where id = p_id and control_digest = p_control and generation = p_generation
    and consent and environment = p_environment and owner_kind = p_kind
  for update;
  if not found or not private.goal_notification_test_enabled(
    v_installation.target
  ) then return jsonb_build_object('status', 'not_eligible'); end if;
  v_owner := private.goal_notification_owner(p_kind, p_game, p_account, p_auth_session, p_proof_digest);
  if v_owner is distinct from v_installation.owner_id then return jsonb_build_object('status', 'not_eligible'); end if;
  v_now := clock_timestamp();
  v_previous_deadline := v_installation.last_test_at + interval '1 minute';
  if v_installation.last_test_id = p_request then
    return jsonb_build_object('status', case
      when v_installation.last_test_outcome = 'pending' and v_previous_deadline <= v_now
        then 'unconfirmed'
      else v_installation.last_test_outcome
    end);
  end if;
  if v_previous_deadline > v_now then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_subscription from private.goal_notification_subscriptions
  where installation_id = p_id and invalid_at is null;
  if not found then return jsonb_build_object('status', 'not_eligible'); end if;

  update private.goal_notification_installations
  set last_test_id = p_request, last_test_at = v_now, last_test_outcome = 'pending'
  where id = p_id;
  return jsonb_build_object(
    'status', 'reserved', 'target', v_installation.target, 'endpoint', v_subscription.endpoint,
    'p256dh', encode(v_subscription.p256dh, 'hex'), 'authKey', encode(v_subscription.auth_key, 'hex'),
    'vapidKeyId', v_subscription.vapid_key_id, 'deadline', v_now + interval '1 minute'
  );
end;
$$;
