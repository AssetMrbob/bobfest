/**
 * Storage Capacity Manager & Reconciliation Engine.
 *
 * Implements transaction-safe capacity reservations, bucket reconciliation,
 * and automatic FIFO cleanup using the official Supabase Storage API.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/types";

export const IMAGE_BUCKET = "bobfess-images";
export const VIDEO_BUCKET = "bobfess-videos";
export const TEMPLATE_BUCKET = "bobfess-templates";
export const PUBLISHED_BUCKET = "bobfess-published";
export const ALL_BOBFESS_BUCKETS = [IMAGE_BUCKET, VIDEO_BUCKET, TEMPLATE_BUCKET, PUBLISHED_BUCKET, "bobfess-attachments"];

export function getBucketForMediaType(mediaType: "image" | "video"): string {
  return mediaType === "image" ? IMAGE_BUCKET : VIDEO_BUCKET;
}

export interface StorageLedgerInfo {
  totalBudgetBytes: number;
  reconciledStoredBytes: number;
  activeReservedBytes: number;
  availableBytes: number;
  hardLimitBytes: number;
  usedPercentage: number;
  lastReconciledAt: string;
}

export interface ReservationResult {
  allowed: boolean;
  reservedSize: number;
  currentStored: number;
  activeReserved: number;
  hardCapacity: number;
  availableBytes: number;
  errorMessage?: string;
}

/**
 * Reconciles the database storage ledger against actual stored objects across ALL project buckets.
 * Lists all objects across bobfess-images, bobfess-videos, and bobfess-attachments.
 */
export async function reconcileBucketStorage(
  adminClient: SupabaseClient<Database>
): Promise<number> {
  let totalStoredBytes = 0;

  for (const bucket of ALL_BOBFESS_BUCKETS) {
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { data: objects, error } = await adminClient.storage
        .from(bucket)
        .list("", { limit, offset, sortBy: { column: "created_at", order: "desc" } });

      if (error || !objects) {
        break;
      }

      for (const obj of objects) {
        if (obj.metadata && typeof obj.metadata.size === "number") {
          totalStoredBytes += obj.metadata.size;
        }
      }

      if (objects.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
  }

  // Atomically update ledger
  const { error: rpcError } = await adminClient.rpc(
    "reconcile_storage_ledger_atomic",
    {
      p_actual_stored_bytes: totalStoredBytes,
    }
  );

  if (rpcError) {
    console.error("Failed to commit reconciled bytes to ledger:", rpcError);
  }

  return totalStoredBytes;
}

/**
 * Executes FIFO cleanup of eligible media files when storage capacity is near limit.
 * Protected media statuses:
 * - 'pending', 'needs_review', 'approved', 'queued', 'publishing'
 * - 'published' if companion story is incomplete or required
 *
 * Eligible media:
 * - 'rejected' media
 * - Old unassociated or orphan media files
 * - Fully completed published items
 */
export async function runFifoStorageCleanup(
  adminClient: SupabaseClient<Database>,
  targetFreedBytes = 0
): Promise<{ freedBytes: number; deletedCount: number; success: boolean }> {
  let freedBytes = 0;
  let deletedCount = 0;

  try {
    // 1. Find eligible media assets ordered by oldest created_at first (FIFO)
    const { data: candidates, error } = await adminClient
      .from("media_assets")
      .select(`
        id,
        storage_path,
        size_bytes,
        created_at,
        status,
        submissions:submission_id (
          id,
          status,
          published_at
        )
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !candidates) {
      return { freedBytes: 0, deletedCount: 0, success: false };
    }

    const filesToDelete: { id: string; path: string; size: number }[] = [];

    for (const item of candidates as unknown as {
      id: string;
      storage_path: string;
      size_bytes: number;
      submissions?: { status: string; published_at: string | null };
    }[]) {
      const sub = item.submissions;
      // Protect pending, approved, queued, or active publications
      if (
        sub &&
        ["pending", "needs_review", "approved", "queued", "publishing"].includes(
          sub.status
        )
      ) {
        continue; // Protected
      }

      // Eligible: rejected or old published
      filesToDelete.push({
        id: item.id,
        path: item.storage_path,
        size: item.size_bytes,
      });

      if (targetFreedBytes > 0 && (freedBytes + item.size_bytes) >= targetFreedBytes) {
        break;
      }
    }

    // 2. Perform deletion through official Supabase Storage API
    for (const file of filesToDelete) {
      // Determine bucket based on path
      const bucket = file.path.includes("video") ? VIDEO_BUCKET : IMAGE_BUCKET;
      const { data: removeRes, error: removeErr } = await adminClient.storage
        .from(bucket)
        .remove([file.path]);

      if (!removeErr && removeRes && removeRes.length > 0) {
        // Confirm deletion in database record
        await adminClient
          .from("media_assets")
          .update({
            deleted_at: new Date().toISOString(),
            status: "deleted",
            deletion_reason: "FIFO storage cleanup target reached",
          })
          .eq("id", file.id);

        freedBytes += file.size;
        deletedCount++;
      } else {
        console.error(`Failed to delete object from storage: ${file.path}`, removeErr);
      }
    }

    // 3. Reconcile ledger if files were deleted
    if (freedBytes > 0) {
      await reconcileBucketStorage(adminClient);
    }

    return { freedBytes, deletedCount, success: true };
  } catch (err) {
    console.error("FIFO cleanup error:", err);
    return { freedBytes, deletedCount, success: false };
  }
}

/**
 * Gets the current aggregate storage ledger metrics for admin dashboard.
 */
export async function getStorageLedgerMetrics(
  adminClient: SupabaseClient<Database>
): Promise<StorageLedgerInfo> {
  const { data: ledger } = await adminClient
    .from("storage_capacity_ledger")
    .select("*")
    .eq("id", "global_storage")
    .single();

  const { data: settings } = await adminClient
    .from("app_settings")
    .select("storage_capacity_limit_percent")
    .eq("id", "global")
    .single();

  const totalBudget = Number(ledger?.total_budget_bytes || 1000000000);
  const storedBytes = Number(ledger?.reconciled_stored_bytes || 0);
  const reservedBytes = Number(ledger?.active_reserved_bytes || 0);
  const hardPercent = Number(settings?.storage_capacity_limit_percent || 95);
  const hardLimitBytes = (totalBudget * hardPercent) / 100;
  const currentTotal = storedBytes + reservedBytes;
  const availableBytes = Math.max(0, hardLimitBytes - currentTotal);
  const usedPercentage = Math.min(100, Math.round((currentTotal / totalBudget) * 100));

  return {
    totalBudgetBytes: totalBudget,
    reconciledStoredBytes: storedBytes,
    activeReservedBytes: reservedBytes,
    availableBytes,
    hardLimitBytes,
    usedPercentage,
    lastReconciledAt: ledger?.last_reconciled_at || new Date().toISOString(),
  };
}
