import { useState, useEffect, useCallback, useRef } from "react";
import { MatchData } from "../utils/matchUtils";
import { Match } from "../store/store";

/**
 * Provide reliable batch or sequential match insertion.
 * @description Adds multiple matches via direct batch (if setGlobalMatches provided) or
 * guarded sequential processing with duplicate detection and progress stats.
 * @param matches Current match list.
 * @param setHomeTeam Setter for home team in parent.
 * @param setAwayTeam Setter for away team in parent.
 * @param handleAddMatch Callback to add a single match.
 * @param setGlobalMatches Optional state setter enabling fast batch add.
 * @returns API with startProcessing plus processing state.
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

  const totalMatchesRef = useRef(0);
  const isProcessingMatchRef = useRef(false);
  const matchesRef = useRef(matches);

  const homeTeamRef = useRef("");
  const awayTeamRef = useRef("");

  // Create wrapped setters that update the refs
  const setHomeTeamWithTracking = useCallback(
    (team: string) => {
      homeTeamRef.current = team;
      setHomeTeam(team);
    },
    [setHomeTeam]
  );

  const setAwayTeamWithTracking = useCallback(
    (team: string) => {
      awayTeamRef.current = team;
      setAwayTeam(team);
    },
    [setAwayTeam]
  );

  // Keep matches ref updated with latest value
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  /**
   * Add many matches in one state update when direct setter is available.
   * @description Filters duplicates before conversion to Match objects.
   * @param matchesToAdd Array of raw match data.
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
      const newMatches = uniqueMatches.map((match) => {
        return {
          id: match.id,
          homeTeam: match.team1,
          awayTeam: match.team2,
          homeGoals: 0,
          awayGoals: 0,
          startTime: match.time,
        };
      });

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
   * Sequentially process matches when batch path not available.
   * @description Uses refs and small polling waits to avoid race conditions and confirm insertion before continuing.
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

      // Set up a more robust state-tracking system
      const initialMatchCount = matchesRef.current.length;
      const waitForStateUpdate = async (
        description: string,
        condition: () => boolean,
        maxWait = 2000
      ) => {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          if (condition()) {
            return true;
          }
          // Use shorter polling intervals instead of longer timeouts
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        console.warn(`Timed out waiting for: ${description}`);
        return false;
      };

      // Set the teams first with tracking wrappers
      setHomeTeamWithTracking(match.team1);
      setAwayTeamWithTracking(match.team2);

      // Wait for team state to be set properly
      await waitForStateUpdate(
        "teams to be set",
        () =>
          homeTeamRef.current === match.team1 &&
          awayTeamRef.current === match.team2,
        500 // Allow a bit more time just in case
      );

      // Add the match
      handleAddMatch();

      // Wait for match to be added by observing the matches array length
      const success = await waitForStateUpdate(
        "match to be added",
        () => matchesRef.current.length > initialMatchCount,
        1500
      );

      if (success) {
        // Update stats
        setProcessingStats((prev) => ({ ...prev, added: prev.added + 1 }));
      } else {
        console.warn(`Failed to add match: ${match.team1} vs ${match.team2}`);
      }

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
    setHomeTeamWithTracking,
    setAwayTeamWithTracking,
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
   * Begin processing a collection of candidate matches.
   * @description Chooses fast batch or guarded sequential strategy; filters invalid/duplicate entries.
   * @param filteredMatches Candidate matches ready for insertion.
   */
  const startProcessing = useCallback(
    (filteredMatches: MatchData[]) => {
      // Guard against overlapping invocations
      if (isProcessing) {
        console.warn(
          "Match processing is already in progress, ignoring new request"
        );
        return;
      }

      // Filter valid matches
      const validMatches = filteredMatches.filter(
        (match) => match.team1 && match.team2
      );

      if (validMatches.length === 0) {
        console.warn("No valid matches to add"); // Replace alert with console.warn
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
        console.warn("All filtered matches are already in your list"); // Replace alert with console.warn
        return;
      }

      // If we have direct state access, use the faster batch method
      if (setGlobalMatches) {
        processBatchDirectly(uniqueMatches);
        return;
      }

      // Otherwise use the sequential method
      const newMatchesToProcess = uniqueMatches; // Just use the filtered matches directly

      setMatchesToProcess(newMatchesToProcess);
      totalMatchesRef.current = newMatchesToProcess.length;
      setProcessingStats({
        added: 0,
        skipped: 0,
        total: newMatchesToProcess.length,
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
