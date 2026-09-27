import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { useHistory, type UseHistoryResult } from "../../hooks/useHistory";
import { useAccountAuth } from "../../hooks/useAccountAuth";
import { useGameStore } from "../../store/store";
import {
  loadCloudHistory,
  type CloudHistoryData,
} from "../../utils/historyRepository";
import { getSupabaseClient, hasSupabasePublicConfig } from "../../utils/supabaseClient";

jest.mock("../../hooks/useAccountAuth", () => ({
  useAccountAuth: jest.fn(),
}));

jest.mock("../../utils/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
  hasSupabasePublicConfig: jest.fn(),
}));

jest.mock("../../utils/historyRepository", () => ({
  ...jest.requireActual<typeof import("../../utils/historyRepository")>(
    "../../utils/historyRepository",
  ),
  loadCloudHistory: jest.fn(),
}));

const mockUseAccountAuth = jest.mocked(useAccountAuth);
const mockGetSupabaseClient = jest.mocked(getSupabaseClient);
const mockHasSupabasePublicConfig = jest.mocked(hasSupabasePublicConfig);
const mockLoadCloudHistory = jest.mocked(loadCloudHistory);

const LOCAL = {
  id: "local-only",
  date: "2026-09-20T12:00:00.000Z",
  players: [{ id: "p1", name: "Alex", drinksTaken: 1 }],
  matches: [],
  commonMatchId: null,
  playerAssignments: {},
  matchesPerPlayer: 1,
};

const CLOUD = {
  id: "cloud-session",
  date: "2026-09-21T12:00:00.000Z",
  players: [{ id: "p2", name: "Blair", drinksTaken: 2 }],
  matches: [],
  commonMatchId: null,
  playerAssignments: {},
  matchesPerPlayer: 1,
};

