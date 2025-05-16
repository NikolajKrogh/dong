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
 * @brief Custom hook for filtering teams based on selected leagues and existing matches.
 *
 * This hook manages the list of teams available for selection in a match setup.
 * It filters teams based on the leagues chosen by the user and ensures that
 * teams already part of an existing match, or selected for the opposing side
 * in the current match being configured, are not available for selection.
 *
 * @param {TeamWithLeague[]} teamsData - An array of all available `TeamWithLeague` objects.
 *                                       This is the master list of teams from which filtering occurs.
 * @param {LeagueEndpoint[]} selectedLeagues - An array of `LeagueEndpoint` objects representing the leagues
 *                                             currently selected by the user for filtering.
 * @param {Match[]} matches - An array of `Match` objects that have already been created/added to the game.
 *                            Used to exclude teams that are already part of these matches.
 * @param {string} homeTeam - The cleaned name of the currently selected home team.
 *                            Used to prevent selecting the same team as the away team.
 * @param {string} awayTeam - The cleaned name of the currently selected away team.
 *                            Used to prevent selecting the same team as the home team.
 *
 * @returns {object} An object containing:
 * @property {TeamWithLeague[]} filteredTeamsData - An array of `TeamWithLeague` objects filtered by the
 *                                                  selected leagues. This list represents teams that match
 *                                                  the league criteria before further filtering for availability
 *                                                  (e.g., excluding used teams).
 * @property {React.Dispatch<React.SetStateAction<TeamWithLeague[]>>} setFilteredTeamsData - A state setter function
 *                                                  to manually update `filteredTeamsData`. This is primarily
 *                                                  for internal use or advanced scenarios where the filtered list
 *                                                  needs to be directly manipulated.
 * @property {TeamWithLeague[]} homeTeamOptions - An array of `TeamWithLeague` objects available for selection
 *                                                as the home team. This list excludes teams already used in
 *                                                other matches and the currently selected away team.
 * @property {TeamWithLeague[]} awayTeamOptions - An array of `TeamWithLeague` objects available for selection
 *                                                as the away team. This list excludes teams already used in
 *                                                other matches and the currently selected home team.
 */
export function useTeamFiltering(
  teamsData: TeamWithLeague[],
  selectedLeagues: LeagueEndpoint[],
  matches: Match[],
  homeTeam: string,
  awayTeam: string
) {
  /**
   * @brief State: Stores teams filtered by the selected leagues.
   * This list is further refined to produce `homeTeamOptions` and `awayTeamOptions`.
   */
  const [filteredTeamsData, setFilteredTeamsData] =
    useState<TeamWithLeague[]>(teamsData);

  /**
   * @brief Effect hook to update `filteredTeamsData` when `selectedLeagues` or `teamsData` changes.
   * If leagues are selected, it filters `teamsData` to include only teams from those leagues.
   * If no leagues are selected, it defaults to showing all `teamsData`.
   * It compares `team.league` (string name) with `league.name` from `selectedLeagues`.
   */
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

  /**
   * @brief Memoized set of cleaned team names that are already used in existing matches.
   * This is used to prevent selecting a team that is already part of another match.
   * Recalculates only when the `matches` array changes.
   * @type {Set<string>}
   */
  const usedTeams = useMemo(() => {
    const teams = new Set<string>();
    matches.forEach((match) => {
      teams.add(cleanTeamName(match.homeTeam));
      teams.add(cleanTeamName(match.awayTeam));
    });
    return teams;
  }, [matches]);

  /**
   * @brief Memoized list of available home team options.
   * Filters `filteredTeamsData` to exclude:
   * 1. The currently selected away team.
   * 2. Teams already used in other matches (from `usedTeams`).
   * Recalculates when `filteredTeamsData`, `awayTeam`, or `usedTeams` change.
   * @type {TeamWithLeague[]}
   */
  const homeTeamOptions = useMemo(() => {
    return filteredTeamsData.filter(
      (team) =>
        team.value !== awayTeam && // Can't select same team as away
        !usedTeams.has(team.value) // Can't select teams already used in other matches
    );
  }, [filteredTeamsData, awayTeam, usedTeams]);

  /**
   * @brief Memoized list of available away team options.
   * Filters `filteredTeamsData` to exclude:
   * 1. The currently selected home team.
   * 2. Teams already used in other matches (from `usedTeams`).
   * Recalculates when `filteredTeamsData`, `homeTeam`, or `usedTeams` change.
   * @type {TeamWithLeague[]}
   */
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
 * @brief Filters an array of match data based on a specified date and optional time range.
 *
 * This function takes a list of matches and filters them based on whether their
 * date matches `selectedDate` and, if time filters are active, whether their
 * time falls within the `startTime` and `endTime` range.
 *
 * @param {MatchData[]} apiData - Array of `MatchData` objects to be filtered.
 *                                These typically come from an API.
 * @param {string} selectedDate - The date to filter by, in "YYYY-MM-DD" format.
 *                                If empty or null, the date filter is not applied.
 * @param {string} startTime - The start of the time range to filter by, in "HH:MM" format.
 *                             If empty or null (along with `endTime`), the time filter is not applied.
 * @param {string} endTime - The end of the time range to filter by, in "HH:MM" format.
 *                           If empty or null (along with `startTime`), the time filter is not applied.
 *
 * @returns {MatchData[]} A new array containing only the matches that meet the
 *                        date and time filter criteria. If no filters are active,
 *                        the original `apiData` array is returned.
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
