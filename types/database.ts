import type { Database as GeneratedDatabase } from "./database.types";

type Functions = GeneratedDatabase["public"]["Functions"];

// PostgreSQL type generation cannot infer argument nullability. These existing
// RPCs deliberately accept null for manually entered matches (migration 035/042).
type NullableMatchArgs<T extends { Args: { source_match_id: string; kickoff_at: string } }> =
  Omit<T, "Args"> & { Args: Omit<T["Args"], "source_match_id" | "kickoff_at"> & {
    source_match_id: string | null;
    kickoff_at: string | null;
  } };
type NullableProposal<T extends { Args: { proposal_id: string } }> = Omit<T, "Args"> & {
  Args: Omit<T["Args"], "proposal_id"> & { proposal_id: string | null };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions"> & {
    Functions: Omit<Functions, "add_room_match" | "add_room_match_v2" | "start_game_session_v2" | "save_running_game_configuration_v2"> & {
      add_room_match: NullableMatchArgs<Functions["add_room_match"]>;
      add_room_match_v2: NullableMatchArgs<Functions["add_room_match_v2"]>;
      start_game_session_v2: NullableProposal<Functions["start_game_session_v2"]>;
      save_running_game_configuration_v2: NullableProposal<Functions["save_running_game_configuration_v2"]>;
    };
  };
};
