#!/usr/bin/env node

// Local-only multi-session checks for guest quota atomicity, rotation replay,
// and a room-close/rotation race. pgTAP runs each file in one transaction, so
// these checks use independent psql processes against a loopback database.

import { spawn } from "node:child_process";
import { randomBytes, randomInt, randomUUID } from "node:crypto";

const defaultDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55422/postgres";
let databaseUrl;
try {
  databaseUrl = new URL(
    process.env.DONG_GUEST_TEST_DATABASE_URL ?? defaultDatabaseUrl,
  );
} catch {
  throw new Error(
    "Refusing to run: DONG_GUEST_TEST_DATABASE_URL must be a valid URL targeting local loopback and the postgres database.",
  );
}
const host = databaseUrl.hostname.replace(/^\[|\]$/g, "").toLowerCase();
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

if (!loopbackHosts.has(host) || databaseUrl.pathname !== "/postgres") {
  throw new Error(
    "Refusing to run: DONG_GUEST_TEST_DATABASE_URL must target local loopback and the postgres database.",
  );
}

const psqlPath = process.env.PSQL_PATH ?? "psql";
const psqlEnvironment = {
  ...process.env,
  PGHOST: host,
  PGPORT: databaseUrl.port || "5432",
  PGUSER: decodeURIComponent(databaseUrl.username || "postgres"),
  PGPASSWORD: decodeURIComponent(databaseUrl.password || ""),
  PGDATABASE: "postgres",
  PGSSLMODE: databaseUrl.searchParams.get("sslmode") ?? "disable",
  PGCONNECT_TIMEOUT: "5",
};

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const lines = (value) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const safeDiagnostics = (value) =>
  value
    .replace(/\b[a-f0-9]{64}\b/gi, "[credential-redacted]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[address-redacted]")
    .replace(/guest-concurrency-[\w-]+@test\.local/gi, "[test-email-redacted]")
    .replace(/\bGC[A-F0-9]{4}\b/g, "[join-code-redacted]")
    .trim()
    .split(/\r?\n/)
    .slice(-3)
    .join(" ")
    .slice(0, 320);

const startPsql = (sql, applicationName) => {
  const child = spawn(
    psqlPath,
    ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
    {
      env: { ...psqlEnvironment, PGAPPNAME: applicationName },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 20_000);

  const promise = new Promise((resolve, reject) => {
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`Could not start local psql process: ${error.message}`));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("Local database probe timed out; SQL output was withheld."));
      } else if (code !== 0) {
        const diagnostics = safeDiagnostics(stderr);
        reject(
          new Error(
            `Local psql (${applicationName}) exited with code ${code}.${diagnostics ? ` ${diagnostics}` : ""}`,
          ),
        );
      } else {
        resolve(stdout);
      }
    });
  });

  child.stdin.end(sql);
  return { child, promise, get stderr() { return stderr; } };
};

const query = async (sql, applicationName = `dong-gc-${randomUUID().slice(0, 8)}`) =>
  (await startPsql(sql, applicationName).promise).trim();

const waitForActivity = async (applicationName, predicate, description) => {
  const name = sqlLiteral(applicationName);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const observed = await query(
      `SELECT coalesce((SELECT ${predicate}
        FROM pg_catalog.pg_stat_activity
        WHERE application_name = ${name}
        ORDER BY backend_start DESC LIMIT 1), false)::text;`,
      "dong-gc-observer",
    );
    if (observed === "t" || observed === "true") return;
    await wait(50);
  }
  throw new Error(`Did not observe the expected database lock state: ${description}.`);
};

const parseLastJsonRow = (output, description) => {
  const row = lines(output).findLast((line) => line.startsWith("{"));
  if (!row) throw new Error(`Missing ${description} response from the local database.`);
  try {
    return JSON.parse(row);
  } catch {
    throw new Error(`Invalid ${description} response from the local database.`);
  }
};

const digestExpression = (kind, value) =>
  `encode(extensions.hmac(
    convert_to(${sqlLiteral(`${kind}:${value}`)}, 'UTF8'),
    convert_to(s.decrypted_secret, 'UTF8'), 'sha256'), 'hex')`;

const deleteProbeWindows = async (identities) => {
  if (identities.length === 0) return;
  const targets = identities
    .map(
      ({ kind, value }) =>
        `SELECT ${sqlLiteral(kind)}::text AS kind, ${digestExpression(kind, value)} AS key_digest FROM secret s`,
    )
    .join(" UNION ALL ");
  await query(`
    WITH secret AS (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'dong_guest_abuse_hmac_v1'
    ), targets AS (${targets}), removed AS (
      DELETE FROM private.guest_abuse_windows w USING targets t
      WHERE w.kind = t.kind AND w.key_digest = t.key_digest
      RETURNING 1
    ) SELECT count(*)::text FROM removed;
  `);
};

