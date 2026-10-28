import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = resolve(root, '.supabase', 'feature030');
const target = resolve(workdir, 'supabase');
mkdirSync(target, { recursive: true });
// Copy only committed schema inputs, never linked-project metadata or credentials.
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')
  .replace('project_id = "dong"', 'project_id = "dong-feature030"')
  .replaceAll('5532', '5832');
if (!config.includes('project_id = "dong-feature030"') || !config.includes('port = 58322')) {
  throw new Error('Disposable configuration guard failed.');
}
writeFileSync(resolve(target, 'config.toml'), config);
cpSync(resolve(root, 'supabase/migrations'), resolve(target, 'migrations'), { recursive: true });
cpSync(resolve(root, 'supabase/tests'), resolve(target, 'tests'), { recursive: true });
cpSync(resolve(root, 'supabase/functions'), resolve(target, 'functions'), { recursive: true, filter: path => !basename(path).startsWith('.env') });
cpSync(resolve(root, 'types'), resolve(workdir, 'types'), { recursive: true });
mkdirSync(resolve(workdir, 'constants'), { recursive: true });
copyFileSync(resolve(root, 'constants/leagues.ts'), resolve(workdir, 'constants/leagues.ts'));
copyFileSync(resolve(root, 'constants/leagueCatalog.json'), resolve(workdir, 'constants/leagueCatalog.json'));
cpSync(resolve(root, 'shared'), resolve(workdir, 'shared'), { recursive: true });
copyFileSync(resolve(root, 'supabase/seed.sql'), resolve(target, 'seed.sql'));
const fixtureEnv = resolve(root, 'supabase/functions/.env.match-catalog.local');
if (!existsSync(fixtureEnv)) {
  writeFileSync(fixtureEnv, 'MATCH_CATALOG_FIXTURES_ONLY=true\n');
}
console.log(`Prepared ${workdir}; no database started or reset. Acquisition remains disabled.`);
