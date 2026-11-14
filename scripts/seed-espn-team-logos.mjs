import { readFileSync } from "node:fs";

const leagueCatalog = JSON.parse(readFileSync(new URL("../constants/leagueCatalog.json", import.meta.url), "utf8"));

// Emit SQL for review and execution by the database operator.
const codes = [...new Set(process.argv.slice(2))];
const supported = new Set(leagueCatalog.map(({ code }) => code));
if (!codes.length || codes.length > 20 || codes.some(code => !supported.has(code))) {
  throw new Error("Supply between 1 and 20 supported league codes.");
}

const logos = new Map();
for (const code of codes) {
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(code)}/teams?limit=500`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`ESPN team list for ${code} returned ${response.status}`);
  const data = await response.json();
  const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
  if (!Array.isArray(teams)) throw new Error(`Invalid ESPN team list for ${code}`);

  for (const { team } of teams) {
    if (typeof team?.id !== "string" || !/^\d{1,128}$/.test(team.id)) continue;
    const image = team.logos?.find(logo => logo.rel?.includes("default")) ?? team.logos?.[0];
    if (typeof image?.href !== "string" || image.href.length > 2048) continue;
    if (!/^https:\/\/(?:[a-z0-9-]+\.)*espncdn\.com\/[^\s]+$/i.test(image.href)) continue;
    if (!logos.has(team.id)) logos.set(team.id, image.href);
  }
}

const literal = value => "'" + value.replaceAll("'", "''") + "'";
console.log("begin;\nset local standard_conforming_strings = on;");
if (logos.size) {
  const rows = [...logos].map(([id, url]) => `(${literal(id)}, ${literal(url)})`);
  console.log(`
with seeded as (
  update private.provider_teams team set logo_url=private.valid_espn_team_logo(seed.url)
  from (values ${rows.join(",\n")}) seed(id, url)
  where team.provider='espn' and team.source_team_id=seed.id and team.logo_url is null
    and private.valid_espn_team_logo(seed.url) is not null
  returning team.id
)
select count(*) as teams_seeded from seeded;`);
}
console.log("select private.backfill_history_team_logos() as history_matches_enriched;\ncommit;");
