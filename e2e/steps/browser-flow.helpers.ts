import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type {
  GuestRoomJoinResponse,
  GuestRoomParticipantSummary,
  GuestRoomSnapshot,
} from "../../types/guestRoom";
import type {
  ImportLegacyHistoryRpcRequest,
  ImportLegacyHistoryRpcResponse,
  LegacyLocalSessionSnapshot,
} from "../../types/legacyHistoryImport";
import {
  createGuestRoomHostFixture,
  type GuestRoomHostFixture,
} from "../fixtures";

export const PERSISTED_STORE_KEY = "dong-storage" as const;

export const LEGACY_HISTORY_IMPORT_SUPABASE_URL =
  "http://127.0.0.1:55321" as const;

/** Fake command-api origin — never actually started; every call is intercepted via page.route. */
export const CONFIGURE_START_GAME_COMMAND_API_URL =
  "http://127.0.0.1:55322" as const;

export const LEGACY_HISTORY_IMPORT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" as const;

export const LEGACY_HISTORY_IMPORT_PUBLISHABLE_KEY =
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" as const;

export const LEGACY_HISTORY_IMPORT_AUTH_STORAGE_KEY =
  `sb-${new URL(LEGACY_HISTORY_IMPORT_SUPABASE_URL).hostname.split(".")[0]}-auth-token` as const;

export const LEGACY_HISTORY_IMPORT_USER_ID =
  "11111111-1111-1111-1111-111111111111" as const;

export const LEGACY_HISTORY_IMPORT_USER_EMAIL =
  "legacy-import@example.com" as const;

export const HOST_ROOM_CREATE_RPC_PATH =
  "**/rest/v1/rpc/create_room_as_host" as const;

export const HOST_ROOM_USER_ID =
  "22222222-2222-2222-2222-222222222222" as const;

export const HOST_ROOM_USER_EMAIL = "host-room@example.com" as const;

export const HOST_ROOM_DISPLAY_NAME = "Alice Host" as const;

export const HOST_ROOM_JOIN_CODE = "123456" as const;

export const HOST_ROOM_SESSION_ID = "host-room-session-1" as const;

export const HOST_ROOM_PARTICIPANT_ID = "host-room-participant-1" as const;

export const GUEST_ROOM_JOIN_RPC_PATH =
  "**/rest/v1/rpc/join_room_as_guest" as const;

export const GUEST_ROOM_SNAPSHOT_RPC_PATH =
  "**/rest/v1/rpc/get_guest_room_snapshot" as const;

export const GUEST_ROOM_SESSION_GRANT_STORAGE_KEY =
  "dong:guest-room-session-grant" as const;

let legacyHistoryImportRpcCallCount = 0;
let legacyHistoryImportRpcLastRequest: ImportLegacyHistoryRpcRequest | null =
  null;
let guestRoomJoinRpcLastRequest: {
  join_code?: string;
  guest_name?: string;
  guest_token?: string;
} | null = null;
let activeGuestRoomFixture: GuestRoomHostFixture | null = null;
let activeGuestParticipant: GuestRoomParticipantSummary | null = null;

export const getLegacyHistoryImportRpcCallCount = () =>
  legacyHistoryImportRpcCallCount;

export const getLegacyHistoryImportRpcLastRequest = () =>
  legacyHistoryImportRpcLastRequest;

export const getGuestRoomJoinRpcLastRequest = () => guestRoomJoinRpcLastRequest;

export const HOME_READY_MARKERS = [
  "Start New Game",
  "Continue Game",
  "Current Game in Progress",
  "Game Stats",
] as const;

export const ONBOARDING_DISMISS_TEXT = "Skip" as const;

export interface SetupJourneyMatchInput {
  homeTeam: string;
  awayTeam: string;
}

export interface SetupJourneyDataset {
  playerNames: string[];
  matches: SetupJourneyMatchInput[];
  commonMatchIndex: number;
  matchesPerPlayer: number;
}

