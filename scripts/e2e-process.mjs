import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const runnerLockPath = join(tmpdir(), "dong-e2e.runner.lock");

export function acquireRunnerLock(path, worktree) {
  let descriptor;
  try { descriptor = openSync(path, "wx"); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner;
    try { owner = JSON.parse(readFileSync(path, "utf8")); } catch { /* a concurrent owner may still be writing */ }
    throw new Error(`Another E2E runner owns ${path}${owner ? ` (PID ${owner.pid}, ${owner.worktree})` : ""}. Stop that runner first; remove a stale lock only after verifying its process has exited.`);
  }
  const ownership = JSON.stringify({ pid: process.pid, worktree, id: randomUUID() });
  writeFileSync(descriptor, ownership);
  return {
    release() {
      if (readFileSync(path, "utf8") !== ownership) throw new Error("E2E lock ownership changed; refusing to remove another runner's lock");
      closeSync(descriptor);
      unlinkSync(path);
    },
  };
}

export function extractCommandErrorMessage(output) {
  for (const line of output.trim().split(/\r?\n/).reverse()) {
    let error;
    try { error = JSON.parse(line).error; } catch { continue; }
    if (typeof error?.message !== "string") continue;
    return error.message
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, "$1[credentials]@")
      .replace(/\b((?:SUPABASE_[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD)|MATCH_CATALOG_SIGNING_KEYS|apikey|authorization|password|access_token|refresh_token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[redacted]")
      .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g, "[redacted]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
      .slice(0, 2000);
  }
}

export async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`E2E port ${port} is occupied; refusing to reuse another service`)));
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

export async function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) return;
  const closed = new Promise(resolve => child.once("close", resolve));
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", reject);
      killer.once("close", resolve);
    });
    await Promise.race([closed, delay(2000, undefined, { ref: false })]);
    if (child.exitCode === null && child.signalCode === null) throw new Error(`Owned process ${child.pid} did not stop`);
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  await Promise.race([closed, delay(2000, undefined, { ref: false })]);
  // The parent can exit before its workers; kill any remaining members of its owned group.
  try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  await Promise.race([closed, delay(2000, undefined, { ref: false })]);
  if (child.exitCode === null && child.signalCode === null) throw new Error(`Owned process group ${child.pid} did not stop`);
}
