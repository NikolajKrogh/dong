import { generateAssignments } from "../../../shared/assignments/generateAssignments.ts";
import type { AssignmentInput, AssignmentOptimizer, AssignmentResult } from "../../../shared/assignments/types.ts";

interface PreviewRequest {
  sessionId: string;
  purpose: "start" | "running_save";
  expectedToken: string;
  configuration: Record<string, unknown>;
}
interface PreviewDependencies {
  prepare(input: PreviewRequest): Promise<{ proposalId: string; input: AssignmentInput } | Record<string, unknown>>;
  publish(proposalId: string, result: AssignmentResult): Promise<unknown>;
  optimizer?: AssignmentOptimizer;
}

async function readPreviewRequest(request: Request): Promise<PreviewRequest> {
  const maximumBytes = 8 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maximumBytes || !request.body) throw new Error("assignment_capacity_exceeded");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new Error("assignment_capacity_exceeded");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(text); } catch { throw new Error("invalid_configuration"); }
  if (!body || typeof body.sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.sessionId) ||
    !["start", "running_save"].includes(body.purpose) || typeof body.expectedToken !== "string" ||
    !body.expectedToken || !body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration)) {
    throw new Error("invalid_configuration");
  }
  return { sessionId: body.sessionId, purpose: body.purpose, expectedToken: body.expectedToken, configuration: body.configuration };
}

/** Authentication wraps this handler; the user-scoped prepare RPC checks host authority before solving. */
export function createAssignmentPreviewHandler(dependencies: PreviewDependencies): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== "POST") return Response.json({ code: "method_not_allowed" }, { status: 405 });
    try {
      const input = await readPreviewRequest(request);
      const prepared = await dependencies.prepare(input);
      if (!("input" in prepared)) return Response.json(prepared);
      const result = await generateAssignments(prepared.input as AssignmentInput, { optimizer: dependencies.optimizer });
      return Response.json(await dependencies.publish(prepared.proposalId as string, result));
    } catch (error) {
      const message = (error as { message?: string })?.message ?? "";
      const known = ["not_host", "not_authenticated", "configuration_conflict", "invalid_configuration", "invalid_assignment_settings",
        "assignment_capacity_exceeded", "assignment_proposal_superseded", "insufficient_match_pool", "per_player_count_below_minimum"];
      const code = known.includes(message) ? message : "assignment_preview_unavailable";
      let status = 409;
      if (code === "not_host") status = 403;
      else if (code === "not_authenticated") status = 401;
      else if (code === "invalid_configuration" || code === "invalid_assignment_settings") status = 400;
      else if (code === "assignment_capacity_exceeded") status = 413;
      else if (code === "assignment_preview_unavailable") status = 503;
      return Response.json({ code }, { status });
    }
  };
}
