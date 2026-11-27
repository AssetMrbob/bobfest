export interface SubmissionSlideData {
  slideOrder: 1 | 2;
  message: string;
  mediaAttachment?: {
    reservationToken: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export interface MultiSlideSubmissionRequest {
  recipient?: string;
  slides: SubmissionSlideData[];
  turnstileToken?: string;
  idempotencyKey?: string;
}

export interface TemplateDimensions {
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateLayoutConfig {
  message_box: BoundingBox;
  media_box?: BoundingBox;
  recipient_box?: BoundingBox;
  code_box?: BoundingBox;
}

export interface CustomTemplate {
  id: string;
  name: string;
  category: "text_feed" | "photo_feed" | "video_feed" | "story";
  dimensions: TemplateDimensions;
  background_storage_path: string | null;
  font_family: string;
  font_file_path: string | null;
  font_size_min: number;
  font_size_max: number;
  text_color: string;
  line_height: number;
  letter_spacing: number;
  vertical_align: "top" | "middle" | "bottom";
  layout_config: TemplateLayoutConfig;
  is_active: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
}
