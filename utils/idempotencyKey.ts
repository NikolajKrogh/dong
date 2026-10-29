/** RFC 4122 v4 UUID. No crypto dependency required — this is an idempotency
 * correlation id, not a security credential. */
export const generateIdempotencyKey = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const random = (Math.random() * 16) | 0;
    const value = c === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};
