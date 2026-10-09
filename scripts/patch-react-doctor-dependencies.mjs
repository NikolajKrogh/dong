import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencies = [
  ["@supabase/auth-js", "2.114.0"],
  ["expo-linking", "57.0.9"],
];

for (const [name, version] of dependencies) {
  const packageFile = resolve(root, "node_modules", name, "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  } catch {
    throw new Error(`Cannot verify installed dependency ${name}.`);
  }
  if (packageJson.version !== version) {
    throw new Error(
      `Expected ${name}@${version}; found ${packageJson.version}. Review this patch before upgrading the dependency.`,
    );
  }
}

function patchFile(relativePath, edits) {
  const file = resolve(root, relativePath);
  const original = readFileSync(file, "utf8");
  const lineEnding = original.includes("\r\n") ? "\r\n" : "\n";
  let source = original.replaceAll("\r\n", "\n");
  let changed = false;

  for (const [before, after] of edits) {
    const beforeCount = source.split(before).length - 1;
    const afterCount = source.split(after).length - 1;
    if (beforeCount === 1 && afterCount === 0) {
      source = source.replace(before, after);
      changed = true;
    } else if (beforeCount !== 0 || afterCount === 0) {
      throw new Error(`Unexpected upstream source in ${relativePath}.`);
    }
  }

  if (changed) {
    writeFileSync(file, source.replaceAll("\n", lineEnding));
  }
}

const sourceBroadcastChannelEdit = [
  `this.broadcastChannel?.addEventListener('message', async (event) => {
        this._debug('received broadcast notification from other tab or client', event)`,
  `this.broadcastChannel?.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin) return
        this._debug('received broadcast notification from other tab or client', event)`,
];
const builtBroadcastChannelEdit = [
  `(_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener('message', async (event) => {
                this._debug('received broadcast notification from other tab or client', event);`,
  `(_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener('message', async (event) => {
                if (event.origin !== window.location.origin) return;
                this._debug('received broadcast notification from other tab or client', event);`,
];

patchFile("node_modules/@supabase/auth-js/src/GoTrueClient.ts", [sourceBroadcastChannelEdit]);
for (const file of [
  "node_modules/@supabase/auth-js/dist/module/GoTrueClient.js",
  "node_modules/@supabase/auth-js/dist/main/GoTrueClient.js",
]) {
  patchFile(file, [builtBroadcastChannelEdit]);
}

const rnLinkingEdit = [
  `const nativeListener: NativeURLListener = (nativeEvent) =>
      listener({ url: window.location.href, nativeEvent });`,
  `const nativeListener: NativeURLListener = (nativeEvent) => {
      if (nativeEvent.origin !== window.location.origin) return;
      listener({ url: window.location.href, nativeEvent });
    };`,
];
const expoLinkingEdit = [
  `const nativeListener = (nativeEvent: MessageEvent) =>
      listener({ url: window.location.href, nativeEvent });`,
  `const nativeListener = (nativeEvent: MessageEvent) => {
      if (nativeEvent.origin !== window.location.origin) return;
      listener({ url: window.location.href, nativeEvent });
    };`,
];
const builtLinkingEdit = [
  `const nativeListener = (nativeEvent) => listener({ url: window.location.href, nativeEvent });`,
  `const nativeListener = (nativeEvent) => {
            if (nativeEvent.origin !== window.location.origin) return;
            listener({ url: window.location.href, nativeEvent });
        };`,
];

patchFile("node_modules/expo-linking/src/RNLinking.web.ts", [rnLinkingEdit]);
patchFile("node_modules/expo-linking/src/ExpoLinking.web.ts", [expoLinkingEdit]);
patchFile("node_modules/expo-linking/build/RNLinking.web.js", [builtLinkingEdit]);
patchFile("node_modules/expo-linking/build/ExpoLinking.web.js", [builtLinkingEdit]);

process.stdout.write("Applied same-origin message-handler patches.\n");
