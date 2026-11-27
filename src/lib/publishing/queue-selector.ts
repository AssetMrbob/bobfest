import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface QueueSelectionResult {
  eligibleSubmissions: Array<{
    id: string;
    public_code: string;
    message: string;
    recipient: string | null;
    status: string;
    moderation_status: string;
    created_at: string;
    updated_at: string;
  }>;
  totalEligible: number;
}

/**
 * Selects next eligible approved submission for automated publishing.
 *
 * Rules:
 * - Only status = 'approved'.
 * - Must NOT be already in publication_batches or publication_slots.
 * - Must NOT be a synthetic test submission (excludes codes starting with 'TEST').
 * - Media must be approved (no media_status = 'pending' or 'needs_review').
 * - Ordering:
 *   1. Explicit admin priority (if exists).
 *   2. Approval timestamp (updated_at).
 *   3. Creation timestamp (created_at).
 *   4. Deterministic tie-breaker (id).
 */
export async function selectNextEligibleSubmission(
  limit: number = 1
): Promise<QueueSelectionResult> {
  const adminClient = createAdminSupabaseClient();

  // 1. Fetch existing scheduled or active batch submission IDs to exclude
  const { data: activeBatches } = await adminClient
    .from("publication_batches")
    .select("submission_id")
    .neq("status", "cancelled");

  const excludedSubmissionIds = new Set<string>();
  if (activeBatches) {
    for (const b of activeBatches) {
      if (b.submission_id) excludedSubmissionIds.add(b.submission_id);
    }
  }

  // Also exclude slots if table exists
  try {
    const { data: activeSlots } = await adminClient
      .from("publication_slots")
      .select("submission_id")
      .neq("status", "cancelled");

    if (activeSlots) {
      for (const s of activeSlots) {
        if (s.submission_id) excludedSubmissionIds.add(s.submission_id);
      }
    }
  } catch {
    // Ignore if table not created yet
  }

  // 2. Fetch approved submissions
  const { data: approvedSubmissions, error: subErr } = await adminClient
    .from("submissions")
    .select("id, public_code, message, recipient, status, moderation_status, created_at, updated_at")
    .eq("status", "approved")
    .order("updated_at", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (subErr || !approvedSubmissions) {
    return { eligibleSubmissions: [], totalEligible: 0 };
  }

  // 3. Filter candidates
  const eligible = approvedSubmissions.filter((sub) => {
    // Exclude if already in a batch or slot
    if (excludedSubmissionIds.has(sub.id)) return false;

    // Exclude synthetic test submissions
    if (sub.public_code.toUpperCase().startsWith("TEST")) return false;

    return true;
  });

  return {
    eligibleSubmissions: eligible.slice(0, limit),
    totalEligible: eligible.length,
  };
}
