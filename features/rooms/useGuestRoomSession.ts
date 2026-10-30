import { createContext, useContext } from "react";
import type { UseGuestRoomSessionResult } from "./useGuestRoomSessionController";

export type { UseGuestRoomSessionResult } from "./useGuestRoomSessionController";

export const GuestRoomSessionContext = createContext<UseGuestRoomSessionResult | null>(null);

export function useGuestRoomSession(): UseGuestRoomSessionResult {
  const session = useContext(GuestRoomSessionContext);
  if (!session) throw new Error("GuestRoomSessionProvider is required");
  return session;
}
