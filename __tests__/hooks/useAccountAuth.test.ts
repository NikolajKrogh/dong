import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  AccountAuthProvider,
  bootstrapAccountRow,
  normalizeAccountDisplayName,
  saveAccountDisplayName,
  useAccountAuth,
} from "../../hooks/useAccountAuth";
import {
  getSupabaseClient,
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "../../utils/supabaseClient";

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

const createAccountsTableMock = () => {
  let accountRow: Record<string, unknown> | null = null;

  const accountsTable = {
    select: jest.fn(() => accountsTable),
    eq: jest.fn(() => accountsTable),
    maybeSingle: jest.fn(async () => ({ data: accountRow, error: null })),
    single: jest.fn(async () => ({ data: accountRow, error: null })),
    insert: jest.fn((values: Record<string, unknown>) => {
      accountRow = {
        id: values.id,
        preferred_display_name: null,
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      };

      return accountsTable;
    }),
    update: jest.fn((values: Record<string, unknown>) => {
      accountRow = {
        id: accountRow?.id ?? values.id,
        preferred_display_name:
          (values.preferred_display_name as string | null | undefined) ??
          accountRow?.preferred_display_name ??
          null,
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

const createSupabaseClientMock = () => {
  const accounts = createAccountsTableMock();
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
    getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    })),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    updateUser: jest.fn(async () => ({ data: { user: null }, error: null })),
  };

  return {
    auth,
    from: jest.fn(() => accounts.accountsTable),
    accounts,
  };
};

describe("account auth foundation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes account display names", () => {
    expect(normalizeAccountDisplayName("  Captain  ")).toBe("Captain");
    expect(normalizeAccountDisplayName("   ")).toBeNull();
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
