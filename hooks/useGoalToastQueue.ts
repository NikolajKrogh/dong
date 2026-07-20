import { useCallback, useEffect, useReducer } from "react";
import Toast from "react-native-toast-message";
import {
  initialToastQueueState,
  toastQueueReducer,
} from "./gameProgress/toastQueueReducer";
import {
  calculateToastScoreDisplay,
  LastGoalInfo,
} from "./gameProgress/goalScoring";

const formatGoalToastMessage = (playersToDrink: string[]) => {
  if (playersToDrink.length === 0) {
    return "";
  }

  if (playersToDrink.length <= 3) {
    return `${playersToDrink.join(", ")} should drink!`;
  }

  return `${playersToDrink.slice(0, 2).join(", ")} and ${
    playersToDrink.length - 2
  } others should drink!`;
};

/**
 * Owns the goal-toast queue: state, the show-next-toast effect, and
 * assembling a toast payload (score display + affected-player message) from
 * a goal event.
 * @param getPlayersWhoDrink Resolves which player names should drink for a
 * given match id; supplied by the caller since it depends on store-derived
 * assignment/common-match data outside this hook's concern.
 */
export function useGoalToastQueue(
  getPlayersWhoDrink: (matchId: string) => string[],
) {
  const [toastState, dispatchToast] = useReducer(
    toastQueueReducer,
    initialToastQueueState,
  );
  const { queue: toastQueue, isToastVisible: isToastCurrentlyVisible } =
    toastState;

  const enqueueGoalToast = useCallback(
    ({
      match,
      matchId,
      team,
      isLiveUpdate,
      newTotal,
      otherTeamScore,
    }: LastGoalInfo) => {
      const { homeScore, awayScore } = calculateToastScoreDisplay(
        match,
        team,
        isLiveUpdate,
        newTotal,
        otherTeamScore,
      );
      const scoreTitle = `${match.homeTeam} ${homeScore}-${awayScore} ${match.awayTeam}`;
      const playersToDrink = getPlayersWhoDrink(matchId);
      const message = formatGoalToastMessage(playersToDrink);

      if (!message) {
        return;
      }

      dispatchToast({
        type: "enqueue",
        toast: {
          type: "success",
          text1: scoreTitle,
          text2: message,
          props: {
            scoringTeam: team,
          },
          position: "bottom",
          visibilityTime: 5000,
        },
      });
    },
    [getPlayersWhoDrink],
  );

  useEffect(() => {
    if (isToastCurrentlyVisible || toastQueue.length === 0) {
      return;
    }

    const toastToShow = toastQueue[0];
    dispatchToast({ type: "showNext" });

    Toast.show({
      ...toastToShow,
      onHide: () => {
        dispatchToast({ type: "hide" });
      },
    });
  }, [toastQueue, isToastCurrentlyVisible]);

  return { enqueueGoalToast };
}
