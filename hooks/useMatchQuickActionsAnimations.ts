import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { Match } from "../store/store";
import { MatchWithScore } from "../types/matchScores";

interface UseMatchQuickActionsAnimationsParams {
  isVisible: boolean;
  match: Match | null | undefined;
  liveMatchData: MatchWithScore | undefined;
  isApiControlledMatch: boolean;
}

/**
 * Owns the 8 Animated.Value refs used by MatchQuickActionsModal plus the
 * effects that drive them: the modal entry animation, and the home/away
 * goal-value "pop" animation triggered whenever the displayed score changes
 * (from either manual updates or live API data).
 */
export function useMatchQuickActionsAnimations({
  isVisible,
  match,
  liveMatchData,
  isApiControlledMatch,
}: UseMatchQuickActionsAnimationsParams) {
  const [closeButtonAnim] = useState(() => new Animated.Value(1));
  const [goalValueAnimHome] = useState(() => new Animated.Value(1));
  const [goalValueAnimAway] = useState(() => new Animated.Value(1));
  const [modalContentAnim] = useState(() => new Animated.Value(0));
  const [incrementAnimHome] = useState(() => new Animated.Value(1));
  const [decrementAnimHome] = useState(() => new Animated.Value(1));
  const [incrementAnimAway] = useState(() => new Animated.Value(1));
  const [decrementAnimAway] = useState(() => new Animated.Value(1));

  const prevGoalsHomeRef = useRef(match?.homeGoals ?? 0);
  const prevGoalsAwayRef = useRef(match?.awayGoals ?? 0);

  /**
   * Run press animation on a control button.
   * @param {Animated.Value} buttonAnim Animated value controlling scale.
   */
  const animateButtonPress = (buttonAnim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(buttonAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /** Entry animation when modal becomes visible. */
  useEffect(() => {
    if (isVisible && match) {
      Animated.timing(modalContentAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    // Reset animation when closing
    return () => {
      if (!isVisible) {
        modalContentAnim.setValue(0);
      }
    };
  }, [isVisible, match, modalContentAnim]);

  /** Animate home goals when the displayed value changes. */
  useEffect(() => {
    // Get the current score (prioritize live data if available)
    const currentScore = isApiControlledMatch
      ? liveMatchData?.homeScore ?? 0
      : match?.homeGoals ?? 0;

    if (prevGoalsHomeRef.current !== currentScore) {
      // Run animation
      Animated.sequence([
        Animated.timing(goalValueAnimHome, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(goalValueAnimHome, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      prevGoalsHomeRef.current = currentScore;
    }
  }, [
    match?.homeGoals,
    liveMatchData?.homeScore,
    isApiControlledMatch,
    goalValueAnimHome,
    liveMatchData,
  ]); // Added goalValueAnimHome and liveMatchData to dependency array

  /** Animate away goals when the displayed value changes. */
  useEffect(() => {
    // Get the current score (prioritize live data if available)
    const currentScore = isApiControlledMatch
      ? liveMatchData?.awayScore ?? 0
      : match?.awayGoals ?? 0;

    if (prevGoalsAwayRef.current !== currentScore) {
      // Run animation
      Animated.sequence([
        Animated.timing(goalValueAnimAway, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(goalValueAnimAway, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      prevGoalsAwayRef.current = currentScore;
    }
  }, [
    match?.awayGoals,
    liveMatchData?.awayScore,
    isApiControlledMatch,
    goalValueAnimAway,
    liveMatchData,
  ]); // Added goalValueAnimAway and liveMatchData to dependency array

  return {
    closeButtonAnim,
    goalValueAnimHome,
    goalValueAnimAway,
    modalContentAnim,
    incrementAnimHome,
    decrementAnimHome,
    incrementAnimAway,
    decrementAnimAway,
    animateButtonPress,
  };
}
