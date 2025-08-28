import { useState, useEffect, useMemo } from "react";
import {
  TeamWithLeague,
  MatchData,
  cleanTeamName,
  convertTimeToMinutes,
} from "../utils/matchUtils";
import { Match } from "../store/store";
import { LeagueEndpoint } from "../constants/leagues";

/**
 * Filter available teams based on league selection and existing matches.
 * @description Returns derived option lists for home/away pickers excluding already used or opposing selections;
 * also exposes the league‑filtered base list.
 * @param teamsData Master list of teams with leagues.
 * @param selectedLeagues Leagues user has selected.
 * @param matches Existing scheduled matches.
 * @param homeTeam Current home team selection (cleaned).
 * @param awayTeam Current away team selection (cleaned).
 * @returns filtered data, setter, and home/away option arrays.
 */
export function useTeamFiltering(
  teamsData: TeamWithLeague[],
  selectedLeagues: LeagueEndpoint[],
  matches: Match[],
  homeTeam: string,
  awayTeam: string
) {
  /** Teams filtered by selected leagues (pre availability filtering). */
  const [filteredTeamsData, setFilteredTeamsData] =
    useState<TeamWithLeague[]>(teamsData);

  /** Update filteredTeamsData when league selection or source data changes. */
  useEffect(() => {
    if (teamsData.length > 0 && selectedLeagues.length > 0) {
      const selectedLeagueNames = selectedLeagues.map((league) => league.name);
      const filtered = teamsData.filter((team) =>
        selectedLeagueNames.includes(team.league)
      );
      setFilteredTeamsData(filtered);
    } else if (teamsData.length > 0) {
      // If no leagues selected, show all teams from the source
      setFilteredTeamsData(teamsData);
    } else {
      // If teamsData is empty, ensure filteredTeamsData is also empty
      setFilteredTeamsData([]);
    }
  }, [selectedLeagues, teamsData]);

  /** Set of cleaned names already used in other matches. */
  const usedTeams = useMemo(() => {
    const teams = new Set<string>();
    matches.forEach((match) => {
      teams.add(cleanTeamName(match.homeTeam));
      teams.add(cleanTeamName(match.awayTeam));
    });
    return teams;
  }, [matches]);

  /** Available home team options excluding picked away and used teams. */
  const homeTeamOptions = useMemo(() => {
    return filteredTeamsData.filter(
      (team) =>
        team.value !== awayTeam && // Can't select same team as away
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, awayTeam, usedTeams]);

  /** Available away team options excluding picked home and used teams. */
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
    awayTeamOptions,
  };
}

/**
 * Filter matches by date and optional time range.
 * @description Returns only matches on selectedDate and within the inclusive time window when both start/end provided;
 * original list when no filters active.
 * @param apiData Input matches.
 * @param selectedDate YYYY-MM-DD date.
 * @param startTime Start time HH:MM.
 * @param endTime End time HH:MM.
 * @returns Filtered matches array.
 */
export function filterMatchesByDateAndTime(
  apiData: MatchData[],
  selectedDate: string,
  startTime: string,
  endTime: string
): MatchData[] {
  const hasTimeFilter = Boolean(startTime && endTime);
  const hasDateFilter = Boolean(selectedDate);

  // Return original data if no filters are applied or if apiData is empty
  if ((!hasTimeFilter && !hasDateFilter) || !apiData || apiData.length === 0) {
    return apiData;
  }

  // Filter the data based on active filters
  return apiData.filter((match) => {
    let includeMatch = true;

    // Apply date filter if active
    if (hasDateFilter) {
      includeMatch = match.date === selectedDate;
    }

    // Apply time filter only if the date filter passed (or wasn't active) and time filter is active
    if (includeMatch && hasTimeFilter) {
      if (match.time) {
        // Ensure match has a time to compare
        const matchMinutes = convertTimeToMinutes(match.time);
        const startMinutes = convertTimeToMinutes(startTime);
        const endMinutes = convertTimeToMinutes(endTime);

        // Check if match time falls within the specified range
        // Also handles cases where time conversion might fail (returns -1)
        if (matchMinutes !== -1 && startMinutes !== -1 && endMinutes !== -1) {
          includeMatch =
            matchMinutes >= startMinutes && matchMinutes <= endMinutes;
        } else {
          // If any time conversion failed, exclude the match for safety or log an error
          includeMatch = false;
        }
      } else {
        // If time filter is active but match has no time, exclude it
        includeMatch = false;
      }
    }
    return includeMatch;
  });
}
