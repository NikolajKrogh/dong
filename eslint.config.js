// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");

const featureImportPatterns = [
  { group: ["**/app/**"], message: "Features cannot depend on routes." },
  { group: ["account", "friends", "history", "preferences"].map(name => `**/${name}/**`), message: "Use this feature's public index." },
];

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
      ".supabase/",
      ".features-gen/",
      "android/app/build/",
      "game-api/target/",
      ".tamagui/",
    ],
  },
  {
    // Deno resolves npm: specifiers; the Edge typecheck validates these modules.
    files: ["supabase/functions/_shared/football-matches/**/*.ts", "shared/encoding/**/*.ts"],
    rules: { "import/no-unresolved": ["error", { ignore: ["^npm:"] }] },
  },
  {
    // Metro resolves bundled assets through require(), including on native.
    files: ["**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-require-imports": ["warn", { allow: ["\\.(png|jpg|jpeg|gif|webp|json|mp3|wav)$"] }] },
  },
  {
    // Jest factories and post-mock imports must resolve modules at test runtime.
    files: ["__tests__/**/*.{ts,tsx}", "jest.setup.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Keep React Compiler readiness diagnostics visible. The lint command
    // uses --max-warnings 0, so warnings fail the gate just like errors.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    files: ["app/friends/**/*.tsx", "app/userPreferences/profile.tsx", "features/**/*.tsx"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      ...featureImportPatterns,
      { group: ["**/lib/supabase", "@supabase/supabase-js", "**/rooms/roomRpcClient"], message: "Screens use feature hooks/operations, not raw database transport." }
    ] }] }
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["**/app/**", "**/features/**"], message: "Infrastructure cannot depend on features or routes." }] }] }
  },
  {
    files: ["features/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: featureImportPatterns }] },
  },
]);
