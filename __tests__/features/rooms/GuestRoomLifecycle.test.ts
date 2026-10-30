import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";
import { GuestRoomLifecycle } from "../../../features/rooms/GuestRoomLifecycle";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockPath = "/";
let mockStatus = "joined";
let mockSession: ReturnType<typeof buildSession> | null = null;
const mockStore = { endedGuestSessionId: null as string | null,
  activeGameContext: { accessKind: "guest" },
  setPlayers: jest.fn(), setMatches: jest.fn(), setCommonMatchId: jest.fn(),
  setPlayerAssignments: jest.fn(), setActiveGameContext: jest.fn(), resetState: jest.fn() };
const mockRouter = { push: mockPush, replace: mockReplace };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter,
  usePathname: () => mockPath, useRootNavigationState: () => ({ key: "root" }) }));
jest.mock("../../../features/rooms/useGuestRoomSession", () => ({
  useGuestRoomSession: () => ({ session: mockSession, status: mockStatus }) }));
jest.mock("../../../store/gameStore", () => ({
  useGameStore: Object.assign((selector: (state: typeof mockStore) => unknown) => selector(mockStore), { getState: () => mockStore }) }));

const buildSession = (state: string, sessionId = "session-1") => ({
  grant: {
    guestToken: "t",
    participantId: "guest-1",
    sessionId,
    joinCode: "ROOM42",
    displayName: "Casey",
  },
  snapshot: {
    sessionId,
    joinCode: "ROOM42",
    state,
    commonMatchId: "match-1",
    assignmentMode: "automatic",
    participants: [
      {
        id: "guest-1",
        displayName: "Casey",
        membershipType: "guest",
        sessionRole: "member",
        currentDrinkTotal: 0,
      },
    ],
    matches: [
      {
        id: "match-1",
        sourceProvider: "espn",
        sourceMatchId: "e1",
        homeTeamName: "Arsenal",
        awayTeamName: "Chelsea",
        kickoffAt: null,
        // Nullable on the guest snapshot, unlike the registered one.
        homeScore: null,
        awayScore: null,
      },
    ],
    assignments: [{ participantId: "guest-1", matchId: "match-1" }],
    picks: [],
    assignmentPlan: {
      participantCount: 1,
      poolSize: 1,
      matchesPerPlayer: 1,
      sharedMatchesPerPair: 0,
      effectivePerPlayer: 1,
      requiredPoolSize: 2,
      relaxedFloor: 2,
      feasible: false,
      startable: false,
    },
  },
});

beforeEach(() => { jest.clearAllMocks(); mockSession = null; mockPath = "/"; mockStatus = "joined"; mockStore.endedGuestSessionId = null; mockStore.activeGameContext.accessKind = "guest"; });
const mount = () => actCreate(React.createElement(GuestRoomLifecycle));
const update = (tree: TestRenderer.ReactTestRenderer) => TestRenderer.act(() => tree.update(React.createElement(GuestRoomLifecycle)));

it("opens a restored joinable room once, including after returning Home", () => {
  mockSession = buildSession("joinable"); const tree = mount();
  expect(mockPush).toHaveBeenCalledWith("/guestRoom?tab=matches");
  mockPath = "/guestRoom"; update(tree); mockPath = "/"; update(tree);
  expect(mockPush).toHaveBeenCalledTimes(1);
});
it("hydrates and replaces the guest page once on an observed start", () => {
  mockSession = buildSession("joinable"); mockPath = "/guestRoom"; const tree = mount();
  mockSession = buildSession("in_progress"); update(tree); update(tree);
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/gameProgress");
  expect(mockStore.setMatches).toHaveBeenCalledWith([expect.objectContaining({ homeGoals: 0, awayGoals: 0 })]);
  expect(mockStore.setActiveGameContext).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1", accessKind: "guest" }));
});
it("hydrates restored running rooms without forcing gameplay navigation", () => {
  mockSession = buildSession("in_progress"); mount();
  expect(mockStore.setPlayers).toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it("handles a new room identity and ignores ended snapshots", () => {
  mockSession = buildSession("joinable", "a"); const tree = mount();
  mockSession = buildSession("in_progress", "a"); update(tree);
  mockSession = buildSession("joinable", "b"); update(tree);
  mockSession = buildSession("in_progress", "b"); update(tree);
  expect(mockStore.setPlayers).toHaveBeenCalledTimes(2);
  mockStore.endedGuestSessionId = "c"; mockSession = buildSession("in_progress", "c"); update(tree);
  expect(mockStore.setPlayers).toHaveBeenCalledTimes(2);
});
it("keeps pending departure recoverable and navigates only after confirmation", () => {
  mockStatus = "pending_leave"; const tree = mount();
  expect(mockPush).toHaveBeenCalledWith("/guestRoom?tab=matches");
  expect(mockStore.resetState).not.toHaveBeenCalled();
  mockStatus = "left"; update(tree); update(tree);
  expect(mockStore.resetState).toHaveBeenCalledTimes(1); expect(mockReplace).toHaveBeenCalledTimes(1);
});
it("leaves room-ended navigation to the existing owner", () => {
  mockStatus = "ended"; mount(); expect(mockReplace).not.toHaveBeenCalled();
});
it("preserves unrelated gameplay on guest departure", () => {
  mockStatus = "left"; mockStore.activeGameContext.accessKind = "registered"; mount();
  expect(mockStore.resetState).not.toHaveBeenCalled();
});