const account = (id: string | null) => ({
  account: id === null ? null : ({ id } as never),
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const cloudData = (...sessions: CloudHistoryData["sessions"]): CloudHistoryData => ({
  sessions,
  importLinks: [],
});

const setLocalHistory = (history: typeof LOCAL[] = []) => {
  useGameStore.setState({ history: history as never });
};

const renderHookProbe = () => {
  let latest: UseHistoryResult | undefined;
  const Probe = () => {
    latest = useHistory();
    return null;
  };

  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  return {
    renderer,
    Probe,
    getLatest: () => latest as UseHistoryResult,
    rerender: () => {
      TestRenderer.act(() => {
        renderer.update(React.createElement(Probe));
      });
    },
  };
};

describe("useHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocalHistory([LOCAL]);
    mockUseAccountAuth.mockReturnValue(account("account-a") as never);
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({} as never);
  });

  it("keeps local history visible and publishes cloud summaries with import links together", async () => {
    const load = deferred<CloudHistoryData>();
    mockLoadCloudHistory.mockReturnValue(load.promise);
    const { renderer, getLatest } = renderHookProbe();

    expect(getLatest().history.map((session) => session.id)).toEqual(["local-only"]);
    expect(getLatest().accountId).toBe("account-a");
    expect(getLatest().loading).toBe(true);

    let refreshPromise!: Promise<void>;
    TestRenderer.act(() => {
      refreshPromise = getLatest().refresh();
    });
    await TestRenderer.act(async () => {
      load.resolve({
        sessions: [CLOUD],
        importLinks: [
          {
            source_local_session_id: "local-only",
            cloud_session_id: "cloud-session",
          },
        ],
      });
      await refreshPromise;
    });

    expect(getLatest().history.map((session) => session.id)).toEqual([
      "cloud-session",
    ]);
    expect(getLatest().loading).toBe(false);
    expect(getLatest().error).toBeNull();
    expect(mockLoadCloudHistory).toHaveBeenCalledWith({});

    TestRenderer.act(() => renderer.unmount());
  });

  it("retains the same account's last good data and shows a generic error after refresh fails", async () => {
    mockLoadCloudHistory
      .mockResolvedValueOnce(cloudData(CLOUD))
      .mockRejectedValueOnce(new Error("private PostgREST details"));
    const { renderer, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await getLatest().refresh();
    });
    expect(getLatest().history.map((session) => session.id)).toContain(
      "cloud-session",
    );

    await TestRenderer.act(async () => {
      await getLatest().refresh();
    });

    expect(getLatest().history.map((session) => session.id)).toContain(
      "cloud-session",
    );
    expect(getLatest().error).toBe(
      "Could not load cloud history. Your available history is still shown.",
    );
    expect(getLatest().error).not.toContain("PostgREST");

    TestRenderer.act(() => renderer.unmount());
  });

  it("ignores an older same-account request after a newer refresh finishes", async () => {
    const older = deferred<CloudHistoryData>();
    const newer = deferred<CloudHistoryData>();
    mockLoadCloudHistory
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const { renderer, getLatest } = renderHookProbe();
    let olderRefresh!: Promise<void>;
    let newerRefresh!: Promise<void>;

    TestRenderer.act(() => {
      olderRefresh = getLatest().refresh();
      newerRefresh = getLatest().refresh();
    });

    await TestRenderer.act(async () => {
      newer.resolve(cloudData({ ...CLOUD, id: "newer-cloud" }));
      await newerRefresh;
    });
    await TestRenderer.act(async () => {
      older.resolve(cloudData({ ...CLOUD, id: "older-cloud" }));
      await olderRefresh;
    });

    expect(getLatest().history.map((session) => session.id)).toContain(
      "newer-cloud",
    );
    expect(getLatest().history.map((session) => session.id)).not.toContain(
      "older-cloud",
    );
    expect(getLatest().loading).toBe(false);

    TestRenderer.act(() => renderer.unmount());
  });

  it("hides the old account immediately and ignores its late cloud response after switching accounts", async () => {
    const accountARequest = deferred<CloudHistoryData>();
    mockLoadCloudHistory
      .mockResolvedValueOnce(cloudData({ ...CLOUD, id: "account-a-cloud" }))
      .mockReturnValueOnce(accountARequest.promise);
    const { renderer, Probe, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await getLatest().refresh();
    });
    expect(getLatest().history.map((session) => session.id)).toContain(
      "account-a-cloud",
    );

    let request!: Promise<void>;
    TestRenderer.act(() => {
      request = getLatest().refresh();
    });

    mockUseAccountAuth.mockReturnValue(account("account-b") as never);
    TestRenderer.act(() => renderer.update(React.createElement(Probe)));

    expect(getLatest().accountId).toBe("account-b");
    expect(getLatest().history.map((session) => session.id)).toEqual([
      "local-only",
    ]);
    expect(getLatest().loading).toBe(true);

    await TestRenderer.act(async () => {
      accountARequest.resolve(cloudData({ ...CLOUD, id: "account-a-cloud" }));
      await request;
    });

    expect(getLatest().history.map((session) => session.id)).toEqual([
      "local-only",
    ]);
    expect(getLatest().error).toBeNull();

    TestRenderer.act(() => renderer.unmount());
  });

  it("invalidates a pending request across account A → sign-out → account A without an intermediate refresh", async () => {
    const pendingARequest = deferred<CloudHistoryData>();
    mockLoadCloudHistory
      .mockResolvedValueOnce(cloudData({ ...CLOUD, id: "account-a-cloud" }))
      .mockReturnValueOnce(pendingARequest.promise);
    const { renderer, Probe, getLatest } = renderHookProbe();

    await TestRenderer.act(async () => {
      await getLatest().refresh();
    });
    expect(getLatest().history.map((session) => session.id)).toContain(
      "account-a-cloud",
    );

    let request!: Promise<void>;
    TestRenderer.act(() => {
      request = getLatest().refresh();
    });

    mockUseAccountAuth.mockReturnValue(account(null) as never);
    TestRenderer.act(() => renderer.update(React.createElement(Probe)));
    expect(getLatest().accountId).toBeNull();

    mockUseAccountAuth.mockReturnValue(account("account-a") as never);
    TestRenderer.act(() => renderer.update(React.createElement(Probe)));
    expect(getLatest().accountId).toBe("account-a");

    await TestRenderer.act(async () => {
      pendingARequest.resolve(
        cloudData({ ...CLOUD, id: "stale-account-a-cloud" }),
      );
      await request;
    });

    expect(getLatest().history.map((session) => session.id)).toEqual([
      "local-only",
    ]);
    expect(getLatest().error).toBeNull();

    TestRenderer.act(() => renderer.unmount());
  });
});
