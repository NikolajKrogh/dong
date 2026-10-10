import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type FormatResult = { output: string; error?: never } | { error: string; output?: never };

function formatGeneratedTypes(source: string): FormatResult {
  const moduleUrl = pathToFileURL(resolve(__dirname, '../../scripts/db-types.mjs')).href;
  const script = `
    import { formatDatabaseTypes } from ${JSON.stringify(moduleUrl)};
    try {
      process.stdout.write(JSON.stringify({ output: formatDatabaseTypes(${JSON.stringify(source)}) }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ error: error.message }));
    }
  `;
  const result = execFileSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8' });
  return JSON.parse(result) as FormatResult;
}

it('formats an exported Database type alias despite varied whitespace and comments', () => {
  const result = formatGeneratedTypes('/* generated */\nexport\n type\tDatabase\n = { public: {}; };');

  expect(result.output).toContain('export type Database =');
  expect(result.error).toBeUndefined();
});

it.each([
  ['comment', '/* export type Database = */ type Other = {};'],
  ['string literal', 'export const generatedText = "export type Database =";'],
  ['unexported alias', 'type Database = {};'],
  ['malformed source', 'export type Database = {'],
])('rejects source without a valid exported Database alias (%s)', (_kind, source) => {
  expect(formatGeneratedTypes(source).error).toBe(
    'Supabase returned invalid database types; tracked file was not changed.',
  );
});
