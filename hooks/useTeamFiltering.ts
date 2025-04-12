import { useState, useEffect, useMemo } from 'react';
import { TeamWithLeague, MatchData, cleanTeamName, isDateInRange, convertTimeToMinutes } from '../utils/matchUtils';
import { Match } from '../app/store';

/**
 * @brief Custom hook for filtering teams based on selected leagues and existing matches.
 * Provides filtered lists of teams suitable for selection as home or away teams,
 * excluding teams already used in other matches or selected for the opposing side.
 * @param {TeamWithLeague[]} teamsData Array of all available teams with their league information.
 * @param {string[]} selectedLeagues Array of league names currently selected for filtering.
 * @param {Match[]} matches Array of matches already created in the game.
 * @param {string} homeTeam The currently selected home team's value (cleaned name).
 * @param {string} awayTeam The currently selected away team's value (cleaned name).
 * @returns An object containing:
 *  - filteredTeamsData: Teams filtered by the selected leagues.
 *  - setFilteredTeamsData: Function to manually update filteredTeamsData (rarely needed externally).
 *  - homeTeamOptions: Available teams for the home side, excluding the selected away team and used teams.
 *  - awayTeamOptions: Available teams for the away side, excluding the selected home team and used teams.
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

  // Memoize the set of used teams (cleaned names) from existing matches
  const usedTeams = useMemo(() => {
    const teams = new Set<string>();
    matches.forEach((match) => {
      teams.add(cleanTeamName(match.homeTeam));
      teams.add(cleanTeamName(match.awayTeam));
    });
    return teams;
  }, [matches]);

  // Filter home team options, excluding already used teams and the current away team
  const homeTeamOptions = useMemo(() => {
    return filteredTeamsData.filter(
      (team) =>
        team.value !== awayTeam && // Can't select same team as away
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, awayTeam, usedTeams]);

  // Filter away team options, excluding already used teams and the current home team
  const awayTeamOptions = useMemo(() => {
    return filteredTeamsData.filter(
      (team) =>
        team.value !== homeTeam && // Can't select same team as home
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, homeTeam, usedTeams]);

  return {
    filteredTeamsData,
    setFilteredTeamsData,
    homeTeamOptions,
    awayTeamOptions
  };
}

/**
 * @brief Filters an array of match data based on specified date and time ranges.
 * @param {MatchData[]} apiData Array of match data objects fetched from an API.
 * @param {string} startDate The start date for filtering (YYYY-MM-DD).
 * @param {string} endDate The end date for filtering (YYYY-MM-DD).
 * @param {string} startTime The start time for filtering (HH:MM).
 * @param {string} endTime The end time for filtering (HH:MM).
 * @returns {MatchData[]} A new array containing only the matches that fall within the specified date and time ranges.
 * If no date or time filters are provided, returns the original array.
 */
export function filterMatchesByDateAndTime(
  apiData: MatchData[],
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string
): MatchData[] {
  const hasTimeFilter = Boolean(startTime && endTime);
  const hasDateFilter = Boolean(startDate && endDate);

  // Return original data if no filters are applied
  if (!hasTimeFilter && !hasDateFilter) {
    return apiData;
  }

  // Filter the data based on active filters
  return apiData.filter((match) => {
    let includeMatch = true;

    // Apply date filter if active
    if (hasDateFilter) {
      // Ensure match.date is valid before checking range
      includeMatch = isDateInRange(match.date ?? "", startDate, endDate);
    }

    // Apply time filter only if the date filter passed (or wasn't active) and time filter is active
    if (includeMatch && hasTimeFilter && match.time) {
      const matchMinutes = convertTimeToMinutes(match.time);
      const startMinutes = convertTimeToMinutes(startTime);
      const endMinutes = convertTimeToMinutes(endTime);

      // Check if match time falls within the specified range
      includeMatch =
        matchMinutes >= startMinutes && matchMinutes <= endMinutes;
    }

    return includeMatch; // Return true if the match passes all active filters
  });
}