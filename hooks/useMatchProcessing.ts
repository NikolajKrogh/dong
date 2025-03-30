import { useState, useEffect, useCallback, useRef } from "react";
import { MatchData } from "../utils/matchUtils";
import { Match } from "../app/store";

/**
 * @brief Custom hook for reliable batch match processing
 *
 * @details This hook provides functionality to add multiple matches
 * either in batch mode (when setGlobalMatches is provided) or sequentially.
 * It handles duplicate detection, concurrent processing prevention, and
 * provides detailed processing state.
 *
 * @param matches Current list of matches in the game
 * @param setHomeTeam Function to set the home team name in parent component
 * @param setAwayTeam Function to set the away team name in parent component
 * @param handleAddMatch Function to add a new match in parent component
 * @param setGlobalMatches Optional direct state setter for batch processing
 *
 * @return Object containing startProcessing function and state information
 */
export function useMatchProcessing(
  matches: Match[],
  setHomeTeam: (team: string) => void,
  setAwayTeam: (team: string) => void,
  handleAddMatch: () => void,
  setGlobalMatches?: (matches: Match[]) => void
) {
  const [matchesToProcess, setMatchesToProcess] = useState<MatchData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState({
    added: 0,
    skipped: 0,
    total: 0,
  });

  // Use refs to avoid race conditions during asynchronous processing
  const totalMatchesRef = useRef(0);
  const isProcessingMatchRef = useRef(false);
  const matchesRef = useRef(matches);

  // Keep matches ref updated with latest value
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  /**
   * @brief Add multiple matches directly to state in a single operation
   *
   * @details This is the faster path that avoids sequential processing when
   * direct state access is available through setGlobalMatches
   *
   * @param matchesToAdd Array of matches to be added
   */
  const processBatchDirectly = useCallback(
    (matchesToAdd: MatchData[]) => {
      if (!setGlobalMatches || matchesToAdd.length === 0) return;

      // Filter out matches that already exist
      const uniqueMatches = matchesToAdd.filter(
        (match) =>
          !matchesRef.current.some(
            (existing) =>
              (existing.homeTeam === match.team1 &&
                existing.awayTeam === match.team2) ||
              (existing.homeTeam === match.team2 &&
                existing.awayTeam === match.team1)
          )
      );

      if (uniqueMatches.length === 0) return;

      // Convert MatchData to Match format
      const newMatches = uniqueMatches.map((match) => ({
        id: String(Date.now()) + Math.random().toString(36).substr(2, 9),
        homeTeam: match.team1,
        awayTeam: match.team2,
        goals: 0,
      }));

      // Update state directly with all new matches
      setGlobalMatches([...matchesRef.current, ...newMatches]);

      // Update stats
      setProcessingStats({
        added: newMatches.length,
        skipped: matchesToAdd.length - newMatches.length,
        total: matchesToAdd.length,
      });

      // Clean up
      setIsProcessing(false);
      setCurrentIndex(-1);
    },
    [setGlobalMatches, matchesRef]
  );

  /**
   * @brief Process one match at a time, with proper waiting between operations
   *
   * @details This function handles the sequential processing of matches when
   * batch processing is not available. It includes safeguards against race
   * conditions and ensures each match is fully processed before moving to the next.
   */
  const processMatch = useCallback(async () => {
    // Prevent concurrent processing
    if (isProcessingMatchRef.current) return;

    // Skip if not processing or done
    if (currentIndex < 0 || !isProcessing) return;

    // Check if we've reached the end
    if (currentIndex >= totalMatchesRef.current) {
      // Clean up when finished
      setHomeTeam("");
      setAwayTeam("");
      setIsProcessing(false);
      setCurrentIndex(-1);
      return;
    }

    // Mark that we're processing a match
    isProcessingMatchRef.current = true;

    try {
      const match = matchesToProcess[currentIndex];

      // Check if match already exists using the ref for latest matches
      const matchExists = matchesRef.current.some(
        (existing) =>
          (existing.homeTeam === match.team1 &&
            existing.awayTeam === match.team2) ||
          (existing.homeTeam === match.team2 &&
            existing.awayTeam === match.team1)
      );

      if (matchExists) {
        setProcessingStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
        setCurrentIndex((prev) => prev + 1);
        return;
      }

      // Set the teams first
      setHomeTeam(match.team1);
      setAwayTeam(match.team2);

      // Wait for React to update state
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Add the match
      handleAddMatch();

      // Wait for handleAddMatch to complete
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Update stats
      setProcessingStats((prev) => ({ ...prev, added: prev.added + 1 }));

      // Move to next match
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error("Error processing match:", error);
      setCurrentIndex((prev) => prev + 1);
    } finally {
      // Release processing lock
      isProcessingMatchRef.current = false;
    }
  }, [
    currentIndex,
    matchesToProcess,
    handleAddMatch,
    setHomeTeam,
    setAwayTeam,
    isProcessing,
  ]);

  // Process match when currentIndex changes
  useEffect(() => {
    if (isProcessing) {
      const timeoutId = setTimeout(() => {
        processMatch();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [currentIndex, isProcessing, processMatch]);

  /**
   * @brief Start processing a list of matches
   *
   * @details This function initiates match processing, either in batch mode
   * or sequentially depending on available capabilities. It handles filtering
   * of invalid or duplicate matches.
   *
   * @param filteredMatches Array of matches to process
   */
  const startProcessing = useCallback(
    (filteredMatches: MatchData[]) => {
      // Filter valid matches
      const validMatches = filteredMatches.filter(
        (match) => match.team1 && match.team2
      );

      if (validMatches.length === 0) {
        alert("No valid matches to add");
        return;
      }

      // Filter out existing matches
      const uniqueMatches = validMatches.filter(
        (match) =>
          !matchesRef.current.some(
            (existing) =>
              (existing.homeTeam === match.team1 &&
                existing.awayTeam === match.team2) ||
              (existing.homeTeam === match.team2 &&
                existing.awayTeam === match.team1)
          )
      );

      if (uniqueMatches.length === 0) {
        alert("All filtered matches are already in your list");
        return;
      }

      // If we have direct state access, use the faster batch method
      if (setGlobalMatches) {
        processBatchDirectly(uniqueMatches);
        return;
      }

      // Otherwise use the sequential method
      setMatchesToProcess(uniqueMatches);
      totalMatchesRef.current = uniqueMatches.length;
      setProcessingStats({
        added: 0,
        skipped: 0,
        total: uniqueMatches.length,
      });

      // Start processing at the first match
      setIsProcessing(true);
      setCurrentIndex(0);
    },
    [matchesRef, processBatchDirectly, setGlobalMatches]
  );

  return {
    startProcessing,
    isProcessing,
    processingState: {
      isProcessing,
      matchesAdded: processingStats.added,
      matchesSkipped: processingStats.skipped,
      totalToProcess: processingStats.total,
    },
  };
}
