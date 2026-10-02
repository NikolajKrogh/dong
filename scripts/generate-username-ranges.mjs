import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/data/unicode-16.0.0/UnicodeData.txt';
const outputPath = 'scripts/data/unicode-16.0.0/letter-number-ranges.sql';
const sourceHash = 'ff58e5823bd095166564a006e47d111130813dcf8bf234ef79fa51a870edb48f';

export function parseRanges(source) {
  const ranges = [];
  let first = null;
  for (const line of source.split(/\r?\n/)) {
    if (!line) continue;
    const [hex, name, category] = line.split(';');
    const codepoint = Number.parseInt(hex, 16);
    if (name.endsWith(', First>')) {
      if (first) throw new Error('Nested Unicode First range');
      first = { codepoint, name: name.slice(0, -8), category };
      continue;
    }
    let start = codepoint;
    if (name.endsWith(', Last>')) {
      if (!first || first.name !== name.slice(0, -7) || first.category !== category) {
        throw new Error('Unpaired Unicode Last range');
      }
      start = first.codepoint;
      first = null;
    } else if (first) {
      throw new Error('Unpaired Unicode First range');
    }
    if (!/^[LN]/.test(category)) continue;
    const previous = ranges.at(-1);
    if (previous && previous[1] + 1 === start) previous[1] = codepoint;
    else ranges.push([start, codepoint]);
  }
  if (first) throw new Error('Unpaired Unicode First range');
  return ranges;
}

export function generate() {
  const source = readFileSync(sourcePath);
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== sourceHash) throw new Error('UnicodeData.txt checksum differs from the pinned Unicode 16.0.0 source');
  const ranges = parseRanges(source.toString('utf8'));
  return `-- Unicode 16.0.0 Letter/Number ranges. Source SHA-256: ${hash}\n` +
    'INSERT INTO private.username_codepoint_ranges (first_codepoint, last_codepoint) VALUES\n' +
    ranges.map(([first, last]) => `  (${first}, ${last})`).join(',\n') + ';\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const generated = generate();
  if (process.argv.includes('--check')) {
    if (readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n') !== generated) {
      throw new Error('Generated Unicode ranges are stale');
    }
    process.stdout.write('Unicode ranges match pinned source.\n');
  } else {
    writeFileSync(outputPath, generated);
    process.stdout.write('Generated Unicode letter/number ranges.\n');
  }
}
