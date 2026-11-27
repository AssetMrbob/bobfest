/**
 * Submission & Form Type Definitions
 */

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "queued"
  | "published";

export interface MediaAttachment {
  id: string;
  type: "image" | "video";
  url: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
}

export interface Submission {
  id: string;
  recipient?: string;
  message: string;
  attachment?: MediaAttachment;
  status: SubmissionStatus;
  createdAt: string;
  moderationNotes?: string;
  scheduledSlot?: string;
  ipHash?: string; // Anonymized hash for anti-spam rate limiting
}

export type FormSubmissionState =
  | "idle"
  | "typing"
  | "submitting"
  | "success"
  | "error";

export interface FormErrors {
  recipient?: string;
  message?: string;
  media?: string;
  general?: string;
}
