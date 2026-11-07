create or replace function private.disable_goal_notification_installation(
  p_id uuid, p_control bytea, p_generation bigint, p_environment text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_generation bigint;
begin
  select generation into v_generation from private.goal_notification_installations
  where id = p_id and control_digest = p_control and environment = p_environment
  for update;
  if not found or p_generation is null or p_generation < 1 or p_generation > v_generation then return false; end if;
  if p_generation < v_generation then return true; end if;

  update private.goal_notification_installations
  set consent = false, revoked_at = clock_timestamp(), generation = generation + 1
  where id = p_id;
  delete from private.goal_notification_subscriptions where installation_id = p_id;
  return true;
end;
$$;

revoke all on function private.disable_goal_notification_installation(uuid, bytea, bigint, text)
from public, anon, authenticated, service_role;
grant execute on function private.disable_goal_notification_installation(uuid, bytea, bigint, text)
to goal_notification_backend;
