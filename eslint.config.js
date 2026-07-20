// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "web-build/",
      "coverage/",
      "test-results/",
      "playwright-report/",
      ".expo/",
      ".features-gen/",
      "android/app/build/",
      "command-api/target/",
      ".tamagui/",
    ],
  },
  {
    // These two files are in-flight on branch 153 (153-configure-start-game)
    // as of the Phase 4 (ESLint 9 upgrade) branch cut and must not be edited
    // by this phase (see specs/019-harden-codebase-foundations/plan.md
    // Technical Context's in-flight file list) — a scoped rule disable
    // stands in for the direct fix (unescaped quote/apostrophe in JSX text)
    // until the owning feature branch merges and normal editing resumes.
    files: ["app/index.tsx", "app/lobby/\\[sessionId\\].tsx"],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
]);
