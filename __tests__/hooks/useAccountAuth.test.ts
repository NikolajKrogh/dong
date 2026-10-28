import { actCreate } from "../../test-utils/render";
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  AccountAuthProvider,
  SESSION_EXPIRED_MESSAGE,
  bootstrapAccountRow,
  normalizeAccountUsername,
  saveAccountUsername,
  useAccountAuth,
} from "../../hooks/useAccountAuth";
import {
  getCurrentSyncedPreferenceState,
  useGameStore,
} from "../../store/store";
import { getSupabaseClient, getSupabasePublicConfig, hasSupabasePublicConfig } from "../../lib/supabase";

const DEFAULT_SELECTED_LEAGUES = [
  { name: "Premier League", code: "eng.1", category: "Europe" },
  { name: "Championship", code: "eng.2", category: "Europe" },
];

const DEFAULT_SYNCED_PREFERENCES = {
  theme: "light" as const,
  soundEnabled: true,
  commonMatchNotificationsEnabled: true,
  configuredLeagues: [
    { code: "eng.1", name: "Premier League", category: "Europe" },
    { code: "eng.2", name: "Championship", category: "Europe" },
    { code: "ger.1", name: "Bundesliga", category: "Europe" },
    { code: "esp.1", name: "La Liga", category: "Europe" },
    { code: "ita.1", name: "Serie A", category: "Europe" },
    { code: "fra.1", name: "Ligue 1", category: "Europe" },
    { code: "den.1", name: "Superliga", category: "Europe" },
  ],
  defaultSelectedLeagues: DEFAULT_SELECTED_LEAGUES,
};

jest.mock("expo-linking", () => ({
  createURL: jest.fn((path: string) => `myapp://${path.replace(/^\//, "")}`),
}));

jest.mock("../../lib/supabase", () => ({
  getSupabaseClient: jest.fn(),
  getSupabasePublicConfig: jest.fn(),
  hasSupabasePublicConfig: jest.fn(),
}));

const mockGetSupabaseClient = jest.mocked(getSupabaseClient);
const mockGetSupabasePublicConfig = jest.mocked(getSupabasePublicConfig);
const mockHasSupabasePublicConfig = jest.mocked(hasSupabasePublicConfig);

const createAccountsTableMock = (
  initialAccount: Record<string, unknown> | null = null,
) => {
  let accountRow: Record<string, unknown> | null = initialAccount;

  const accountsTable = {
    select: jest.fn(() => accountsTable),
    eq: jest.fn(() => accountsTable),
    maybeSingle: jest.fn(async () => ({ data: accountRow, error: null })),
    single: jest.fn(async () => ({ data: accountRow, error: null })),
    insert: jest.fn((values: Record<string, unknown>) => {
      accountRow = {
        id: values.id,
        username: null,
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      };

      return accountsTable;
    }),
    update: jest.fn((values: Record<string, unknown>) => {
      accountRow = {
        id: accountRow?.id ?? values.id,
        username:
          typeof values.username === "string" ||
          values.username === null
            ? values.username
            : (accountRow?.username ?? null),
        created_at: accountRow?.created_at ?? "2026-05-10T00:00:00.000Z",
        updated_at:
          typeof values.updated_at === "string" || values.updated_at === null
            ? values.updated_at
            : (accountRow?.updated_at ?? "2026-05-10T00:00:00.000Z"),
      };

      return accountsTable;
    }),
  };

  return {
    accountsTable,
    getCurrentAccount: () => accountRow,
  };
};

