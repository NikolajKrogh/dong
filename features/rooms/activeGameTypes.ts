import {
  type Dispatch,
  type SetStateAction
} from "react";
import type {
  GameplayActionResult,
  GameplayActionType
} from "../../types/room";

export type ActiveGameSyncStatus =
  | "idle"
  | "hydrating"
  | "ready"
  | "refreshing"
  | "offline"
  | "ended"
  | "access_lost"
  | "error";

export interface PendingGameplayMutation {
  id: string;
  kind: Extract<GameplayActionType, "manual_score" | "drink">;
  matchId?: string;
  participantId?: string;
  team?: "home" | "away";
  deltaGoals?: -1 | 1;
  deltaHalfDrinks?: -1 | 1;
  status: "pending" | "uncertain";
}

export type GameplayAction = () => Promise<GameplayActionResult>;

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
