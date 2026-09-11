export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          id: string
          preferred_display_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          preferred_display_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          preferred_display_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      assignment_picks: {
        Row: {
          created_at: string | null
          match_id: string
          participant_id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          match_id: string
          participant_id: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          match_id?: string
          participant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_assignment_picks_match"
            columns: ["session_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "fk_assignment_picks_participant"
            columns: ["session_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["session_id", "id"]
          },
        ]
      }
      assignment_snapshots: {
        Row: {
          captured_at: string
          expected_assignment_count: number
          match_id: string
          participant_id: string
          session_id: string
        }
        Insert: {
          captured_at?: string
          expected_assignment_count: number
          match_id: string
          participant_id: string
          session_id: string
        }
        Update: {
          captured_at?: string
          expected_assignment_count?: number
          match_id?: string
          participant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "completed_session_summaries"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "assignment_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assignment_snapshots_match"
            columns: ["session_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "fk_assignment_snapshots_participant"
            columns: ["session_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["session_id", "id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string | null
          match_id: string
          participant_id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          match_id: string
          participant_id: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          match_id?: string
          participant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_assignments_match"
            columns: ["session_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "fk_assignments_participant"
            columns: ["session_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["session_id", "id"]
          },
        ]
      }
      command_idempotency: {
        Row: {
          command_type: string
          completed_at: string | null
          created_at: string
          host_account_id: string
          idempotency_key: string
          response_detail: Json | null
          response_status: string | null
          room_id: string
        }
        Insert: {
          command_type: string
          completed_at?: string | null
          created_at?: string
          host_account_id: string
          idempotency_key: string
          response_detail?: Json | null
          response_status?: string | null
          room_id: string
        }
        Update: {
          command_type?: string
          completed_at?: string | null
          created_at?: string
          host_account_id?: string
          idempotency_key?: string
          response_detail?: Json | null
          response_status?: string | null
          room_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_account_id: string
          created_at: string
          id: string
          requested_at: string
          requester_account_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_account_id: string
          created_at?: string
          id?: string
          requested_at?: string
          requester_account_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_account_id?: string
          created_at?: string
          id?: string
          requested_at?: string
          requester_account_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_account_id_fkey"
            columns: ["addressee_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_account_id_fkey"
            columns: ["requester_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          assignment_mode: Database["public"]["Enums"]["assignment_mode"]
          common_match_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          join_code: string
          last_activity_at: string
          last_event_sequence: number
          matches_per_player: number
          owner_account_id: string
          shared_matches_per_pair: number
          started_at: string | null
          state: Database["public"]["Enums"]["session_state"]
        }
        Insert: {
          assignment_mode?: Database["public"]["Enums"]["assignment_mode"]
          common_match_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          join_code: string
          last_activity_at?: string
          last_event_sequence?: number
          matches_per_player?: number
          owner_account_id: string
          shared_matches_per_pair?: number
          started_at?: string | null
          state?: Database["public"]["Enums"]["session_state"]
        }
        Update: {
          assignment_mode?: Database["public"]["Enums"]["assignment_mode"]
          common_match_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          join_code?: string
          last_activity_at?: string
          last_event_sequence?: number
          matches_per_player?: number
          owner_account_id?: string
          shared_matches_per_pair?: number
          started_at?: string | null
          state?: Database["public"]["Enums"]["session_state"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_sessions_common_match"
            columns: ["id", "common_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "game_sessions_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gameplay_command_results: {
        Row: {
          actor_participant_id: string
          command_type: string
          created_at: string
          idempotency_key: string
          request_fingerprint: string
          response: Json
          session_id: string
        }
        Insert: {
          actor_participant_id: string
          command_type: string
          created_at?: string
          idempotency_key: string
          request_fingerprint: string
          response: Json
          session_id: string
        }
        Update: {
          actor_participant_id?: string
          command_type?: string
          created_at?: string
          idempotency_key?: string
          request_fingerprint?: string
          response?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_gameplay_command_results_actor"
            columns: ["session_id", "actor_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "gameplay_command_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "completed_session_summaries"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "gameplay_command_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gameplay_events: {
        Row: {
          actor_participant_id: string
          created_at: string | null
          event_type: string
          id: string
          idempotency_key: string
          payload: Json
          sequence_number: number
          session_id: string
        }
        Insert: {
          actor_participant_id: string
          created_at?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          payload: Json
          sequence_number: number
          session_id: string
        }
        Update: {
          actor_participant_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          payload?: Json
          sequence_number?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_gameplay_events_actor_participant"
            columns: ["session_id", "actor_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "gameplay_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "completed_session_summaries"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "gameplay_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number
          away_team_name: string
          created_at: string | null
          home_score: number
          home_team_name: string
          id: string
          kickoff_at: string | null
          session_id: string
          source_league_code: string | null
          source_match_id: string | null
          source_provider: string
        }
        Insert: {
          away_score?: number
          away_team_name: string
          created_at?: string | null
          home_score?: number
          home_team_name: string
          id?: string
          kickoff_at?: string | null
          session_id: string
          source_league_code?: string | null
          source_match_id?: string | null
          source_provider: string
        }
        Update: {
          away_score?: number
          away_team_name?: string
          created_at?: string | null
          home_score?: number
          home_team_name?: string
          id?: string
          kickoff_at?: string | null
          session_id?: string
          source_league_code?: string | null
          source_match_id?: string | null
          source_provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "completed_session_summaries"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "matches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          account_id: string | null
          created_at: string | null
          current_drink_total: number
          display_name: string
          guest_rejoin_token_hash: string | null
          id: string
          left_at: string | null
          membership_type: Database["public"]["Enums"]["participant_membership_type"]
          session_id: string
          session_role: Database["public"]["Enums"]["participant_session_role"]
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          current_drink_total?: number
          display_name: string
          guest_rejoin_token_hash?: string | null
          id?: string
          left_at?: string | null
          membership_type: Database["public"]["Enums"]["participant_membership_type"]
          session_id: string
          session_role?: Database["public"]["Enums"]["participant_session_role"]
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          current_drink_total?: number
          display_name?: string
          guest_rejoin_token_hash?: string | null
          id?: string
          left_at?: string | null
          membership_type?: Database["public"]["Enums"]["participant_membership_type"]
          session_id?: string
          session_role?: Database["public"]["Enums"]["participant_session_role"]
        }
        Relationships: [
          {
            foreignKeyName: "participants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "completed_session_summaries"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          account_id: string
          created_at: string
          settings_data: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          settings_data?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          settings_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      completed_session_summaries: {
        Row: {
          assignments_changed_during_play: boolean | null
          common_match_id: string | null
          completed_at: string | null
          matches: Json | null
          matches_per_player: number | null
          owner_account_id: string | null
          player_assignments: Json | null
          players: Json | null
          session_id: string | null
          session_total_drinks: number | null
          session_total_goals: number | null
          session_total_matches: number | null
          session_total_players: number | null
          started_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_sessions_common_match"
            columns: ["session_id", "common_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "game_sessions_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      history_overview_totals: {
        Row: {
          average_drinks_per_participation: number | null
          total_drinks: number | null
          total_goals: number | null
          total_matches: number | null
          total_participations: number | null
          total_sessions: number | null
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          account_id: string | null
          average_per_game: number | null
          display_name: string | null
          games_played: number | null
          rank: number | null
          total_drinks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      lifetime_player_stats: {
        Row: {
          account_id: string | null
          average_per_game: number | null
          display_name: string | null
          games_played: number | null
          total_drinks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_room_match: {
        Args: {
          away_team_name: string
          home_team_name: string
          kickoff_at: string
          session_id: string
          source_match_id: string
          source_provider: string
        }
        Returns: string
      }
      add_room_match_v2: {
        Args: {
          away_team_name: string
          home_team_name: string
          kickoff_at: string
          session_id: string
          source_league_code: string
          source_match_id: string
          source_provider: string
        }
        Returns: string
      }
      add_room_matches: {
        Args: { matches: Json; session_id: string }
        Returns: Json
      }
      allocate_event_sequence: {
        Args: { p_session_id: string }
        Returns: number
      }
      change_manual_score: {
        Args: {
          delta_goals: number
          idempotency_key: string
          match_id: string
          session_id: string
          team: string
        }
        Returns: Json
      }
      change_manual_score_as_guest: {
        Args: {
          delta_goals: number
          guest_token: string
          idempotency_key: string
          match_id: string
          team: string
        }
        Returns: Json
      }
      change_participant_drink: {
        Args: {
          delta_half_drinks: number
          idempotency_key: string
          participant_id: string
          session_id: string
        }
        Returns: Json
      }
      change_participant_drink_as_guest: {
        Args: {
          delta_half_drinks: number
          guest_token: string
          idempotency_key: string
          participant_id: string
        }
        Returns: Json
      }
      compare_registered_players: {
        Args: { left_account_id: string; right_account_id: string }
        Returns: {
          games_played_together: number
          player1_average_per_game: number
          player1_avg_with_player2: number
          player1_avg_without_player2: number
          player1_common_match_count: number
          player1_efficiency: number
          player1_games_played: number
          player1_id: string
          player1_max_in_a_game: number
          player1_name: string
          player1_top_drinker_count: number
          player1_total_drinks: number
          player1_wins_count: number
          player2_average_per_game: number
          player2_avg_with_player1: number
          player2_avg_without_player1: number
          player2_common_match_count: number
          player2_efficiency: number
          player2_games_played: number
          player2_id: string
          player2_max_in_a_game: number
          player2_name: string
          player2_top_drinker_count: number
          player2_total_drinks: number
          player2_wins_count: number
          tied_games_count: number
          timeline_data: Json
        }[]
      }
      compare_session_participants: {
        Args: {
          p_left_participant_id: string
          p_right_participant_id: string
          p_session_id: string
        }
        Returns: {
          games_played_together: number
          player1_average_per_game: number
          player1_avg_with_player2: number
          player1_avg_without_player2: number
          player1_common_match_count: number
          player1_efficiency: number
          player1_games_played: number
          player1_id: string
          player1_max_in_a_game: number
          player1_name: string
          player1_top_drinker_count: number
          player1_total_drinks: number
          player1_wins_count: number
          player2_average_per_game: number
          player2_avg_with_player1: number
          player2_avg_without_player1: number
          player2_common_match_count: number
          player2_efficiency: number
          player2_games_played: number
          player2_id: string
          player2_max_in_a_game: number
          player2_name: string
          player2_top_drinker_count: number
          player2_total_drinks: number
          player2_wins_count: number
          tied_games_count: number
          timeline_data: Json
        }[]
      }
      complete_command_idempotency: {
        Args: {
          idempotency_key: string
          response_detail: Json
          response_status: string
        }
        Returns: undefined
      }
      create_room_as_host: { Args: never; Returns: Json }
      end_game_session: { Args: { session_id: string }; Returns: Json }
      get_guest_room_snapshot: { Args: { guest_token: string }; Returns: Json }
      get_my_active_room: { Args: never; Returns: Json }
      get_room_snapshot: { Args: { session_id: string }; Returns: Json }
      import_legacy_history: {
        Args: { claimed_local_participant_id: string; sessions: Json }
        Returns: Json
      }
      join_room_as_guest: {
        Args: { guest_name: string; guest_token: string; join_code: string }
        Returns: Json
      }
      join_room_as_registered: { Args: { join_code: string }; Returns: Json }
      leave_room_as_guest: { Args: { guest_token: string }; Returns: Json }
      leave_room_as_host: {
        Args: { session_id: string; successor_participant_id?: string }
        Returns: Json
      }
      leave_room_as_member: { Args: { session_id: string }; Returns: Json }
      purge_assignment_snapshots_for_sessions: {
        Args: { session_ids: string[] }
        Returns: number
      }
      reassign_participant_matches: {
        Args: {
          idempotency_key: string
          match_ids: string[]
          participant_id: string
          session_id: string
        }
        Returns: Json
      }
      release_command_idempotency: {
        Args: { idempotency_key: string }
        Returns: undefined
      }
      remove_room_match: {
        Args: { match_id: string; session_id: string }
        Returns: undefined
      }
      remove_room_matches: {
        Args: { match_ids: string[]; session_id: string }
        Returns: undefined
      }
      reserve_command_idempotency: {
        Args: { command_type: string; idempotency_key: string; room_id: string }
        Returns: Json
      }
      set_common_match: {
        Args: { match_id: string; session_id: string }
        Returns: undefined
      }
      set_my_room_picks: {
        Args: { match_ids: string[]; session_id: string }
        Returns: undefined
      }
      set_my_room_picks_as_guest: {
        Args: { guest_token: string; match_ids: string[] }
        Returns: undefined
      }
      set_room_assignment_mode: {
        Args: { mode: string; session_id: string }
        Returns: undefined
      }
      set_room_assignment_settings: {
        Args: {
          matches_per_player: number
          session_id: string
          shared_matches_per_pair: number
        }
        Returns: undefined
      }
      set_room_assignments: {
        Args: { assignments: Json; session_id: string }
        Returns: undefined
      }
      start_game_session: {
        Args: {
          idempotency_key: string
          relax_constraints?: boolean
          session_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      assignment_mode: "automatic" | "host_assigned" | "player_picked"
      friendship_status: "pending" | "accepted" | "declined" | "canceled"
      legacy_history_import_session_state:
        | "pending"
        | "imported"
        | "skipped"
        | "failed"
        | "conflict"
      legacy_history_import_state: "in_progress" | "completed" | "failed"
      participant_membership_type: "registered" | "guest"
      participant_session_role: "owner" | "member"
      session_state: "joinable" | "in_progress" | "completed" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assignment_mode: ["automatic", "host_assigned", "player_picked"],
      friendship_status: ["pending", "accepted", "declined", "canceled"],
      legacy_history_import_session_state: [
        "pending",
        "imported",
        "skipped",
        "failed",
        "conflict",
      ],
      legacy_history_import_state: ["in_progress", "completed", "failed"],
      participant_membership_type: ["registered", "guest"],
      participant_session_role: ["owner", "member"],
      session_state: ["joinable", "in_progress", "completed", "closed"],
    },
  },
} as const
