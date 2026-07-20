import { describe, expect, it } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { LeagueEndpoint } from "../../constants/leagues";
import { useMatchListFilters } from "../../hooks/useMatchListFilters";
import { TeamWithLeague } from "../../utils/matchUtils";

type HookResult = ReturnType<typeof useMatchListFilters>;

const PREMIER_LEAGUE: LeagueEndpoint = { name: "Premier League", code: "eng.1" };
const CHAMPIONSHIP: LeagueEndpoint = { name: "Championship", code: "eng.2" };
const BUNDESLIGA: LeagueEndpoint = { name: "Bundesliga", code: "ger.1" };

const ALL_TEAMS: TeamWithLeague[] = [
  { key: "arsenal", value: "Arsenal FC", league: "Premier League" },
  { key: "dortmund", value: "Borussia Dortmund", league: "Bundesliga" },
];

const renderHookProbe = (
  storedDefaultLeagues: LeagueEndpoint[] = [],
  allTeamsData: TeamWithLeague[] = ALL_TEAMS,
) => {
  let latest: HookResult | undefined;

  const Probe = () => {
    latest = useMatchListFilters({ storedDefaultLeagues, allTeamsData });
    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Probe));

  return { renderer, getLatest: () => latest as HookResult };
};

describe("useMatchListFilters", () => {
  it("falls back to the built-in default leagues when none are stored", () => {
    const { renderer, getLatest } = renderHookProbe([]);

    expect(getLatest().selectedLeagues).toEqual([
      { name: "Premier League", code: "eng.1" },
      { name: "Championship", code: "eng.2" },
    ]);

    renderer.unmount();
  });

  it("seeds selectedLeagues from stored default leagues when provided", () => {
    const { renderer, getLatest } = renderHookProbe([BUNDESLIGA]);

    expect(getLatest().selectedLeagues).toEqual([BUNDESLIGA]);

    renderer.unmount();
  });

  it("toggleLeague (via handleLeagueChange) adds an unselected league and removes a selected one", () => {
    const { renderer, getLatest } = renderHookProbe([PREMIER_LEAGUE]);

    TestRenderer.act(() => {
      getLatest().handleLeagueChange(CHAMPIONSHIP);
    });
    expect(getLatest().selectedLeagues).toEqual([PREMIER_LEAGUE, CHAMPIONSHIP]);

    TestRenderer.act(() => {
      getLatest().handleLeagueChange(PREMIER_LEAGUE);
    });
    expect(getLatest().selectedLeagues).toEqual([CHAMPIONSHIP]);

    renderer.unmount();
  });

  it("setSelectedDate updates selectedDate", () => {
    const { renderer, getLatest } = renderHookProbe();

    TestRenderer.act(() => {
      getLatest().setSelectedDate("2026-03-14");
    });

    expect(getLatest().selectedDate).toBe("2026-03-14");

    renderer.unmount();
  });

  it("setStartTime and setEndTime update the time range independently", () => {
    const { renderer, getLatest } = renderHookProbe();

    TestRenderer.act(() => {
      getLatest().setStartTime("12:00");
    });
    expect(getLatest().startTime).toBe("12:00");
    expect(getLatest().endTime).toBe("16:00");

    TestRenderer.act(() => {
      getLatest().setEndTime("18:30");
    });
    expect(getLatest().endTime).toBe("18:30");

    renderer.unmount();
  });

  it("syncSelectedLeagues (syncLeagues) replaces the entire selection", () => {
    const { renderer, getLatest } = renderHookProbe([PREMIER_LEAGUE]);

    TestRenderer.act(() => {
      getLatest().syncSelectedLeagues([CHAMPIONSHIP, BUNDESLIGA]);
    });

    expect(getLatest().selectedLeagues).toEqual([CHAMPIONSHIP, BUNDESLIGA]);

    renderer.unmount();
  });

  it("addCustomHomeTeam (addCustomTeam) appends a home-side team option built from the current selection", () => {
    const { renderer, getLatest } = renderHookProbe([PREMIER_LEAGUE]);
    const initialCount = getLatest().homeTeamOptions.length;

    TestRenderer.act(() => {
      getLatest().addCustomHomeTeam("My Custom FC");
    });

    const homeNames = getLatest().homeTeamOptions.map((t) => t.value);
    expect(getLatest().homeTeamOptions).toHaveLength(initialCount + 1);
    expect(homeNames).toContain("My Custom FC");
    // Custom teams also flow into the away side, since both derive from teamOptions
    expect(
      getLatest().awayTeamOptions.map((t) => t.value),
    ).toContain("My Custom FC");

    renderer.unmount();
  });

  it("addCustomAwayTeam derives the custom team's league from the first selected league", () => {
    const { renderer, getLatest } = renderHookProbe([BUNDESLIGA]);

    TestRenderer.act(() => {
      getLatest().addCustomAwayTeam("Wildcard United");
    });

    const wildcard = getLatest().awayTeamOptions.find(
      (t) => t.value === "Wildcard United",
    );
    expect(wildcard?.league).toBe("Bundesliga");

    renderer.unmount();
  });

  it("derives isDateFilterActive/isTimeFilterActive from current state", () => {
    const { renderer, getLatest } = renderHookProbe();

    expect(getLatest().isDateFilterActive).toBe(true);
    expect(getLatest().isTimeFilterActive).toBe(true);

    renderer.unmount();
  });

  it("cleans FC-style prefixes/suffixes when building team display names", () => {
    const { renderer, getLatest } = renderHookProbe([PREMIER_LEAGUE], [
      { key: "arsenal", value: "Arsenal FC", league: "Premier League" },
    ]);

    const arsenal = getLatest().homeTeamOptions.find(
      (t) => t.value === "Arsenal FC",
    );
    expect(arsenal?.displayName).toBe("Arsenal");

    renderer.unmount();
  });
});
