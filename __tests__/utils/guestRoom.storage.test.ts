import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
  readAndRemoveLegacyGuestRoomSessionGrant,
  saveGuestRoomSessionGrant,
} from "../../utils/guestRoom";
import { write } from "../../platform/guestCredential";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock("../../platform/guestCredential", () => ({
  read: jest.fn(), write: jest.fn(), clear: jest.fn(), generateToken: jest.fn(),
}));

describe("guest credential migration", () => {
  beforeEach(() => { jest.clearAllMocks(); });

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
