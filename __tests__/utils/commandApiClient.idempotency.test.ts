import { generateIdempotencyKey } from "../../utils/commandApiClient";

describe("shared idempotency key generation", () => {
  it("generates RFC 4122 UUIDv4 values for shared web and native callers", () => {
    const keys = Array.from({ length: 32 }, () => generateIdempotencyKey());
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    expect(keys.every((key) => uuidV4.test(key))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
