import { useState, useEffect } from 'react';
import { MatchData } from '../utils/matchUtils';
import { Match } from '../app/store';

/**
 * Custom hook for processing matches in batches
 */
export function useMatchProcessing(
  matches: Match[],
  setHomeTeam: (team: string) => void,
  setAwayTeam: (team: string) => void,
  handleAddMatch: () => void
) {
  const [matchesToProcess, setMatchesToProcess] = useState<MatchData[]>([]);
  const [processingMatchIndex, setProcessingMatchIndex] = useState<number>(-1);
  const [processingState, setProcessingState] = useState({
    isProcessing: false,
    matchesAdded: 0,
    matchesSkipped: 0,
    totalToProcess: 0,
  });

  // Process matches when processingMatchIndex changes
  useEffect(() => {
    if (
      processingMatchIndex >= 0 &&
      matchesToProcess.length > 0 &&
      processingMatchIndex < matchesToProcess.length
    ) {
      setProcessingState(prev => ({
        ...prev,
        isProcessing: true,
        totalToProcess: matchesToProcess.length,
      }));
      
      const currentMatch = matchesToProcess[processingMatchIndex];

      if (currentMatch.team1 && currentMatch.team2) {
        // Check if this match already exists in the list
        const matchExists = matches.some(
          (existingMatch) =>
            (existingMatch.homeTeam === currentMatch.team1 &&
              existingMatch.awayTeam === currentMatch.team2) ||
            (existingMatch.homeTeam === currentMatch.team2 &&
              existingMatch.awayTeam === currentMatch.team1)
        );

        if (!matchExists) {
          // Only add the match if it doesn't exist
          setHomeTeam(currentMatch.team1);
          setAwayTeam(currentMatch.team2);

          // Use setTimeout to allow state to update before adding match
          setTimeout(() => {
            handleAddMatch();
            processNextMatch(true);
          }, 100);
        } else {
          // Skip existing match and move to next
          processNextMatch(false);
        }
      } else {
        // Skip invalid match
        processNextMatch(false);
      }
    }
  }, [processingMatchIndex, matchesToProcess, matches]);

  const processNextMatch = (wasAdded: boolean) => {
    setTimeout(() => {
      setProcessingState(prev => ({
        ...prev,
        matchesAdded: wasAdded ? prev.matchesAdded + 1 : prev.matchesAdded,
        matchesSkipped: wasAdded ? prev.matchesSkipped : prev.matchesSkipped + 1,
      }));
      
      if (processingMatchIndex < matchesToProcess.length - 1) {
        setProcessingMatchIndex(processingMatchIndex + 1);
      } else {
        // Done processing
        setProcessingMatchIndex(-1);
        setMatchesToProcess([]); // Clear the processing queue
        setHomeTeam("");
        setAwayTeam("");
        setProcessingState(prev => ({
          ...prev,
          isProcessing: false,
        }));
        
        // Provide feedback without alerts
        console.log(`Added all new matches that matched your filters`);
      }
    }, 100);
  };

  const startProcessing = (filteredMatches: MatchData[]) => {
    // Create local copies of filtered matches that contain both teams
    const validMatches = filteredMatches.filter(
      (match) => match.team1 && match.team2
    );

    if (validMatches.length === 0) {
      alert("No valid matches to add");
      return;
    }

    // Reset processing state
    setProcessingState({
      isProcessing: true,
      matchesAdded: 0,
      matchesSkipped: 0,
      totalToProcess: validMatches.length,
    });

    // Store the valid matches for processing
    setMatchesToProcess(validMatches);

    // Start processing at index 0
    setProcessingMatchIndex(0);
  };

  return {
    startProcessing,
    matchesToProcess,
    processingMatchIndex,
    processingState,
  };
}