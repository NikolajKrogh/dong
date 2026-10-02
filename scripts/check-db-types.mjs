import { readFileSync } from 'node:fs';
import { generateTypes } from './db-types.mjs';

const actual = readFileSync('types/database.types.ts', 'utf8').replaceAll('\r\n', '\n');
if (actual !== generateTypes()) {
  console.error('Database types have drifted. Run npm run db:types against the tested local schema.');
  process.exitCode = 1;
} else {
  console.log('Database types match the local schema.');
}
