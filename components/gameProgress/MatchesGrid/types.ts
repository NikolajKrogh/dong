import { Match, Player } from "../../../store/store";
import { MatchWithScore } from "../../../hooks/useLiveScores";

// Define sorting options
/** Sort field keys for matches list/grid. */
export type SortField = "homeTeam" | "awayTeam" | "playerName";
/** Sort direction. */
export type SortDirection = "asc" | "desc";

/**
 * Props for MatchesGrid.
 * @description Data + handlers required to render matches in grid/list form with pull‑to‑refresh and live score meta.
 */
export interface MatchesGridProps {
  /** Array of match objects from the game store. */
  matches: Match[];
  /** Player list used for assignment lookups. */
  players: Player[];
  /** ID of the designated common match. */
  commonMatchId: string;
  /** Mapping playerId -> array of matchIds the player is assigned to. */
  playerAssignments: Record<string, string[]>;
  /** Opens quick actions for a match. */
  openQuickActions: (matchId: string) => void;
  /** Optional live match score snapshots. */
  liveMatches?: MatchWithScore[];
  /** Optional refresh control element. */
  refreshControl?: React.ReactElement;
  /** Trigger manual refresh. */
  onRefresh: () => void;
  /** True while refresh is in progress. */
  refreshing: boolean;
  /** Last successful live score update timestamp. */
  lastUpdated: Date | null;
  /** Whether live polling is active. */
  isPolling: boolean;
}

/**
 * Props for an individual match item (grid or list).
 * @description Combines local match data, live overlay data and handlers for quick actions.
 */
export interface MatchItemProps {
  /** Local match record. */
  match: Match;
  /** ID of the common match (for highlighting). */
  commonMatchId: string;
  /** Players assigned to this match. */
  assignedPlayers: Player[];
  /** Optional live score snapshot. */
  liveMatch?: MatchWithScore;
  /** Opens quick actions for this match. */
  openQuickActions: (matchId: string) => void;
}

/**
 * Props for MatchesHeader.
 * @description Sorting + layout controls state used by the header bar.
 */
export interface MatchesHeaderProps {
  /** Current sort field. */
  sortField: SortField;
  /** Current sort direction. */
  sortDirection: SortDirection;
  /** True if grid layout is active (else list). */
  useGridLayout: boolean;
  /** Show/hide sort modal. */
  setSortModalVisible: (visible: boolean) => void;
  /** Toggle layout mode. */
  toggleLayoutMode: () => void;
}

/**
 * Props for sort modal.
 * @description Supplies current sort selection and change handlers.
 */
export interface SortModalProps {
  /** Modal visibility flag. */
  visible: boolean;
  /** Active sort field. */
  sortField: SortField;
  /** Active sort direction. */
  sortDirection: SortDirection;
  /** Close modal handler. */
  onClose: () => void;
  /** Change sort field handler. */
  onSortChange: (field: SortField) => void;
}

/**
 * Props for the last-updated footer.
 * @description Provides refresh control state and last update metadata.
 */
export interface LastUpdatedFooterProps {
  /** Invoked to trigger manual refresh. */
  onRefresh: () => void;
  /** True if refresh in progress. */
  refreshing: boolean;
  /** Timestamp of last successful update (null if never). */
  lastUpdated: Date | null;
  /** True if automatic polling is active. */
  isPolling: boolean;
}
