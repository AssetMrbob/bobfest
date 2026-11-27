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
    };
    Enums: {
      submission_status_enum: SubmissionStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
