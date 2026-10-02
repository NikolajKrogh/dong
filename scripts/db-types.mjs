import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function generateTypes() {
  const args = ['node_modules/supabase/dist/supabase.js', 'gen', 'types', 'typescript', '--local', '--schema', 'public'];
  const workdir = process.env.DONG_DB_WORKDIR;
  if (workdir) args.push('--workdir', workdir);
  const source = execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  const parsed = ts.createSourceFile('database.types.ts', source, ts.ScriptTarget.Latest, true);
  if (parsed.parseDiagnostics.length || !source.includes('export type Database =')) {
    throw new Error('Supabase returned invalid database types; tracked file was not changed.');
  }
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(parsed);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync('types/database.types.ts', generateTypes());
}
