import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { LEAGUE_ENDPOINTS } from "../../constants/leagues";
import {
  AccountAuthProvider,
  SESSION_EXPIRED_MESSAGE,
  bootstrapAccountRow,
  normalizeAccountDisplayName,
  normalizeAccountUsername,
  saveAccountProfile,
  saveAccountDisplayName,
  useAccountAuth,
} from "../../hooks/useAccountAuth";
import { getCurrentSyncedPreferenceState, useGameStore } from "../../store/store";
import {
  getSupabaseClient,
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "../../utils/supabaseClient";

const DEFAULT_SELECTED_LEAGUES = [
  { name: "Premier League", code: "eng.1", category: "Europe" },
  { name: "Championship", code: "eng.2", category: "Europe" },
];

const DEFAULT_SYNCED_PREFERENCES = {
  theme: "light" as const,
  soundEnabled: true,
  commonMatchNotificationsEnabled: true,
  configuredLeagues: LEAGUE_ENDPOINTS,
  defaultSelectedLeagues: DEFAULT_SELECTED_LEAGUES,
};

jest.mock("expo-linking", () => ({
  createURL: jest.fn((path: string) => `myapp://${path.replace(/^\//, "")}`),
}));

jest.mock("../../utils/supabaseClient", () => ({
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
        preferred_display_name: null,
        username:
          (values.username as string | null | undefined) ??
          accountRow?.username ??
          null,
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      };

      return accountsTable;
    }),
    update: jest.fn((values: Record<string, unknown>) => {
      accountRow = {
        id: accountRow?.id ?? values.id,
        preferred_display_name:
          Object.prototype.hasOwnProperty.call(values, "preferred_display_name")
            ? ((values.preferred_display_name as string | null | undefined) ??
              null)
            : (accountRow?.preferred_display_name ?? null),
        username:
          Object.prototype.hasOwnProperty.call(values, "username")
            ? ((values.username as string | null | undefined) ?? null)
            : (accountRow?.username ?? null),
        created_at: accountRow?.created_at ?? "2026-05-10T00:00:00.000Z",
        updated_at:
          (values.updated_at as string | null | undefined) ??
          accountRow?.updated_at ??
          "2026-05-10T00:00:00.000Z",
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
          values.settings_data ?? settingsRow?.settings_data ?? DEFAULT_SYNCED_PREFERENCES,
        created_at:
          settingsRow?.created_at ?? "2026-05-10T00:00:00.000Z",
        updated_at:
          (values.updated_at as string | null | undefined) ??
          settingsRow?.updated_at ??
          "2026-05-10T00:00:00.000Z",
      };

      return settingsTable;
    }),
  };
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
    getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
    onAuthStateChange: jest.fn((callback: (event: unknown, nextSession: Session | null) => void) => {
      authStateChangeCallback = callback;

      return {
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    };}),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    updateUser: jest.fn(async () => ({ data: { user: null }, error: null })),
  };

  return {
    auth,
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

describe("account auth foundation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGameStore.setState(DEFAULT_SYNCED_PREFERENCES);
  });

  it("normalizes account display names", () => {
    expect(normalizeAccountDisplayName("  Captain  ")).toBe("Captain");
    expect(normalizeAccountDisplayName("   ")).toBeNull();
  });

  it("normalizes account usernames", () => {
    expect(normalizeAccountUsername("  captain.owner  ")).toBe(
      "captain.owner",
    );
    expect(normalizeAccountUsername("   ")).toBeNull();
  });

  it("bootstraps a missing account row for the signed-in user", async () => {
    const client = createSupabaseClientMock();

    const account = await bootstrapAccountRow(
      client as unknown as ReturnType<typeof getSupabaseClient>,
      "host-1",
    );

    expect(client.from).toHaveBeenCalledWith("accounts");
    expect(client.accounts.accountsTable.insert).toHaveBeenCalledWith({
      id: "host-1",
    });
    expect(account).toMatchObject({
      id: "host-1",
      preferredDisplayName: null,
    });
  });

  it("rejects blank display names before sending them to Postgres", async () => {
    const client = createSupabaseClientMock();

    await expect(
      saveAccountDisplayName(
        client as unknown as ReturnType<typeof getSupabaseClient>,
        "host-1",
        "   ",
      ),
    ).rejects.toThrow("Account display name cannot be blank.");
  });

  it("rejects blank usernames before sending them to Postgres", async () => {
    const client = createSupabaseClientMock();

    await expect(
      saveAccountProfile(
        client as unknown as ReturnType<typeof getSupabaseClient>,
        "host-1",
        {
          displayName: "Captain",
          username: "   ",
        },
      ),
    ).rejects.toThrow("Account username cannot be blank.");

    expect(client.accounts.accountsTable.update).not.toHaveBeenCalled();
  });

  it("restores the saved profile fields from the account row", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock({
      id: "host-restore",
      preferred_display_name: "Restored Captain",
      username: "restored-handle",
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

    const Probe = () => {
      observedAccount = useAccountAuth().account;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(observedAccount).toMatchObject({
      preferredDisplayName: "Restored Captain",
      username: "restored-handle",
    });
  });

  it("saves the signed-in profile fields and keeps the last saved profile on validation errors", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock({
      id: "host-profile",
      preferred_display_name: "Captain",
      username: "captain-owner",
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
    let saveProfile:
      | ((profile: { displayName: string; username: string }) => Promise<void>)
      | null = null;

    const Probe = () => {
      const auth = useAccountAuth();
      observedAccount = auth.account;
      saveProfile = auth.saveProfile;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

    await TestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await TestRenderer.act(async () => {
      await saveProfile?.({
        displayName: "Captain Updated",
        username: "captain-updated",
      });
    });

    expect(observedAccount).toMatchObject({
      preferredDisplayName: "Captain Updated",
      username: "captain-updated",
    });

    await expect(
      TestRenderer.act(async () => {
        await saveProfile?.({
          displayName: "   ",
          username: "captain-updated",
        });
      }),
    ).rejects.toThrow("Account display name cannot be blank.");

    expect(observedAccount).toMatchObject({
      preferredDisplayName: "Captain Updated",
      username: "captain-updated",
    });
  });

  it("hydrates the supported settings from the saved settings row on session restore", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock(
      {
        id: "host-settings-restore",
        preferred_display_name: "Captain",
        username: "captain-owner",
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

    TestRenderer.create(
      React.createElement(AccountAuthProvider, null, React.createElement(() => null)),
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
      preferred_display_name: "Captain",
      username: "captain-owner",
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

    TestRenderer.create(
      React.createElement(AccountAuthProvider, null, React.createElement(() => null)),
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
        preferred_display_name: "Captain",
        username: "captain-owner",
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

    TestRenderer.create(
      React.createElement(AccountAuthProvider, null, React.createElement(() => null)),
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
        preferred_display_name: "Captain",
        username: "captain-owner",
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

    const Probe = () => {
      const auth = useAccountAuth();
      signOut = auth.signOut;
      observedStatus = auth.status;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

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
        preferred_display_name: "Captain",
        username: "captain-owner",
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

    const Probe = () => {
      const auth = useAccountAuth();
      observedStatus = auth.status;
      observedSessionNotice = auth.sessionNotice;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

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

    const client = createSupabaseClientMock();
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

    const Probe = () => {
      const auth = useAccountAuth();
      observedStatus = auth.status;
      signUpAccount = auth.signUp;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

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
    expect(observedStatus).toBe("needsDisplayName");
    expect(client.accounts.getCurrentAccount()).toMatchObject({
      id: "host-2",
      preferred_display_name: null,
    });
  });

  it("updates the password and signs the recovery session out", async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true);

    const client = createSupabaseClientMock();
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

    const Probe = () => {
      const auth = useAccountAuth();
      completePasswordRecovery = auth.completePasswordRecovery;
      observedStatus = auth.status;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

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

    const client = createSupabaseClientMock();
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

    const mockFetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    let deleteAccount: (() => Promise<void>) | null = null;
    let observedStatus = "loading";

    const Probe = () => {
      const auth = useAccountAuth();
      deleteAccount = auth.deleteAccount;
      observedStatus = auth.status;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

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

    const client = createSupabaseClientMock();
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

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "Deletion failed" }), {
        status: 500,
      }),
    ) as unknown as typeof fetch;

    let deleteAccount: (() => Promise<void>) | null = null;

    const Probe = () => {
      const auth = useAccountAuth();
      deleteAccount = auth.deleteAccount;
      return null;
    };

    TestRenderer.create(
      React.createElement(
        AccountAuthProvider,
        null,
        React.createElement(Probe),
      ),
    );

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
