import { DistributedLockManager } from "./distributed-lock";
import { reconcileBucketStorage, runFifoStorageCleanup } from "@/lib/storage/storage-manager";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface StorageMaintenanceReport {
  reconciledStoredBytes: number;
  totalBudgetBytes: number;
  usedPercentage: number;
  cleanedFilesCount: number;
  freedBytes: number;
  status: "ok" | "warning_90" | "hard_limit_95";
  skippedDueToLock: boolean;
}

/**
 * Executes storage reconciliation and FIFO cleanup under distributed lock.
 * Lock: `lock:storage_maintenance`
 */
export async function performStorageMaintenance(): Promise<StorageMaintenanceReport> {
  const adminClient = createAdminSupabaseClient();
  const workerId = DistributedLockManager.getWorkerId();

  // Acquire lock for 300 seconds
  const lock = await DistributedLockManager.acquireLock("lock:storage_maintenance", 300, workerId);
  if (!lock.acquired) {
    return {
      reconciledStoredBytes: 0,
      totalBudgetBytes: 1_000_000_000,
      usedPercentage: 0,
      cleanedFilesCount: 0,
      freedBytes: 0,
      status: "ok",
      skippedDueToLock: true,
    };
  }

  try {
    // 1. Reconcile storage ledger across buckets
    const totalStoredBytes = await reconcileBucketStorage(adminClient);

    // 2. Query ledger to check percentage
    const { data: ledger } = await adminClient
      .from("storage_capacity_ledger")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const budgetBytes = ledger?.total_budget_bytes || 1_000_000_000;
    const reservedBytes = ledger?.active_reserved_bytes || 0;
    const usedBytes = totalStoredBytes + reservedBytes;
    const usedPercent = (usedBytes / budgetBytes) * 100;

    let cleanedCount = 0;
    let freedBytes = 0;

    // 3. If used >= 85%, run FIFO cleanup
    if (usedPercent >= 85) {
      const cleanupRes = await runFifoStorageCleanup(adminClient);
      cleanedCount = cleanupRes.deletedCount;
      freedBytes = cleanupRes.freedBytes;

      // Reconcile again after deletion
      await reconcileBucketStorage(adminClient);
    }

    let status: StorageMaintenanceReport["status"] = "ok";
    if (usedPercent >= 95) {
      status = "hard_limit_95";
    } else if (usedPercent >= 90) {
      status = "warning_90";
    }

    // Update scheduler_health record
    try {
      await adminClient
        .from("scheduler_health")
        .update({
          last_storage_cleanup_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", "global");
    } catch {
      // Graceful fallback
    }

    return {
      reconciledStoredBytes: totalStoredBytes,
      totalBudgetBytes: budgetBytes,
      usedPercentage: Number(usedPercent.toFixed(2)),
      cleanedFilesCount: cleanedCount,
      freedBytes,
      status,
      skippedDueToLock: false,
    };
  } finally {
    await DistributedLockManager.releaseLock("lock:storage_maintenance", workerId, lock.fencingToken);
  }
}
