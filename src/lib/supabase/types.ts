export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubmissionStatus =
  | "pending"
  | "needs_review"
  | "approved"
  | "queued"
  | "publishing"
  | "published"
  | "rejected"
  | "failed";

export interface Database {
  public: {
    Tables: {
      submissions: {
        Row: {
          id: string;
          public_code: string;
          recipient: string | null;
          message: string;
          status: SubmissionStatus;
          moderation_status: string;
          moderation_reason: string | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          public_code: string;
          recipient?: string | null;
          message: string;
          status?: SubmissionStatus;
          moderation_status?: string;
          moderation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          public_code?: string;
          recipient?: string | null;
          message?: string;
          status?: SubmissionStatus;
          moderation_status?: string;
          moderation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: string;
          submission_id: string;
          slide_id?: string | null;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          status: string;
          created_at: string;
          deleted_at: string | null;
          deletion_reason?: string | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          slide_id?: string | null;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          status?: string;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
        };
        Update: {
          id?: string;
          submission_id?: string;
          slide_id?: string | null;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          status?: string;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_assets_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          }
        ];
      };
      submission_slides: {
        Row: {
          id: string;
          submission_id: string;
          slide_order: number;
          message: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          slide_order: number;
          message: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          slide_order?: number;
          message?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submission_slides_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          }
        ];
      };
      templates: {
        Row: {
          id: string;
          name: string;
          category: string;
          dimensions: Json;
          background_storage_path: string | null;
          font_family: string;
          font_file_path: string | null;
          font_size_min: number;
          font_size_max: number;
          text_color: string;
          line_height: number;
          letter_spacing: number;
          vertical_align: string;
          layout_config: Json;
          is_active: boolean;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          dimensions?: Json;
          background_storage_path?: string | null;
          font_family?: string;
          font_file_path?: string | null;
          font_size_min?: number;
          font_size_max?: number;
          text_color?: string;
          line_height?: number;
          letter_spacing?: number;
          vertical_align?: string;
          layout_config?: Json;
          is_active?: boolean;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          dimensions?: Json;
          background_storage_path?: string | null;
          font_family?: string;
          font_file_path?: string | null;
          font_size_min?: number;
          font_size_max?: number;
          text_color?: string;
          line_height?: number;
          letter_spacing?: number;
          vertical_align?: string;
          layout_config?: Json;
          is_active?: boolean;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      template_versions: {
        Row: {
          id: string;
          template_id: string;
          version: number;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          version: number;
          snapshot: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          version?: number;
          snapshot?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_profiles: {
        Row: {
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          id: string;
          accept_submissions: boolean;
          auto_publish_enabled: boolean;
          max_daily_feed_posts: number;
          publish_times: string[];
          timezone: string;
          auto_story_enabled: boolean;
          max_carousel_slides: number;
          max_message_length: number;
          max_image_size_mb: number;
          max_video_size_mb: number;
          storage_capacity_limit_percent: number;
          storage_warning_percent: number;
          storage_cleanup_target_percent: number;
          moderation_mode?: string;
          daily_ai_request_budget?: number;
          master_automation_enabled?: boolean;
          catchup_window_minutes?: number;
          max_retry_attempts?: number;
          storage_cleanup_retention_days?: number;
          instagram_feed_enabled?: boolean;
          instagram_story_enabled?: boolean;
          threads_enabled?: boolean;
          threads_reply_enabled?: boolean;
          threads_prefix?: string;
          threads_suffix?: string;
          threads_show_ref_code?: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          accept_submissions?: boolean;
          auto_publish_enabled?: boolean;
          max_daily_feed_posts?: number;
          publish_times?: string[];
          timezone?: string;
          auto_story_enabled?: boolean;
          max_carousel_slides?: number;
          max_message_length?: number;
          max_image_size_mb?: number;
          max_video_size_mb?: number;
          storage_capacity_limit_percent?: number;
          storage_warning_percent?: number;
          storage_cleanup_target_percent?: number;
          moderation_mode?: string;
          daily_ai_request_budget?: number;
          master_automation_enabled?: boolean;
          catchup_window_minutes?: number;
          max_retry_attempts?: number;
          storage_cleanup_retention_days?: number;
          instagram_feed_enabled?: boolean;
          instagram_story_enabled?: boolean;
          threads_enabled?: boolean;
          threads_reply_enabled?: boolean;
          threads_prefix?: string;
          threads_suffix?: string;
          threads_show_ref_code?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          accept_submissions?: boolean;
          auto_publish_enabled?: boolean;
          max_daily_feed_posts?: number;
          publish_times?: string[];
          timezone?: string;
          auto_story_enabled?: boolean;
          max_carousel_slides?: number;
          max_message_length?: number;
          max_image_size_mb?: number;
          max_video_size_mb?: number;
          storage_capacity_limit_percent?: number;
          storage_warning_percent?: number;
          storage_cleanup_target_percent?: number;
          moderation_mode?: string;
          daily_ai_request_budget?: number;
          master_automation_enabled?: boolean;
          catchup_window_minutes?: number;
          max_retry_attempts?: number;
          storage_cleanup_retention_days?: number;
          instagram_feed_enabled?: boolean;
          instagram_story_enabled?: boolean;
          threads_enabled?: boolean;
          threads_reply_enabled?: boolean;
          threads_prefix?: string;
          threads_suffix?: string;
          threads_show_ref_code?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      publication_batches: {
        Row: {
          id: string;
          scheduled_time: string;
          status: string;
          carousel_container_id: string | null;
          story_container_id: string | null;
          permalink: string | null;
          published_at: string | null;
          created_at: string;
          submission_id?: string | null;
          template_version_id?: string | null;
          feed_asset_paths?: string[] | null;
          story_asset_path?: string | null;
          caption?: string | null;
          rendered_at?: string | null;
          approved_for_publishing?: boolean;
        };
        Insert: {
          id?: string;
          scheduled_time: string;
          status?: string;
          carousel_container_id?: string | null;
          story_container_id?: string | null;
          permalink?: string | null;
          published_at?: string | null;
          created_at?: string;
          submission_id?: string | null;
          template_version_id?: string | null;
          feed_asset_paths?: string[] | null;
          story_asset_path?: string | null;
          caption?: string | null;
          rendered_at?: string | null;
          approved_for_publishing?: boolean;
        };
        Update: {
          id?: string;
          scheduled_time?: string;
          status?: string;
          carousel_container_id?: string | null;
          story_container_id?: string | null;
          permalink?: string | null;
          published_at?: string | null;
          created_at?: string;
          submission_id?: string | null;
          template_version_id?: string | null;
          feed_asset_paths?: string[] | null;
          story_asset_path?: string | null;
          caption?: string | null;
          rendered_at?: string | null;
          approved_for_publishing?: boolean;
        };
        Relationships: [];
      };
      platform_deliveries: {
        Row: {
          id: string;
          batch_id: string;
          submission_id: string;
          platform: "instagram" | "threads";
          publication_type: "feed" | "story" | "threads_main" | "threads_reply";
          status: string;
          scheduled_time: string;
          attempt_count: number;
          container_id: string | null;
          published_media_id: string | null;
          permalink: string | null;
          last_attempt_at: string | null;
          published_at: string | null;
          next_retry_at: string | null;
          sanitized_error_code: string | null;
          sanitized_error_message: string | null;
          payload_snapshot: Json | null;
          lease_owner?: string | null;
          lease_expires_at?: string | null;
          claim_version?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          submission_id: string;
          platform: "instagram" | "threads";
          publication_type: "feed" | "story" | "threads_main" | "threads_reply";
          status?: string;
          scheduled_time: string;
          attempt_count?: number;
          container_id?: string | null;
          published_media_id?: string | null;
          permalink?: string | null;
          last_attempt_at?: string | null;
          published_at?: string | null;
          next_retry_at?: string | null;
          sanitized_error_code?: string | null;
          sanitized_error_message?: string | null;
          payload_snapshot?: Json | null;
          lease_owner?: string | null;
          lease_expires_at?: string | null;
          claim_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string;
          submission_id?: string;
          platform?: "instagram" | "threads";
          publication_type?: "feed" | "story" | "threads_main" | "threads_reply";
          status?: string;
          scheduled_time?: string;
          attempt_count?: number;
          container_id?: string | null;
          published_media_id?: string | null;
          permalink?: string | null;
          last_attempt_at?: string | null;
          published_at?: string | null;
          next_retry_at?: string | null;
          sanitized_error_code?: string | null;
          sanitized_error_message?: string | null;
          payload_snapshot?: Json | null;
          lease_owner?: string | null;
          lease_expires_at?: string | null;
          claim_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_credentials: {
        Row: {
          id: string;
          platform: "instagram" | "threads";
          account_id: string;
          account_username: string;
          encrypted_token: string;
          iv: string;
          auth_tag: string;
          token_type: string;
          expires_at: string | null;
          last_refreshed_at: string | null;
          last_health_check_at: string | null;
          last_status: string;
          sanitized_last_error: string | null;
          metadata: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          platform: "instagram" | "threads";
          account_id: string;
          account_username: string;
          encrypted_token: string;
          iv: string;
          auth_tag: string;
          token_type?: string;
          expires_at?: string | null;
          last_refreshed_at?: string | null;
          last_health_check_at?: string | null;
          last_status?: string;
          sanitized_last_error?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          platform?: "instagram" | "threads";
          account_id?: string;
          account_username?: string;
          encrypted_token?: string;
          iv?: string;
          auth_tag?: string;
          token_type?: string;
          expires_at?: string | null;
          last_refreshed_at?: string | null;
          last_health_check_at?: string | null;
          last_status?: string;
          sanitized_last_error?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      queue_jobs: {
        Row: {
          id: string;
          job_type: string;
          batch_id: string | null;
          submission_id: string | null;
          status: string;
          priority: number;
          scheduled_at: string;
          next_attempt_at: string;
          attempt_count: number;
          max_attempts: number;
          lease_owner: string | null;
          lease_expires_at: string | null;
          claim_version: number;
          heartbeat_at: string | null;
          last_error_code: string | null;
          sanitized_error_message: string | null;
          payload: Json;
          created_at: string;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_type: string;
          batch_id?: string | null;
          submission_id?: string | null;
          status?: string;
          priority?: number;
          scheduled_at?: string;
          next_attempt_at?: string;
          attempt_count?: number;
          max_attempts?: number;
          lease_owner?: string | null;
          lease_expires_at?: string | null;
          claim_version?: number;
          heartbeat_at?: string | null;
          last_error_code?: string | null;
          sanitized_error_message?: string | null;
          payload?: Json;
          created_at?: string;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_type?: string;
          batch_id?: string | null;
          submission_id?: string | null;
          status?: string;
          priority?: number;
          scheduled_at?: string;
          next_attempt_at?: string;
          attempt_count?: number;
          max_attempts?: number;
          lease_owner?: string | null;
          lease_expires_at?: string | null;
          claim_version?: number;
          heartbeat_at?: string | null;
          last_error_code?: string | null;
          sanitized_error_message?: string | null;
          payload?: Json;
          created_at?: string;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      publication_slots: {
        Row: {
          id: string;
          wib_date: string;
          slot_time: string;
          batch_id: string;
          submission_id: string;
          reserved_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          wib_date: string;
          slot_time: string;
          batch_id: string;
          submission_id: string;
          reserved_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          wib_date?: string;
          slot_time?: string;
          batch_id?: string;
          submission_id?: string;
          reserved_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      distributed_locks: {
        Row: {
          lock_key: string;
          owner_id: string;
          fencing_token: number;
          acquired_at: string;
          expires_at: string;
          metadata: Json;
        };
        Insert: {
          lock_key: string;
          owner_id: string;
          fencing_token?: number;
          acquired_at?: string;
          expires_at: string;
          metadata?: Json;
        };
        Update: {
          lock_key?: string;
          owner_id?: string;
          fencing_token?: number;
          acquired_at?: string;
          expires_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      scheduler_health: {
        Row: {
          id: string;
          last_worker_run_at: string | null;
          last_successful_run_at: string | null;
          last_worker_duration_ms: number | null;
          last_worker_status: string;
          last_worker_report: Json;
          last_token_check_at: string | null;
          last_token_refresh_at: string | null;
          last_storage_cleanup_at: string | null;
          consecutive_failures: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          last_worker_run_at?: string | null;
          last_successful_run_at?: string | null;
          last_worker_duration_ms?: number | null;
          last_worker_status?: string;
          last_worker_report?: Json;
          last_token_check_at?: string | null;
          last_token_refresh_at?: string | null;
          last_storage_cleanup_at?: string | null;
          consecutive_failures?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          last_worker_run_at?: string | null;
          last_successful_run_at?: string | null;
          last_worker_duration_ms?: number | null;
          last_worker_status?: string;
          last_worker_report?: Json;
          last_token_check_at?: string | null;
          last_token_refresh_at?: string | null;
          last_storage_cleanup_at?: string | null;
          consecutive_failures?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      publication_items: {
        Row: {
          id: string;
          batch_id: string;
          submission_id: string;
          slide_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          submission_id: string;
          slide_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string;
          submission_id?: string;
          slide_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publication_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "publication_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publication_items_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          }
        ];
      };
      moderation_logs: {
        Row: {
          id: string;
          submission_id: string;
          previous_status: string;
          new_status: string;
          moderation_reason: string | null;
          decision_source: string;
          admin_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          previous_status: string;
          new_status: string;
          moderation_reason?: string | null;
          decision_source?: string;
          admin_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          previous_status?: string;
          new_status?: string;
          moderation_reason?: string | null;
          decision_source?: string;
          admin_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_logs_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          }
        ];
      };
      system_logs: {
        Row: {
          id: string;
          event_type: string;
          severity: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          severity?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          severity?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          id: string;
          client_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          key: string;
          public_code: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          key: string;
          public_code: string;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          key?: string;
          public_code?: string;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      storage_capacity_ledger: {
        Row: {
          id: string;
          total_budget_bytes: number;
          reconciled_stored_bytes: number;
          active_reserved_bytes: number;
          last_reconciled_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          total_budget_bytes?: number;
          reconciled_stored_bytes?: number;
          active_reserved_bytes?: number;
          last_reconciled_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          total_budget_bytes?: number;
          reconciled_stored_bytes?: number;
          active_reserved_bytes?: number;
          last_reconciled_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      storage_reservations: {
        Row: {
          id: string;
          reservation_token: string;
          storage_path: string;
          media_type: "image" | "video";
          mime_type: string;
          size_bytes: number;
          client_hash: string;
          status: "reserved" | "finalized" | "expired" | "released";
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          reservation_token: string;
          storage_path: string;
          media_type: "image" | "video";
          mime_type: string;
          size_bytes: number;
          client_hash: string;
          status?: "reserved" | "finalized" | "expired" | "released";
          created_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          reservation_token?: string;
          storage_path?: string;
          media_type?: "image" | "video";
          mime_type?: string;
          size_bytes?: number;
          client_hash?: string;
          status?: "reserved" | "finalized" | "expired" | "released";
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      storage_audit_logs: {
        Row: {
          id: string;
          event_type: string;
          bytes_change: number;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          bytes_change?: number;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          bytes_change?: number;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      check_and_record_rate_limit: {
        Args: {
          p_client_hash: string;
          p_max_requests?: number;
          p_window_interval?: string;
        };
        Returns: {
          allowed: boolean;
          current_count: number;
          remaining: number;
          reset_seconds: number;
        }[];
      };
      reserve_storage_capacity_atomic: {
        Args: {
          p_token: string;
          p_path: string;
          p_media_type: string;
          p_mime: string;
          p_client_hash: string;
          p_ttl_seconds?: number;
        };
        Returns: {
          allowed: boolean;
          reserved_size: number;
          current_stored: number;
          active_reserved: number;
          hard_capacity: number;
          available_bytes: number;
          error_message: string | null;
        }[];
      };
      finalize_storage_reservation_atomic: {
        Args: {
          p_token: string;
          p_actual_bytes: number;
        };
        Returns: {
          success: boolean;
          reconciled_stored: number;
          active_reserved: number;
          error_message: string | null;
        }[];
      };
      release_storage_reservation_atomic: {
        Args: {
          p_token: string;
        };
        Returns: {
          success: boolean;
          active_reserved: number;
        }[];
      };
      reconcile_storage_ledger_atomic: {
        Args: {
          p_actual_stored_bytes: number;
        };
        Returns: {
          success: boolean;
          reconciled_stored: number;
          active_reserved: number;
          last_reconciled: string;
        }[];
      };
      reserve_publication_slot_atomic: {
        Args: {
          p_wib_date: string;
          p_slot_time: string;
          p_batch_id: string;
          p_submission_id: string;
        };
        Returns: {
          success: boolean;
          error?: string;
          wib_date?: string;
          slot_time?: string;
          batch_id?: string;
        };
      };
      acquire_distributed_lock_atomic: {
        Args: {
          p_lock_key: string;
          p_owner_id: string;
          p_ttl_seconds: number;
          p_metadata?: Json;
        };
        Returns: {
          acquired: boolean;
          lock_key?: string;
          owner_id?: string;
          fencing_token?: number;
          expires_at?: string;
        };
      };
      release_distributed_lock_atomic: {
        Args: {
          p_lock_key: string;
          p_owner_id: string;
          p_fencing_token: number;
        };
        Returns: boolean;
      };
      claim_next_queue_job_atomic: {
        Args: {
          p_worker_id: string;
          p_lease_duration_seconds?: number;
        };
        Returns: {
          job_id: string;
          job_type: string;
          batch_id: string | null;
          submission_id: string | null;
          attempt_count: number;
          max_attempts: number;
          claim_version: number;
          payload: Json;
        }[];
      };
    };
    Enums: {
      submission_status_enum: SubmissionStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
