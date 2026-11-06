create function private.repair_goal_notification_subscription(
  p_id uuid, p_control bytea, p_generation bigint, p_environment text, p_target text,
  p_kind text, p_game uuid, p_account uuid, p_auth_session uuid, p_proof bytea,
  p_endpoint text, p_key bytea, p_auth_key bytea, p_vapid_key_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  i private.goal_notification_installations%rowtype;
  sub private.goal_notification_subscriptions%rowtype;
begin
  select * into i from private.goal_notification_installations
  where id = p_id and control_digest = p_control and generation = p_generation and consent
    and environment = p_environment and target = p_target and owner_kind = p_kind
  for update;
  if not found or not coalesce(private.goal_notification_enrollment_enabled(p_target), false)
    or private.goal_notification_owner(p_kind, p_game, p_account, p_auth_session, p_proof) is distinct from i.owner_id
  then return false; end if;

  select * into sub from private.goal_notification_subscriptions where installation_id = p_id;
  if found and (sub.endpoint, sub.p256dh, sub.auth_key, sub.vapid_key_id)
    is not distinct from (p_endpoint, p_key, p_auth_key, p_vapid_key_id) then
    return sub.invalid_at is null;
  end if;

  begin
    insert into private.goal_notification_subscriptions (installation_id, endpoint, p256dh, auth_key, vapid_key_id)
    values (p_id, p_endpoint, p_key, p_auth_key, p_vapid_key_id)
    on conflict (installation_id) do update set endpoint = excluded.endpoint, p256dh = excluded.p256dh,
      auth_key = excluded.auth_key, vapid_key_id = excluded.vapid_key_id, invalid_at = null;
    update private.goal_notification_installations set last_test_id = null, last_test_outcome = null where id = p_id;
    update private.goal_notification_game_associations set revision = revision + 1, bound_at = clock_timestamp()
    where installation_id = p_id;
    perform private.refresh_goal_notification_boundaries(p_id);
  exception when unique_violation then
    return false;
  end;
  return true;
end;
$$;

revoke all on function private.repair_goal_notification_subscription(uuid, bytea, bigint, text, text,
  text, uuid, uuid, uuid, bytea, text, bytea, bytea, text) from public, anon, authenticated, service_role;
grant execute on function private.repair_goal_notification_subscription(uuid, bytea, bigint, text, text,
  text, uuid, uuid, uuid, bytea, text, bytea, bytea, text) to goal_notification_backend;
