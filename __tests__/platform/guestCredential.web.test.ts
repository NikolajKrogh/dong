import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  clear,
  generateToken,
  read,
  write,
} from "../../platform/guestCredential/index.web";

const originalCrypto = globalThis.crypto;
const originalWindow = globalThis.window;

const sessionItems = new Map<string, string>();
const sessionStorage = {
  getItem: jest.fn((key: string) => sessionItems.get(key) ?? null),
  setItem: jest.fn((key: string, value: string) => { sessionItems.set(key, value); }),
  removeItem: jest.fn((key: string) => { sessionItems.delete(key); }),
};
const localStorage = { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() };

describe("web guest credential boundary", () => {
  beforeEach(() => {
    sessionItems.clear();
    jest.clearAllMocks();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { isSecureContext: true, sessionStorage, localStorage },
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: originalCrypto });
  });

  it("uses 32 bytes of Web Crypto only on a secure context", async () => {
    await expect(generateToken()).resolves.toBe("07".repeat(32));
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { isSecureContext: false, sessionStorage, localStorage },
    });
    await expect(generateToken()).rejects.toMatchObject({ code: "secure_random_unavailable" });
  });

  it("retains the bearer within the tab session, not localStorage", async () => {
    const record = { kind: "pending_join" as const, token: "secret-token", joinCode: "ABC123", displayName: "Ada" };
    await write(record);
    await expect(read()).resolves.toEqual(record);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    await clear();
    await expect(read()).resolves.toBeNull();
  });

  it("fails closed when browser session storage is unavailable", async () => {
    sessionStorage.setItem.mockImplementationOnce(() => { throw new Error("blocked"); });
    await expect(write({ kind: "pending_join", token: "secret-token", joinCode: "ABC123", displayName: "Ada" })).rejects.toMatchObject({ code: "protected_storage_unavailable" });
  });
});
