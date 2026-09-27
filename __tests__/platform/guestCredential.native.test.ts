import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clear,
  generateToken,
  read,
  write,
} from "../../platform/guestCredential/index.native";

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const cryptoBytes = jest.mocked(Crypto.getRandomBytesAsync);
const getItem = jest.mocked(SecureStore.getItemAsync);
const setItem = jest.mocked(SecureStore.setItemAsync);
const deleteItem = jest.mocked(SecureStore.deleteItemAsync);

describe("native guest credential boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a 32-byte token from native secure randomness", async () => {
    cryptoBytes.mockResolvedValue(Uint8Array.from({ length: 32 }, (_, i) => i));

    await expect(generateToken()).resolves.toBe(
      Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0")).join(""),
    );
    expect(cryptoBytes).toHaveBeenCalledWith(32);
  });

  it("fails closed when native randomness is absent", async () => {
    cryptoBytes.mockRejectedValue(new Error("native module unavailable"));

    await expect(generateToken()).rejects.toMatchObject({
      code: "secure_random_unavailable",
    });
  });

  it("stores and retrieves a bearer only through SecureStore", async () => {
    const record = { kind: "pending_join" as const, token: "secret-token", joinCode: "ABC123", displayName: "Ada" };
    getItem.mockResolvedValue(JSON.stringify(record));

    await write(record);
    await expect(read()).resolves.toEqual(record);
    await clear();

    expect(setItem).toHaveBeenCalledWith(expect.any(String), JSON.stringify(record));
    expect(deleteItem).toHaveBeenCalledWith(expect.any(String));
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("does not silently fall back when secure storage rejects a write", async () => {
    setItem.mockRejectedValue(new Error("keystore unavailable"));

    await expect(write({ kind: "pending_join", token: "secret-token", joinCode: "ABC123", displayName: "Ada" })).rejects.toMatchObject({
      code: "protected_storage_unavailable",
    });
  });
});
