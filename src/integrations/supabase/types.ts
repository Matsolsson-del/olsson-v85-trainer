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
      activity_log: {
        Row: {
          after_value: Json | null
          before_value: Json | null
          created_at: string
          description: string | null
          event_type: string
          group_id: string
          id: string
          round_id: string | null
          user_id: string | null
        }
        Insert: {
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          description?: string | null
          event_type: string
          group_id: string
          id?: string
          round_id?: string | null
          user_id?: string | null
        }
        Update: {
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          description?: string | null
          event_type?: string
          group_id?: string
          id?: string
          round_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_import_attempts: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          idempotency_key: string | null
          message: string | null
          ok: boolean
          round_id: string | null
          status_code: number
          validation_errors: Json
          version_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          idempotency_key?: string | null
          message?: string | null
          ok?: boolean
          round_id?: string | null
          status_code?: number
          validation_errors?: Json
          version_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          idempotency_key?: string | null
          message?: string | null
          ok?: boolean
          round_id?: string | null
          status_code?: number
          validation_errors?: Json
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_import_attempts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_import_attempts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_import_attempts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "ai_import_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_import_settings: {
        Row: {
          created_at: string
          enabled: boolean
          group_id: string
          key_created_at: string | null
          key_hash: string | null
          key_prefix: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          group_id: string
          key_created_at?: string | null
          key_hash?: string | null
          key_prefix?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          group_id?: string
          key_created_at?: string | null
          key_hash?: string | null
          key_prefix?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_import_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_import_versions: {
        Row: {
          analysis_version: string | null
          analyzed_at: string | null
          bet_stop_at: string | null
          created_at: string
          data_quality: Json
          external_round_id: string | null
          group_id: string
          id: string
          idempotency_key: string
          legs: Json
          main_recommendation: string | null
          model_name: string | null
          payload: Json
          race_date: string | null
          round_id: string
          sources: Json
          status: string
          systems: Json
          track_name: string | null
          version: number
        }
        Insert: {
          analysis_version?: string | null
          analyzed_at?: string | null
          bet_stop_at?: string | null
          created_at?: string
          data_quality?: Json
          external_round_id?: string | null
          group_id: string
          id?: string
          idempotency_key: string
          legs?: Json
          main_recommendation?: string | null
          model_name?: string | null
          payload: Json
          race_date?: string | null
          round_id: string
          sources?: Json
          status?: string
          systems?: Json
          track_name?: string | null
          version: number
        }
        Update: {
          analysis_version?: string | null
          analyzed_at?: string | null
          bet_stop_at?: string | null
          created_at?: string
          data_quality?: Json
          external_round_id?: string | null
          group_id?: string
          id?: string
          idempotency_key?: string
          legs?: Json
          main_recommendation?: string | null
          model_name?: string | null
          payload?: Json
          race_date?: string | null
          round_id?: string
          sources?: Json
          status?: string
          systems?: Json
          track_name?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_import_versions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_import_versions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_layers: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          layer: string
          race_id: string | null
          round_id: string
          source_label: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          layer: string
          race_id?: string | null
          round_id: string
          source_label?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          layer?: string
          race_id?: string | null
          round_id?: string
          source_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_layers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_layers_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_layers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_locks: {
        Row: {
          acquired_at: string
          lock_key: string
          run_id: string | null
        }
        Insert: {
          acquired_at?: string
          lock_key: string
          run_id?: string | null
        }
        Update: {
          acquired_at?: string
          lock_key?: string
          run_id?: string | null
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          accounting_note: string | null
          ai_draft_created: boolean
          candidates_found: number
          candidates_reclassified: number
          candidates_rejected: number
          created_at: string
          delay_seconds: number | null
          entries_imported: number
          error_message: string | null
          finished_at: string | null
          game_id: string | null
          group_id: string
          id: string
          log: Json
          mode: string
          next_run_at: string | null
          races_imported: number
          retries: number
          round_id: string | null
          run_type: string
          scheduled_for: string | null
          slot_key: string | null
          sources_checked: number
          sources_waiting: number
          sources_with_tips: number
          started_at: string
          status: string
          target_race_date: string | null
          timezone: string
          tips_duplicates: number
          tips_imported: number
          tips_new: number
          tips_unchanged: number
          tips_updated: number
          tips_verified_total: number
          track_name: string | null
          triggered_by: string | null
        }
        Insert: {
          accounting_note?: string | null
          ai_draft_created?: boolean
          candidates_found?: number
          candidates_reclassified?: number
          candidates_rejected?: number
          created_at?: string
          delay_seconds?: number | null
          entries_imported?: number
          error_message?: string | null
          finished_at?: string | null
          game_id?: string | null
          group_id: string
          id?: string
          log?: Json
          mode?: string
          next_run_at?: string | null
          races_imported?: number
          retries?: number
          round_id?: string | null
          run_type: string
          scheduled_for?: string | null
          slot_key?: string | null
          sources_checked?: number
          sources_waiting?: number
          sources_with_tips?: number
          started_at?: string
          status?: string
          target_race_date?: string | null
          timezone?: string
          tips_duplicates?: number
          tips_imported?: number
          tips_new?: number
          tips_unchanged?: number
          tips_updated?: number
          tips_verified_total?: number
          track_name?: string | null
          triggered_by?: string | null
        }
        Update: {
          accounting_note?: string | null
          ai_draft_created?: boolean
          candidates_found?: number
          candidates_reclassified?: number
          candidates_rejected?: number
          created_at?: string
          delay_seconds?: number | null
          entries_imported?: number
          error_message?: string | null
          finished_at?: string | null
          game_id?: string | null
          group_id?: string
          id?: string
          log?: Json
          mode?: string
          next_run_at?: string | null
          races_imported?: number
          retries?: number
          round_id?: string | null
          run_type?: string
          scheduled_for?: string | null
          slot_key?: string | null
          sources_checked?: number
          sources_waiting?: number
          sources_with_tips?: number
          started_at?: string
          status?: string
          target_race_date?: string | null
          timezone?: string
          tips_duplicates?: number
          tips_imported?: number
          tips_new?: number
          tips_unchanged?: number
          tips_updated?: number
          tips_verified_total?: number
          track_name?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_snapshots: {
        Row: {
          cost: number | null
          created_at: string
          group_id: string
          id: string
          payload: Json
          responsible_user_id: string
          round_id: string
          rows_count: number | null
          submitted_at: string
          system_version_id: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          group_id: string
          id?: string
          payload?: Json
          responsible_user_id: string
          round_id: string
          rows_count?: number | null
          submitted_at?: string
          system_version_id?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          group_id?: string
          id?: string
          payload?: Json
          responsible_user_id?: string
          round_id?: string
          rows_count?: number | null
          submitted_at?: string
          system_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_snapshots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_snapshots_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_snapshots_system_version_id_fkey"
            columns: ["system_version_id"]
            isOneToOne: false
            referencedRelation: "system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          created_by: string
          entity_id: string
          entity_type: string
          group_id: string
          id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          entity_id: string
          entity_type: string
          group_id: string
          id?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
      data_quality_reports: {
        Row: {
          created_at: string
          id: string
          missing_fields: Json | null
          race_id: string | null
          round_id: string
          score: number | null
          sufficient_for_final: boolean
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          missing_fields?: Json | null
          race_id?: string | null
          round_id: string
          score?: number | null
          sufficient_for_final?: boolean
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          missing_fields?: Json | null
          race_id?: string | null
          round_id?: string
          score?: number | null
          sufficient_for_final?: boolean
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_reports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_reports_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
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
      entry_results: {
        Row: {
          disqualified: boolean
          event_notes: string | null
          finish_position: number | null
          galloped: boolean
          id: string
          race_entry_id: string
          race_result_id: string
        }
        Insert: {
          disqualified?: boolean
          event_notes?: string | null
          finish_position?: number | null
          galloped?: boolean
          id?: string
          race_entry_id: string
          race_result_id: string
        }
        Update: {
          disqualified?: boolean
          event_notes?: string | null
          finish_position?: number | null
          galloped?: boolean
          id?: string
          race_entry_id?: string
          race_result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_results_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_results_race_result_id_fkey"
            columns: ["race_result_id"]
            isOneToOne: false
            referencedRelation: "race_results"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_tip_candidates: {
        Row: {
          accepted: boolean
          automation_run_id: string | null
          classification: string
          code: string
          created_at: string
          date_verified: boolean
          game_type_verified: boolean
          group_id: string
          id: string
          race_date: string
          reasons: Json
          round_id: string | null
          source_key: string
          source_name: string
          tip_signals: Json
          title: string | null
          track_verified: boolean
          url: string
        }
        Insert: {
          accepted?: boolean
          automation_run_id?: string | null
          classification: string
          code: string
          created_at?: string
          date_verified?: boolean
          game_type_verified?: boolean
          group_id: string
          id?: string
          race_date: string
          reasons?: Json
          round_id?: string | null
          source_key: string
          source_name: string
          tip_signals?: Json
          title?: string | null
          track_verified?: boolean
          url: string
        }
        Update: {
          accepted?: boolean
          automation_run_id?: string | null
          classification?: string
          code?: string
          created_at?: string
          date_verified?: boolean
          game_type_verified?: boolean
          group_id?: string
          id?: string
          race_date?: string
          reasons?: Json
          round_id?: string | null
          source_key?: string
          source_name?: string
          tip_signals?: Json
          title?: string | null
          track_verified?: boolean
          url?: string
        }
        Relationships: []
      }
      expert_tip_sources: {
        Row: {
          access_note: string | null
          allowed_url_patterns: Json
          created_at: string
          domain: string | null
          enabled: boolean
          failure_count: number
          group_id: string
          id: string
          kind: string
          last_checked_at: string | null
          last_message: string | null
          last_status: string
          last_verified_tip_at: string | null
          min_interval_minutes: number
          name: string
          next_attempt_at: string | null
          paywall: boolean
          quality_status: string
          reject_url_patterns: Json
          source_key: string
          supported_games: Json
          updated_at: string
        }
        Insert: {
          access_note?: string | null
          allowed_url_patterns?: Json
          created_at?: string
          domain?: string | null
          enabled?: boolean
          failure_count?: number
          group_id: string
          id?: string
          kind?: string
          last_checked_at?: string | null
          last_message?: string | null
          last_status?: string
          last_verified_tip_at?: string | null
          min_interval_minutes?: number
          name: string
          next_attempt_at?: string | null
          paywall?: boolean
          quality_status?: string
          reject_url_patterns?: Json
          source_key: string
          supported_games?: Json
          updated_at?: string
        }
        Update: {
          access_note?: string | null
          allowed_url_patterns?: Json
          created_at?: string
          domain?: string | null
          enabled?: boolean
          failure_count?: number
          group_id?: string
          id?: string
          kind?: string
          last_checked_at?: string | null
          last_message?: string | null
          last_status?: string
          last_verified_tip_at?: string | null
          min_interval_minutes?: number
          name?: string
          next_attempt_at?: string | null
          paywall?: boolean
          quality_status?: string
          reject_url_patterns?: Json
          source_key?: string
          supported_games?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_tip_sources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_tips: {
        Row: {
          alternatives: Json
          classification: string
          content_hash: string
          created_at: string
          date_verified: boolean
          expert: string | null
          fetched_at: string
          game_type_verified: boolean
          group_id: string
          hedges: Json
          id: string
          is_current: boolean
          leg_number: number | null
          longshot: string | null
          note: string | null
          published_at: string | null
          race_date: string
          ranking: Json
          reviewed_at: string | null
          round_id: string | null
          source_id: string | null
          source_key: string
          source_name: string
          system_row: string | null
          tip_key: string
          top_pick: string | null
          track_verified: boolean
          url: string | null
          verification_code: string | null
          verification_reasons: Json
          version: number
          warning: string | null
        }
        Insert: {
          alternatives?: Json
          classification?: string
          content_hash: string
          created_at?: string
          date_verified?: boolean
          expert?: string | null
          fetched_at?: string
          game_type_verified?: boolean
          group_id: string
          hedges?: Json
          id?: string
          is_current?: boolean
          leg_number?: number | null
          longshot?: string | null
          note?: string | null
          published_at?: string | null
          race_date: string
          ranking?: Json
          reviewed_at?: string | null
          round_id?: string | null
          source_id?: string | null
          source_key: string
          source_name: string
          system_row?: string | null
          tip_key: string
          top_pick?: string | null
          track_verified?: boolean
          url?: string | null
          verification_code?: string | null
          verification_reasons?: Json
          version?: number
          warning?: string | null
        }
        Update: {
          alternatives?: Json
          classification?: string
          content_hash?: string
          created_at?: string
          date_verified?: boolean
          expert?: string | null
          fetched_at?: string
          game_type_verified?: boolean
          group_id?: string
          hedges?: Json
          id?: string
          is_current?: boolean
          leg_number?: number | null
          longshot?: string | null
          note?: string | null
          published_at?: string | null
          race_date?: string
          ranking?: Json
          reviewed_at?: string | null
          round_id?: string | null
          source_id?: string | null
          source_key?: string
          source_name?: string
          system_row?: string | null
          tip_key?: string
          top_pick?: string | null
          track_verified?: boolean
          url?: string | null
          verification_code?: string | null
          verification_reasons?: Json
          version?: number
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_tips_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_tips_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_tips_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "expert_tip_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_tips_reports: {
        Row: {
          consensus: Json
          created_at: string
          created_by: string | null
          disagreements: Json
          error_message: string | null
          group_id: string
          id: string
          legs: Json
          model_used: string | null
          race_date: string
          round_id: string | null
          sources: Json
          status: string
          summary: string | null
          track_name: string | null
          trends: Json
          updated_at: string
        }
        Insert: {
          consensus?: Json
          created_at?: string
          created_by?: string | null
          disagreements?: Json
          error_message?: string | null
          group_id: string
          id?: string
          legs?: Json
          model_used?: string | null
          race_date: string
          round_id?: string | null
          sources?: Json
          status?: string
          summary?: string | null
          track_name?: string | null
          trends?: Json
          updated_at?: string
        }
        Update: {
          consensus?: Json
          created_at?: string
          created_by?: string | null
          disagreements?: Json
          error_message?: string | null
          group_id?: string
          id?: string
          legs?: Json
          model_used?: string | null
          race_date?: string
          round_id?: string | null
          sources?: Json
          status?: string
          summary?: string | null
          track_name?: string | null
          trends?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_tips_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_tips_reports_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      final_checks: {
        Row: {
          created_at: string
          created_by: string | null
          findings: Json
          group_id: string
          id: string
          round_id: string
          run_at: string
          status: string
          suggestions: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          findings?: Json
          group_id: string
          id?: string
          round_id: string
          run_at?: string
          status?: string
          suggestions?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          findings?: Json
          group_id?: string
          id?: string
          round_id?: string
          run_at?: string
          status?: string
          suggestions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "final_checks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_checks_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "group_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      imported_history_rounds: {
        Row: {
          analysis: string | null
          bet_stop_at: string | null
          budget: number | null
          computed_cost: number | null
          computed_rows: number | null
          correct_count: number | null
          created_at: string
          data_quality: string
          group_id: string
          id: string
          idempotency_key: string
          imported_by: string | null
          legs: Json
          lessons: string | null
          net_result: number | null
          payout: number | null
          race_date: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          row_price: number | null
          source: string | null
          spike_hits: number | null
          spikes: Json
          stated_cost: number | null
          stated_rows: number | null
          status: string
          superseded_by: string | null
          systems: Json
          track_name: string | null
          uncertainty_note: string | null
          updated_at: string
          usable_for_learning: boolean
          winners: Json
          winners_verified: boolean
        }
        Insert: {
          analysis?: string | null
          bet_stop_at?: string | null
          budget?: number | null
          computed_cost?: number | null
          computed_rows?: number | null
          correct_count?: number | null
          created_at?: string
          data_quality?: string
          group_id: string
          id?: string
          idempotency_key: string
          imported_by?: string | null
          legs?: Json
          lessons?: string | null
          net_result?: number | null
          payout?: number | null
          race_date: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_price?: number | null
          source?: string | null
          spike_hits?: number | null
          spikes?: Json
          stated_cost?: number | null
          stated_rows?: number | null
          status?: string
          superseded_by?: string | null
          systems?: Json
          track_name?: string | null
          uncertainty_note?: string | null
          updated_at?: string
          usable_for_learning?: boolean
          winners?: Json
          winners_verified?: boolean
        }
        Update: {
          analysis?: string | null
          bet_stop_at?: string | null
          budget?: number | null
          computed_cost?: number | null
          computed_rows?: number | null
          correct_count?: number | null
          created_at?: string
          data_quality?: string
          group_id?: string
          id?: string
          idempotency_key?: string
          imported_by?: string | null
          legs?: Json
          lessons?: string | null
          net_result?: number | null
          payout?: number | null
          race_date?: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_price?: number | null
          source?: string | null
          spike_hits?: number | null
          spikes?: Json
          stated_cost?: number | null
          stated_rows?: number | null
          status?: string
          superseded_by?: string | null
          systems?: Json
          track_name?: string | null
          uncertainty_note?: string | null
          updated_at?: string
          usable_for_learning?: boolean
          winners?: Json
          winners_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "imported_history_rounds_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_history_rounds_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "imported_history_rounds"
            referencedColumns: ["id"]
          },
        ]
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
      job_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          group_id: string
          id: string
          job_id: string | null
          job_type: string
          log: Json | null
          round_id: string | null
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          group_id: string
          id?: string
          job_id?: string | null
          job_type: string
          log?: Json | null
          round_id?: string | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          group_id?: string
          id?: string
          job_id?: string | null
          job_type?: string
          log?: Json | null
          round_id?: string | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          group_id: string
          id: string
          job_type: string
          schedule_cron: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          job_type: string
          schedule_cron?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          job_type?: string
          schedule_cron?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_hypotheses: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_hypotheses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          group_id: string
          id: string
          note: string | null
          round_id: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          note?: string | null
          round_id?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          note?: string | null
          round_id?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          group_id: string
          id: string
          link_path: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          group_id: string
          id?: string
          link_path?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          group_id?: string
          id?: string
          link_path?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_recommendations: {
        Row: {
          created_at: string
          group_id: string
          id: string
          improvements: string | null
          model_used: string | null
          next_focus: string | null
          round_id: string | null
          rounds_analyzed: number
          stats: Json
          strengths: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          improvements?: string | null
          model_used?: string | null
          next_focus?: string | null
          round_id?: string | null
          rounds_analyzed?: number
          stats?: Json
          strengths?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          improvements?: string | null
          model_used?: string | null
          next_focus?: string | null
          round_id?: string | null
          rounds_analyzed?: number
          stats?: Json
          strengths?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_recommendations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_recommendations_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
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
      race_fact_changes: {
        Row: {
          after_value: Json | null
          automation_run_id: string | null
          before_value: Json | null
          description: string
          detected_at: string
          field: string
          group_id: string
          horse_name: string | null
          id: string
          important: boolean
          leg_number: number | null
          race_entry_id: string | null
          race_id: string | null
          round_id: string
        }
        Insert: {
          after_value?: Json | null
          automation_run_id?: string | null
          before_value?: Json | null
          description: string
          detected_at?: string
          field: string
          group_id: string
          horse_name?: string | null
          id?: string
          important?: boolean
          leg_number?: number | null
          race_entry_id?: string | null
          race_id?: string | null
          round_id: string
        }
        Update: {
          after_value?: Json | null
          automation_run_id?: string | null
          before_value?: Json | null
          description?: string
          detected_at?: string
          field?: string
          group_id?: string
          horse_name?: string | null
          id?: string
          important?: boolean
          leg_number?: number | null
          race_entry_id?: string | null
          race_id?: string | null
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_fact_changes_automation_run_id_fkey"
            columns: ["automation_run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_fact_changes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_fact_changes_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_fact_changes_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_fact_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      race_postmortems: {
        Row: {
          actual_scenario: string | null
          approved_at: string | null
          concrete_lesson: string | null
          created_at: string
          driver_execution: Database["public"]["Enums"]["driver_execution"]
          expected_scenario: string | null
          id: string
          preventable: boolean | null
          primary_error_category:
            | Database["public"]["Enums"]["error_category"]
            | null
          process_quality: number | null
          race_id: string
          unpredictable_event_description: string | null
          updated_at: string
          winner_was_selected: boolean | null
        }
        Insert: {
          actual_scenario?: string | null
          approved_at?: string | null
          concrete_lesson?: string | null
          created_at?: string
          driver_execution?: Database["public"]["Enums"]["driver_execution"]
          expected_scenario?: string | null
          id?: string
          preventable?: boolean | null
          primary_error_category?:
            | Database["public"]["Enums"]["error_category"]
            | null
          process_quality?: number | null
          race_id: string
          unpredictable_event_description?: string | null
          updated_at?: string
          winner_was_selected?: boolean | null
        }
        Update: {
          actual_scenario?: string | null
          approved_at?: string | null
          concrete_lesson?: string | null
          created_at?: string
          driver_execution?: Database["public"]["Enums"]["driver_execution"]
          expected_scenario?: string | null
          id?: string
          preventable?: boolean | null
          primary_error_category?:
            | Database["public"]["Enums"]["error_category"]
            | null
          process_quality?: number | null
          race_id?: string
          unpredictable_event_description?: string | null
          updated_at?: string
          winner_was_selected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "race_postmortems_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          final_market_snapshot_at: string | null
          id: string
          notable_event: string | null
          race_id: string
          registered_at: string
          registered_by: string
          result_source_id: string | null
          winner_entry_id: string | null
        }
        Insert: {
          final_market_snapshot_at?: string | null
          id?: string
          notable_event?: string | null
          race_id: string
          registered_at?: string
          registered_by: string
          result_source_id?: string | null
          winner_entry_id?: string | null
        }
        Update: {
          final_market_snapshot_at?: string | null
          id?: string
          notable_event?: string | null
          race_id?: string
          registered_at?: string
          registered_by?: string
          result_source_id?: string | null
          winner_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_result_source_id_fkey"
            columns: ["result_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
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
      responsibility_rotation: {
        Row: {
          active: boolean
          created_at: string
          group_id: string
          id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id: string
          id?: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string
          id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_rotation_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_rotation_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_flags: {
        Row: {
          body: string
          created_at: string
          created_by: string
          flag_type: string
          id: string
          race_id: string | null
          resolved_at: string | null
          round_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          flag_type?: string
          id?: string
          race_id?: string | null
          resolved_at?: string | null
          round_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          flag_type?: string
          id?: string
          race_id?: string | null
          resolved_at?: string | null
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_flags_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_flags_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_postmortems: {
        Row: {
          ai_draft: string | null
          approved_at: string | null
          approved_text: string | null
          bad_decisions_despite_win: string | null
          created_at: string
          do_not_change_yet: string | null
          good_decisions_despite_loss: string | null
          id: string
          max_three_changes_to_test: string | null
          round_id: string
          strengths: string | null
          three_main_errors: string | null
          updated_at: string
        }
        Insert: {
          ai_draft?: string | null
          approved_at?: string | null
          approved_text?: string | null
          bad_decisions_despite_win?: string | null
          created_at?: string
          do_not_change_yet?: string | null
          good_decisions_despite_loss?: string | null
          id?: string
          max_three_changes_to_test?: string | null
          round_id: string
          strengths?: string | null
          three_main_errors?: string | null
          updated_at?: string
        }
        Update: {
          ai_draft?: string | null
          approved_at?: string | null
          approved_text?: string | null
          bad_decisions_despite_win?: string | null
          created_at?: string
          do_not_change_yet?: string | null
          good_decisions_despite_loss?: string | null
          id?: string
          max_three_changes_to_test?: string | null
          round_id?: string
          strengths?: string | null
          three_main_errors?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_postmortems_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_responsibility: {
        Row: {
          assigned_at: string
          change_reason: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          replaced_user_id: string | null
          rotation_mode: string
          round_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          change_reason?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          replaced_user_id?: string | null
          rotation_mode?: string
          round_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          change_reason?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          replaced_user_id?: string | null
          rotation_mode?: string
          round_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_responsibility_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_responsibility_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      round_results: {
        Row: {
          group_winnings: number
          id: string
          registered_at: string
          round_id: string
          v85_payout: number | null
        }
        Insert: {
          group_winnings?: number
          id?: string
          registered_at?: string
          round_id: string
          v85_payout?: number | null
        }
        Update: {
          group_winnings?: number
          id?: string
          registered_at?: string
          round_id?: string
          v85_payout?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          ai_status: string
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
          submitted_by: string | null
          submitted_manually_at: string | null
          track_condition: string | null
          track_id: string | null
          updated_at: string
          weather_notes: string | null
        }
        Insert: {
          ai_status?: string
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
          submitted_by?: string | null
          submitted_manually_at?: string | null
          track_condition?: string | null
          track_id?: string | null
          updated_at?: string
          weather_notes?: string | null
        }
        Update: {
          ai_status?: string
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
          submitted_by?: string | null
          submitted_manually_at?: string | null
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
      spike_protocols: {
        Row: {
          created_at: string
          driver_assessment: string | null
          expected_position: string | null
          group_win_probability: number | null
          id: string
          main_loss_risk: string | null
          main_opponent: string | null
          main_strength: string | null
          market_percent: number | null
          race_entry_id: string
          race_id: string
          revoke_condition: string | null
          system_version_id: string
          updated_at: string
          why_spike: string | null
        }
        Insert: {
          created_at?: string
          driver_assessment?: string | null
          expected_position?: string | null
          group_win_probability?: number | null
          id?: string
          main_loss_risk?: string | null
          main_opponent?: string | null
          main_strength?: string | null
          market_percent?: number | null
          race_entry_id: string
          race_id: string
          revoke_condition?: string | null
          system_version_id: string
          updated_at?: string
          why_spike?: string | null
        }
        Update: {
          created_at?: string
          driver_assessment?: string | null
          expected_position?: string | null
          group_win_probability?: number | null
          id?: string
          main_loss_risk?: string | null
          main_opponent?: string | null
          main_strength?: string | null
          market_percent?: number | null
          race_entry_id?: string
          race_id?: string
          revoke_condition?: string | null
          system_version_id?: string
          updated_at?: string
          why_spike?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spike_protocols_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spike_protocols_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spike_protocols_system_version_id_fkey"
            columns: ["system_version_id"]
            isOneToOne: false
            referencedRelation: "system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_candidates: {
        Row: {
          ai_analysis_run_id: string | null
          cost: number | null
          created_at: string
          estimated_coverage: number | null
          hedges: Json
          id: string
          profile: string
          rationale: string | null
          recommended: boolean
          risk_level: string | null
          round_id: string
          rows_count: number | null
          selected: boolean
          selections: Json
          spikes: Json
          title: string
          updated_at: string
          weakest_assumption: string | null
        }
        Insert: {
          ai_analysis_run_id?: string | null
          cost?: number | null
          created_at?: string
          estimated_coverage?: number | null
          hedges?: Json
          id?: string
          profile: string
          rationale?: string | null
          recommended?: boolean
          risk_level?: string | null
          round_id: string
          rows_count?: number | null
          selected?: boolean
          selections?: Json
          spikes?: Json
          title: string
          updated_at?: string
          weakest_assumption?: string | null
        }
        Update: {
          ai_analysis_run_id?: string | null
          cost?: number | null
          created_at?: string
          estimated_coverage?: number | null
          hedges?: Json
          id?: string
          profile?: string
          rationale?: string | null
          recommended?: boolean
          risk_level?: string | null
          round_id?: string
          rows_count?: number | null
          selected?: boolean
          selections?: Json
          spikes?: Json
          title?: string
          updated_at?: string
          weakest_assumption?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_candidates_ai_analysis_run_id_fkey"
            columns: ["ai_analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_candidates_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      system_selections: {
        Row: {
          created_at: string
          id: string
          race_entry_id: string
          race_id: string
          system_version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          race_entry_id: string
          race_id: string
          system_version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          race_entry_id?: string
          race_id?: string
          system_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_selections_race_entry_id_fkey"
            columns: ["race_entry_id"]
            isOneToOne: false
            referencedRelation: "race_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_selections_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_selections_system_version_id_fkey"
            columns: ["system_version_id"]
            isOneToOne: false
            referencedRelation: "system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_versions: {
        Row: {
          approximate_coverage: number | null
          budget: number
          calculated_cost: number
          calculated_rows: number
          change_reason: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          row_price: number
          system_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          approximate_coverage?: number | null
          budget: number
          calculated_cost?: number
          calculated_rows?: number
          change_reason?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          row_price: number
          system_id: string
          updated_at?: string
          version_number: number
        }
        Update: {
          approximate_coverage?: number | null
          budget?: number
          calculated_cost?: number
          calculated_rows?: number
          change_reason?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          row_price?: number
          system_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_versions_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          round_id: string
          status: Database["public"]["Enums"]["system_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          round_id: string
          status?: Database["public"]["Enums"]["system_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          round_id?: string
          status?: Database["public"]["Enums"]["system_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "systems_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
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
      assign_round_responsibility: {
        Args: { _round_id: string }
        Returns: string
      }
      change_round_responsibility: {
        Args: {
          _new_user_id: string
          _reason: string
          _rotation_mode?: string
          _round_id: string
        }
        Returns: undefined
      }
      clone_system_version: {
        Args: { _change_reason: string; _system_version_id: string }
        Returns: string
      }
      entry_group_id: { Args: { _entry_id: string }; Returns: string }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      is_group_owner: { Args: { _group_id: string }; Returns: boolean }
      is_round_responsible: { Args: { _round_id: string }; Returns: boolean }
      join_family_group: { Args: never; Returns: string }
      lock_system_version: {
        Args: { _system_version_id: string }
        Returns: Json
      }
      race_analyses_revealed: { Args: { _race_id: string }; Returns: boolean }
      race_group_id: { Args: { _race_id: string }; Returns: string }
      race_round_id: { Args: { _race_id: string }; Returns: string }
      reveal_analyses_early: {
        Args: { _reason: string; _round_id: string }
        Returns: undefined
      }
      round_group_id: { Args: { _round_id: string }; Returns: string }
      submit_individual_analysis: {
        Args: { _assessment_id: string }
        Returns: undefined
      }
      system_group_id: { Args: { _system_id: string }; Returns: string }
      system_version_group_id: { Args: { _sv_id: string }; Returns: string }
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
