import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";
import { useHomeRoomActions } from "../../../features/home/useHomeRoomActions";

const mockRoom = { sessionId: "room-1", participantId: "host", role: "owner", joinCode: "ABC123" };
const mockRefresh = jest.fn();
jest.mock("../../../utils/supabaseClient", () => ({
  getRoomRpcClient: () => ({ getRoomSnapshot: () => new Promise(() => {}) }),
}));
const mockJoin = jest.fn();
const mockStore = {
  activeGameContext: { mode: "multiplayer", sessionId: "room-1" },
  resetState: jest.fn(),
  clearActiveGameContext: jest.fn(),
};
const mockExit = {
  isExiting: false, error: null, pendingSuccessorChoice: false,
  eligibleSuccessors: [], needsCloseConfirm: false, cancel: jest.fn(),
  exitRoom: jest.fn(), confirmSuccessor: jest.fn(), confirmClose: jest.fn(),
};
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../../store/store", () => ({
  useGameStore: Object.assign((selector: (state: typeof mockStore) => unknown) => selector(mockStore), {
    getState: () => mockStore,
  }),
}));
jest.mock("../../../features/account", () => ({ useAccountAuth: () => ({ account: { id: "host" } }) }));
jest.mock("../../../hooks/useMyActiveRoom", () => ({
  useMyActiveRoom: () => ({ activeRoom: mockRoom, refresh: mockRefresh, isLoading: false, error: null }),
}));
jest.mock("../../../hooks/useRoomExit", () => ({ useRoomExit: () => mockExit }));
jest.mock("../../../hooks/useHostRoomCreate", () => ({ useHostRoomCreate: () => ({}) }));
jest.mock("../../../hooks/useRegisteredRoomJoin", () => ({
  useRegisteredRoomJoin: () => ({ conflictRoom: null, clearConflict: jest.fn(), joinRoom: mockJoin }),
}));
jest.mock("../../../hooks/useGuestRoomJoin", () => ({
  useGuestRoomJoin: () => ({ session: null, status: "idle" }),
}));

function mountActions() {
  let actions!: ReturnType<typeof useHomeRoomActions>;
  function Probe() { actions = useHomeRoomActions(); return null; }
  actCreate(React.createElement(Probe));
  return () => actions;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.activeGameContext.sessionId = "room-1";
  mockExit.exitRoom.mockResolvedValue(null);
});

it("keeps a recovered room and local game accessible after a failed or canceled exit", async () => {
  const actions = mountActions();
  TestRenderer.act(() => actions().openRoomExit());
  await TestRenderer.act(async () => { await actions().handleLeaveCurrentAndSwitch(); });
  expect(mockExit.exitRoom).toHaveBeenCalledWith("room-1", "owner");
  expect(actions().roomToLeave).toEqual(mockRoom);
  expect(mockStore.resetState).not.toHaveBeenCalled();
  TestRenderer.act(() => actions().cancelRoomExit());
  expect(actions().roomToLeave).toBeNull();
  expect(actions().activeRoom).toEqual(mockRoom);
  expect(mockRefresh).not.toHaveBeenCalled();
});

it("waits for server exit before clearing local gameplay and refreshing membership", async () => {
  let confirmExit!: (result: object) => void;
  mockExit.exitRoom.mockReturnValue(new Promise(resolve => { confirmExit = resolve; }));
  const actions = mountActions();
  TestRenderer.act(() => actions().openRoomExit());
  let pending!: Promise<void>;
  TestRenderer.act(() => { pending = actions().handleLeaveCurrentAndSwitch(); });
  expect(mockStore.resetState).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
  await TestRenderer.act(async () => { confirmExit({ status: "closed" }); await pending; });
  expect(mockStore.resetState).toHaveBeenCalledTimes(1);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(actions().roomToLeave).toBeNull();
  expect(mockJoin).not.toHaveBeenCalled();
});

it.each(["successor", "close"])("completes a pending host %s without erasing an unrelated game or joining another room", async kind => {
  mockStore.activeGameContext.sessionId = "other-game";
  mockExit.confirmSuccessor.mockResolvedValue({ status: "transferred" });
  mockExit.confirmClose.mockResolvedValue({ status: "closed" });
  const actions = mountActions();
  TestRenderer.act(() => actions().openRoomExit());
  await TestRenderer.act(async () => {
    if (kind === "successor") await actions().handleChooseSuccessorOnHome("new-host");
    else await actions().handleConfirmCloseOnHome();
  });
  expect(mockStore.resetState).not.toHaveBeenCalled();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(actions().roomToLeave).toBeNull();
  expect(mockJoin).not.toHaveBeenCalled();
});
