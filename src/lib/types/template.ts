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

export interface LayerElementConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  locked?: boolean;
  fitMode?: "cover" | "contain";
}

export interface TemplateLayoutConfig {
  message_box: LayerElementConfig;
  media_box?: LayerElementConfig;
  recipient_box?: LayerElementConfig;
  code_box?: LayerElementConfig;
  story_feed_box?: LayerElementConfig;
  show_recipient?: boolean;
  show_code?: boolean;
  show_slide_number?: boolean;
  layer_order?: string[]; // e.g. ['background', 'media', 'overlay', 'text', 'recipient', 'code']
}

export interface CustomTemplate {
  id: string;
  name: string;
  category: "text_feed" | "photo_feed" | "video_feed" | "story";
  dimensions: TemplateDimensions;
  background_storage_path: string | null;
  overlay_storage_path?: string | null;
  font_family: string;
  font_file_path: string | null;
  font_size_min: number;
  font_size_max: number;
  font_weight?: string;
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
