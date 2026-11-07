import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { root, workdir, projectId, ports, appUrl, apiUrl, identities, prepareWorkspace, assertWorkspace } from "./e2e-workspace.mjs";
import { seedEnvironment } from "./e2e-seed.mjs";
import { configureGateway } from "./e2e-gateway.mjs";
import { acquireRunnerLock, assertPortAvailable, capturedCommandError, runnerLockPath, stopProcess } from "./e2e-process.mjs";

const serveOnly = process.argv.slice(2).includes("--serve");
const forwardedArgs = process.argv.slice(2).filter(arg => arg !== "--serve");
const children = [];
const logs = join(root, "test-results", "services");
const cli = join(root, "node_modules/supabase/dist/supabase.js");
const environment = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(EXPO_PUBLIC_|SUPABASE_|MATCH_CATALOG_|GOAL_NOTIFICATION|PROVIDER_SCORE_|SPRING_|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$)/.test(name))), CI: "1", EXPO_NO_DOTENV: "1", SUPABASE_TELEMETRY_DISABLED: "1" };
let stackOwned = false;
let cleanupPromise;
let lock;

function command(executable, args, { env = environment, cwd = root, input, name = "setup", capture = false } = {}) {
  const stream = createWriteStream(join(logs, `${name}.log`), { flags: "a" });
  const child = spawn(executable, args, { cwd, env, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
  children.push(child);
  let output = "";
  child.stdout.on("data", chunk => { if (capture) output += chunk; else stream.write(chunk); if (name === "playwright") process.stdout.write(chunk); });
  child.stderr.on("data", chunk => { stream.write(chunk); if (name === "playwright") process.stderr.write(chunk); });
  if (input) child.stdin.end(input); else child.stdin.end();
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => {
      if (code !== 0 && capture) {
        const diagnostic = capturedCommandError(output);
        if (diagnostic) stream.write(`${diagnostic}\n`);
      }
      stream.end();
      if (code === 0) resolve(output);
      else reject(new Error(`${name} exited with ${code}; see test-results/services/${name}.log`));
    });
  });
  // Service exits are observed by readiness checks and cleanup, without unhandled rejections.
  done.catch(() => {});
  return { child, done };
}
const supabase = args => command(process.execPath, [cli, ...args, "--workdir", workdir, "--yes"], { name: "supabase", capture: true }).done;
const executeSql = sql => command("docker", ["exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, name: "seed" }).done;

async function waitFor(url, name, child, request = {}) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`${name} stopped before readiness; inspect service logs`);
    try { if ((await fetch(url, { ...request, signal: AbortSignal.timeout(request.method ? 30_000 : 3000) })).ok) return; } catch { /* startup is still in progress */ }
    await delay(500);
  }
  throw new Error(`${name} did not become ready at ${url}; inspect service logs`);
}
function cleanup() {
  return cleanupPromise ??= (async () => {
    const reportFailure = error => { console.error(error.message); process.exitCode ||= 1; };
    try {
      for (const child of [...children].reverse()) await stopProcess(child).catch(reportFailure);
      if (stackOwned) {
        try { assertWorkspace(); await supabase(["stop", "--no-backup"]); }
        catch (error) { reportFailure(error); }
      }
    } finally {
      try { lock?.release(); } catch (error) { reportFailure(error); }
    }
  })();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => cleanup().finally(() => process.exit(130)));

