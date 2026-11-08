import type { Page, Route } from "@playwright/test";
import { expect } from "@playwright/test";
import { buildHostRoomCreateResponse, buildHostRoomSnapshot, HOST_ROOM_PARTICIPANT_ID, HOST_ROOM_SESSION_ID,
  mockHostRoomServices, mockConfigureStartGameServices } from "./browser-flow.helpers";
import type { RoomAssignmentInput, RoomSnapshot } from "../../types/room";
const member = "editable-member";
const targets = { [HOST_ROOM_PARTICIPANT_ID]: 2, [member]: 2 };
let snapshot: RoomSnapshot;
let committed: RoomAssignmentInput[] = [];
let generationCount = 0;
const reply = (route: Route, body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });

export async function mockEditableAssignments(page: Page) {
  await mockHostRoomServices(page);
  await mockConfigureStartGameServices(page);
  snapshot = buildHostRoomSnapshot([{ id: member, displayName: "Morgan", membershipType: "registered", sessionRole: "member" }]);
  snapshot = { ...snapshot, state: "joinable", assignmentPolicyVersion: 2, configurationToken: "initial",
    capabilities: { perPlayerMatchCounts: true, assignmentPreview: true, editableAutomaticAssignments: true },
    assignmentMode: "automatic", commonMatchId: "common", assignments: [], picks: [],
    matches: [["common", "Arsenal", "Chelsea"], ["one", "Cardiff City", "Burnley"], ["two", "Preston North End", "Southampton"],
      ["three", "Cagliari", "Lecce"], ["four", "Fulham", "Newcastle United"]].map(([id, homeTeamName, awayTeamName]) => ({
        id, homeTeamName, awayTeamName, sourceProvider: "manual", sourceMatchId: null,
        kickoffAt: "2026-11-07T16:00:00Z", homeScore: 0, awayScore: 0 })),
    assignmentPlan: { ...snapshot.assignmentPlan, matchesPerPlayer: 2, sharedMatchesPerPair: 1, participantCount: 2,
      poolSize: 5, effectivePerPlayer: 2, feasible: true, startable: true, targetsByParticipantId: { ...targets } },
  };
  generationCount = 0;
  committed = [];
  let created = false;
  for (const endpoint of ["create_room_as_host", "create_room_as_host_v2"]) await page.route(`**/rest/v1/rpc/${endpoint}`, async route => {
    created = true; await reply(route, buildHostRoomCreateResponse());
  });
  await page.route("**/rest/v1/rpc/get_my_active_room", route => reply(route, created ? {
    sessionId: HOST_ROOM_SESSION_ID, participantId: HOST_ROOM_PARTICIPANT_ID, role: "owner", joinCode: snapshot.joinCode,
  } : null));
  await page.route("**/rest/v1/rpc/get_room_snapshot", route => reply(route, snapshot));
  await page.route("**/rest/v1/rpc/set_room_assignment_configuration_v2", async route => {
    const body = route.request().postDataJSON().configuration;
    snapshot.assignmentPlan.matchesPerPlayer = body.matchesPerPlayer;
    snapshot.assignmentPlan.targetsByParticipantId = Object.fromEntries(snapshot.participants.map(p => [p.id, body.playerMatchCounts[p.id] ?? body.matchesPerPlayer]));
    snapshot.participants = snapshot.participants.map(p => ({ ...p, additionalMatchCount: body.playerMatchCounts[p.id] ?? null }));
    snapshot.activeRoster = snapshot.participants;
    snapshot.configurationToken += "-change";
    await reply(route, snapshot);
  });
  await page.route("**/functions/v1/room-assignment-preview", async route => {
    generationCount++;
    await reply(route, { proposalId: "proposal", expiresAt: "2099-01-01T00:00:00Z", assignments: {
      [HOST_ROOM_PARTICIPANT_ID]: ["one", "two"], [member]: ["one", "three"] },
      targetsByParticipantId: targets, sharingPolicy: "exact", requiresSharingConsent: false, quality: null });
  });
  for (const name of ["start_game_session_v2", "save_running_game_configuration_v2"]) {
    await page.route(`**/rest/v1/rpc/${name}`, async route => {
      const args = route.request().postDataJSON();
      expect(args.proposal_id).toBeNull();
      committed = args.assignment_overrides;
      expect(committed).toBeInstanceOf(Array);
      snapshot.assignments = [...committed, ...snapshot.participants.map(p => ({ participantId: p.id, matchId: "common" }))];
      snapshot.state = "in_progress";
      snapshot.configurationToken += "-saved";
      await reply(route, snapshot);
    });
  }
}

export const editableAssignmentState = () => ({ snapshot, committed, generationCount });
