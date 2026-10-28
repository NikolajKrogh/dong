/** Shared public match facts. Opaque IDs and versions must not pass through JS numbers. */
export const FOOTBALL_MATCH_PROVIDER = 'espn' as const;

type SavedMatchId = string;
type MatchObservationVersion = string;
export type MatchAvailability = 'available' | 'partial' | 'pending' | 'unavailable' | 'deferred';
export type MatchLifecycle = 'scheduled' | 'live' | 'delayed' | 'suspended' | 'postponed' | 'finished' | 'canceled' | 'abandoned' | 'unknown';
type KickoffValidity = 'confirmed' | 'tentative' | 'unknown';
export type MatchSide = 'home' | 'away';

interface MatchIdentity {
  provider: typeof FOOTBALL_MATCH_PROVIDER;
  leagueCode: string;
  sourceEventId: string;
  sourceCompetitionId: string | null;
}

interface SavedMatchTeam {
  sourceTeamId: string | null;
  name: string;
  shortName: string | null;
}

interface MatchFreshness {
  lastAttemptAt: string | null;
  lastSuccessfulCheckAt: string | null;
  observedAt: string | null;
  isStale: boolean;
  availabilityReason: string | null;
}

export interface SavedMatchGoal {
  sourcePlayId: string | null;
  side: MatchSide | null;
  sourceAthleteId: string | null;
  athleteName: string | null;
  sourceTeamId: string | null;
  clock: string | null;
  period: number | null;
  occurredAt: string | null;
  kind: 'goal' | 'penalty' | 'own_goal' | 'shootout' | 'unknown';
  isRetracted: boolean;
}

export interface SavedTeamStatistics {
  shotAttempts: number | null;
  shotsOnGoal: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  cornerKicks: number | null;
  possession: number | null;
}

export interface SavedRosterEntry {
  sourceAthleteId: string | null;
  athleteName: string;
  side: MatchSide;
  jersey: string | null;
  position: string | null;
  isStarter: boolean | null;
  didPlay: boolean | null;
  minutesPlayed: number | null;
}

interface SavedHistoryDetails {
  rosterEntries: SavedRosterEntry[] | null;
  teamStats: { home: Record<string, number | null>; away: Record<string, number | null> } | null;
  availability: MatchAvailability;
  isFinal: boolean | null;
  hasMoreRosterEntries: boolean;
}

export interface SavedMatch {
  catalogMatchId: SavedMatchId;
  identity: MatchIdentity;
  homeTeam: SavedMatchTeam;
  awayTeam: SavedMatchTeam;
  kickoffAt: string | null;
  kickoffValidity: KickoffValidity;
  lifecycle: MatchLifecycle;
  rawStatus: string | null;
  isCompleted: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  shootoutHomeScore: number | null;
  shootoutAwayScore: number | null;
  aggregateHomeScore: number | null;
  aggregateAwayScore: number | null;
  period: number | null;
  clockSeconds: number | null;
  displayClock: string | null;
  season: { sourceId: string | null; year: number | null; type: string | null } | null;
  venue: { sourceId: string | null; name: string | null } | null;
  observationVersion: MatchObservationVersion;
  availability: MatchAvailability;
  freshness: MatchFreshness;
  goals: SavedMatchGoal[] | null;
  goalsAvailability: MatchAvailability;
  hasMoreGoals: boolean;
  homeTeamStatistics: SavedTeamStatistics | null;
  awayTeamStatistics: SavedTeamStatistics | null;
  historyDetails?: SavedHistoryDetails;
}

export interface MatchDiscoverySelection {
  leagueCodes: string[];
  date: string;
}

interface MatchDiscoveryGroup {
  leagueCode: string;
  date: string;
  availability: MatchAvailability;
  lastSuccessfulCheckAt: string | null;
  isStale: boolean;
  reason: string | null;
  retryAfterSeconds: number | null;
}

export interface MatchDiscoveryResult {
  matches: SavedMatch[];
  availability: MatchAvailability;
  groups: MatchDiscoveryGroup[];
  retryAfterSeconds: number | null;
}

export interface SavedMatchesResult {
  matches: SavedMatch[];
  missingCatalogMatchIds: SavedMatchId[];
  availability: MatchAvailability;
  retryAfterSeconds: number | null;
}

export type SoloTrackingSelection = {
  operationId: string;
  catalogMatchIds: SavedMatchId[];
} & ({ creationNonce: string; grantToken?: never; expectedSelectionVersion?: never }
  | { creationNonce?: never; grantToken: string; expectedSelectionVersion: number });

export interface SoloTrackingGrant {
  grantToken: string;
  selectionVersion: number;
  isReplay: boolean;
  catalogMatchIds: SavedMatchId[];
  expiresAt: string;
  state: 'active' | 'ended';
}

export const FOOTBALL_MATCH_ERROR_CODES = [
  'invalid_selection', 'unsupported_league', 'date_out_of_range', 'projection_too_large',
  'invalid_tracking_grant', 'tracking_expired', 'not_permitted', 'operation_conflict',
  'tracking_conflict', 'identity_unresolved', 'admission_limited', 'capacity_limited',
  'configuration_required', 'acquisition_paused', 'transport_unavailable',
] as const;
export type FootballMatchErrorCode = typeof FOOTBALL_MATCH_ERROR_CODES[number];

/** Finds football fixtures, reads saved match details, and manages solo score tracking. */
export interface FootballMatchService {
  discoverMatches(selection: MatchDiscoverySelection): Promise<MatchDiscoveryResult>;
  readSavedMatches(catalogMatchIds: SavedMatchId[], options?: { projection?: 'live' | 'history' }): Promise<SavedMatchesResult>;
  replaceSoloTracking(selection: SoloTrackingSelection): Promise<SoloTrackingGrant>;
}