export interface BrowserFlowPlayer {
  id: string;
  name: string;
  drinksTaken?: number;
}

export interface BrowserFlowMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface BrowserFlowPersistedState {
  state: {
    players: BrowserFlowPlayer[];
    matches: BrowserFlowMatch[];
    commonMatchId: string | null;
    playerAssignments: Record<string, string[]>;
    matchesPerPlayer: number;
    history: unknown[];
    theme: "light" | "dark";
  };
  version: 0;
}

export const createLegacyHistoryImportSessions =
  (): LegacyLocalSessionSnapshot[] => [
    {
      id: "legacy-session-a",
      date: "2026-05-01T19:00:00.000Z",
      players: [
        { id: "alex-session-a", name: "Alex Example", drinksTaken: 2 },
        { id: "jordan-session-a", name: "Jordan Guest", drinksTaken: 1 },
      ],
      matches: [
        {
          id: "legacy-match-a-1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeGoals: 2,
          awayGoals: 1,
        },
      ],
      commonMatchId: "legacy-match-a-1",
      playerAssignments: {
        "alex-session-a": ["legacy-match-a-1"],
        "jordan-session-a": ["legacy-match-a-1"],
      },
      matchesPerPlayer: 1,
    },
    {
      id: "legacy-session-b",
      date: "2026-05-03T19:00:00.000Z",
      players: [
        { id: "alex-session-b", name: "Alex Example", drinksTaken: 4 },
        { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 3 },
      ],
      matches: [
        {
          id: "legacy-match-b-1",
          homeTeam: "Liverpool",
          awayTeam: "Everton",
          homeGoals: 3,
          awayGoals: 2,
        },
      ],
      commonMatchId: "legacy-match-b-1",
      playerAssignments: {
        "alex-session-b": ["legacy-match-b-1"],
        "jordan-session-b": ["legacy-match-b-1"],
      },
      matchesPerPlayer: 1,
    },
  ];

export const buildLegacyHistoryImportPersistedState = (
  sessions: LegacyLocalSessionSnapshot[],
): BrowserFlowPersistedState => ({
  state: {
    players: [],
    matches: [],
    commonMatchId: null,
    playerAssignments: {},
    matchesPerPlayer: 1,
    history: sessions,
    theme: "light",
  },
  version: 0,
});

