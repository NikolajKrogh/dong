import { Match, Player } from "../../../store/store";
import { MatchWithScore } from "../../../types/matchScores";

/** Props for MatchQuickActionsModal. */
export interface MatchQuickActionsModalProps {
  /** Whether the modal is visible. */
  isVisible: boolean;
  /** Callback invoked to close the modal. */
  onClose: () => void;
  /** ID of the currently selected match for quick actions; null if none. */
  selectedMatchId: string | null;
  /** All match objects (from the store). */
  matches: Match[];
  /** All player objects (from the store). */
  players: Player[];
  /** The ID of the designated common match. */
  commonMatchId: string;
  /** Mapping of player IDs to the match IDs they are assigned to. */
  playerAssignments: Record<string, string[]>;
  /** Increment a team's goal count for a match. */
  handleGoalIncrement: (matchId: string, team: "home" | "away") => void;
  /** Decrement a team's goal count for a match. */
  handleGoalDecrement: (matchId: string, team: "home" | "away") => void;
  /** Live match data (if available) used to render API-controlled matches. */
  liveMatches: MatchWithScore[];
}
