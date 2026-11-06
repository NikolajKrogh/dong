create function private.clean_goal_notifications()
returns void language plpgsql security definer set search_path = '' as $$
begin
  with expired as (
    select id from private.goal_notification_deliveries
    where state in ('pending', 'leased')
      and (deadline <= statement_timestamp()
        or (state = 'leased' and attempts = 3 and claim_until <= statement_timestamp()))
    order by due_at limit 100 for update skip locked
  )
  update private.goal_notification_deliveries d
  set state = 'expired', uncertain = d.uncertain or d.authorized_at is not null,
    claim_token = null, claim_until = null
  from expired where d.id = expired.id;

  delete from private.goal_notification_dispatch_wakes
  where id in (select id from private.goal_notification_dispatch_wakes
    where expires_at <= statement_timestamp() order by expires_at limit 100);
  delete from private.goal_notification_deliveries
  where id in (select id from private.goal_notification_deliveries
    where accepted_at <= statement_timestamp() - interval '7 days' order by accepted_at limit 100);

  delete from private.goal_notification_subscriptions
  where invalid_at <= statement_timestamp()
    and installation_id in (select installation_id from private.goal_notification_subscriptions
    where invalid_at <= statement_timestamp() order by invalid_at limit 100);

  delete from private.goal_notification_game_associations b
  where b.installation_id in (
    select a.installation_id from private.goal_notification_game_associations a
    join private.goal_notification_installations i on i.id = a.installation_id
    where not i.consent
      or (a.room_id is not null and private.goal_notification_owner(
        i.owner_kind, a.room_id, i.owner_id, a.auth_session_id, a.guest_digest) is distinct from i.owner_id)
      or (a.solo_grant_id is not null and not exists (
        select from private.solo_tracking_grants s where s.id = a.solo_grant_id and s.ended_at is null
          and s.expires_at > statement_timestamp()
      ))
    order by a.bound_at limit 100 for update of i skip locked
  );
  delete from private.goal_notification_session_scope s
  where (s.room_id, s.participant_id) in (
    select scope.room_id, scope.participant_id from private.goal_notification_session_scope scope
    where not exists (
      select from public.game_sessions g join public.participants p on p.session_id = g.id
      where g.id = scope.room_id and p.id = scope.participant_id and p.left_at is null and g.state = 'in_progress'
    )
    limit 100
  );

  delete from private.goal_notification_installations
  where not consent and revoked_at <= statement_timestamp() - interval '7 days' and id in (
    select id from private.goal_notification_installations
    where not consent and revoked_at <= statement_timestamp() - interval '7 days'
    order by revoked_at limit 100 for update skip locked
  );

  delete from private.goal_notification_apple_authorizations
  where (origin, public_key) in (select origin, public_key from private.goal_notification_apple_authorizations
    where generated_at <= statement_timestamp() - interval '7 days' order by generated_at limit 100);
end;
$$;
revoke all on function private.clean_goal_notifications() from public, anon, authenticated, service_role;
select cron.schedule('dong-goal-notification-cleanup', '*/5 * * * *', 'select private.clean_goal_notifications()');