export const buildLegacyHistoryImportAuthSession = () => ({
  access_token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy-import-access-token",
  refresh_token: "legacy-import-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: LEGACY_HISTORY_IMPORT_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: LEGACY_HISTORY_IMPORT_USER_EMAIL,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

export const buildLegacyHistoryImportAuthUser = () => ({
  id: LEGACY_HISTORY_IMPORT_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: LEGACY_HISTORY_IMPORT_USER_EMAIL,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const buildLegacyHistoryImportResponse = (
  request: ImportLegacyHistoryRpcRequest,
): ImportLegacyHistoryRpcResponse => ({
  accountId: LEGACY_HISTORY_IMPORT_USER_ID,
  importState: "completed",
  claimedLocalParticipantId: request.claimedLocalParticipantId,
  summary: {
    importedCount: request.sessions.length,
    skippedCount: 0,
    failedCount: 0,
  },
  sessions: request.sessions.map((session) => ({
    sourceLocalSessionId: session.sourceLocalSessionId,
    sourceFingerprint: `fingerprint-${session.sourceLocalSessionId}`,
    state: "imported",
    cloudSessionId: `cloud-${session.sourceLocalSessionId}`,
  })),
});

export const createSetupJourneyDataset = (
  overrides: Partial<SetupJourneyDataset> = {},
): SetupJourneyDataset => ({
  playerNames: overrides.playerNames ?? ["Alex", "Morgan"],
  matches: overrides.matches ?? [
    { homeTeam: "Arsenal", awayTeam: "Chelsea" },
    { homeTeam: "Liverpool", awayTeam: "Everton" },
  ],
  commonMatchIndex: overrides.commonMatchIndex ?? 0,
  matchesPerPlayer: overrides.matchesPerPlayer ?? 1,
});

export const createSetupJourneyDatasets = (): SetupJourneyDataset[] => [
  createSetupJourneyDataset(),
  createSetupJourneyDataset({
    playerNames: ["Alex", "Morgan", "Jamie"],
    matches: [
      { homeTeam: "Barcelona", awayTeam: "Real Madrid" },
      { homeTeam: "PSG", awayTeam: "Marseille" },
    ],
    commonMatchIndex: 1,
    matchesPerPlayer: 2,
  }),
];

export const buildPersistedBrowserStateFromSetupDataset = (
  dataset: SetupJourneyDataset,
): BrowserFlowPersistedState => {
  const players: BrowserFlowPlayer[] = dataset.playerNames.map(
    (name, index) => ({
      id: `p${index + 1}`,
      name,
    }),
  );

  const matches: BrowserFlowMatch[] = dataset.matches.map((match, index) => ({
    id: `m${index + 1}`,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeGoals: 0,
    awayGoals: 0,
  }));

  const commonMatchId =
    dataset.commonMatchIndex >= 0 && dataset.commonMatchIndex < matches.length
      ? (matches[dataset.commonMatchIndex]?.id ?? null)
      : null;

  const playerAssignments = Object.fromEntries(
    players.map((player) => [player.id, commonMatchId ? [commonMatchId] : []]),
  );

  return {
    state: {
      players,
      matches,
      commonMatchId,
      playerAssignments,
      matchesPerPlayer: dataset.matchesPerPlayer,
      history: [],
      theme: "light",
    },
    version: 0,
  };
};

export const dismissOnboardingIfPresent = async (page: Page) => {
  const skipButton = page.getByText(ONBOARDING_DISMISS_TEXT);
  const onboardingVisible = await skipButton
    .isVisible({ timeout: 500 })
    .catch(() => false);

  if (onboardingVisible) {
    await skipButton.click();
  }
};

export const waitForBrowserFlowReady = async (
  page: Page,
  markers: readonly string[] = HOME_READY_MARKERS,
) => {
  await page.waitForLoadState("networkidle");
  await dismissOnboardingIfPresent(page);

  await page.waitForFunction(
    (currentMarkers) =>
      currentMarkers.some((marker) =>
        document.body?.innerText?.includes(marker),
      ),
    markers,
    { timeout: 10_000 },
  );
};

export const mockLegacyHistoryImportServices = async (page: Page) => {
  legacyHistoryImportRpcCallCount = 0;
  legacyHistoryImportRpcLastRequest = null;

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildLegacyHistoryImportAuthUser()),
    });
  });

  await page.route("**/rest/v1/rpc/import_legacy_history", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as ImportLegacyHistoryRpcRequest;

    legacyHistoryImportRpcCallCount += 1;
    legacyHistoryImportRpcLastRequest = body;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildLegacyHistoryImportResponse(body)),
    });
  });
};

export const expectLegacyHistoryImportToRemainDisabled = async (page: Page) => {
  const importButton = page.getByTestId("LegacyHistoryImportButton");

  await expect(importButton).toHaveAttribute("aria-disabled", "true");
  await expect(importButton).toContainText("Import Complete");
};

export const seedLegacyHistoryImportState = async (page: Page) => {
  const persistedState = buildLegacyHistoryImportPersistedState(
    createLegacyHistoryImportSessions(),
  );
  const authSession = buildLegacyHistoryImportAuthSession();

  await page.evaluate(
    ({ storageKey, state, authStorageKey, session }) => {
      globalThis.localStorage.setItem(
        storageKey,
        JSON.stringify({ state, version: 0 }),
      );
      globalThis.localStorage.setItem(authStorageKey, JSON.stringify(session));
    },
    {
      storageKey: PERSISTED_STORE_KEY,
      state: persistedState.state,
      authStorageKey: LEGACY_HISTORY_IMPORT_AUTH_STORAGE_KEY,
      session: authSession,
    },
  );

  await page.reload();
  await waitForBrowserFlowReady(page);
};

