import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  LEGACY_HISTORY_IMPORT_AUTH_STORAGE_KEY,
  PERSISTED_STORE_KEY,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

const DEFAULT_BASE_URL = "http://localhost:8093";
const HOST_PROFILE_SESSION_EVENT = "dong:e2e:session-expired";
const SESSION_EXPIRED_MESSAGE =
  "Your session ended. Sign in again to keep managing your profile and synced settings.";
const HOST_PROFILE_USER_ID = "13131313-1313-1313-1313-131313131313";
const HOST_PROFILE_EMAIL = "host-profile@test.local";
const FIXED_TIMESTAMP = "2026-05-15T12:00:00.000Z";

type SyncedPreferenceState = {
  theme: "light" | "dark";
  soundEnabled: boolean;
  commonMatchNotificationsEnabled: boolean;
  configuredLeagues: {
    code: string;
    name: string;
    category?: string;
  }[];
  defaultSelectedLeagues: {
    code: string;
    name: string;
    category?: string;
  }[];
};

const PREMIER_LEAGUE = {
  code: "eng.1",
  name: "Premier League",
  category: "Europe",
} as const;
const CHAMPIONSHIP = {
  code: "eng.2",
  name: "Championship",
  category: "Europe",
} as const;
const MLS = {
  code: "usa.1",
  name: "MLS",
} as const;
const LALIGA = {
  code: "esp.1",
  name: "LaLiga",
  category: "Europe",
} as const;

const createSyncedSettings = (
  overrides: Partial<SyncedPreferenceState> = {},
): SyncedPreferenceState => ({
  theme: overrides.theme ?? "light",
  soundEnabled: overrides.soundEnabled ?? true,
  commonMatchNotificationsEnabled:
    overrides.commonMatchNotificationsEnabled ?? true,
  configuredLeagues: (overrides.configuredLeagues ?? [PREMIER_LEAGUE]).map(
    (league) => ({ ...league }),
  ),
  defaultSelectedLeagues: (
    overrides.defaultSelectedLeagues ?? [PREMIER_LEAGUE]
  ).map((league) => ({ ...league })),
});

const RESTORED_HOST_SETTINGS = createSyncedSettings({
  configuredLeagues: [PREMIER_LEAGUE, CHAMPIONSHIP],
  defaultSelectedLeagues: [PREMIER_LEAGUE],
});

const FIRST_SYNC_LOCAL_SETTINGS = createSyncedSettings({
  theme: "dark",
  soundEnabled: false,
  commonMatchNotificationsEnabled: false,
  configuredLeagues: [PREMIER_LEAGUE, CHAMPIONSHIP, MLS],
  defaultSelectedLeagues: [MLS],
});

const RETURNING_LOCAL_SETTINGS = createSyncedSettings({
  theme: "light",
  soundEnabled: true,
  commonMatchNotificationsEnabled: true,
  configuredLeagues: [PREMIER_LEAGUE, LALIGA],
  defaultSelectedLeagues: [PREMIER_LEAGUE, LALIGA],
});

const CLOUD_SYNCED_SETTINGS = createSyncedSettings({
  theme: "dark",
  soundEnabled: false,
  commonMatchNotificationsEnabled: false,
  configuredLeagues: [PREMIER_LEAGUE, CHAMPIONSHIP, MLS],
  defaultSelectedLeagues: [MLS],
});

type MockAccountRow = {
  id: string;
  preferred_display_name: string | null;
  created_at: string;
  updated_at: string | null;
};

type MockSettingsRow = {
  account_id: string;
  settings_data: SyncedPreferenceState;
  created_at: string;
  updated_at: string;
};

type MockHostProfileState = {
  userId: string;
  email: string;
  account: MockAccountRow;
  settings: MockSettingsRow | null;
};

const cloneSyncedSettings = (settings: SyncedPreferenceState) => ({
  theme: settings.theme,
  soundEnabled: settings.soundEnabled,
  commonMatchNotificationsEnabled: settings.commonMatchNotificationsEnabled,
  configuredLeagues: settings.configuredLeagues.map((league) => ({
    ...league,
  })),
  defaultSelectedLeagues: settings.defaultSelectedLeagues.map((league) => ({
    ...league,
  })),
});

