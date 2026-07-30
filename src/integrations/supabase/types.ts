export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_analysis_runs: {
        Row: {
          approved: boolean
          created_at: string
          created_by: string
          group_id: string
          id: string
          input_reference: Json | null
          prompt_version: string
          race_id: string | null
          response: string | null
          round_id: string | null
          run_type: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          input_reference?: Json | null
          prompt_version?: string
          race_id?: string | null
          response?: string | null
          round_id?: string | null
          run_type: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          input_reference?: Json | null
          prompt_version?: string
          race_id?: string | null
          response?: string | null
          round_id?: string | null
          run_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_runs_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_runs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      data_imports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          import_type: string
          raw_payload: string | null
          result_summary: Json | null
          round_id: string
          source_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          import_type: string
          raw_payload?: string | null
          result_summary?: Json | null
          round_id: string
          source_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          import_type?: string
          raw_payload?: string | null
          result_summary?: Json | null
          round_id?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_imports_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          created_at: string
          group_id: string
          id: string
          kind: string
          name: string
          note: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          kind?: string
          name: string
          note?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          kind?: string
          name?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          normalized_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      group_entry_assessments: {
        Row: {
          active_exclusion: boolean
          created_at: string
          driver_horse_rating: number | null
          driver_rating: number | null
          exclusion_reason: string | null
          final_rank: number | null
          group_race_assessment_id: string
          group_win_probability: number
          id: string
          must_include: boolean
          race_entry_id: string
          tier: Database["public"]["Enums"]["tier"] | null
          updated_at: string
          value_comment: string | null
        }
        Insert: {
          active_exclusion?: boolean
          created_at?: string
          driver_horse_rating?: number | null
          driver_rating?: number | null
          exclusion_reason?: string | null
          final_rank?: number | null
          group_race_assessment_id: string
          group_win_probability?: number
          id?: string
          must_include?: boolean
          race_entry_id: string
          tier?: Database["public"]["Enums"]["tier"] | null
          updated_at?: string
          value_comment?: string | null
        }
        Update: {
          active_exclusion?: boolean
          created_at?: string
          driver_horse_rating?: number | null
          driver_rating?: number | null
          exclusion_reason?: string | null
          final_rank?: number | null
          group_race_assessment_id?: string
          group_win_probability?: number
          id?: string
          must_include?: boolean
          race_entry_id?: string
          tier?: Database["public"]["Enums"]["tier"] | null
          updated_at?: string
          value_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_entry_assessments_group_race_assessment_id_fkey"
            columns: ["group_race_assessment_id"]
            isOneToOne: false
            referencedRelation: "group_race_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_entry_assessments_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          group_id: string
          id: string
          invited_by: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          group_id: string
          id?: string
          invited_by: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          group_id?: string
          id?: string
          invited_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: Database["public"]["Enums"]["group_role"]
          share_percent: number
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          share_percent?: number
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          share_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_race_assessments: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          likely_leader_entry_id: string | null
          locked_at: string | null
          notes: string | null
          pace_scenario: string | null
          primary_spike_candidate_id: string | null
          race_id: string
          status: Database["public"]["Enums"]["assessment_status"]
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          likely_leader_entry_id?: string | null
          locked_at?: string | null
          notes?: string | null
          pace_scenario?: string | null
          primary_spike_candidate_id?: string | null
          race_id: string
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          likely_leader_entry_id?: string | null
          locked_at?: string | null
          notes?: string | null
          pace_scenario?: string | null
          primary_spike_candidate_id?: string | null
          race_id?: string
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_race_assessments_likely_leader_entry_id_fkey"
            columns: ["likely_leader_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_race_assessments_primary_spike_candidate_id_fkey"
            columns: ["primary_spike_candidate_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_race_assessments_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          default_budget: number
          default_row_price: number
          id: string
          name: string
          owner_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_budget?: number
          default_row_price?: number
          id?: string
          name: string
          owner_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_budget?: number
          default_row_price?: number
          id?: string
          name?: string
          owner_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      horses: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          normalized_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      individual_entry_assessments: {
        Row: {
          change_condition: string | null
          created_at: string
          driver_horse_rating: number | null
          driver_rating: number | null
          estimated_win_probability: number | null
          id: string
          include_preference: Database["public"]["Enums"]["include_preference"]
          individual_race_assessment_id: string
          race_entry_id: string
          rank_position: number | null
          reasoning: string | null
          tier: Database["public"]["Enums"]["tier"] | null
          updated_at: string
        }
        Insert: {
          change_condition?: string | null
          created_at?: string
          driver_horse_rating?: number | null
          driver_rating?: number | null
          estimated_win_probability?: number | null
          id?: string
          include_preference?: Database["public"]["Enums"]["include_preference"]
          individual_race_assessment_id: string
          race_entry_id: string
          rank_position?: number | null
          reasoning?: string | null
          tier?: Database["public"]["Enums"]["tier"] | null
          updated_at?: string
        }
        Update: {
          change_condition?: string | null
          created_at?: string
          driver_horse_rating?: number | null
          driver_rating?: number | null
          estimated_win_probability?: number | null
          id?: string
          include_preference?: Database["public"]["Enums"]["include_preference"]
          individual_race_assessment_id?: string
          race_entry_id?: string
          rank_position?: number | null
          reasoning?: string | null
          tier?: Database["public"]["Enums"]["tier"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "individual_entry_assessments_individual_race_assessment_id_fkey"
            columns: ["individual_race_assessment_id"]
            isOneToOne: false
            referencedRelation: "individual_race_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_entry_assessments_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_race_assessments: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          locked_at: string | null
          overall_notes: string | null
          overbet_entry_id: string | null
          race_id: string
          spike_candidate_entry_id: string | null
          submitted_at: string | null
          underbet_entry_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          locked_at?: string | null
          overall_notes?: string | null
          overbet_entry_id?: string | null
          race_id: string
          spike_candidate_entry_id?: string | null
          submitted_at?: string | null
          underbet_entry_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          locked_at?: string | null
          overall_notes?: string | null
          overbet_entry_id?: string | null
          race_id?: string
          spike_candidate_entry_id?: string | null
          submitted_at?: string | null
          underbet_entry_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "individual_race_assessments_overbet_entry_id_fkey"
            columns: ["overbet_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_race_assessments_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_race_assessments_spike_candidate_entry_id_fkey"
            columns: ["spike_candidate_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_race_assessments_underbet_entry_id_fkey"
            columns: ["underbet_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      market_snapshots: {
        Row: {
          bet_share_percent: number
          captured_at: string
          created_at: string
          created_by: string | null
          id: string
          race_entry_id: string
          source_id: string | null
        }
        Insert: {
          bet_share_percent: number
          captured_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          race_entry_id: string
          source_id?: string | null
        }
        Update: {
          bet_share_percent?: number
          captured_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          race_entry_id?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_snapshots_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_snapshots_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          assessment_principles: string | null
          created_at: string
          driver_assessment: string | null
          group_id: string
          hypothesis: string | null
          id: string
          next_change_requirement: string | null
          spike_rules: string | null
          title: string
          updated_at: string
          valid_from: string
          value_vs_probability: string | null
          version: string
        }
        Insert: {
          assessment_principles?: string | null
          created_at?: string
          driver_assessment?: string | null
          group_id: string
          hypothesis?: string | null
          id?: string
          next_change_requirement?: string | null
          spike_rules?: string | null
          title: string
          updated_at?: string
          valid_from?: string
          value_vs_probability?: string | null
          version: string
        }
        Update: {
          assessment_principles?: string | null
          created_at?: string
          driver_assessment?: string | null
          group_id?: string
          hypothesis?: string | null
          id?: string
          next_change_requirement?: string | null
          spike_rules?: string | null
          title?: string
          updated_at?: string
          valid_from?: string
          value_vs_probability?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_versions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      race_entries: {
        Row: {
          age: number | null
          base_distance_m: number | null
          cart_info: string | null
          created_at: string
          driver_id: string | null
          earnings: number | null
          equipment_notes: string | null
          form_text: string | null
          handicap_m: number | null
          horse_id: string
          id: string
          post_position: number | null
          race_id: string
          record_text: string | null
          scratched: boolean
          sex: string | null
          shoe_info: string | null
          source_id: string | null
          start_number: number
          trainer_id: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          age?: number | null
          base_distance_m?: number | null
          cart_info?: string | null
          created_at?: string
          driver_id?: string | null
          earnings?: number | null
          equipment_notes?: string | null
          form_text?: string | null
          handicap_m?: number | null
          horse_id: string
          id?: string
          post_position?: number | null
          race_id: string
          record_text?: string | null
          scratched?: boolean
          sex?: string | null
          shoe_info?: string | null
          source_id?: string | null
          start_number: number
          trainer_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          age?: number | null
          base_distance_m?: number | null
          cart_info?: string | null
          created_at?: string
          driver_id?: string | null
          earnings?: number | null
          equipment_notes?: string | null
          form_text?: string | null
          handicap_m?: number | null
          horse_id?: string
          id?: string
          post_position?: number | null
          race_id?: string
          record_text?: string | null
          scratched?: boolean
          sex?: string | null
          shoe_info?: string | null
          source_id?: string | null
          start_number?: number
          trainer_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_entries_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_entries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_entries_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          created_at: string
          distance_m: number | null
          external_race_number: number | null
          id: string
          leg_number: number
          name: string | null
          pace_notes: string | null
          proposition: string | null
          race_class: string | null
          round_id: string
          start_at: string | null
          start_method: Database["public"]["Enums"]["start_method"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          external_race_number?: number | null
          id?: string
          leg_number: number
          name?: string | null
          pace_notes?: string | null
          proposition?: string | null
          race_class?: string | null
          round_id: string
          start_at?: string | null
          start_method?: Database["public"]["Enums"]["start_method"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          external_race_number?: number | null
          id?: string
          leg_number?: number
          name?: string | null
          pace_notes?: string | null
          proposition?: string | null
          race_class?: string | null
          round_id?: string
          start_at?: string | null
          start_method?: Database["public"]["Enums"]["start_method"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "races_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          analyses_revealed_at: string | null
          bet_stop_at: string | null
          budget: number
          created_at: string
          created_by: string
          general_notes: string | null
          group_id: string
          id: string
          is_demo: boolean
          locked_at: string | null
          model_version_id: string | null
          product_type: string
          race_date: string
          row_price: number
          status: Database["public"]["Enums"]["round_status"]
          track_condition: string | null
          track_id: string | null
          updated_at: string
          weather_notes: string | null
        }
        Insert: {
          analyses_revealed_at?: string | null
          bet_stop_at?: string | null
          budget?: number
          created_at?: string
          created_by: string
          general_notes?: string | null
          group_id: string
          id?: string
          is_demo?: boolean
          locked_at?: string | null
          model_version_id?: string | null
          product_type?: string
          race_date: string
          row_price?: number
          status?: Database["public"]["Enums"]["round_status"]
          track_condition?: string | null
          track_id?: string | null
          updated_at?: string
          weather_notes?: string | null
        }
        Update: {
          analyses_revealed_at?: string | null
          bet_stop_at?: string | null
          budget?: number
          created_at?: string
          created_by?: string
          general_notes?: string | null
          group_id?: string
          id?: string
          is_demo?: boolean
          locked_at?: string | null
          model_version_id?: string | null
          product_type?: string
          race_date?: string
          row_price?: number
          status?: Database["public"]["Enums"]["round_status"]
          track_condition?: string | null
          track_id?: string | null
          updated_at?: string
          weather_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_model_version_id_fkey"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          created_at: string
          id: string
          name: string
          normalized_name: string | null
          short_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          normalized_name?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trainers: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          normalized_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      entry_group_id: { Args: { _entry_id: string }; Returns: string }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      is_group_owner: { Args: { _group_id: string }; Returns: boolean }
      race_analyses_revealed: { Args: { _race_id: string }; Returns: boolean }
      race_group_id: { Args: { _race_id: string }; Returns: string }
      race_round_id: { Args: { _race_id: string }; Returns: string }
      round_group_id: { Args: { _round_id: string }; Returns: string }
    }
    Enums: {
      assessment_status: "draft" | "locked"
      driver_execution: "better" | "as_expected" | "worse" | "not_assessed"
      error_category:
        | "capacity_error"
        | "form_error"
        | "position_or_pace_error"
        | "distance_or_start_method_error"
        | "driver_underestimated"
        | "driver_overestimated"
        | "driver_horse_combo_underestimated"
        | "current_information_missed"
        | "system_construction_error"
        | "excessive_value_hunting"
        | "excessive_favorite_protection"
        | "unpredictable_event"
      group_role: "owner" | "member"
      include_preference: "must_include" | "consider" | "exclude" | "neutral"
      round_status:
        | "draft"
        | "individual_analysis"
        | "analyses_revealed"
        | "group_assessment"
        | "system_building"
        | "system_locked"
        | "results_registered"
        | "postmortem"
        | "completed"
      start_method: "auto" | "volt"
      system_status: "draft" | "final"
      tier: "A" | "B" | "C" | "D"
      transaction_type:
        | "contribution"
        | "stake"
        | "winnings"
        | "withdrawal"
        | "correction"
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
  public: {
    Enums: {
      assessment_status: ["draft", "locked"],
      driver_execution: ["better", "as_expected", "worse", "not_assessed"],
      error_category: [
        "capacity_error",
        "form_error",
        "position_or_pace_error",
        "distance_or_start_method_error",
        "driver_underestimated",
        "driver_overestimated",
        "driver_horse_combo_underestimated",
        "current_information_missed",
        "system_construction_error",
        "excessive_value_hunting",
        "excessive_favorite_protection",
        "unpredictable_event",
      ],
      group_role: ["owner", "member"],
      include_preference: ["must_include", "consider", "exclude", "neutral"],
      round_status: [
        "draft",
        "individual_analysis",
        "analyses_revealed",
        "group_assessment",
        "system_building",
        "system_locked",
        "results_registered",
        "postmortem",
        "completed",
      ],
      start_method: ["auto", "volt"],
      system_status: ["draft", "final"],
      tier: ["A", "B", "C", "D"],
      transaction_type: [
        "contribution",
        "stake",
        "winnings",
        "withdrawal",
        "correction",
      ],
    },
  },
} as const
