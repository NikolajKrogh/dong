import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { apiUrl, identities } from "./e2e-workspace.mjs";

export async function seedEnvironment({ publishableKey, serviceRoleKey, executeSql, databasePassword }) {
  await executeSql(`
    set timezone='UTC';
    update cron.job set active=false;
    select vault.create_secret('${databasePassword}','dong_guest_abuse_hmac_v1');
    create role dong_e2e_catalog login password '${databasePassword}';
    grant match_catalog_backend to dong_e2e_catalog;
    alter role dong_e2e_catalog set statement_timeout='10s';
    update private.provider_budget_state set ownership_mode='catalog',rolling_limit=50,daily_limit=500,new_demand_allowed=true,optional_work_allowed=false where provider='espn';
    insert into private.provider_leagues(provider,league_code,display_name) values ('espn','eng.1','English Premier League'),('espn','eng.2','Championship') on conflict(provider,league_code) do nothing;
    insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,last_successful_check_at,live_due_at,successful_empty)
      select 'espn',league.id,'scoreboard',day::date,now()+interval '1 day',now()+interval '1 day',league.league_code<>'eng.1' or day::date<>current_date
      from private.provider_leagues league cross join generate_series(current_date-1,current_date+7,interval '1 day') day
      where league.league_code in ('eng.1','eng.2') on conflict do nothing;
    insert into private.provider_matches(league_id,source_event_id,home_name,away_name,kickoff_at,kickoff_validity,lifecycle,home_score,away_score,scoreboard_group_id,last_successful_check_at,observed_at,availability)
      select l.id,fixture.event_id,fixture.home,fixture.away,current_date+interval '15 hours 30 minutes','confirmed','scheduled',0,0,g.id,now()+interval '1 day',now(),'available'
      from private.provider_leagues l join private.provider_request_groups g on g.league_id=l.id and g.request_date=current_date
      cross join (values ('e2e-arsenal-chelsea','Arsenal','Chelsea'),('e2e-liverpool-everton','Liverpool','Everton'),('e2e-city-united','Manchester City','Manchester United')) fixture(event_id,home,away)
      where l.league_code='eng.1';
  `);
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let hostAccessToken;
  for (const [email, username] of [[identities.hostEmail, "E2EHost"], [identities.accountEmail, "E2EAccount"]]) {
    const created = await admin.auth.admin.createUser({ email, password: identities.password, email_confirm: true });
    if (created.error) throw new Error(`Could not create local ${username}: ${created.error.message}`);
    const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await client.auth.signInWithPassword({ email, password: identities.password });
    if (signedIn.error) throw new Error(`Local Auth login failed: ${signedIn.error.message}`);
    if (email === identities.hostEmail) hostAccessToken = signedIn.data.session.access_token;
    const header = JSON.parse(Buffer.from(signedIn.data.session.access_token.split('.')[0], 'base64url'));
    if (!['ES256', 'RS256'].includes(header.alg)) throw new Error("Local Auth must issue asymmetric JWTs accepted by Java");
    for (const [rpc, params] of [["bootstrap_account", {}], ["set_account_username", { requested_username: username }]]) {
      const result = await client.rpc(rpc, params);
      if (result.error) throw new Error(`Local ${rpc} failed: ${result.error.message}`);
    }
    await client.auth.signOut();
  }
  return { hostAccessToken };
}
