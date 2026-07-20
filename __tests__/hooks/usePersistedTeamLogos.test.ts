import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { usePersistedTeamLogos } from "../../hooks/usePersistedTeamLogos";
import { useGameStore, type Match } from "../../store/store";
import {
  cacheTeamLogo,
  clearOverriddenLogos,
  getHardcodedTeamLogoOnly,
  getTeamLogo,
} from "../../utils/teamLogos";

jest.mock("../../utils/teamLogos", () => ({
  cacheTeamLogo: jest.fn(),
  clearOverriddenLogos: jest.fn(),
  getHardcodedTeamLogoOnly: jest.fn(),
  getTeamLogo: jest.fn(),
}));

const mockCacheTeamLogo = jest.mocked(cacheTeamLogo);
const mockClearOverriddenLogos = jest.mocked(clearOverriddenLogos);
const mockGetHardcodedTeamLogoOnly = jest.mocked(getHardcodedTeamLogoOnly);
const mockGetTeamLogo = jest.mocked(getTeamLogo);

const buildMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "match-1",
  homeTeam: "Arsenal FC",
  awayTeam: "Chelsea FC",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

const setMatches = (matches: Match[]) => {
  useGameStore.setState({ matches });
};

const renderProbe = () => {
  const Probe = () => {
    usePersistedTeamLogos();
    return null;
  };

  return TestRenderer.create(React.createElement(Probe));
};

describe("usePersistedTeamLogos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMatches([]);
  });

  it("does nothing when there are no matches", async () => {
    const renderer = renderProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
    });

    expect(mockClearOverriddenLogos).not.toHaveBeenCalled();
    expect(mockGetTeamLogo).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("clears overridden logos and loads persisted logos for teams without hardcoded assets", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockImplementation(async (teamName: string) =>
      teamName === "Arsenal FC" ? "https://example.com/arsenal.png" : null,
    );
    setMatches([buildMatch()]);

    const renderer = renderProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClearOverriddenLogos).toHaveBeenCalledTimes(1);
    expect(mockGetTeamLogo).toHaveBeenCalledWith("Arsenal FC");
    expect(mockGetTeamLogo).toHaveBeenCalledWith("Chelsea FC");
    expect(mockCacheTeamLogo).toHaveBeenCalledWith(
      "Arsenal FC",
      "https://example.com/arsenal.png",
    );
    expect(mockCacheTeamLogo).not.toHaveBeenCalledWith(
      "Chelsea FC",
      expect.anything(),
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("skips the AsyncStorage lookup for teams that already have a hardcoded logo", async () => {
    mockGetHardcodedTeamLogoOnly.mockImplementation((teamName: string) =>
      teamName === "Arsenal FC" ? ({} as never) : null,
    );
    mockGetTeamLogo.mockResolvedValue(null);
    setMatches([buildMatch()]);

    const renderer = renderProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetTeamLogo).not.toHaveBeenCalledWith("Arsenal FC");
    expect(mockGetTeamLogo).toHaveBeenCalledWith("Chelsea FC");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("deduplicates identical home/away team names across matches", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockResolvedValue(null);
    setMatches([
      buildMatch({ id: "match-1" }),
      buildMatch({ id: "match-2", awayTeam: "Arsenal FC" }),
    ]);

    const renderer = renderProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetTeamLogo).toHaveBeenCalledTimes(2);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("logs and continues when a persisted lookup rejects", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockImplementation(async (teamName: string) => {
      if (teamName === "Arsenal FC") {
        throw new Error("storage unavailable");
      }
      return null;
    });
    setMatches([buildMatch()]);

    const renderer = renderProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockGetTeamLogo).toHaveBeenCalledWith("Chelsea FC");

    consoleErrorSpy.mockRestore();
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
