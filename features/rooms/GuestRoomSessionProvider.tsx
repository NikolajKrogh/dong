import React from "react";
import { GuestRoomSessionContext } from "./useGuestRoomSession";
import { useGuestRoomSessionController } from "./useGuestRoomSessionController";

export function GuestRoomSessionProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const session = useGuestRoomSessionController();
  return <GuestRoomSessionContext.Provider value={session}>{children}</GuestRoomSessionContext.Provider>;
}