const createGuestFixture = async (onFixtureCreated) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const joinCode = `GC${suffix.slice(0, 4)}`;
  const displayName = "Concurrency Probe";
  const email = `guest-concurrency-${suffix.toLowerCase()}@test.local`;
  const callerIp = `192.0.2.${randomInt(1, 255)}`;
  const guestToken = randomBytes(32).toString("hex");

  const setupOutput = await query(`
    BEGIN;
    WITH host AS (
      INSERT INTO auth.users
        (id, aud, role, email, email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${sqlLiteral(email)},
        now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
      RETURNING id
    ), account AS (
      INSERT INTO public.accounts (id, username)
      SELECT id, 'Probe' || left(replace(id::text, '-', ''), 20) FROM host RETURNING id
    ), room AS (
      INSERT INTO public.game_sessions (owner_account_id, join_code)
      SELECT id, ${sqlLiteral(joinCode)} FROM account RETURNING id
    )
    SELECT room.id::text || '|' || account.id::text FROM room CROSS JOIN account;
    COMMIT;
  `);

  const [roomId, accountId] = lines(setupOutput).at(-1)?.split("|") ?? [];
  if (!roomId || !accountId) {
    throw new Error("Could not create the isolated local guest-room fixture.");
  }

  const fixture = {
    roomId,
    accountId,
    joinCode,
    callerIp,
    guestToken,
    participantId: null,
    quotaIdentities: [
      { kind: "join_caller", value: callerIp },
      { kind: "join_code", value: joinCode },
    ],
  };
  onFixtureCreated(fixture);

  const joinOutput = await query(`
    BEGIN;
    SET LOCAL request.headers = ${sqlLiteral(JSON.stringify({ "x-dong-guest-caller": callerIp }))};
    SET LOCAL request.jwt.claim.role = 'service_role';
    SELECT public.join_room_as_guest(
      ${sqlLiteral(joinCode)}, ${sqlLiteral(displayName)}, ${sqlLiteral(guestToken)}
    )::text;
    COMMIT;
  `);
  const joinResponse = parseLastJsonRow(joinOutput, "guest join");
  if (!joinResponse.participantId) {
    const allowedCodes = new Set([
      "room_unavailable", "room_not_found", "guest_name_required", "rate_limited",
      "invalid_request", "unknown_error",
    ]);
    const safeReason = allowedCodes.has(joinResponse.code)
      ? joinResponse.code
      : "unexpected-response-shape";
    const safeFields =
      joinResponse && typeof joinResponse === "object"
        ? Object.keys(joinResponse).sort().join(",")
        : typeof joinResponse;
    throw new Error(
      `The isolated local guest fixture could not join (${safeReason}; fields=${safeFields || "none"}).`,
    );
  }
  fixture.participantId = joinResponse.participantId;
  return fixture;
};

const cleanupFixture = async (fixture) => {
  await deleteProbeWindows(fixture.quotaIdentities);
  await query(`
    BEGIN;
    DELETE FROM public.assignment_picks ap USING public.matches m
      WHERE ap.match_id = m.id AND m.session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.assignment_snapshots WHERE session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.assignments WHERE session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.gameplay_command_results WHERE session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.gameplay_events WHERE session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.matches WHERE session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.participants WHERE session_id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.game_sessions WHERE id = ${sqlLiteral(fixture.roomId)}::uuid;
    DELETE FROM public.accounts WHERE id = ${sqlLiteral(fixture.accountId)}::uuid;
    DELETE FROM auth.users WHERE id = ${sqlLiteral(fixture.accountId)}::uuid;
    COMMIT;
  `);
};

