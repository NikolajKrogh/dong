import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  useLegacyHistoryImport,
  type UseLegacyHistoryImportResult,
} from "../../hooks/useLegacyHistoryImport";
import { useGameStore } from "../../store/store";
import type { ImportLegacyHistoryRpcResponse } from "../../types/legacyHistoryImport";
import {
  getLegacyHistoryImportRpcClient,
  getSupabaseClient,
  hasSupabasePublicConfig,
} from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getLegacyHistoryImportRpcClient: jest.fn(),
  getSupabaseClient: jest.fn(),
  hasSupabasePublicConfig: jest.fn(),
}));

const mockGetLegacyHistoryImportRpcClient = jest.mocked(
  getLegacyHistoryImportRpcClient,
);
const mockGetSupabaseClient = jest.mocked(getSupabaseClient);
const mockHasSupabasePublicConfig = jest.mocked(hasSupabasePublicConfig);

const SESSION = {
  id: "session-1",
  date: "2026-01-01T00:00:00.000Z",
  players: [{ id: "p1", name: "Alice", drinksTaken: 2 }],
  matches: [
    {
      id: "m1",
      homeTeam: "Arsenal FC",
      awayTeam: "Chelsea FC",
      homeGoals: 1,
      awayGoals: 0,
    },
  ],
  commonMatchId: null,
  playerAssignments: {},
  matchesPerPlayer: 1,
};

const setHistory = (history: (typeof SESSION)[]) => {
  useGameStore.setState({ history: history as never });
};

const mockAuthenticatedUser = (userId = "user-1") => {
  mockGetSupabaseClient.mockReturnValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: userId } } })) },
  } as never);
};

const mockUnauthenticatedUser = () => {
  mockGetSupabaseClient.mockReturnValue({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: null },
        error: new Error("no session"),
      })),
    },
  } as never);
};

const buildImportResponse = (
  overrides: Partial<ImportLegacyHistoryRpcResponse> = {},
): ImportLegacyHistoryRpcResponse => ({
  accountId: "user-1",
  importState: "completed",
  claimedLocalParticipantId: "p1",
  summary: { importedCount: 1, skippedCount: 0, failedCount: 0 },
  sessions: [
    {
      sourceLocalSessionId: "session-1",
      sourceFingerprint: "fp-1",
      state: "imported",
    },
  ],
  ...overrides,
});

const renderHookProbe = () => {
  const phases: UseLegacyHistoryImportResult["importPhase"][] = [];
  let latest: UseLegacyHistoryImportResult | undefined;

  const Probe = () => {
    latest = useLegacyHistoryImport();
    phases.push(latest.importPhase);
    return null;
  };

  const renderer = TestRenderer.create(React.createElement(Probe));

  return { renderer, phases, getLatest: () => latest as UseLegacyHistoryImportResult };
};

