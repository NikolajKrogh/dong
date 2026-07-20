import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import TestRenderer from "react-test-renderer";

import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import { cacheLeagueLogo } from "../../utils/teamLogos";

jest.mock("../../utils/teamLogos", () => ({
  cacheLeagueLogo: jest.fn(),
}));

const mockCacheLeagueLogo = jest.mocked(cacheLeagueLogo);

const renderHookProbe = (leagueName: string, leagueCode?: string) => {
  let latest:
    | { logoSource: unknown; isLoading: boolean }
    | undefined;

  const Probe = () => {
    latest = useLeagueLogo(leagueName, leagueCode);
    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Probe));

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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest()?.logoSource).toEqual({
      uri: "https://example.com/eredivisie.png",
    });
    expect(getLatest()?.isLoading).toBe(false);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("fetches from the ESPN API and caches the result when nothing is local or cached", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        leagues: [
          {
            logos: [
              { rel: ["default", "full"], href: "https://espn.example/logo.png" },
            ],
          },
        ],
      }),
    }));
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const { renderer, getLatest } = renderHookProbe("Eredivisie", "ned.1");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/ned.1/scoreboard",
    );
    expect(mockCacheLeagueLogo).toHaveBeenCalledWith(
      "Eredivisie",
      "https://espn.example/logo.png",
    );
    expect(getLatest()?.logoSource).toEqual({
      uri: "https://espn.example/logo.png",
    });
    expect(getLatest()?.isLoading).toBe(false);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("does not call the API when no leagueCode is provided, and leaves isLoading true (no completion path)", async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const { renderer, getLatest } = renderHookProbe("Eredivisie");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getLatest()?.logoSource).toBeUndefined();
    expect(getLatest()?.isLoading).toBe(true);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("stops loading and logs when the API response is not ok", async () => {
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const fetchMock = jest.fn(async () => ({ ok: false, status: 500 }));
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const { renderer, getLatest } = renderHookProbe("Eredivisie", "ned.1");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(getLatest()?.logoSource).toBeUndefined();

    consoleWarnSpy.mockRestore();
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("does not update state after unmount (unmount guard)", async () => {
    let resolveFetch: (value: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void = () => undefined;
    const fetchMock = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve as typeof resolveFetch;
        }),
    );
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const { renderer, getLatest } = renderHookProbe("Eredivisie", "ned.1");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    TestRenderer.act(() => {
      renderer.unmount();
    });

    await TestRenderer.act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          leagues: [
            {
              logos: [
                {
                  rel: ["default"],
                  href: "https://espn.example/late.png",
                },
              ],
            },
          ],
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest()?.logoSource).toBeUndefined();
  });
});