export const buildHostRoomAuthSession = () => ({
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.host-room-access-token",
  refresh_token: "host-room-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: HOST_ROOM_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: HOST_ROOM_USER_EMAIL,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

export const buildHostRoomAuthUser = () => ({
  id: HOST_ROOM_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: HOST_ROOM_USER_EMAIL,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const buildHostRoomAccountRow = () => ({
  id: HOST_ROOM_USER_ID,
  preferred_display_name: HOST_ROOM_DISPLAY_NAME,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const buildHostRoomSettingsRow = () => ({
  account_id: HOST_ROOM_USER_ID,
  settings_data: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const buildHostRoomCreateResponse = () => ({
  sessionId: HOST_ROOM_SESSION_ID,
  joinCode: HOST_ROOM_JOIN_CODE,
  hostParticipantId: HOST_ROOM_PARTICIPANT_ID,
  hostDisplayName: HOST_ROOM_DISPLAY_NAME,
});

export const HOST_ROOM_SNAPSHOT_RPC_PATH =
  "**/rest/v1/rpc/get_room_snapshot" as const;

export const HOST_ROOM_MY_ACTIVE_RPC_PATH =
  "**/rest/v1/rpc/get_my_active_room" as const;

export interface ConfigureStartGameMatch {
  id: string;
  sourceProvider: string;
  sourceMatchId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
  homeScore: number;
  awayScore: number;
}

export interface ConfigureStartGameAssignment {
  participantId: string;
  matchId: string;
}

/**
 * Mutable room-configuration state (018-configure-start-game) shared by the
 * `add_room_match` / `set_common_match` / `set_room_assignments` /
 * `start-game` route mocks below, and read back into every polled snapshot —
 * so a full host journey (select matches → common match → assignments →
 * start) is reflected across repeated `get_room_snapshot` polls. Defaults
 * match the previous hardcoded snapshot, so other host-room features that
 * never call `resetConfigureStartGameState` are unaffected.
 */
let configureStartGameState: {
  roomState: "joinable" | "in_progress";
  commonMatchId: string | null;
  matches: ConfigureStartGameMatch[];
  assignments: ConfigureStartGameAssignment[];
} = { roomState: "joinable", commonMatchId: null, matches: [], assignments: [] };

export const resetConfigureStartGameState = () => {
  configureStartGameState = {
    roomState: "joinable",
    commonMatchId: null,
    matches: [],
    assignments: [],
  };
};

export const buildHostRoomSnapshot = (
  extraParticipants: {
    id: string;
    displayName: string;
    membershipType: "registered" | "guest";
    sessionRole: "owner" | "member";
  }[] = [],
) => ({
  sessionId: HOST_ROOM_SESSION_ID,
  joinCode: HOST_ROOM_JOIN_CODE,
  state: configureStartGameState.roomState,
  commonMatchId: configureStartGameState.commonMatchId,
  participants: [
    {
      id: HOST_ROOM_PARTICIPANT_ID,
      displayName: HOST_ROOM_DISPLAY_NAME,
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
    ...extraParticipants.map((p) => ({ ...p, currentDrinkTotal: 0 })),
  ],
  matches: configureStartGameState.matches,
  assignments: configureStartGameState.assignments,
});

export const mockHostRoomServices = async (page: Page) => {
  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHostRoomAuthUser()),
    });
  });

  await page.route("**/rest/v1/accounts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHostRoomAccountRow()),
    });
  });

  await page.route("**/rest/v1/settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHostRoomSettingsRow()),
    });
  });

  await page.route(HOST_ROOM_CREATE_RPC_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHostRoomCreateResponse()),
    });
  });

  await page.route(HOST_ROOM_MY_ACTIVE_RPC_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route(HOST_ROOM_SNAPSHOT_RPC_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHostRoomSnapshot(extraSnapshotParticipants)),
    });
  });

  await page.route("**/rest/v1/rpc/join_room_as_registered", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: "joined-member-1",
        sessionId: HOST_ROOM_SESSION_ID,
        joinCode: HOST_ROOM_JOIN_CODE,
        displayName: HOST_ROOM_DISPLAY_NAME,
        membershipType: "registered",
        sessionRole: "member",
        snapshot: buildHostRoomSnapshot(extraSnapshotParticipants),
      }),
    });
  });

  await page.route("**/rest/v1/rpc/leave_room_as_host", async (route) => {
    const body = route.request().postDataJSON() as {
      successor_participant_id?: string | null;
    };
    if (!body?.successor_participant_id && extraSnapshotParticipants.length > 1) {
      // >1 eligible and no choice → server asks for a successor.
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "successor_required", code: "P0001" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "transferred",
        sessionId: HOST_ROOM_SESSION_ID,
        newHostParticipantId:
          body?.successor_participant_id ?? "auto-successor-1",
        newHostDisplayName: "New Host",
        snapshot: buildHostRoomSnapshot(),
      }),
    });
  });
};

