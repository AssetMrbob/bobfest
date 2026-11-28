import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Json } from "@/lib/supabase/types";
import crypto from "crypto";

export interface LockAcquisition {
  acquired: boolean;
  lockKey: string;
  ownerId?: string;
  fencingToken?: number;
  expiresAt?: string;
  error?: string;
}

/**
 * Distributed Lock Manager (Replacing In-Memory Mutexes).
 * Works across serverless instances and multiple parallel invocations.
 * Uses the database-backed atomic RPC and fails closed if it is unavailable.
 */
export class DistributedLockManager {
  public static getWorkerId(): string {
    return `worker-${crypto.randomUUID()}`;
  }

  /**
   * Tries to atomically acquire a distributed lock.
   */
  public static async acquireLock(
    lockKey: string,
    ttlSeconds: number = 60,
    ownerId: string = this.getWorkerId(),
    metadata: Record<string, unknown> = {}
  ): Promise<LockAcquisition> {
    const adminClient = createAdminSupabaseClient();

    try {
      const { data, error } = await adminClient.rpc("acquire_distributed_lock_atomic", {
        p_lock_key: lockKey,
        p_owner_id: ownerId,
        p_ttl_seconds: ttlSeconds,
        p_metadata: metadata as unknown as Json,
      });

      if (!error && data) {
        return {
          acquired: data.acquired === true,
          lockKey,
          ownerId: data.owner_id || ownerId,
          fencingToken: data.fencing_token,
          expiresAt: data.expires_at,
        };
      }
      return { acquired: false, lockKey, error: error?.message || "Distributed lock RPC returned no data" };
    } catch (err) {
      return {
        acquired: false,
        lockKey,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Releases a previously acquired lock atomically using fencing token.
   */
  public static async releaseLock(
    lockKey: string,
    ownerId: string,
    fencingToken?: number
  ): Promise<boolean> {
    const adminClient = createAdminSupabaseClient();

    try {
      if (fencingToken === undefined) return false;
      const { data, error } = await adminClient.rpc("release_distributed_lock_atomic", {
        p_lock_key: lockKey,
        p_owner_id: ownerId,
        p_fencing_token: fencingToken,
      });
      return !error && data === true;
    } catch {
      return false;
    }
  }

  /**
   * Executes a callback inside an automatically managed distributed lock.
   */
  public static async withLock<T>(
    lockKey: string,
    ttlSeconds: number,
    fn: (fencingToken: number) => Promise<T>,
    ownerId: string = this.getWorkerId()
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lock = await this.acquireLock(lockKey, ttlSeconds, ownerId);
    if (!lock.acquired) {
      return {
        success: false,
        error: `Could not acquire lock for key "${lockKey}" (Held by ${lock.ownerId || "another worker"} until ${lock.expiresAt || "unknown"})`,
      };
    }

    try {
      const result = await fn(lock.fencingToken || 1);
      return { success: true, result };
    } finally {
      await this.releaseLock(lockKey, ownerId, lock.fencingToken);
    }
  }
}
