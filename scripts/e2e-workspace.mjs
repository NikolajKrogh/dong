import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const workdir = join(root, ".supabase", "e2e");
export const projectId = "dong-e2e";
export const ports = { api: 60321, db: 60322, shadow: 60320, studio: 60323, mail: 60324, pooler: 60329, inspector: 60330, java: 18080, web: 18093 };
export const appUrl = `http://127.0.0.1:${ports.web}`;
export const apiUrl = `http://127.0.0.1:${ports.api}`;
export const identities = {
  hostEmail: "e2e-host@fixture.invalid",
  accountEmail: "e2e-account@fixture.invalid",
  password: "Local-E2E-password-2026!",
};

export function prepareWorkspace() {
  const target = join(workdir, "supabase");
  if (resolve(target) !== join(root, ".supabase", "e2e", "supabase")) throw new Error("Refusing to replace a workspace outside .supabase/e2e/supabase");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  let config = readFileSync(join(root, "supabase/config.toml"), "utf8")
    .replace(/^project_id = .*$/m, `project_id = "${projectId}"`)
    .replace(/^site_url = .*$/m, `site_url = "${appUrl}"`)
    .replace(/^additional_redirect_urls = .*$/m, `additional_redirect_urls = ["${appUrl}/**"]`)
    .replace(/^# signing_keys_path = .*$/m, 'signing_keys_path = "./signing_keys.json"');
  const replacements = new Map([[55321, ports.api], [55322, ports.db], [55320, ports.shadow], [55323, ports.studio], [55324, ports.mail], [55329, ports.pooler], [55327, 60327], [8083, ports.inspector]]);
  config = config.replace(/^(\s*(?:port|shadow_port|inspector_port)\s*=\s*)(\d+)/gm, (line, prefix, port) => `${prefix}${replacements.get(Number(port)) ?? port}`);
  if (!config.includes(`project_id = "${projectId}"`) || !config.includes(`port = ${ports.db}`) || !config.includes('signing_keys_path = "./signing_keys.json"')) throw new Error("E2E workspace configuration guard failed");
  writeFileSync(join(target, "config.toml"), config);
  for (const name of ["migrations", "functions"]) cpSync(join(root, "supabase", name), join(target, name), { recursive: true, filter: source => !/(?:^|[/\\])\.env[^/\\]*$/.test(source) });
  for (const name of ["types", "shared", "constants"]) {
    const destination = join(workdir, name);
    if (resolve(destination) !== join(root, ".supabase", "e2e", name)) throw new Error("Refusing to replace inputs outside the E2E workspace");
    rmSync(destination, { recursive: true, force: true });
    cpSync(join(root, name), destination, { recursive: true });
  }
  writeFileSync(join(target, "seed.sql"), "-- E2E seeds are installed by scripts/e2e-seed.mjs after Auth is ready.\n");
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const key = { ...privateKey.export({ format: "jwk" }), kid: randomUUID(), use: "sig", alg: "ES256", key_ops: ["sign", "verify"] };
  writeFileSync(join(target, "signing_keys.json"), JSON.stringify([key]));
  return { catalogSecret: randomBytes(32).toString("hex"), databasePassword: randomBytes(24).toString("hex") };
}

export function assertWorkspace() {
  const config = readFileSync(join(workdir, "supabase/config.toml"), "utf8");
  assertWorkspaceConfig(config);
}

export function assertWorkspaceConfig(config) {
  const rootSection = config.split(/^\[/m)[0];
  const databaseSection = config.split(/^\[db\][ \t]*\r?$/m)[1]?.split(/^\[/m)[0] ?? "";
  if (!/^project_id = "dong-e2e"$/m.test(rootSection) || !new RegExp(`^port = ${ports.db}$`, "m").test(databaseSection)) throw new Error("Refusing a reset outside the isolated dong-e2e workspace");
}