let extraSnapshotParticipants: {
  id: string;
  displayName: string;
  membershipType: "registered" | "guest";
  sessionRole: "owner" | "member";
}[] = [];

export const setHostRoomSnapshotParticipants = (
  participants: typeof extraSnapshotParticipants,
) => {
  extraSnapshotParticipants = participants;
};

export const seedHostRoomAuthSession = async (page: Page) => {
  const authSession = buildHostRoomAuthSession();

  await page.addInitScript(
    ({ authStorageKey, session, launchedKey }) => {
      globalThis.localStorage.setItem(launchedKey, "true");
      globalThis.localStorage.setItem(authStorageKey, JSON.stringify(session));
    },
    {
      authStorageKey: LEGACY_HISTORY_IMPORT_AUTH_STORAGE_KEY,
      session: authSession,
      launchedKey: "hasLaunched",
    },
  );
};

const buildGuestFixtureParticipant = (
  participant: GuestRoomHostFixture["participants"][number],
): GuestRoomParticipantSummary => ({
  id: participant.id,
  displayName: participant.displayName,
  membershipType: participant.membershipType,
  sessionRole: participant.sessionRole,
  currentDrinkTotal: participant.currentDrinkTotal,
});

const buildMockGuestParticipant = ({
  guestName,
  guestToken,
}: {
  guestName: string;
  guestToken: string;
}): GuestRoomParticipantSummary => ({
  id: `guest-${guestToken}`,
  displayName: guestName,
  membershipType: "guest",
  sessionRole: "member",
  currentDrinkTotal: 0,
});

export const buildGuestRoomSnapshotFromFixture = (
  fixture: GuestRoomHostFixture,
  guestParticipant?: GuestRoomParticipantSummary,
): GuestRoomSnapshot => ({
  sessionId: fixture.sessionId,
  joinCode: fixture.joinCode,
  state: fixture.state,
  commonMatchId: fixture.commonMatchId,
  participants: guestParticipant
    ? [
        ...fixture.participants.map(buildGuestFixtureParticipant),
        guestParticipant,
      ]
    : fixture.participants.map(buildGuestFixtureParticipant),
  matches: fixture.matches.map((match) => ({
    id: match.id,
    sourceProvider: match.sourceProvider,
    sourceMatchId: match.sourceMatchId,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    kickoffAt: match.kickoffAt,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  })),
  assignments: fixture.assignments.map((assignment) => ({
    participantId: assignment.participantId,
    matchId: assignment.matchId,
  })),
});

export const buildGuestRoomJoinResponseFromFixture = ({
  fixture,
  guestName,
  guestToken,
}: {
  fixture: GuestRoomHostFixture;
  guestName: string;
  guestToken: string;
}): GuestRoomJoinResponse => {
  const guestParticipant = buildMockGuestParticipant({
    guestName,
    guestToken,
  });

  return {
    participantId: guestParticipant.id,
    sessionId: fixture.sessionId,
    guestToken,
    joinCode: fixture.joinCode,
    displayName: guestName,
    snapshot: buildGuestRoomSnapshotFromFixture(fixture, guestParticipant),
  };
};