const createSupabaseClientMock = (
  initialAccount: Record<string, unknown> | null = null,
  initialSettings: Record<string, unknown> | null = null,
  bootstrapUserId = "host-1",
) => {
  const accounts = createAccountsTableMock(initialAccount);
  let settingsRow = initialSettings;
  let authStateChangeCallback:
    | ((event: unknown, nextSession: Session | null) => void)
    | null = null;
  const settingsTable = {
    select: jest.fn(() => settingsTable),
    eq: jest.fn(() => settingsTable),
    maybeSingle: jest.fn(async () => ({ data: settingsRow, error: null })),
    single: jest.fn(async () => ({ data: settingsRow, error: null })),
    upsert: jest.fn((values: Record<string, unknown>) => {
      settingsRow = {
        account_id: values.account_id,
        settings_data:
          values.settings_data ??
          settingsRow?.settings_data ??
          DEFAULT_SYNCED_PREFERENCES,
        created_at: settingsRow?.created_at ?? "2026-05-10T00:00:00.000Z",
        updated_at:
          typeof values.updated_at === "string" || values.updated_at === null
            ? values.updated_at
            : (settingsRow?.updated_at ?? "2026-05-10T00:00:00.000Z"),
      };

      return settingsTable;
    }),
  };
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
    getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
    onAuthStateChange: jest.fn(
      (callback: (event: unknown, nextSession: Session | null) => void) => {
        authStateChangeCallback = callback;

        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      },
    ),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    updateUser: jest.fn(async () => ({ data: { user: null }, error: null })),
  };

  return {
    auth,
    rpc: jest.fn((name: string, args?: Record<string, unknown>) => {
      if (name === "bootstrap_account") {
        if (!accounts.getCurrentAccount()) {
          accounts.accountsTable.insert({ id: bootstrapUserId });
        }
      } else {
        accounts.accountsTable.update({ username: args?.requested_username });
      }

      return accounts.accountsTable;
    }),
    from: jest.fn((table: string) =>
      table === "settings" ? settingsTable : accounts.accountsTable,
    ),
    accounts,
    settings: {
      settingsTable,
      getCurrentSettings: () => settingsRow,
    },
    emitAuthStateChange: (event: unknown, nextSession: Session | null) => {
      authStateChangeCallback?.(event, nextSession);
    },
  };
};

const renderAuthProbe = (observe: (auth: ReturnType<typeof useAccountAuth>) => void) => {
  const Probe = () => {
    observe(useAccountAuth());
    return null;
  };
  return actCreate(React.createElement(AccountAuthProvider, null, React.createElement(Probe)));
};

