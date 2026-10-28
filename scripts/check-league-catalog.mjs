import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const leagues = JSON.parse(read('constants/leagueCatalog.json'));
assert.ok(Array.isArray(leagues) && leagues.length > 0, 'League catalog must not be empty');
const codes = new Set();
const defaultOrders = new Set();
const quote = value => `'${value.replaceAll("'", "''")}'`;
for (const league of leagues) {
  assert.match(league.code, /^[a-z0-9._-]{1,80}$/);
  assert.ok(!codes.has(league.code), `Duplicate league: ${league.code}`);
  codes.add(league.code);
  assert.ok(typeof league.name === 'string' && league.name.trim() && league.name.length <= 160);
  assert.ok(typeof league.category === 'string' && league.category.trim() && league.category.length <= 80);
  assert.equal(typeof league.selectedByDefault, 'boolean');
  if (league.defaultOrder !== null) {
    assert.ok(Number.isInteger(league.defaultOrder) && league.defaultOrder >= 0 && !defaultOrders.has(league.defaultOrder));
    defaultOrders.add(league.defaultOrder);
  }
  assert.ok(!league.selectedByDefault || league.defaultOrder !== null, 'Selected defaults must also be configured defaults');
}

// Migrations are release snapshots, not independent runtime catalogs.
const values = leagues.map(league => `  (${quote(league.code)},${quote(league.name)},${quote(league.category)},${league.defaultOrder ?? 'null::integer'},${league.selectedByDefault})`).join(',\n');
if (process.argv.includes('--sql')) {
  console.log(values);
} else {
  const seed = read('supabase/migrations/20261025193835_match_catalog_consumers.sql');
  const seedCodes = [...seed.matchAll(/\('espn','([^']+)','[^']+'\)/g)].map(match => match[1]);
  assert.deepEqual(seedCodes.sort(), [...codes].sort(), 'League identity seed differs from the release catalog');
  const metadata = read('supabase/migrations/20261026190113_league_catalog_metadata.sql').replaceAll('\r\n', '\n');
  const savedValues = metadata.match(/from \(values\n([\s\S]*?)\n\) as metadata/);
  assert.equal(savedValues?.[1], values, 'League metadata snapshot differs; generate its values with --sql');
  console.log(`League catalog and database snapshots agree (${leagues.length} leagues).`);
}
