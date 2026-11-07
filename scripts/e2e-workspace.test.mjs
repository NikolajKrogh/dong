import assert from "node:assert/strict";
import { test } from "node:test";
import { assertWorkspaceConfig, ports } from "./e2e-workspace.mjs";
import { configureGateway } from "./e2e-gateway.mjs";
import { acquireRunnerLock, assertPortAvailable, capturedCommandError, stopProcess } from "./e2e-process.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { parse, stringify } from "yaml";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("database reset requires both the dedicated project and database port", () => {
  assert.doesNotThrow(() => assertWorkspaceConfig(`project_id = "dong-e2e"\n[db]\nport = ${ports.db}\n`));
  for (const config of [
    `project_id = "dong"\n[db]\nport = ${ports.db}\n`,
    'project_id = "dong-e2e"\n[db]\nport = 55322\n',
    'project_id = "production"\n[db]\nport = 5432\n',
    `project_id = "dong-e2e"\n[api]\nport = ${ports.db}\n[db]\nport = 55322\n`,
    "",
  ]) assert.throws(() => assertWorkspaceConfig(config), /Refusing a reset/);
});

test("an occupied port is rejected without disturbing the existing listener", async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(assertPortAvailable(server.address().port), /occupied/);
    assert.equal(server.listening, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("a competing worktree cannot acquire or remove the owning runner's lock", () => {
  const directory = mkdtempSync(join(tmpdir(), "dong-e2e-lock-check-"));
  const path = join(directory, "runner.lock");
  const owner = acquireRunnerLock(path, "first-worktree");
  try {
    assert.throws(() => acquireRunnerLock(path, "second-worktree"), /Another E2E runner owns/);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).worktree, "first-worktree");
  } finally { owner.release(); rmdirSync(directory); }
  assert.equal(existsSync(path), false);
});

test("captured CLI errors retain the failure reason without credentials", () => {
  const output = JSON.stringify({ error: { message: 'Port occupied; postgresql://fixture:private@localhost/db SUPABASE_SERVICE_ROLE_KEY="private-key" sb_secret_private eyJhbGciOiJIUzI1NiJ9.e30.private' } });
  const message = capturedCommandError(output);
  assert.match(message, /Port occupied/);
  assert.doesNotMatch(message, /fixture|private/);
  assert.equal(capturedCommandError('{"SERVICE_ROLE_KEY":"private"}'), undefined);
});

test("local gateway replaces spoofed caller headers and retains existing transforms", async () => {
  let written;
  const fixture = { services: [{ name: "functions-v1", plugins: [{ name: "request-transformer", config: { add: { headers: ["authorization:Bearer local-fixture", "cf-connecting-ip:203.0.113.10"] } } }] }] };
  await configureGateway(async (_command, args, options) => {
    if (args.includes("cat")) return stringify(fixture);
    if (options.input) written = parse(options.input);
    return "";
  });
  const config = written.services[0].plugins[0].config;
  assert.deepEqual(config.remove.headers, ["cf-connecting-ip"]);
  assert.deepEqual(config.add.headers, ["authorization:Bearer local-fixture", "cf-connecting-ip:127.0.0.1"]);
});

test("cleanup terminates an owned long-lived process", { timeout: 8000 }, async () => {
  const child = spawn(process.execPath, ["-e", 'process.on("SIGTERM",()=>{});console.log("ready");setInterval(()=>{},1000)'], { detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  try {
    await once(child.stdout, "data");
    await stopProcess(child);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});
