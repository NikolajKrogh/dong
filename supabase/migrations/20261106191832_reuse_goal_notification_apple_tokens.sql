create function private.read_goal_notification_apple_authorization(p_origin text, p_key text)
returns text language sql stable security definer set search_path = '' as $$
  select a.vapid_header
  from private.goal_notification_apple_authorizations a
  where a.origin = p_origin and a.public_key = p_key
    and a.generated_at > statement_timestamp() - interval '1 hour';
$$;

revoke all on function private.read_goal_notification_apple_authorization(text, text)
from public, anon, authenticated, service_role;
grant execute on function private.read_goal_notification_apple_authorization(text, text)
to goal_notification_backend;

create or replace function private.cache_goal_notification_apple_authorization(p_origin text, p_key text, p_header text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_header text;
begin
  insert into private.goal_notification_apple_authorizations as a (origin, public_key, vapid_header, generated_at)
  values (p_origin, p_key, p_header, statement_timestamp())
  on conflict (origin, public_key) do update set
    vapid_header = excluded.vapid_header, generated_at = excluded.generated_at
  where a.generated_at <= statement_timestamp() - interval '1 hour'
  returning a.vapid_header into v_header;

  -- A concurrent refresh may have won since the caller read the cache.
  if not found then
    v_header := private.read_goal_notification_apple_authorization(p_origin, p_key);
  end if;
  return v_header;
end;
$$;
