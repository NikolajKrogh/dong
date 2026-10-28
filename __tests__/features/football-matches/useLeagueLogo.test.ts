import { actCreate } from "../../../test-utils/render";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import TestRenderer from "react-test-renderer";

import { useLeagueLogo } from "../../../features/football-matches/useLeagueLogo";
const flushQuery = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

const renderHookProbe = (leagueName: string, leagueCode?: string) => {
  let latest:
    | { logoSource: unknown; isLoading: boolean }
    | undefined;

  const Probe = () => {
    latest = useLeagueLogo(leagueName, leagueCode);
    return null;
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const renderer = actCreate(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(Probe),
    ),
  );

  return { renderer, getLatest: () => latest };
};

describe("useLeagueLogo", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (globalThis as { fetch?: unknown }).fetch = undefined;
  });

  it("resolves a bundled local asset synchronously without hitting storage or the network", async () => {
    const { renderer, getLatest } = renderHookProbe("Premier League");

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    expect(getLatest()?.isLoading).toBe(false);
    expect(getLatest()?.logoSource).toBeDefined();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("falls back to a cached AsyncStorage entry when no local asset matches", async () => {
    await AsyncStorage.setItem(
      "league_logo_Eredivisie",
      "https://example.com/eredivisie.png",
    );

    const { renderer, getLatest } = renderHookProbe("Eredivisie");

    await TestRenderer.act(async () => {
      await flushQuery();
    });

    expect(getLatest()?.logoSource).toEqual({
      uri: "https://example.com/eredivisie.png",
    });
    expect(getLatest()?.isLoading).toBe(false);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("leaves uncached logos to the existing placeholder without fetching a scoreboard", async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch: unknown }).fetch = fetchMock;
    const { renderer, getLatest } = renderHookProbe("Eredivisie", "ned.1");
    await TestRenderer.act(async () => { await flushQuery(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getLatest()?.logoSource).toBeUndefined();
    expect(getLatest()?.isLoading).toBe(false);
    TestRenderer.act(() => { renderer.unmount(); });
  });
});