const createMockAccountRow = (
  overrides: Partial<MockAccountRow> = {},
): MockAccountRow => ({
  id: HOST_PROFILE_USER_ID,
  preferred_display_name: "Captain",
  created_at: FIXED_TIMESTAMP,
  updated_at: FIXED_TIMESTAMP,
  ...overrides,
});

const createMockSettingsRow = (
  settings: SyncedPreferenceState,
): MockSettingsRow => ({
  account_id: HOST_PROFILE_USER_ID,
  settings_data: cloneSyncedSettings(settings),
  created_at: FIXED_TIMESTAMP,
  updated_at: FIXED_TIMESTAMP,
});

const createMockHostProfileState = ({
  account,
  settings = RESTORED_HOST_SETTINGS,
}: {
  account?: Partial<MockAccountRow>;
  settings?: SyncedPreferenceState | null;
} = {}): MockHostProfileState => ({
  userId: HOST_PROFILE_USER_ID,
  email: HOST_PROFILE_EMAIL,
  account: createMockAccountRow(account),
  settings: settings ? createMockSettingsRow(settings) : null,
});

const buildHostAuthUser = (state: MockHostProfileState) => ({
  id: state.userId,
  aud: "authenticated",
  role: "authenticated",
  email: state.email,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: FIXED_TIMESTAMP,
  updated_at: FIXED_TIMESTAMP,
});

const buildHostAuthSession = (state: MockHostProfileState) => ({
  access_token: "host-profile-access-token",
  refresh_token: "host-profile-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: buildHostAuthUser(state),
});

const buildPersistedStoreState = (settings: SyncedPreferenceState) => ({
  state: {
    players: [],
    matches: [],
    commonMatchId: null,
    playerAssignments: {},
    matchesPerPlayer: 1,
    history: [],
    ...cloneSyncedSettings(settings),
  },
  version: 0,
});

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers":
    "authorization,x-client-info,apikey,content-type,prefer,accept",
};

let activeHostProfileState = createMockHostProfileState();
let expectedSeededSettings: SyncedPreferenceState | null = null;

const resetHostProfileScenario = () => {
  activeHostProfileState = createMockHostProfileState();
  expectedSeededSettings = null;
};

const fulfillJson = async (
  route: Parameters<Page["route"]>[1] extends (
    route: infer RouteType,
  ) => Promise<void>
    ? RouteType
    : never,
  status: number,
  body: unknown,
) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
};

const readJsonRequestBody = (
  page: Parameters<Page["route"]>[1] extends (
    route: infer RouteType,
  ) => Promise<void>
    ? RouteType
    : never,
) => {
  const body = page.request().postDataJSON() as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;

  if (!body) {
    return {};
  }

  return Array.isArray(body) ? (body[0] ?? {}) : body;
};

const installHostProfileMocks = async (page: Page) => {
  await page.route("**/auth/v1/user**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers: corsHeaders });
      return;
    }

    await fulfillJson(route, 200, buildHostAuthUser(activeHostProfileState));
  });

  await page.route("**/auth/v1/logout**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers: corsHeaders });
      return;
    }

    await fulfillJson(route, 200, {});
  });

  await page.route("**/rest/v1/accounts**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers: corsHeaders });
      return;
    }

    if (route.request().method() === "GET") {
      await fulfillJson(route, 200, activeHostProfileState.account);
      return;
    }

    if (route.request().method() === "POST") {
      const body = readJsonRequestBody(route);

      activeHostProfileState.account = createMockAccountRow({
        id:
          typeof body.id === "string"
            ? body.id
            : activeHostProfileState.account.id,
      });

      await fulfillJson(route, 201, []);
      return;
    }

    if (route.request().method() === "PATCH") {
      const body = readJsonRequestBody(route);

      activeHostProfileState.account = {
        ...activeHostProfileState.account,
        preferred_display_name:
          typeof body.preferred_display_name === "string" ||
          body.preferred_display_name === null
            ? body.preferred_display_name
            : activeHostProfileState.account.preferred_display_name,
        updated_at:
          typeof body.updated_at === "string"
            ? body.updated_at
            : new Date().toISOString(),
      };

      await fulfillJson(route, 200, activeHostProfileState.account);
      return;
    }

    await route.continue();
  });

  await page.route("**/rest/v1/settings**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers: corsHeaders });
      return;
    }

    if (route.request().method() === "GET") {
      if (!activeHostProfileState.settings) {
        await fulfillJson(route, 200, []);
        return;
      }

      await fulfillJson(route, 200, activeHostProfileState.settings);
      return;
    }

    if (route.request().method() === "POST") {
      const body = readJsonRequestBody(route);
      const nextSettings = cloneSyncedSettings(
        body.settings_data as SyncedPreferenceState,
      );

      activeHostProfileState.settings = {
        account_id:
          typeof body.account_id === "string"
            ? body.account_id
            : HOST_PROFILE_USER_ID,
        settings_data: nextSettings,
        created_at:
          activeHostProfileState.settings?.created_at ?? FIXED_TIMESTAMP,
        updated_at:
          typeof body.updated_at === "string"
            ? body.updated_at
            : new Date().toISOString(),
      };

      await fulfillJson(route, 200, activeHostProfileState.settings);
      return;
    }

    await route.continue();
  });
};

