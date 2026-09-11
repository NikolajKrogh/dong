// eslint-disable-next-line import/no-unresolved -- Deno resolves npm: specifiers in the Edge runtime.
import { withSupabase } from "npm:@supabase/server@1.5.2";

import {
  buildFetchTargets,
  DEFAULT_ESPN_BASE_URL,
  fetchScoreboards,
  isUuid,
  isUuidV4,
  normalizeProviderResults,
  parseSupportedLeagues,
  type ClaimedProviderMatch,
} from "./provider.ts";

const MAX_BODY_BYTES = 4_096;
const DEFAULT_LOCAL_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:8081",
  "http://localhost:8081",
];

const allowedOrigins = new Set(
  [
    ...DEFAULT_LOCAL_ORIGINS,
    ...(Deno.env.get("PROVIDER_SCORE_ALLOWED_ORIGINS") ?? "").split(","),
  ].map((origin) => origin.trim()).filter(Boolean),
);

const corsHeaders = (origin: string | null) => ({
  ...(origin && allowedOrigins.has(origin)
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : {}),
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, idempotency-key, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const json = (
  body: unknown,
  status: number,
  origin: string | null,
): Response =>
  Response.json(body, {
    status,
    headers: corsHeaders(origin),
  });

const rpcStatus = (message: string): number => {
  if (message.includes("room_not_found")) return 404;
  if (message.includes("not_room_participant")) return 403;
  if (
    message.includes("stale_provider_refresh") ||
    message.includes("idempotency_conflict")
  ) return 409;
  if (
    message.includes("invalid_provider") ||
    message.includes("duplicate_provider") ||
    message.includes("match_not_in_room")
  ) return 422;
  if (message.includes("invalid_room_state")) return 409;
  return 503;
};

const authenticatedHandler = withSupabase(
  { auth: "user", cors: false, errors: { detailed: false } },
  async (request, context) => {
    const origin = request.headers.get("Origin");
    const startedAt = Date.now();
    const requestId = request.headers.get("Idempotency-Key");

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 422, origin);
    }
    const contentType = request.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return json({ error: "invalid_content_type" }, 422, origin);
    }
    const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ error: "request_too_large" }, 422, origin);
    }
    if (!isUuidV4(requestId)) {
      return json({ error: "invalid_idempotency_key" }, 422, origin);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "request_too_large" }, 422, origin);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid_json" }, 422, origin);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).some((key) => key !== "sessionId") ||
      !isUuid((body as { sessionId?: unknown }).sessionId)
    ) {
      return json({ error: "invalid_request" }, 422, origin);
    }

    const sessionId = (body as { sessionId: string }).sessionId;
    const actorId = context.jwtClaims?.sub;
    if (!isUuid(actorId)) {
      return json({ error: "not_authenticated" }, 401, origin);
    }

    const { data: claimData, error: claimError } = await context.supabaseAdmin.rpc(
      "claim_provider_score_refresh",
      {
        session_id: sessionId,
        actor_account_id: actorId,
        request_id: requestId,
      },
    );
    if (claimError) {
      const status = rpcStatus(claimError.message);
      console.warn(JSON.stringify({
        requestId,
        sessionId,
        actorId,
        outcome: status === 403 ? "authorization_failed" : "database_claim_failed",
        durationMs: Date.now() - startedAt,
      }));
      return json(
        { error: claimError.message },
        status,
        origin,
      );
    }

    const claim = claimData as {
      status?: string;
      matches?: ClaimedProviderMatch[];
    } | null;
    if (claim?.status === "not_due") {
      console.info(JSON.stringify({
        requestId,
        sessionId,
        actorId,
        outcome: "not_due",
        durationMs: Date.now() - startedAt,
      }));
      return json({
        sessionId,
        requestId,
        status: "not_due",
        refreshedAt: null,
        results: [],
        warnings: [],
      }, 200, origin);
    }

    const matches = Array.isArray(claim?.matches) ? claim.matches : [];
    const supportedLeagues = parseSupportedLeagues(
      Deno.env.get("PROVIDER_SCORE_LEAGUES"),
    );
    const targets = buildFetchTargets(matches, supportedLeagues);
    const providerResults = await fetchScoreboards(targets, {
      baseUrl: Deno.env.get("PROVIDER_SCORE_ESPN_BASE_URL") ??
        DEFAULT_ESPN_BASE_URL,
    });
    for (const result of providerResults) {
      if (!result.error) continue;
      console.warn(JSON.stringify({
        requestId,
        sessionId,
        actorId,
        leagueCode: result.target.leagueCode,
        date: result.target.date,
        outcome: result.failureReason ?? result.error,
      }));
    }

    if (
      targets.length > 0 &&
      providerResults.every((result) => result.error !== undefined)
    ) {
      console.warn(JSON.stringify({
        requestId,
        sessionId,
        actorId,
        outcome: "provider_unavailable",
        targetCount: targets.length,
        durationMs: Date.now() - startedAt,
      }));
      return json({ error: "provider_unavailable" }, 503, origin);
    }

    const { observations, warnings } = normalizeProviderResults(
      matches,
      providerResults,
    );
    const { data: acceptedData, error: acceptedError } =
      await context.supabaseAdmin.rpc(
        "accept_provider_score_batch_from_edge",
        {
          session_id: sessionId,
          actor_account_id: actorId,
          request_id: requestId,
          observations,
        },
      );
    if (acceptedError) {
      const status = rpcStatus(acceptedError.message);
      console.warn(JSON.stringify({
        requestId,
        sessionId,
        actorId,
        outcome: status === 403 ? "authorization_failed" : "database_commit_failed",
        durationMs: Date.now() - startedAt,
      }));
      return json(
        { error: acceptedError.message },
        status,
        origin,
      );
    }

    const accepted = acceptedData as {
      refreshedAt?: string;
      results?: unknown[];
    } | null;
    const status = warnings.length > 0 ? "partial" : "updated";
    console.info(JSON.stringify({
      requestId,
      sessionId,
      actorId,
      outcome: status,
      targetCount: targets.length,
      observationCount: observations.length,
      warningCount: warnings.length,
      durationMs: Date.now() - startedAt,
    }));
    return json({
      sessionId,
      requestId,
      status,
      refreshedAt: accepted?.refreshedAt ?? new Date().toISOString(),
      results: accepted?.results ?? [],
      warnings,
    }, 200, origin);
  },
);

const fetchHandler = async (request: Request): Promise<Response> => {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "origin_not_allowed" }, 403, null);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  const response = await authenticatedHandler(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export default { fetch: fetchHandler };