describe("account auth foundation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGameStore.setState(DEFAULT_SYNCED_PREFERENCES);
  });

  it("seeds first settings from bundled defaults without waiting for a catalog request", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    const client = createSupabaseClientMock({ id: "catalog-user", username: "Captain", created_at: null, updated_at: null });
    const session = { user: { id: "catalog-user" }, access_token: "token" } as Session;
    client.auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
    client.auth.getUser.mockResolvedValue({ data: { user: session.user }, error: null } as never);
    mockGetSupabaseClient.mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
    let auth!: ReturnType<typeof useAccountAuth>;
    const tree = renderAuthProbe(value => { auth = value; });
    await TestRenderer.act(async () => { await Promise.resolve(); });
    expect(auth.status).toBe("ready");
    expect(client.settings.settingsTable.upsert).toHaveBeenCalledWith(expect.objectContaining({
      settings_data: expect.objectContaining({ configuredLeagues: DEFAULT_SYNCED_PREFERENCES.configuredLeagues }),
    }), expect.anything());
    TestRenderer.act(() => tree.unmount());
  });

  it.each(["failed", "signedOut", "signedOutAndBack"])("keeps confirmed identity when a delayed username save is %s", async (outcome) => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    const row = { id: "owner", username: "Captain", created_at: null, updated_at: null };
    const client = createSupabaseClientMock(row);
    const session = { user: { id: "owner" }, access_token: "token" } as Session;
    client.auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
    client.auth.getUser.mockResolvedValue({ data: { user: session.user }, error: null } as never);
    mockGetSupabaseClient.mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
    let auth!: ReturnType<typeof useAccountAuth>;
    const Probe = () => { auth = useAccountAuth(); return null; };
    let tree!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { tree = TestRenderer.create(React.createElement(AccountAuthProvider, null, React.createElement(Probe))); });
    let complete!: (value: { data: Record<string, unknown> | null; error: { message: string } | null }) => void;
    client.rpc.mockImplementationOnce(() => client.accounts.accountsTable);
    client.accounts.accountsTable.single.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }) as never);
    let pending!: Promise<unknown>;
    TestRenderer.act(() => { pending = auth.saveUsername("Captain_New").catch(error => error); });
    if (outcome !== "failed") await TestRenderer.act(async () => { client.emitAuthStateChange("SIGNED_OUT", null); });
    if (outcome === "signedOutAndBack") await TestRenderer.act(async () => { client.emitAuthStateChange("SIGNED_IN", session); });
    await TestRenderer.act(async () => {
      complete(outcome === "failed" ? { data: null, error: { message: "username_unavailable" } } : { data: { ...row, username: "Captain_New" }, error: null });
      expect(await pending).toBeInstanceOf(Error);
    });
    expect(auth.account?.username ?? null).toBe(outcome === "signedOut" ? null : "Captain");
    TestRenderer.act(() => tree.unmount());
  });

  it("normalizes account display names", () => {
    expect(normalizeAccountUsername("  Captain  ")).toBe("Captain");
    expect(normalizeAccountUsername("   ")).toBeNull();
  });

  it("bootstraps a missing account row for the signed-in user", async () => {
    const client = createSupabaseClientMock(null, null, "host-1");

    const account = await bootstrapAccountRow(
      client as unknown as ReturnType<typeof getSupabaseClient>,
      "host-1",
    );

    expect(client.rpc).toHaveBeenCalledWith("bootstrap_account");
    expect(account).toMatchObject({
      id: "host-1",
      username: null,
    });
  });

  it("rejects blank display names before sending them to Postgres", async () => {
    const client = createSupabaseClientMock();

    await expect(
      saveAccountUsername(
        client as unknown as ReturnType<typeof getSupabaseClient>,
        "host-1",
        "   ",
      ),
    ).rejects.toThrow("Username cannot be blank.");
  });

  it("restores the saved display name from the account row", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock({
      id: "host-restore",
      username: "Restored Captain",
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-restore" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-restore" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    let observedAccount: ReturnType<typeof useAccountAuth>["account"] = null;

    renderAuthProbe((auth) => {
      observedAccount = auth.account;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(observedAccount).toMatchObject({
      username: "Restored Captain",
    });
  });

  it("saves the signed-in display name and keeps the last saved profile on validation errors", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock({
      id: "host-profile",
      username: "Captain",
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-profile" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-profile" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    let observedAccount: ReturnType<typeof useAccountAuth>["account"] = null;
    let saveUsername: ((displayName: string) => Promise<void>) | null = null;

    renderAuthProbe((auth) => {
      observedAccount = auth.account;
      saveUsername = auth.saveUsername;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      await saveUsername?.("Captain Updated");
    });

    expect(observedAccount).toMatchObject({
      username: "Captain Updated",
    });

    await expect(
      TestRenderer.act(async () => {
        await saveUsername?.("   ");
      }),
    ).rejects.toThrow("Username cannot be blank.");

    expect(observedAccount).toMatchObject({
      username: "Captain Updated",
    });
  });

  it("hydrates the supported settings from the saved settings row on session restore", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(
      {
        id: "host-settings-restore",
        username: "Captain",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
      {
        account_id: "host-settings-restore",
        settings_data: {
          theme: "dark",
          soundEnabled: false,
          commonMatchNotificationsEnabled: false,
          configuredLeagues: [
            { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
          ],
          defaultSelectedLeagues: [
            { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
          ],
        },
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
    );

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-settings-restore" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-settings-restore" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    actCreate(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(() => null),
      ),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getCurrentSyncedPreferenceState()).toMatchObject({
      theme: "dark",
      soundEnabled: false,
      commonMatchNotificationsEnabled: false,
      configuredLeagues: [
        { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
      ],
      defaultSelectedLeagues: [
        { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
      ],
    });
  });

  it("seeds the first synced settings row from the current local values", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    useGameStore.setState({
      theme: "dark",
      soundEnabled: false,
      commonMatchNotificationsEnabled: false,
      configuredLeagues: [
        { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
      ],
      defaultSelectedLeagues: [
        { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
      ],
    });

    const client = createSupabaseClientMock({
      id: "host-settings-seed",
      username: "Captain",
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    });

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-settings-seed" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-settings-seed" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    actCreate(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(() => null),
      ),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(client.settings.getCurrentSettings()).toMatchObject({
      account_id: "host-settings-seed",
      settings_data: {
        theme: "dark",
        soundEnabled: false,
        commonMatchNotificationsEnabled: false,
        configuredLeagues: [
          { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
        ],
        defaultSelectedLeagues: [
          { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
        ],
      },
    });
  });

  it("persists supported preference changes after the account is restored", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(
      {
        id: "host-settings-save",
        username: "Captain",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
      {
        account_id: "host-settings-save",
        settings_data: DEFAULT_SYNCED_PREFERENCES,
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
    );

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-settings-save" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-settings-save" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    actCreate(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(() => null),
      ),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      useGameStore.getState().setTheme("dark");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(client.settings.getCurrentSettings()).toMatchObject({
      settings_data: expect.objectContaining({
        theme: "dark",
      }),
    });
  });

  it("signs out without clearing the local synced settings", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(
      {
        id: "host-signout",
        username: "Captain",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
      {
        account_id: "host-signout",
        settings_data: {
          theme: "dark",
          soundEnabled: false,
          commonMatchNotificationsEnabled: false,
          configuredLeagues: [
            { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
          ],
          defaultSelectedLeagues: [
            { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
          ],
        },
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
    );

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-signout" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-signout" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    let signOut: (() => Promise<void>) | null = null;
    let observedStatus = "loading";

    renderAuthProbe((auth) => {
      signOut = auth.signOut;
      observedStatus = auth.status;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      await signOut?.();
    });

    expect(observedStatus).toBe("signedOut");
    expect(getCurrentSyncedPreferenceState()).toMatchObject({
      theme: "dark",
      soundEnabled: false,
      commonMatchNotificationsEnabled: false,
    });
  });

  it("moves to a recoverable signed-out state when the session expires", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(
      {
        id: "host-expired",
        username: "Captain",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
      {
        account_id: "host-expired",
        settings_data: DEFAULT_SYNCED_PREFERENCES,
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      },
    );

    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-expired" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-expired" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    let observedStatus = "loading";
    let observedSessionNotice: string | null = null;

    renderAuthProbe((auth) => {
      observedStatus = auth.status;
      observedSessionNotice = auth.sessionNotice;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      client.emitAuthStateChange("SIGNED_OUT", null);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(observedStatus).toBe("signedOut");
    expect(observedSessionNotice).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("boots a newly signed-up account into display-name onboarding", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(null, null, "host-2");
    (
      client.auth.signUp as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-2" },
        },
      },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    let observedStatus = "loading";
    let signUpAccount:
      | ((
          email: string,
          password: string,
          returnTo?: string | null,
        ) => Promise<void>)
      | null = null;

    renderAuthProbe((auth) => {
      observedStatus = auth.status;
      signUpAccount = auth.signUp;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      await signUpAccount?.("host-2@test.local", "password-123", "/setupGame");
    });

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "host-2@test.local",
      password: "password-123",
      options: {
        emailRedirectTo: "myapp://auth?returnTo=%2FsetupGame",
      },
    });
    expect(observedStatus).toBe("needsUsername");
    expect(client.accounts.getCurrentAccount()).toMatchObject({
      id: "host-2",
      username: null,
    });
  });

  it("updates the password and signs the recovery session out", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(null, null, "host-3");
    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-3" },
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-3" } },
      error: null,
    });
    (
      client.auth.updateUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-3" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    let completePasswordRecovery:
      | ((newPassword: string) => Promise<void>)
      | null = null;
    let observedStatus = "loading";

    renderAuthProbe((auth) => {
      completePasswordRecovery = auth.completePasswordRecovery;
      observedStatus = auth.status;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      await completePasswordRecovery?.("new-password-123");
    });

    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: "new-password-123",
    });
    expect(client.auth.signOut).toHaveBeenCalled();
    expect(observedStatus).toBe("signedOut");
  });

  it("calls the delete-account edge function and transitions to signedOut", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockGetSupabasePublicConfig.mockReturnValue({
      url: "https://test.supabase.co",
      apiKey: "test-anon-key",
    });

    const client = createSupabaseClientMock(null, null, "host-5");
    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-5" },
          access_token: "test-access-token",
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-5" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    const mockFetch: typeof fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    globalThis.fetch = mockFetch;

    let deleteAccount: (() => Promise<void>) | null = null;
    let observedStatus = "loading";

    renderAuthProbe((auth) => {
      deleteAccount = auth.deleteAccount;
      observedStatus = auth.status;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      await deleteAccount?.();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.supabase.co/functions/v1/delete-account",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
    expect(observedStatus).toBe("signedOut");
  });

  it("throws when the delete-account edge function returns an error", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);
    mockGetSupabasePublicConfig.mockReturnValue({
      url: "https://test.supabase.co",
      apiKey: "test-anon-key",
    });

    const client = createSupabaseClientMock(null, null, "host-6");
    (
      client.auth.getSession as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        session: {
          user: { id: "host-6" },
          access_token: "test-access-token",
        },
      },
      error: null,
    });
    (
      client.auth.getUser as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: { user: { id: "host-6" } },
      error: null,
    });

    mockGetSupabaseClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseClient>,
    );

    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: "Deletion failed" }), {
          status: 500,
        }),
    ) as typeof fetch;

    let deleteAccount: (() => Promise<void>) | null = null;

    renderAuthProbe((auth) => {
      deleteAccount = auth.deleteAccount;
    });

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await expect(
      TestRenderer.act(async () => {
        await deleteAccount?.();
      }),
    ).rejects.toThrow("Deletion failed");
  });

  it("keeps the provider in signed-out mode when Supabase is not configured", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(false);
    mockGetSupabaseClient.mockImplementation(() => {
      throw new Error("Unexpected client access in an unconfigured test");
    });

    let observedStatus = "loading";

    const Probe = () => {
      observedStatus = useAccountAuth().status;
      return null;
    };

    TestRenderer.act(() => {
      TestRenderer.create(
        React.createElement(
          AccountAuthProvider,
          null,
          React.createElement(Probe),
        ),
      );
    });

    expect(observedStatus).toBe("signedOut");
  });
});