try {
  mkdirSync(logs, { recursive: true });
  mkdirSync(workdir, { recursive: true });
  lock = acquireRunnerLock(runnerLockPath, root);
  for (const name of ["runner-check", "docker-ports", "supabase", "seed", "edge", "java-build", "java", "expo", "bddgen", "playwright"]) writeFileSync(join(logs, `${name}.log`), "");
  await command(process.execPath, ["--test", "scripts/e2e-workspace.test.mjs"], { name: "runner-check" }).done;
  for (const port of Object.values(ports)) await assertPortAvailable(port);
  const published = await command("docker", ["ps", "--format", "{{.Ports}}"], { name: "docker-ports", capture: true }).done;
  if (Object.values(ports).some(port => published.includes(`:${port}->`))) throw new Error("An E2E port is published by another Docker stack; refusing to reuse it");
  console.log("Preparing isolated dong-e2e services (first startup may download Docker images)…");
  const secrets = prepareWorkspace();
  assertWorkspace();
  stackOwned = true;
  await supabase(["start", "--exclude", "studio,postgres-meta,logflare,vector,supavisor"]);
  await supabase(["db", "reset", "--local"]);
  await configureGateway((executable, args, options) => command(executable, args, options).done);
  const status = JSON.parse(await supabase(["status", "-o", "json"]));
  const anonKey = status.PUBLISHABLE_KEY;
  const serviceKey = status.SERVICE_ROLE_KEY;
  if (!anonKey || !serviceKey || status.API_URL !== apiUrl) throw new Error("Unexpected local Supabase binding or missing local keys");
  const { hostAccessToken } = await seedEnvironment({ anonKey, serviceKey, executeSql, databasePassword: secrets.databasePassword });
  const functionEnv = join(workdir, "functions.env");
  writeFileSync(functionEnv, [
    `MATCH_CATALOG_DATABASE_URL=postgresql://dong_e2e_catalog:${secrets.databasePassword}@db.supabase.internal:5432/postgres`,
    "MATCH_CATALOG_FIXTURES_ONLY=true",
    `MATCH_CATALOG_SIGNING_KEY_ID=e2e`,
    `MATCH_CATALOG_SIGNING_KEYS=${JSON.stringify({ e2e: secrets.catalogSecret })}`,
    `MATCH_CATALOG_ALLOWED_ORIGINS=${appUrl}`,
    `PROVIDER_SCORE_ALLOWED_ORIGINS=${appUrl}`,
  ].join("\n") + "\n");
  const edge = command(process.execPath, [cli, "functions", "serve", "--env-file", functionEnv, "--workdir", workdir], { name: "edge" });
  console.log("Building local Java service…");
  const maven = process.platform === "win32" ? "cmd.exe" : "bash";
  const mavenArgs = process.platform === "win32" ? ["/d", "/s", "/c", "mvnw.cmd -q -DskipTests package"] : ["./mvnw", "-q", "-DskipTests", "package"];
  await command(maven, mavenArgs, { cwd: join(root, "game-api"), name: "java-build" }).done;
  const javaEnvironment = { ...environment, PORT: String(ports.java), SPRING_PROFILES_ACTIVE: "dev", SPRING_CONFIG_IMPORT: "", SUPABASE_URL: apiUrl, SUPABASE_ANON_KEY: anonKey, SUPABASE_JWKS_URL: `${apiUrl}/auth/v1/.well-known/jwks.json` };
  const java = command("java", ["-jar", "target/game-api-0.1.0-SNAPSHOT.jar"], { cwd: join(root, "game-api"), env: javaEnvironment, name: "java" });
  const testEnv = {
    ...environment,
    PLAYWRIGHT_BASE_URL: appUrl,
    E2E_SUPABASE_URL: apiUrl,
    E2E_SUPABASE_PUBLISHABLE_KEY: anonKey,
    E2E_HOST_EMAIL: identities.hostEmail,
    E2E_ACCOUNT_EMAIL: identities.accountEmail,
    E2E_PASSWORD: identities.password,
    EXPO_PUBLIC_SUPABASE_URL: apiUrl,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    EXPO_PUBLIC_GAME_API_URL: `http://127.0.0.1:${ports.java}`,
  };
  const expo = command(process.execPath, ["--dns-result-order=ipv4first", "node_modules/expo/bin/cli", "start", "--web", "--localhost", "--port", String(ports.web), "--clear"], { env: testEnv, name: "expo" });
  await waitFor(`${apiUrl}/auth/v1/.well-known/jwks.json`, "Auth");
  await waitFor(`http://127.0.0.1:${ports.java}/actuator/health`, "Java", java.child);
  const jwtProbe = await fetch(`http://127.0.0.1:${ports.java}/v1/rooms/00000000-0000-4000-8000-000000000000/actions/e2e-readiness`, {
    method: "POST", headers: { Authorization: `Bearer ${hostAccessToken}`, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(10_000),
  });
  if (jwtProbe.status !== 422) throw new Error(`Java did not accept the real local Auth JWT (${jwtProbe.status}); inspect java.log`);
  await waitFor(appUrl, "Expo", expo.child);
  writeFileSync(join(workdir, "runtime.json"), JSON.stringify(Object.fromEntries(Object.entries(testEnv).filter(([key]) => key.startsWith("E2E_") || key === "PLAYWRIGHT_BASE_URL")), null, 2));
  console.log("Waiting for real local match discovery…");
  try {
    await waitFor(`${apiUrl}/functions/v1/discover-matches`, "Edge match discovery", edge.child, { method: "POST", headers: { "Content-Type": "application/json", apikey: anonKey }, body: JSON.stringify({ leagueCodes: ["eng.1"], date: new Date().toISOString().slice(0, 10) }) });
  } catch (error) {
    if (!serveOnly) throw error;
    console.error(`${error.message}. Exploration services remain available for diagnosis.`);
  }
  const guestProbe = await fetch(`${apiUrl}/functions/v1/guest-room-access`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ operation: "join_room_as_guest", args: { join_code: "ZZZZZZ", guest_name: "Readiness Guest", guest_token: "a".repeat(64) } }),
    signal: AbortSignal.timeout(30_000),
  });
  const guestResult = await guestProbe.json();
  if (guestProbe.status !== 200 || guestResult.ok !== false || guestResult.code !== "room_unavailable") throw new Error("Local guest ingress readiness failed; inspect edge.log and gateway.log");
  console.log(`E2E services ready: ${appUrl}`);
  if (serveOnly) {
    console.log("Exploration mode: press Ctrl+C to stop the isolated stack.");
    await new Promise(() => {});
  } else {
    await command(process.execPath, ["node_modules/playwright-bdd/dist/cli/index.js"], { env: testEnv, name: "bddgen" }).done;
    await command(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...forwardedArgs], { env: testEnv, name: "playwright" }).done;
    console.log("E2E happy paths passed.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