const seedSignedInHostState = async (
  page: Page,
  syncedSettings: SyncedPreferenceState,
) => {
  await page.addInitScript(
    ({ persistedStoreKey, persistedState, authStorageKey, authSession }) => {
      globalThis.localStorage.setItem(
        persistedStoreKey,
        JSON.stringify(persistedState),
      );
      globalThis.localStorage.setItem(
        authStorageKey,
        JSON.stringify(authSession),
      );
    },
    {
      persistedStoreKey: PERSISTED_STORE_KEY,
      persistedState: buildPersistedStoreState(syncedSettings),
      authStorageKey: LEGACY_HISTORY_IMPORT_AUTH_STORAGE_KEY,
      authSession: buildHostAuthSession(activeHostProfileState),
    },
  );
};

const waitForPreferencesScreen = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("UserPreferencesContent")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("AccountSection")).toBeVisible();
};

const openPreferences = async (page: Page, baseURL?: string | null) => {
  await page.goto(`${baseURL ?? DEFAULT_BASE_URL}/userPreferences`, {
    waitUntil: "commit",
    timeout: 60_000,
  });
  await waitForPreferencesScreen(page);
};

const getSwitchState = async (page: Page, testID: string) => {
  return page.getByTestId(testID).evaluate((element) => {
    const nestedSwitch =
      element instanceof HTMLInputElement ||
      element.getAttribute("role") === "switch"
        ? element
        : element.querySelector('[role="switch"], input[type="checkbox"]');

    if (!nestedSwitch) {
      return null;
    }

    if (nestedSwitch instanceof HTMLInputElement) {
      return nestedSwitch.checked;
    }

    return nestedSwitch.getAttribute("aria-checked") === "true";
  });
};

Given(
  "the host profile settings flow is available",
  async ({ page, $testInfo }) => {
    $testInfo.setTimeout(Math.max($testInfo.timeout, 90_000));
    resetHostProfileScenario();

    await page.addInitScript(() => {
      globalThis.localStorage.setItem("hasLaunched", "true");
      (
        globalThis as typeof globalThis & { __DONG_E2E__?: boolean }
      ).__DONG_E2E__ = true;
    });

    await installHostProfileMocks(page);
  },
);

Given(
  "a signed-in host profile is restored in preferences",
  async ({ page, baseURL }) => {
    activeHostProfileState = createMockHostProfileState({
      settings: RESTORED_HOST_SETTINGS,
    });

    await seedSignedInHostState(page, RESTORED_HOST_SETTINGS);
    await openPreferences(page, baseURL);
  },
);

Given(
  "the local preference state is seeded for first sync",
  async ({ page }) => {
    activeHostProfileState = createMockHostProfileState({ settings: null });
    expectedSeededSettings = cloneSyncedSettings(FIRST_SYNC_LOCAL_SETTINGS);

    await seedSignedInHostState(page, FIRST_SYNC_LOCAL_SETTINGS);
  },
);

