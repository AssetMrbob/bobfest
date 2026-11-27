export type ModerationDecision = "approved" | "needs_review" | "rejected";

export type ModerationRiskLevel = "low" | "medium" | "high" | "critical";

export type ModerationFlag =
  | "spam"
  | "harassment"
  | "bullying"
  | "sexual_content"
  | "hate_speech"
  | "threats"
  | "violence"
  | "self_harm"
  | "personal_information"
  | "impersonation"
  | "defamatory_allegations"
  | "inappropriate_language"
  | "prompt_injection"
  | "unclear_context";

export interface ModerationResult {
  decision: ModerationDecision;
  risk_level: ModerationRiskLevel;
  category: string;
  reason_code: string;
  short_reason: string;
  detected_flags: ModerationFlag[];
  requires_human_review: boolean;
  model_version: string;
  tokens_used?: {
    prompt_tokens: number;
    candidate_tokens: number;
  };
}

export type ModerationMode = "SMART_AUTOMATIC" | "AI_ASSISTED" | "MANUAL";

export interface AIQuotaUsage {
  requests_today: number;
  successful_requests: number;
  failed_requests: number;
  retry_attempts: number;
  daily_budget: number;
  model_name: string;
  last_request_at: string | null;
  last_error: string | null;
}
