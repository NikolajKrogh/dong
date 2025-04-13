import { Match, Player } from "../../../app/store";
import { MatchWithScore } from "../../../hooks/useLiveScores";

// Define sorting options
/** @brief Type definition for the field used to sort matches. */
export type SortField = "homeTeam" | "awayTeam" | "playerName";
/** @brief Type definition for the direction of sorting. */
export type SortDirection = "asc" | "desc";

/**
 * @interface MatchesGridProps
 * @brief Defines the properties required by the MatchesGrid component.
 */
export interface MatchesGridProps {
  /** @brief Array of match objects from the game store. */
  matches: Match[];
  /** @brief Array of player objects from the game store. */
  players: Player[];
  /** @brief The ID of the match designated as 'common'. */
  commonMatchId: string;
  /** @brief Record mapping player IDs to an array of match IDs they are assigned to. */
  playerAssignments: Record<string, string[]>;
  /** @brief Function to open the quick actions modal for a specific match. */
  openQuickActions: (matchId: string) => void;
  /** @brief Optional array of live match data with scores. */
  liveMatches?: MatchWithScore[];
  /** @brief Optional React element for pull-to-refresh functionality. */
  refreshControl?: React.ReactElement;
  /** @brief Function to call when a refresh is triggered. */
  onRefresh: () => void;
  /** @brief Boolean indicating if a refresh is currently in progress. */
  refreshing: boolean;
  /** @brief Date object indicating the last time live scores were updated. */
  lastUpdated: Date | null;
  /** @brief Boolean indicating if live score polling is active. */
  isPolling: boolean;
}

/**
 * @interface MatchItemProps
 * @brief Defines the properties required by the MatchGridItem and MatchListItem components.
 */
export interface MatchItemProps {
  /** @brief The local match data object. */
  match: Match;
  /** @brief The ID of the common match, if any. */
  commonMatchId: string;
  /** @brief Array of players assigned to this match. */
  assignedPlayers: Player[];
  /** @brief Live score data for the match, if available. */
  liveMatch?: MatchWithScore;
  /** @brief Function to call when the item is pressed to open quick actions. */
  openQuickActions: (matchId: string) => void;
}

/**
 * @interface MatchesHeaderProps
 * @brief Defines the properties required by the MatchesHeader component.
 */
export interface MatchesHeaderProps {
  /** @brief The current field used for sorting matches. */
  sortField: SortField;
  /** @brief The current direction of sorting (ascending or descending). */
  sortDirection: SortDirection;
  /** @brief Indicates whether the grid layout is currently active. */
  useGridLayout: boolean;
  /** @brief Function to control the visibility of the sort modal. */
  setSortModalVisible: (visible: boolean) => void;
  /** @brief Function to toggle between grid and list layout modes. */
  toggleLayoutMode: () => void;
}

/**
 * @interface SortModalProps
 * @brief Defines the properties required by the SortModal component.
 */
export interface SortModalProps {
  /** @brief Controls the visibility of the modal. */
  visible: boolean;
  /** @brief The currently active sort field. */
  sortField: SortField;
  /** @brief The current sort direction. */
  sortDirection: SortDirection;
  /** @brief Function to call when the modal should be closed. */
  onClose: () => void;
  /** @brief Function to call when a sort option is selected. */
  onSortChange: (field: SortField) => void;
}

/**
 * @interface LastUpdatedFooterProps
 * @brief Defines the properties required by the LastUpdatedFooter component.
 */
export interface LastUpdatedFooterProps {
  /** @brief Callback function executed when the refresh button is pressed. */
  onRefresh: () => void;
  /** @brief Indicates if a refresh operation is currently in progress. */
  refreshing: boolean;
  /** @brief The timestamp of the last successful update. Null if no update has occurred. */
  lastUpdated: Date | null;
  /** @brief Indicates if automatic polling for updates is active. */
  isPolling: boolean;
}