export const transitionMockGuestRoomToState = (
  nextState: GuestRoomHostFixture["state"],
) => {
  if (!activeGuestRoomFixture) {
    return;
  }

  activeGuestRoomFixture = {
    ...activeGuestRoomFixture,
    state: nextState,
  };
};

export const buildGuestRoomSessionGrantFromFixture = ({
  fixture,
  guestName,
  guestToken,
}: {
  fixture: GuestRoomHostFixture;
  guestName: string;
  guestToken: string;
}) => {
  const joinResponse = buildGuestRoomJoinResponseFromFixture({
    fixture,
    guestName,
    guestToken,
  });

  return {
    guestToken: joinResponse.guestToken,
    participantId: joinResponse.participantId,
    sessionId: joinResponse.sessionId,
    joinCode: joinResponse.joinCode,
    displayName: joinResponse.displayName,
  };
};

export const seedGuestRoomSessionGrant = async (
  page: Page,
  sessionGrant: ReturnType<typeof buildGuestRoomSessionGrantFromFixture>,
) => {
  await page.evaluate(
    ({ storageKey, grant }) => {
      globalThis.localStorage.setItem(storageKey, JSON.stringify(grant));
    },
    {
      storageKey: GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
      grant: sessionGrant,
    },
  );
};

export const mockGuestRoomRpcServices = async (
  page: Page,
  fixture: GuestRoomHostFixture = createGuestRoomHostFixture(),
) => {
  let latestJoinResponse: GuestRoomJoinResponse | null = null;

  guestRoomJoinRpcLastRequest = null;
  activeGuestRoomFixture = fixture;
  activeGuestParticipant = null;

  await page.route(GUEST_ROOM_JOIN_RPC_PATH, async (route) => {
    const body = route.request().postDataJSON() as {
      join_code?: string;
      guest_name?: string;
      guest_token?: string;
    };

    guestRoomJoinRpcLastRequest = body;

    latestJoinResponse = buildGuestRoomJoinResponseFromFixture({
      fixture: activeGuestRoomFixture ?? fixture,
      guestName: body.guest_name?.trim() || fixture.defaultGuestName,
      guestToken: body.guest_token?.trim() || "guest-room-test-token",
    });
    activeGuestParticipant =
      latestJoinResponse.snapshot.participants.find(
        (participant) => participant.id === latestJoinResponse?.participantId,
      ) ?? null;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(latestJoinResponse),
    });
  });

  await page.route(GUEST_ROOM_SNAPSHOT_RPC_PATH, async (route) => {
    const body = route.request().postDataJSON() as {
      guest_token?: string;
    };

    const guestToken =
      body.guest_token?.trim() ||
      latestJoinResponse?.guestToken ||
      "guest-room-test-token";
    const guestParticipant =
      activeGuestParticipant ??
      buildMockGuestParticipant({
        guestName: latestJoinResponse?.displayName || fixture.defaultGuestName,
        guestToken,
      });

    const snapshot = buildGuestRoomSnapshotFromFixture(
      activeGuestRoomFixture ?? fixture,
      guestParticipant,
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshot),
    });
  });

  return {
    fixture,
    getLatestJoinResponse: () => latestJoinResponse,
    getLatestJoinRequest: () => guestRoomJoinRpcLastRequest,
  };
};

export const CONFIGURE_START_GAME_MATCH_DISCOVERY_FIXTURES = [
  {
    id: "espn-fixture-1",
    league: "eng.1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startDateTime: new Date().toISOString(),
    status: "scheduled" as const,
  },
  {
    id: "espn-fixture-2",
    league: "eng.1",
    homeTeam: "Liverpool",
    awayTeam: "Everton",
    startDateTime: new Date().toISOString(),
    status: "scheduled" as const,
  },
];