describe("useLegacyHistoryImport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHistory([]);
  });

  it("starts in the checking phase, then moves to ready once auth resolves (unconfigured)", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(false);
    setHistory([SESSION]);

    const { renderer, phases, getLatest } = renderHookProbe();

    expect(phases[0]).toBe("checking");

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest().importPhase).toBe("ready");
    expect(getLatest().isConfigured).toBe(false);
    expect(getLatest().authChecked).toBe(true);
    expect(getLatest().isAuthenticated).toBe(false);
    expect(getLatest().availabilityReason).toBe(
      "Supabase import is not configured for this build.",
    );
    expect(getLatest().canStartImport).toBe(false);

    renderer.unmount();
  });

  it("reports the missing-history reason when there is no local history, regardless of config", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockAuthenticatedUser();
    setHistory([]);

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest().hasLocalHistory).toBe(false);
    expect(getLatest().availabilityReason).toBe(
      "No local history saved on this device yet.",
    );
    expect(getLatest().canStartImport).toBe(false);

    renderer.unmount();
  });

  it("gates on authentication: unauthenticated + configured + has history -> ready with an auth reason", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockUnauthenticatedUser();
    setHistory([SESSION]);

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest().importPhase).toBe("ready");
    expect(getLatest().isAuthenticated).toBe(false);
    expect(getLatest().availabilityReason).toBe("Sign in to import this history.");
    expect(getLatest().canStartImport).toBe(false);

    renderer.unmount();
  });

  it("allows starting the import once configured, authenticated, and history/claimants exist", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockAuthenticatedUser();
    setHistory([SESSION]);

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLatest().claimantOptions).toHaveLength(1);
    expect(getLatest().claimantOptions[0].name).toBe("Alice");
    expect(getLatest().canStartImport).toBe(true);
    expect(getLatest().availabilityReason).toBeNull();

    renderer.unmount();
  });

  it("transitions checking -> ready -> importing -> completed on a successful import", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockAuthenticatedUser();
    setHistory([SESSION]);

    const importLegacyHistory = jest.fn(async () => buildImportResponse());
    mockGetLegacyHistoryImportRpcClient.mockReturnValue({
      importLegacyHistory,
    });

    const { renderer, phases, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const claimant = getLatest().claimantOptions[0];

    await TestRenderer.act(async () => {
      await getLatest().importHistory(claimant);
    });

    expect(importLegacyHistory).toHaveBeenCalledTimes(1);
    expect(getLatest().importPhase).toBe("completed");
    expect(getLatest().isImporting).toBe(false);
    expect(getLatest().canStartImport).toBe(false);
    expect(phases).toEqual(
      expect.arrayContaining(["checking", "ready", "importing", "completed"]),
    );

    renderer.unmount();
  });

  it("transitions to failed and allows retry when the RPC rejects", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockAuthenticatedUser();
    setHistory([SESSION]);

    const importLegacyHistory = jest.fn(async () => {
      throw new Error("network unreachable");
    });
    mockGetLegacyHistoryImportRpcClient.mockReturnValue({
      importLegacyHistory,
    });

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const claimant = getLatest().claimantOptions[0];

    await TestRenderer.act(async () => {
      await getLatest().importHistory(claimant);
    });

    expect(getLatest().importPhase).toBe("failed");
    expect(getLatest().importError).toBe("network unreachable");
    expect(getLatest().canRetryImport).toBe(true);

    renderer.unmount();
  });

  it("importHistory short-circuits with a config error and never calls the RPC client when unconfigured", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(false);
    setHistory([SESSION]);

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const claimant = getLatest().claimantOptions[0];

    await TestRenderer.act(async () => {
      const result = await getLatest().importHistory(claimant);
      expect(result).toBeNull();
    });

    expect(getLatest().importError).toBe(
      "Supabase import is not configured for this build.",
    );
    expect(mockGetLegacyHistoryImportRpcClient).not.toHaveBeenCalled();

    renderer.unmount();
  });

  it("importHistory short-circuits with an auth error and never calls the RPC client when unauthenticated", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockUnauthenticatedUser();
    setHistory([SESSION]);

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const claimant = getLatest().claimantOptions[0];

    await TestRenderer.act(async () => {
      const result = await getLatest().importHistory(claimant);
      expect(result).toBeNull();
    });

    expect(getLatest().importError).toBe("Sign in to import this history.");
    expect(mockGetLegacyHistoryImportRpcClient).not.toHaveBeenCalled();

    renderer.unmount();
  });

  it("returns the cached result without re-calling the RPC when already completed", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockAuthenticatedUser();
    setHistory([SESSION]);

    const response = buildImportResponse();
    const importLegacyHistory = jest.fn(async () => response);
    mockGetLegacyHistoryImportRpcClient.mockReturnValue({
      importLegacyHistory,
    });

    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const claimant = getLatest().claimantOptions[0];

    await TestRenderer.act(async () => {
      await getLatest().importHistory(claimant);
    });

    await TestRenderer.act(async () => {
      const secondResult = await getLatest().importHistory(claimant);
      expect(secondResult).toEqual(response);
    });

    expect(importLegacyHistory).toHaveBeenCalledTimes(1);

    renderer.unmount();
  });
});
