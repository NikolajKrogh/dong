import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database";
import { createRoomAssignmentTransport } from "../../../features/rooms/roomAssignmentTransport";
jest.mock("../../../lib/supabase", () => ({ getSupabaseClient: jest.fn() }));

const context = { revision: "revision", expectedToken: "token", targetsByParticipantId: { a: 0, b: 1 }, configuration: {
  assignmentPolicyVersion: 2 as const, assignmentMode: "host_assigned" as const, matchesPerPlayer: 1,
  sharedMatchesPerPair: 1, playerMatchCounts: { a: 0 }, assignments: [{ participantId: "b", matchId: "match" }], newMatches: [],
} };
function fixture() {
  const rpc = jest.fn(async () => ({ data: { sessionId: "room" }, error: null }));
  const invoke = jest.fn(async () => ({ data: { proposalId: "proposal", requiresSharingConsent: true }, error: null }));
  const transport = createRoomAssignmentTransport({ rpc, functions: { invoke } } as unknown as SupabaseClient<Database>);
  return { transport, rpc, invoke };
}
it("reviews manual choices without an optimizer or remote reservation", async () => {
  const { transport, invoke } = fixture();
  expect(await transport.prepare({ sessionId: "room", purpose: "start", context })).toMatchObject({
    proposalId: null, assignments: { a: [], b: ["match"] }, targetsByParticipantId: { a: 0, b: 1 }, quality: null,
  });
  expect(invoke).not.toHaveBeenCalled();
  expect(await transport.prepare({ sessionId: "room", purpose: "start", context: { ...context,
    targetsByParticipantId: { a: 0, b: 0 }, configuration: { ...context.configuration, assignments: [] } } }))
    .toMatchObject({ sharingPolicy: "common_only", assignments: { a: [], b: [] } });
});
it("sends automatic drafts only to authenticated preview ingress", async () => {
  const { transport, invoke } = fixture();
  const automatic = { ...context, configuration: { ...context.configuration, assignmentMode: "automatic" as const } };
  await transport.prepare({ sessionId: "room", purpose: "running_save", context: automatic });
  expect(invoke).toHaveBeenCalledWith("room-assignment-preview", { body: {
    sessionId: "room", purpose: "running_save", expectedToken: "token", configuration: automatic.configuration,
  } });
});
it.each(["start", "running_save"] as const)("commits %s using the frozen proposal and consent", async purpose => {
  const { transport, rpc } = fixture();
  await transport.commit({ sessionId: "room", purpose, context, proposalId: "proposal", idempotencyKey: "key", acceptRelaxedSharing: true });
  expect(rpc).toHaveBeenCalledWith(purpose === "start" ? "start_game_session_v2" : "save_running_game_configuration_v2",
    expect.objectContaining({ session_id: "room", proposal_id: "proposal", expected_token: "token", idempotency_key: "key", accept_relaxed_sharing: true }));
});
