import { execFileSync } from "node:child_process";

const runParser = (fixture: string) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import {parseRanges} from './scripts/generate-username-ranges.mjs'; process.stdout.write(JSON.stringify(parseRanges(${JSON.stringify(fixture)})));`,
      ],
      { encoding: "utf8" },
    ),
  );

it("expands First/Last records and keeps only letter and number categories", () => {
  expect(
    runParser([
      "0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;",
      "0042;LATIN CAPITAL LETTER B;Lu;0;L;;;;;N;;;;0062;",
      "0043;COMBINING ACUTE ACCENT;Mn;230;NSM;;;;;N;;;;;",
      "3400;<CJK Ideograph Extension A, First>;Lo;0;L;;;;;N;;;;;",
      "4DBF;<CJK Ideograph Extension A, Last>;Lo;0;L;;;;;N;;;;;",
      "1D400;MATHEMATICAL BOLD CAPITAL A;Lu;0;L;;;;;N;;;;;",
      "1F100;DIGIT ZERO FULL STOP;No;0;EN;;;;;N;;;;;",
    ].join("\n")),
  ).toEqual([
    [0x41, 0x42],
    [0x3400, 0x4dbf],
    [0x1d400, 0x1d400],
    [0x1f100, 0x1f100],
  ]);
});

it("reproduces the pinned Unicode 16.0.0 SQL without drift", () => {
  expect(() =>
    execFileSync(process.execPath, ["scripts/generate-username-ranges.mjs", "--check"], {
      encoding: "utf8",
    }),
  ).not.toThrow();
});