/**
 * Mocks the room-configuration Supabase RPCs (add_room_match, set_common_match,
 * set_room_assignments) plus the Java command-api's match discovery and
 * start-game endpoints, on top of `mockHostRoomServices`. All state mutates the
 * shared `configureStartGameState` so a full host journey is reflected across
 * repeated `get_room_snapshot` polls (018-configure-start-game).
 */
export const mockConfigureStartGameServices = async (page: Page) => {
  resetConfigureStartGameState();

  await page.route("**/rest/v1/rpc/add_room_match", async (route) => {
    const body = route.request().postDataJSON() as {
      source_provider: string;
      source_match_id: string | null;
      home_team_name: string;
      away_team_name: string;
      kickoff_at: string | null;
    };
    const existing = configureStartGameState.matches.find(
      (match) =>
        match.sourceProvider === body.source_provider &&
        match.sourceMatchId === body.source_match_id,
    );
    const id = existing?.id ?? `match-${configureStartGameState.matches.length + 1}`;
    if (!existing) {
      configureStartGameState.matches.push({
        id,
        sourceProvider: body.source_provider,
        sourceMatchId: body.source_match_id,
        homeTeamName: body.home_team_name,
        awayTeamName: body.away_team_name,
        kickoffAt: body.kickoff_at,
        homeScore: 0,
        awayScore: 0,
      });
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(id),
    });
  });

  await page.route("**/rest/v1/rpc/set_common_match", async (route) => {
    const body = route.request().postDataJSON() as { match_id: string };
    configureStartGameState.commonMatchId = body.match_id;
    await route.fulfill({ status: 200, contentType: "application/json", body: "" });
  });

  await page.route("**/rest/v1/rpc/set_room_assignments", async (route) => {
    const body = route.request().postDataJSON() as {
      assignments: ConfigureStartGameAssignment[];
    };
    configureStartGameState.assignments = body.assignments;
    await route.fulfill({ status: 200, contentType: "application/json", body: "" });
  });

  await page.route(`${CONFIGURE_START_GAME_COMMAND_API_URL}/v1/matches**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CONFIGURE_START_GAME_MATCH_DISCOVERY_FIXTURES),
    });
  });

  await page.route(
    `${CONFIGURE_START_GAME_COMMAND_API_URL}/v1/rooms/*/commands/start-game`,
    async (route) => {
      // Mirrors StartGameCommandHandler's FR-006–FR-009 checks closely enough for e2e coverage.
      if (configureStartGameState.roomState !== "joinable") {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "INVALID_ROOM_STATE",
            message: "The room state is not in the joinable lobby state.",
            timestamp: new Date().toISOString(),
          }),
        });
        return;
      }
      if (configureStartGameState.matches.length === 0) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "EMPTY_MATCHES",
            message: "At least one match must be selected for the room.",
            timestamp: new Date().toISOString(),
          }),
        });
        return;
      }
      if (!configureStartGameState.commonMatchId) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "MISSING_COMMON_MATCH",
            message: "No common match is currently designated for the room.",
            timestamp: new Date().toISOString(),
          }),
        });
        return;
      }
      const assignedParticipantIds = new Set(
        configureStartGameState.assignments
          .filter((assignment) => assignment.matchId !== configureStartGameState.commonMatchId)
          .map((assignment) => assignment.participantId),
      );
      if (!assignedParticipantIds.has(HOST_ROOM_PARTICIPANT_ID)) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "UNASSIGNED_PARTICIPANTS",
            message:
              "Every participant must be assigned at least one match (excluding the common match).",
            timestamp: new Date().toISOString(),
          }),
        });
        return;
      }

      configureStartGameState.roomState = "in_progress";
      const idempotencyKey = route.request().headers()["idempotency-key"] ?? "unknown";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          commandType: "start-game",
          roomId: HOST_ROOM_SESSION_ID,
          idempotencyKey,
          status: "ACCEPTED",
          timestamp: new Date().toISOString(),
        }),
      });
    },
  );
};
