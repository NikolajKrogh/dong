import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { ImageSourcePropType } from "react-native";
import TestRenderer from "react-test-renderer";

import { useTeamLogo } from "../../hooks/useTeamLogo";
import { getHardcodedTeamLogoOnly, getTeamLogo } from "../../utils/teamLogos";

jest.mock("../../utils/teamLogos", () => ({
  getHardcodedTeamLogoOnly: jest.fn(),
  getTeamLogo: jest.fn(),
}));

const mockGetHardcodedTeamLogoOnly = jest.mocked(getHardcodedTeamLogoOnly);
const mockGetTeamLogo = jest.mocked(getTeamLogo);

const DEFAULT_LOGO = require("../../assets/images/teams/default.png");
const HARDCODED_LOGO = { testUri: "hardcoded-arsenal" } as ImageSourcePropType;

const renderHookProbe = (teamName: string) => {
  const observedSources: ImageSourcePropType[] = [];
  let latest: ImageSourcePropType | undefined;

  const Probe = () => {
    latest = useTeamLogo(teamName);
    observedSources.push(latest);
    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Probe));

  return { renderer, observedSources, getLatest: () => latest };
};

describe("useTeamLogo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the default logo immediately for an empty team name", () => {
    const { renderer, getLatest } = renderHookProbe("");

    expect(getLatest()).toBe(DEFAULT_LOGO);
    expect(mockGetHardcodedTeamLogoOnly).not.toHaveBeenCalled();

    renderer.unmount();
  });

  it("returns the default logo immediately for a whitespace-only team name", () => {
    const { renderer, getLatest } = renderHookProbe("   ");

    expect(getLatest()).toBe(DEFAULT_LOGO);

    renderer.unmount();
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

    renderer.unmount();
  });

  it("falls back to the default logo, then updates to the persisted API logo", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockResolvedValue("https://example.com/logo.png");

    const { renderer, getLatest } = renderHookProbe("Unmapped United");

    expect(getLatest()).toBe(DEFAULT_LOGO);

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest()).toEqual({ uri: "https://example.com/logo.png" });

    renderer.unmount();
  });

  it("stays on the default logo when no persisted logo is found", async () => {
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockResolvedValue(null);

    const { renderer, getLatest } = renderHookProbe("Unmapped United");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest()).toBe(DEFAULT_LOGO);

    renderer.unmount();
  });

  it("logs and keeps the default logo when the persisted lookup rejects", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockGetHardcodedTeamLogoOnly.mockReturnValue(null);
    mockGetTeamLogo.mockRejectedValue(new Error("storage unavailable"));

    const { renderer, getLatest } = renderHookProbe("Unmapped United");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest()).toBe(DEFAULT_LOGO);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    renderer.unmount();
  });

  it("re-resolves the logo when the team name changes", async () => {
    mockGetHardcodedTeamLogoOnly.mockImplementation((teamName: string) =>
      teamName === "Chelsea FC" ? HARDCODED_LOGO : null,
    );
    mockGetTeamLogo.mockResolvedValue(null);

    let teamName = "Unmapped United";
    let latest: ImageSourcePropType | undefined;

    const Probe = () => {
      latest = useTeamLogo(teamName);
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest).toBe(DEFAULT_LOGO);

    teamName = "Chelsea FC";
    await TestRenderer.act(async () => {
      renderer.update(React.createElement(Probe));
    });

    expect(latest).toBe(HARDCODED_LOGO);

    renderer.unmount();
  });
});