const run = async () => {
  const preflight = await query(`
    SELECT (
      current_database() = 'postgres'
      AND to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
      AND to_regclass('private.guest_abuse_windows') IS NOT NULL
      AND EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20260920095616')
    )::text;
  `);
  if (preflight !== "t" && preflight !== "true") {
    throw new Error("The loopback database is not the expected migrated DONG test database.");
  }

  const probeIdentities = [];
  let createdVaultSecretId = null;
  let fixture = null;
  try {
    const hasVaultKey = await query(`SELECT EXISTS (
      SELECT 1 FROM vault.decrypted_secrets WHERE name = 'dong_guest_abuse_hmac_v1'
    )::text;`);
    if (hasVaultKey !== "t" && hasVaultKey !== "true") {
      createdVaultSecretId = await query(`
        SELECT vault.create_secret(
          encode(extensions.gen_random_bytes(32), 'hex'),
          'dong_guest_abuse_hmac_v1'
        )::text;
      `);
      if (!/^[0-9a-f-]{36}$/i.test(createdVaultSecretId)) {
        throw new Error("Could not provision a temporary local-only HMAC test key.");
      }
    }

    const sessions = Number(process.env.GUEST_CONCURRENCY_SESSIONS ?? 24);
    const limit = Number(process.env.GUEST_CONCURRENCY_LIMIT ?? 5);
    if (!Number.isInteger(sessions) || sessions < 8 || sessions > 32) {
      throw new Error("GUEST_CONCURRENCY_SESSIONS must be an integer from 8 through 32.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit >= sessions) {
      throw new Error("GUEST_CONCURRENCY_LIMIT must be a positive integer below the session count.");
    }

    const quotaValue = `local-probe-${randomUUID()}`;
    probeIdentities.push({ kind: "join_caller", value: quotaValue });
    const quotaSql = `
      SELECT pg_sleep(1);
      SELECT coalesce(
        private.take_guest_quota('join_caller', ${sqlLiteral(quotaValue)}, ${limit}, 60)->>'code',
        'accepted'
      );
    `;
    const quotaOutputs = await Promise.all(
      Array.from({ length: sessions }, (_, index) =>
        query(quotaSql, `dong-gc-quota-${index}-${randomUUID().slice(0, 6)}`),
      ),
    );
    const outcomes = quotaOutputs.map((output) => lines(output).at(-1));
    const accepted = outcomes.filter((outcome) => outcome === "accepted").length;
    const limited = outcomes.filter((outcome) => outcome === "rate_limited").length;
    if (accepted !== limit || limited !== sessions - limit) {
      throw new Error("Concurrent quota attempts did not enforce one shared atomic limit.");
    }

    const counterOutput = await query(`
      WITH secret AS (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'dong_guest_abuse_hmac_v1'
      )
      SELECT coalesce(sum(w.count)::text, '0')
      FROM private.guest_abuse_windows w CROSS JOIN secret s
      WHERE w.kind = 'join_caller'
        AND w.key_digest = ${digestExpression("join_caller", quotaValue)};
    `);
    if (counterOutput !== String(sessions)) {
      throw new Error("Concurrent quota counter did not persist every attempt exactly once.");
    }

    fixture = await createGuestFixture((createdFixture) => {
      fixture = createdFixture;
    });
    const replacementToken = randomBytes(32).toString("hex");
    const operationId = randomUUID();
    const tokenHash = `encode(extensions.digest(${sqlLiteral(replacementToken)}, 'sha256'), 'hex')`;
    const advisoryLock = `pg_catalog.hashtextextended(${tokenHash}, 0)`;
    const rotationArgs = `${sqlLiteral(fixture.guestToken)}, ${sqlLiteral(replacementToken)}, ${sqlLiteral(operationId)}::uuid`;
    const rotationHolderName = `dong-gc-rotation-holder-${randomUUID().slice(0, 6)}`;
    const rotationWaiterName = `dong-gc-rotation-waiter-${randomUUID().slice(0, 6)}`;
    const rotationHolder = startPsql(`
      BEGIN;
      SELECT pg_catalog.pg_advisory_xact_lock(${advisoryLock});
      SELECT pg_sleep(3);
      SELECT public.rotate_guest_room_grant(${rotationArgs})::text;
      COMMIT;
    `, rotationHolderName);
    await waitForActivity(rotationHolderName, "wait_event = 'PgSleep'", "rotation lock holder");

    const rotationWaiter = startPsql(
      `SELECT public.rotate_guest_room_grant(${rotationArgs})::text;`,
      rotationWaiterName,
    );
    await waitForActivity(rotationWaiterName, "wait_event_type = 'Lock'", "copied-token rotation retry");
    const [rotationFirstOutput, rotationReplayOutput] = await Promise.all([
      rotationHolder.promise,
      rotationWaiter.promise,
    ]);
    const rotationFirst = parseLastJsonRow(rotationFirstOutput, "first rotation");
    const rotationReplay = parseLastJsonRow(rotationReplayOutput, "rotation replay");
    if (
      rotationFirst.ok !== true || rotationFirst.replayed !== false ||
      rotationReplay.ok !== true || rotationReplay.replayed !== true
    ) {
      throw new Error("Concurrent copied-token rotation did not return one success and one exact replay.");
    }

    const participantState = await query(`
      SELECT (
        p.guest_rejoin_token_hash = encode(extensions.digest(${sqlLiteral(replacementToken)}, 'sha256'), 'hex')
        AND p.guest_grant_previous_hash = encode(extensions.digest(${sqlLiteral(fixture.guestToken)}, 'sha256'), 'hex')
        AND (SELECT count(*) FROM public.gameplay_events e
          WHERE e.session_id = p.session_id AND e.event_type = 'participant_joined') = 1
      )::text
      FROM public.participants p WHERE p.id = ${sqlLiteral(fixture.participantId)}::uuid;
    `);
    if (participantState !== "t" && participantState !== "true") {
      throw new Error("Rotation race changed the final credential tuple or duplicated join history.");
    }

    const raceToken = randomBytes(32).toString("hex");
    const raceOperation = randomUUID();
    const closeHolderName = `dong-gc-close-holder-${randomUUID().slice(0, 6)}`;
    const closeWaiterName = `dong-gc-close-waiter-${randomUUID().slice(0, 6)}`;
    const closeHolder = startPsql(`
      BEGIN;
      UPDATE public.game_sessions SET state = 'closed'::public.session_state
      WHERE id = ${sqlLiteral(fixture.roomId)}::uuid;
      SELECT pg_sleep(3);
      COMMIT;
    `, closeHolderName);
    await waitForActivity(closeHolderName, "wait_event = 'PgSleep'", "terminal room close lock holder");

    const closeWaiter = startPsql(`
      SELECT public.rotate_guest_room_grant(
        ${sqlLiteral(replacementToken)}, ${sqlLiteral(raceToken)}, ${sqlLiteral(raceOperation)}::uuid
      )::text;
    `, closeWaiterName);
    await waitForActivity(closeWaiterName, "wait_event_type = 'Lock'", "rotation waiting on terminal room close");
    const [closeOutput, deniedRotationOutput] = await Promise.all([
      closeHolder.promise,
      closeWaiter.promise,
    ]);
    const deniedRotation = parseLastJsonRow(deniedRotationOutput, "terminal-room rotation");
    if (lines(closeOutput).length !== 0 || deniedRotation.code !== "room_unavailable") {
      throw new Error("A rotation that raced behind room closure was not denied.");
    }

    const terminalState = await query(`
      SELECT (
        gs.state = 'closed'::public.session_state
        AND p.guest_rejoin_token_hash = encode(extensions.digest(${sqlLiteral(replacementToken)}, 'sha256'), 'hex')
        AND p.guest_grant_previous_hash = encode(extensions.digest(${sqlLiteral(fixture.guestToken)}, 'sha256'), 'hex')
        AND p.guest_rejoin_token_hash <> encode(extensions.digest(${sqlLiteral(raceToken)}, 'sha256'), 'hex')
      )::text
      FROM public.game_sessions gs JOIN public.participants p ON p.session_id = gs.id
      WHERE gs.id = ${sqlLiteral(fixture.roomId)}::uuid
        AND p.id = ${sqlLiteral(fixture.participantId)}::uuid;
    `);
    if (terminalState !== "t" && terminalState !== "true") {
      throw new Error("The terminal room state did not win the renewal race.");
    }

    console.log("Local-only guest concurrency probe passed:");
    console.log(`- Quota: ${sessions} simultaneous sessions; ${accepted} accepted, ${limited} limited, counter=${counterOutput}.`);
    console.log("- Rotation: two independent sessions produced one rotation and one exact replay.");
    console.log("- Terminal race: renewal waited behind room closure and returned room_unavailable.");
  } finally {
    const cleanupFailures = [];
    try {
      if (fixture) await cleanupFixture(fixture);
    } catch {
      cleanupFailures.push("room fixture");
    }
    let countersCleaned = false;
    try {
      await deleteProbeWindows([
        ...probeIdentities,
        ...(fixture?.quotaIdentities ?? []),
      ]);
      countersCleaned = true;
    } catch {
      cleanupFailures.push("abuse counters");
    }
    try {
      if (createdVaultSecretId && countersCleaned) {
        await query(`DELETE FROM vault.secrets WHERE id = ${sqlLiteral(createdVaultSecretId)}::uuid RETURNING id::text;`);
      } else if (createdVaultSecretId) {
        cleanupFailures.push("temporary local Vault key retained because counters remain");
      }
    } catch {
      cleanupFailures.push("temporary local Vault key");
    }
    if (cleanupFailures.length > 0) {
      throw new Error(`Local probe cleanup was incomplete: ${cleanupFailures.join(", ")}.`);
    }
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Guest concurrency probe failed.");
  process.exitCode = 1;
});
