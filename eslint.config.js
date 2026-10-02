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
      { group: ["**/app/**"], message: "Features cannot depend on routes." },
      { group: ["**/lib/supabase", "@supabase/supabase-js", "**/utils/supabaseClient"], message: "Screens use feature repositories/hooks, not raw database transport." },
      { group: ["**/features/*/*", "@/features/*/*"], message: "Import another feature through its public index." }
    ] }] }
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["**/app/**", "**/features/**"], message: "Infrastructure cannot depend on features or routes." }] }] }
  },
  ...["account", "friends", "history"].map(feature => ({
    files: [`features/${feature}/**/*.ts`],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["**/app/**"], message: "Features cannot depend on routes." },
      { group: ["account", "friends", "history"].filter(name => name !== feature).flatMap(name => [`../${name}/*`, `**/features/${name}/*`]), message: "Use the other feature's public index." }
    ] }] }
  })),
]);
