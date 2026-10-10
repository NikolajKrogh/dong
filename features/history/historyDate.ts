import * as z from "zod/mini";

const historyDateSchema = z.pipe(z.string(), z.coerce.date());

export function getHistoryTimestamp(value: unknown): number | null {
  const parsedDate = historyDateSchema.safeParse(value);
  return parsedDate.success ? parsedDate.data.getTime() : null;
}