Given(
  "cloud-backed settings already exist for the signed-in host",
  async ({ page }) => {
    activeHostProfileState = createMockHostProfileState({
      settings: CLOUD_SYNCED_SETTINGS,
    });
    expectedSeededSettings = cloneSyncedSettings(CLOUD_SYNCED_SETTINGS);

    await seedSignedInHostState(page, RETURNING_LOCAL_SETTINGS);
  },
);

When(
  "the host updates the profile display name to {string}",
  async ({ page }, displayName: string) => {
    await page.getByTestId("ProfileDisplayNameInput").fill(displayName);
  },
);

When("the host saves the profile form", async ({ page }) => {
  await page.getByText("Save display name", { exact: true }).click();
  await page.waitForLoadState("networkidle");
});

When("the host clears the profile display name", async ({ page }) => {
  await page.getByTestId("ProfileDisplayNameInput").fill("");
});

When(
  "the signed-in host restores preferences without cloud settings",
  async ({ page, baseURL }) => {
    await openPreferences(page, baseURL);
  },
);

When(
  "the signed-in host restores preferences on another session",
  async ({ page, baseURL }) => {
    await openPreferences(page, baseURL);
  },
);

When("the host signs out from preferences", async ({ page }) => {
  await page.getByText("Sign out", { exact: true }).click();
  await page.waitForLoadState("networkidle");
});

When("the signed-in host session expires in preferences", async ({ page }) => {
  await page.evaluate((eventName) => {
    globalThis.dispatchEvent(new Event(eventName));
  }, HOST_PROFILE_SESSION_EVENT);
});

Then(
  "the saved profile should show display name {string}",
  async ({ page }, displayName: string) => {
    await page.reload({ waitUntil: "commit" });
    await waitForPreferencesScreen(page);
    await expect(page.getByTestId("ProfileDisplayNameInput")).toHaveValue(
      displayName,
    );
  },
);

Then(
  "the profile validation message should say {string}",
  async ({ page }, message: string) => {
    await expect(page.getByTestId("ProfileValidationMessage")).toHaveText(
      message,
    );
  },
);

Then(
  "the synced settings row should seed from the current local values",
  async ({ page: _page }) => {
    expect(expectedSeededSettings).not.toBeNull();
    await expect
      .poll(() =>
        JSON.stringify(activeHostProfileState.settings?.settings_data ?? null),
      )
      .toBe(JSON.stringify(expectedSeededSettings));
  },
);

Then(
  "the synced settings should match the saved account state",
  async ({ page }) => {
    const expectedSettings = activeHostProfileState.settings?.settings_data;

    expect(expectedSettings).not.toBeNull();

    await expect
      .poll(() => getSwitchState(page, "ThemeSettingSwitch"))
      .toBe(expectedSettings?.theme === "dark");
    await expect
      .poll(() => getSwitchState(page, "SoundSettingSwitch"))
      .toBe(expectedSettings?.soundEnabled ?? false);
    await expect
      .poll(() => getSwitchState(page, "CommonMatchNotificationsSwitch"))
      .toBe(expectedSettings?.commonMatchNotificationsEnabled ?? false);

    await expect(page.getByTestId("ManageLeaguesRow")).toContainText(
      `${expectedSettings?.configuredLeagues.length ?? 0} leagues`,
    );
    await expect(page.getByTestId("DefaultLeaguesRow")).toContainText(
      `${expectedSettings?.defaultSelectedLeagues.length ?? 0} selected`,
    );

    const persistedState = await page.evaluate(
      ({ storageKey }) => {
        const rawState = globalThis.localStorage.getItem(storageKey);

        return rawState ? JSON.parse(rawState) : null;
      },
      { storageKey: PERSISTED_STORE_KEY },
    );

    expect(persistedState?.state).toMatchObject(expectedSettings ?? {});
  },
);

Then(
  "the preferences screen should show the signed-out recovery state",
  async ({ page }) => {
    await expect(
      page.getByText("Sign in or create account", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("ProfileSection")).toHaveCount(0);
    await expect(
      page.getByText("Sign in to create and manage multiplayer rooms.", {
        exact: true,
      }),
    ).toBeVisible();
  },
);

Then("the session failure message should be visible", async ({ page }) => {
  await expect(
    page.getByText(SESSION_EXPIRED_MESSAGE, { exact: true }),
  ).toBeVisible();
});
