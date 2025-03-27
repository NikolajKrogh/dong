import { useState, useEffect, useMemo } from 'react';
import { TeamWithLeague, MatchData, cleanTeamName, isDateInRange, convertTimeToMinutes } from '../utils/matchUtils';
import { Match } from '../app/store';

/**
 * Custom hook for filtering teams based on leagues and matches
 */
export function useTeamFiltering(
  teamsData: TeamWithLeague[],
  selectedLeagues: string[],
  matches: Match[],
  homeTeam: string,
  awayTeam: string
) {
  const [filteredTeamsData, setFilteredTeamsData] = useState<TeamWithLeague[]>(teamsData);

  // Filter teams by selected leagues
  useEffect(() => {
    if (teamsData.length > 0 && selectedLeagues.length > 0) {
      const filtered = teamsData.filter((team) =>
        selectedLeagues.includes(team.league)
      );
      setFilteredTeamsData(filtered);
    } else if (teamsData.length > 0) {
      // If no leagues selected, show all teams
      setFilteredTeamsData(teamsData);
    }
  }, [selectedLeagues, teamsData]);

  // Filter home team options, excluding already used teams
  const homeTeamOptions = useMemo(() => {
    // Get teams already used in existing matches
    const usedTeams = new Set<string>();
    matches.forEach((match) => {
      usedTeams.add(cleanTeamName(match.homeTeam));
      usedTeams.add(cleanTeamName(match.awayTeam));
    });

    return filteredTeamsData.filter(
      (team) =>
        team.value !== awayTeam && // Can't select same team as away
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, awayTeam, matches]);

  // Filter away team options, excluding already used teams
  const awayTeamOptions = useMemo(() => {
    // Get teams already used in existing matches
    const usedTeams = new Set<string>();
    matches.forEach((match) => {
      usedTeams.add(cleanTeamName(match.homeTeam));
      usedTeams.add(cleanTeamName(match.awayTeam));
    });

    return filteredTeamsData.filter(
      (team) =>
        team.value !== homeTeam && // Can't select same team as home
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, homeTeam, matches]);

  return {
    filteredTeamsData,
    setFilteredTeamsData,
    homeTeamOptions,
    awayTeamOptions
  };
}

// Functions for filtering matches by date and time
export function filterMatchesByDateAndTime(
  apiData: MatchData[],
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string
): MatchData[] {
  const hasTimeFilter = Boolean(startTime && endTime);
  const hasDateFilter = Boolean(startDate && endDate);
  
  if (!hasTimeFilter && !hasDateFilter) {
    return apiData;
  }
  
  return apiData.filter((match) => {
    let includeMatch = true;
    
    // Apply date filter if active
    if (hasDateFilter) {
      includeMatch = isDateInRange(match.date ?? "", startDate, endDate);
    }
    
    // Apply time filter if active
    if (includeMatch && hasTimeFilter && match.time) {
      const matchMinutes = convertTimeToMinutes(match.time);
      const startMinutes = convertTimeToMinutes(startTime);
      const endMinutes = convertTimeToMinutes(endTime);
      
      includeMatch = 
        matchMinutes >= startMinutes && matchMinutes <= endMinutes;
    }
    
    return includeMatch;
  });
}