/** @jest-environment jsdom */
import React from "react";
import TestRenderer from "react-test-renderer";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { actCreate } from "../../../test-utils/render";
import { useMatchData } from "../../../features/football-matches/useMatchData";
import type { DiscoverySelection } from "../../../features/football-matches/matchDiscoveryQueries";

const mockDiscover = jest.fn();
const mockGetService = jest.fn((_options: unknown) => ({}));
let mockInteractive = true;
jest.mock("../../../features/football-matches/footballMatchService", () => ({
  getFootballMatchService: (options: unknown) => mockGetService(options),
}));
jest.mock("../../../features/football-matches/matchDiscoveryAdapter", () => ({
  createMatchDiscoveryApiClient: () => ({ discoverMatches: (selection: unknown) => mockDiscover(selection) }),
}));
jest.mock("../../../platform", () => ({ useAppVisibility: () => ({ isInteractive: mockInteractive }) }));

const date = "2026-10-30";
let client: QueryClient;
let latest: ReturnType<typeof useMatchData>;
function Probe({ selection }: { selection: DiscoverySelection }) {
  const result = useMatchData(selection);
  React.useEffect(() => { latest = result; }, [result]);
  return null;
}
const tree = (selection: DiscoverySelection) => <QueryClientProvider client={client}><Probe selection={selection} /></QueryClientProvider>;
const settle = async () => { await TestRenderer.act(async () => { await jest.advanceTimersByTimeAsync(1); }); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
  jest.setSystemTime(new Date(`${date}T12:00:00Z`));
  mockInteractive = true;
  focusManager.setFocused(true); onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockDiscover.mockImplementation(async ({ leagueCodes, requestedAt }) => ({
    availability: "available", retryAfterSeconds: null,
    groups: leagueCodes.map((leagueCode: string) => ({ leagueCode, date: requestedAt.slice(0,10),
      availability: "available", isStale: false, lastSuccessfulCheckAt: new Date().toISOString() })),
    matches: leagueCodes.map((league: string) => ({ id: league, catalogMatchId: `catalog-${league}`, league,
      homeTeam: "Arsenal", awayTeam: "Chelsea", startDateTime: `${requestedAt.slice(0,10)}T23:30:00Z`, status: "scheduled" })),
  }));
});
afterEach(() => { client.clear(); jest.useRealTimers(); });

it("uses one-check discovery and preserves canonical names, identity, instant and per-league team options", async () => {
  actCreate(tree({ date, leagueCodes: ["usa.1", "eng.1"], active: true })); await settle();
  expect(mockGetService).toHaveBeenCalledWith({ followUpPending: false });
  expect(mockDiscover).toHaveBeenCalledWith({ leagueCodes: ["eng.1", "usa.1"], requestedAt: `${date}T00:00:00.000Z` });
  expect(latest.apiData.map(group => group.name)).toEqual(["Premier League", "MLS"]);
  expect(latest.apiData[0].matches[0]).toMatchObject({ id: "eng.1", catalogMatchId: "catalog-eng.1", startDateTime: `${date}T23:30:00Z` });
  expect(latest.apiData[0].matches[0].time).toBe(new Date(`${date}T23:30:00Z`).toTimeString().slice(0,5));
  expect(latest.teamsData).toHaveLength(4);
  expect(latest.isInitialLoading).toBe(false);
});

it("reuses a shared QueryClient and projects only the current date and leagues", async () => {
  const selection = { date, leagueCodes: ["eng.1"], active: true };
  const renderer = actCreate(tree(selection)); await settle();
  TestRenderer.act(() => renderer.update(tree({ ...selection, leagueCodes: ["usa.1", "eng.1"] }))); await settle();
  expect(mockDiscover).toHaveBeenLastCalledWith({ leagueCodes: ["usa.1"], requestedAt: `${date}T00:00:00.000Z` });
  TestRenderer.act(() => renderer.update(tree({ ...selection, date: "2026-10-31" }))); await settle();
  expect(latest.apiData).toHaveLength(1);
  expect(latest.apiData[0].matches[0].date).toBe("2026-10-31");
  TestRenderer.act(() => renderer.update(tree(selection))); await settle();
  expect(mockDiscover).toHaveBeenCalledTimes(3);
  expect(latest.apiData[0].matches[0].date).toBe(date);
});

it("combines route activity and application interactivity before admitting demand", async () => {
  const selection = { date, leagueCodes: ["eng.1"], active: false };
  const renderer = actCreate(tree(selection)); await settle();
  expect(mockDiscover).not.toHaveBeenCalled();
  mockInteractive = false;
  TestRenderer.act(() => renderer.update(tree({ ...selection, active: true }))); await settle();
  expect(mockDiscover).not.toHaveBeenCalled();
  mockInteractive = true;
  TestRenderer.act(() => renderer.update(tree({ ...selection, active: true }))); await settle();
  expect(mockDiscover).toHaveBeenCalledTimes(1);
  await TestRenderer.act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  mockInteractive = false;
  TestRenderer.act(() => renderer.update(tree({ ...selection, active: true }))); await settle();
  mockInteractive = true;
  TestRenderer.act(() => renderer.update(tree({ ...selection, active: true }))); await settle();
  expect(mockDiscover).toHaveBeenCalledTimes(2);
});
