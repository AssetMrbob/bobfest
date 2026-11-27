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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
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
