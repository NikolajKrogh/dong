import { Match, Player } from "../../../app/store";
import { MatchWithScore } from "../../../hooks/useLiveScores";

// Define sorting options
export type SortField = "homeTeam" | "awayTeam" | "playerName";
export type SortDirection = "asc" | "desc";

/**
 * @interface MatchesGridProps
 * @brief Defines the properties required by the MatchesGrid component.
 */
export interface MatchesGridProps {
  /** @param matches Array of match objects from the game store. */
  matches: Match[];
  /** @param players Array of player objects from the game store. */
  players: Player[];
  /** @param commonMatchId The ID of the match designated as 'common'. */
  commonMatchId: string;
  /** @param playerAssignments Record mapping player IDs to an array of match IDs they are assigned to. */
  playerAssignments: Record<string, string[]>;
  /** @param openQuickActions Function to open the quick actions modal for a specific match. */
  openQuickActions: (matchId: string) => void;
  /** @param liveMatches Optional array of live match data with scores. */
  liveMatches?: MatchWithScore[];
  /** @param refreshControl Optional React element for pull-to-refresh functionality. */
  refreshControl?: React.ReactElement;
  /** @param onRefresh Function to call when a refresh is triggered. */
  onRefresh: () => void;
  /** @param refreshing Boolean indicating if a refresh is currently in progress. */
  refreshing: boolean;
  /** @param lastUpdated Date object indicating the last time live scores were updated. */
  lastUpdated: Date | null;
  /** @param isPolling Boolean indicating if live score polling is active. */
  isPolling: boolean;
}

export interface MatchItemProps {
  match: Match;
  commonMatchId: string;
  assignedPlayers: Player[];
  liveMatch?: MatchWithScore;
  openQuickActions: (matchId: string) => void;
}

export interface MatchesHeaderProps {
  sortField: SortField;
  sortDirection: SortDirection;
  useGridLayout: boolean;
  setSortModalVisible: (visible: boolean) => void;
  toggleLayoutMode: () => void;
}

export interface SortModalProps {
  visible: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onClose: () => void;
  onSortChange: (field: SortField) => void;
}

export interface LastUpdatedFooterProps {
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: Date | null;
  isPolling: boolean;
}