import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ImageSourcePropType } from "react-native";
import TestRenderer from "react-test-renderer";

import { useTeamLogo } from "../../../features/football-matches/useTeamLogo";
import { getHardcodedTeamLogoOnly, getTeamLogo } from "../../../features/football-matches/teamLogos";

jest.mock("../../../features/football-matches/teamLogos", () => ({
  getHardcodedTeamLogoOnly: jest.fn(),
  getTeamLogo: jest.fn(),
}));

const mockGetHardcodedTeamLogoOnly = jest.mocked(getHardcodedTeamLogoOnly);
const mockGetTeamLogo = jest.mocked(getTeamLogo);
let queryClient: QueryClient;

const DEFAULT_LOGO = require("../../../assets/images/teams/default.png");
const HARDCODED_LOGO = { testUri: "hardcoded-arsenal" } as ImageSourcePropType;
// Drain both the lookup promise and React Query's scheduled observer notification.
const flushQuery = () => jest.runAllTimersAsync();

const renderHookProbe = (teamName: string) => {
  let latest: ImageSourcePropType | undefined;

  const Probe = ({ name }: { name: string }) => {
    latest = useTeamLogo(name);
    return null;
  };

  const element = (name: string) => React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(Probe, { name }),
  );
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element(teamName));
  });

  return { renderer, getLatest: () => latest,
    rerender: (name: string) => renderer.update(element(name)) };
};

describe("useTeamLogo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    jest.useRealTimers();
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("returns the default logo immediately for an %s team name", (_label, name) => {
    const { renderer, getLatest } = renderHookProbe(name);

    expect(getLatest()).toBe(DEFAULT_LOGO);
    expect(mockGetHardcodedTeamLogoOnly).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("returns a hardcoded logo synchronously without checking the async cache", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(HARDCODED_LOGO);

    const { renderer, getLatest } = renderHookProbe("Arsenal FC");

    expect(getLatest()).toBe(HARDCODED_LOGO);

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    expect(getLatest()).toBe(HARDCODED_LOGO);
    expect(mockGetTeamLogo).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("falls back to the default logo, then updates to the persisted API logo", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockResolvedValue("https://example.com/logo.png");

    const { renderer, getLatest } = renderHookProbe("Unmapped United");

    expect(getLatest()).toBe(DEFAULT_LOGO);

    await TestRenderer.act(async () => {
      await flushQuery();
    });

    expect(getLatest()).toEqual({ uri: "https://example.com/logo.png" });

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("stays on the default logo when no persisted logo is found", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockResolvedValue(null);

    const { renderer, getLatest } = renderHookProbe("Unmapped United");

    await TestRenderer.act(async () => {
      await flushQuery();
    });

    expect(getLatest()).toBe(DEFAULT_LOGO);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("logs and keeps the default logo when the persisted lookup rejects", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockRejectedValue(new Error("storage unavailable"));

    const { renderer, getLatest } = renderHookProbe("Unmapped United");

    await TestRenderer.act(async () => {
      await flushQuery();
    });

    expect(getLatest()).toBe(DEFAULT_LOGO);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("re-resolves the logo when the team name changes", async () => {
    mockGetHardcodedTeamLogoOnly.mockImplementation((teamName: string) =>
      teamName === "Chelsea FC" ? HARDCODED_LOGO : null,
    );
    mockGetTeamLogo.mockResolvedValue(null);

    const { renderer, getLatest, rerender } = renderHookProbe("Unmapped United");

    await TestRenderer.act(async () => {
      await flushQuery();
    });

    expect(getLatest()).toBe(DEFAULT_LOGO);

    await TestRenderer.act(async () => {
      rerender("Chelsea FC");
    });

    expect(getLatest()).toBe(HARDCODED_LOGO);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
