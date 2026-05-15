import { useCallback, useState } from "react";

import {
  type UseGuestRoomSessionResult,
  useGuestRoomSession,
} from "./useGuestRoomSession";

export interface UseGuestRoomJoinResult extends UseGuestRoomSessionResult {
  submitGuestJoin: UseGuestRoomSessionResult["joinRoom"];
  isSubmitting: boolean;
}

export const useGuestRoomJoin = (): UseGuestRoomJoinResult => {
  const sessionState = useGuestRoomSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitGuestJoin = useCallback(
    async (joinCode: string, guestName: string) => {
      setIsSubmitting(true);

      try {
        return await sessionState.joinRoom(joinCode, guestName);
      } finally {
        setIsSubmitting(false);
      }
    },
    [sessionState],
  );

  return {
    ...sessionState,
    submitGuestJoin,
    isSubmitting,
    joinRoom: submitGuestJoin,
  };
};
