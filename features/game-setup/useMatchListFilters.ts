import { useCallback, useMemo, useReducer } from "react";
import { formatTeamOptionName } from "../football-matches/teamNames";

import { LeagueEndpoint } from "../../constants/leagues";
import { formatDateIsoValue } from "../../platform/date-input/normalizeValue";
import { TeamWithLeague } from "../football-matches/matchFilters";

const DEFAULT_SELECTED_LEAGUES: LeagueEndpoint[] = [
  { name: "Premier League", code: "eng.1" },
  { name: "Championship", code: "eng.2" },
];

interface MatchListFiltersOptions {
  storedDefaultLeagues: LeagueEndpoint[];
  allTeamsData: TeamWithLeague[];
}

interface MatchListFilterState {
  selectedDate: string;
  selectedLeagues: LeagueEndpoint[];
  startTime: string;
  endTime: string;
  customTeams: TeamWithLeague[];
}

type MatchListFilterAction =
  | { type: "setSelectedDate"; value: string }
  | { type: "setStartTime"; value: string }
  | { type: "setEndTime"; value: string }
  | { type: "toggleLeague"; league: LeagueEndpoint }
  | { type: "syncLeagues"; leagues: LeagueEndpoint[] }
  | { type: "addCustomTeam"; team: TeamWithLeague };

const getInitialSelectedLeagues = (storedDefaultLeagues: LeagueEndpoint[]) => {
  if (Array.isArray(storedDefaultLeagues) && storedDefaultLeagues.length > 0) {
    return storedDefaultLeagues;
  }

  return DEFAULT_SELECTED_LEAGUES;
};

const createInitialState = (
  storedDefaultLeagues: LeagueEndpoint[],
): MatchListFilterState => ({
  selectedDate: formatDateIsoValue(new Date()),
  selectedLeagues: getInitialSelectedLeagues(storedDefaultLeagues),
  startTime: "15:00",
  endTime: "16:00",
  customTeams: [],
});

const buildTeamOptions = (teams: TeamWithLeague[], side: "home" | "away") => {
  return teams.map((team) => ({
    key:
      team.key ||
      `${side}-${String(team.value).toLowerCase().replaceAll(/\s+/g, "-")}`,
    value: team.value,
    displayName: formatTeamOptionName(team.value),
    league: team.league,
  }));
};

const matchListFilterReducer = (
  state: MatchListFilterState,
  action: MatchListFilterAction,
): MatchListFilterState => {
  switch (action.type) {
    case "setSelectedDate":
      return { ...state, selectedDate: action.value };
    case "setStartTime":
      return { ...state, startTime: action.value };
    case "setEndTime":
      return { ...state, endTime: action.value };
    case "toggleLeague": {
      const isSelected = state.selectedLeagues.some(
        (league) => league.code === action.league.code,
      );

      return {
        ...state,
        selectedLeagues: isSelected
          ? state.selectedLeagues.filter(
              (league) => league.code !== action.league.code,
            )
          : [...state.selectedLeagues, action.league],
      };
    }
    case "syncLeagues":
      return { ...state, selectedLeagues: action.leagues };
    case "addCustomTeam":
      return {
        ...state,
        customTeams: [...state.customTeams, action.team],
      };
    default:
      return state;
  }
};

export const useMatchListFilters = ({
  storedDefaultLeagues,
  allTeamsData,
}: MatchListFiltersOptions) => {
  const [state, dispatch] = useReducer(
    matchListFilterReducer,
    storedDefaultLeagues,
    createInitialState,
  );

  const { selectedDate, selectedLeagues, startTime, endTime, customTeams } =
    state;

  const teamOptions = useMemo(() => {
    return [...allTeamsData, ...customTeams];
  }, [allTeamsData, customTeams]);

  const homeTeamOptions = useMemo(() => {
    return buildTeamOptions(teamOptions, "home");
  }, [teamOptions]);

  const awayTeamOptions = useMemo(() => {
    return buildTeamOptions(teamOptions, "away");
  }, [teamOptions]);

  const handleLeagueChange = useCallback((league: LeagueEndpoint) => {
    dispatch({ type: "toggleLeague", league });
  }, []);

  const setSelectedDate = useCallback((value: string) => {
    dispatch({ type: "setSelectedDate", value });
  }, []);

  const setStartTime = useCallback((value: string) => {
    dispatch({ type: "setStartTime", value });
  }, []);

  const setEndTime = useCallback((value: string) => {
    dispatch({ type: "setEndTime", value });
  }, []);

  const addCustomTeam = useCallback(
    (value: string, side: "home" | "away") => {
      const team: TeamWithLeague = {
        key: `${side}-${value.toLowerCase().replaceAll(/\s+/g, "-")}-${Date.now()}`,
        value,
        league: selectedLeagues[0]?.name ?? "Custom",
      };

      dispatch({ type: "addCustomTeam", team });
    },
    [selectedLeagues],
  );

  const syncSelectedLeagues = useCallback((leagues: LeagueEndpoint[]) => {
    dispatch({ type: "syncLeagues", leagues });
  }, []);

  return {
    selectedDate,
    selectedLeagues,
    startTime,
    endTime,
    homeTeamOptions,
    awayTeamOptions,
    isDateFilterActive: Boolean(selectedDate),
    isTimeFilterActive: Boolean(startTime && endTime),
    setSelectedDate,
    setStartTime,
    setEndTime,
    syncSelectedLeagues,
    handleLeagueChange,
    addCustomHomeTeam: (value: string) => addCustomTeam(value, "home"),
    addCustomAwayTeam: (value: string) => addCustomTeam(value, "away"),
  };
};
