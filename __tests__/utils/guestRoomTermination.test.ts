import { useGameStore } from "../../store/store";
import { clearGuestRoomSessionGrant } from "../../utils/guestRoom";
import { confirmGuestRoomEnded } from "../../utils/guestRoomTermination";

jest.mock("../../utils/guestRoom", () => ({ clearGuestRoomSessionGrant: jest.fn() }));
const clear = jest.mocked(clearGuestRoomSessionGrant);

it("keeps termination cleanup retryable and preserves history", async () => {
  useGameStore.getState().resetState();
  useGameStore.setState({ endedGuestSessionId: null });
  const history = useGameStore.getState().history;
  clear.mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue(undefined);
  await expect(confirmGuestRoomEnded("room-1")).rejects.toThrow("storage unavailable");
  expect(useGameStore.getState().endedGuestSessionId).toBe("room-1");
  await confirmGuestRoomEnded("room-1");
  expect(clear).toHaveBeenCalledTimes(2);
  expect(clear).toHaveBeenLastCalledWith("room-1");
  expect(useGameStore.getState().history).toBe(history);
});

it("ignores a late termination from a room the player already switched away from", async () => {
  useGameStore.setState({ endedGuestSessionId: null });
  useGameStore.getState().setActiveGameContext({ mode: "multiplayer", sessionId: "new-room" });
  clear.mockClear();
  await confirmGuestRoomEnded("old-room");
  expect(clear).not.toHaveBeenCalled();
  expect(useGameStore.getState().endedGuestSessionId).toBeNull();
  expect(useGameStore.getState().activeGameContext.sessionId).toBe("new-room");
});
