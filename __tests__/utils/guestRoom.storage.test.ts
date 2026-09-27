import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
  readAndRemoveLegacyGuestRoomSessionGrant,
  saveGuestRoomSessionGrant,
  clearGuestRoomSessionGrant,
} from "../../utils/guestRoom";
import { write, read, clear } from "../../platform/guestCredential";
import { useGameStore } from "../../store/store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock("../../platform/guestCredential", () => ({
  read: jest.fn(), write: jest.fn(), clear: jest.fn(), generateToken: jest.fn(),
}));

describe("guest credential migration", () => {
  beforeEach(() => { useGameStore.setState({ endedGuestSessionId: null }); jest.clearAllMocks(); });

  it("serializes terminal cleanup after an in-flight credential write", async () => {
    let finishWrite!: () => void;
    jest.mocked(write).mockImplementationOnce(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const grant = { guestToken: "secret", participantId: "guest-1", sessionId: "room-1", joinCode: "ROOM42", displayName: "Ada" };
    const saving = saveGuestRoomSessionGrant(grant);
    const rejected = expect(saving).rejects.toMatchObject({ code: "room_ended" });
    await Promise.resolve();
    useGameStore.setState({ endedGuestSessionId: "room-1" });
    jest.mocked(read).mockResolvedValue({ kind: "joined", token: "secret", ...grant });
    const clearing = clearGuestRoomSessionGrant("room-1");
    expect(clear).not.toHaveBeenCalled();
    finishWrite();
    await clearing;
    await rejected;
    expect(clear).toHaveBeenCalled();
  });

  it("does not erase a new room credential when retrying old-room cleanup", async () => {
    jest.mocked(read).mockResolvedValue({ kind: "joined", token: "new-secret", participantId: "p2", sessionId: "room-2", joinCode: "ROOM2", displayName: "Ada" });
    await clearGuestRoomSessionGrant("room-1");
    expect(clear).not.toHaveBeenCalled();
  });

  it("deletes the old key before returning a valid legacy grant", async () => {
    const grant = {
      guestToken: "old-secret", participantId: "guest-1", sessionId: "room-1",
      joinCode: "abc123", displayName: "Ada",
    };
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(grant));
    const read = await readAndRemoveLegacyGuestRoomSessionGrant();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
    expect(read).toEqual({ ...grant, joinCode: "ABC123" });
    expect(write).not.toHaveBeenCalled();
  });

  it("never writes a new bearer to AsyncStorage", async () => {
    await saveGuestRoomSessionGrant({
      guestToken: "new-secret", participantId: "guest-1", sessionId: "room-1",
      joinCode: "ABC123", displayName: "Ada",
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ token: "new-secret", kind: "joined" }));
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
