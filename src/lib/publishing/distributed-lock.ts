import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Json } from "@/lib/supabase/types";

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
 * Uses database-backed `distributed_locks` table with RPC atomic function
 * and fallback compare-and-swap mechanism if RPC has not been migrated.
 */
export class DistributedLockManager {
  private static workerInstanceId = `worker-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
  private static inMemoryLockFallback = new Map<string, { ownerId: string; expiresAt: number; fencingToken: number }>();

  public static getWorkerId(): string {
    return this.workerInstanceId;
  }

  /**
   * Tries to atomically acquire a distributed lock.
   */
  public static async acquireLock(
    lockKey: string,
    ttlSeconds: number = 60,
    ownerId: string = this.workerInstanceId,
    metadata: Record<string, unknown> = {}
  ): Promise<LockAcquisition> {
    const adminClient = createAdminSupabaseClient();

    try {
      // 1. Try atomic database RPC function first
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
    } catch {
      // Fallback below
    }

    // 2. Client-side fallback using distributed_locks table directly
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

      const { data: existing, error: fetchErr } = await adminClient
        .from("distributed_locks")
        .select("*")
        .eq("lock_key", lockKey)
        .maybeSingle();

      if (fetchErr && fetchErr.code !== "PGRST116") {
        // Production distributed locking MUST fail closed without in-memory fallback.
        // Granting in-memory locks across serverless containers risks split-brain duplicate publishing.
        if (process.env.NODE_ENV === "production") {
          return {
            acquired: false,
            lockKey,
            error: `Production distributed lock failed closed: database table unavailable (${fetchErr.message})`,
          };
        }

        // Table does not exist in DB yet before migration -> in-memory mutual exclusion fallback (DEV / TEST ONLY)
        const existingLocal = DistributedLockManager.inMemoryLockFallback.get(lockKey);
        const nowMs = now.getTime();
        if (existingLocal && existingLocal.expiresAt > nowMs && existingLocal.ownerId !== ownerId) {
          return {
            acquired: false,
            lockKey,
            ownerId: existingLocal.ownerId,
            fencingToken: existingLocal.fencingToken,
            expiresAt: new Date(existingLocal.expiresAt).toISOString(),
            error: "Lock active by another owner (fallback mode).",
          };
        }
        const fencing = (existingLocal?.fencingToken || 0) + 1;
        DistributedLockManager.inMemoryLockFallback.set(lockKey, {
          ownerId,
          expiresAt: nowMs + ttlSeconds * 1000,
          fencingToken: fencing,
        });
        return {
          acquired: true,
          lockKey,
          ownerId,
          fencingToken: fencing,
          expiresAt,
        };
      }

      if (!existing) {
        const { error: insErr } = await adminClient.from("distributed_locks").insert({
          lock_key: lockKey,
          owner_id: ownerId,
          fencing_token: 1,
          acquired_at: now.toISOString(),
          expires_at: expiresAt,
          metadata: metadata as unknown as Json,
        });

        if (!insErr) {
          return { acquired: true, lockKey, ownerId, fencingToken: 1, expiresAt };
        }
      } else {
        const isExpired = new Date(existing.expires_at).getTime() < now.getTime();
        const isSameOwner = existing.owner_id === ownerId;

        if (isExpired || isSameOwner) {
          const nextFencing = (existing.fencing_token || 1) + 1;
          const { error: updErr } = await adminClient
            .from("distributed_locks")
            .update({
              owner_id: ownerId,
              fencing_token: nextFencing,
              acquired_at: now.toISOString(),
              expires_at: expiresAt,
              metadata: metadata as unknown as Json,
            })
            .eq("lock_key", lockKey)
            .eq("fencing_token", existing.fencing_token);

          if (!updErr) {
            return { acquired: true, lockKey, ownerId, fencingToken: nextFencing, expiresAt };
          }
        }
      }

      return {
        acquired: false,
        lockKey,
        ownerId: existing?.owner_id,
        expiresAt: existing?.expires_at,
      };
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
    ownerId: string = this.workerInstanceId,
    fencingToken?: number
  ): Promise<boolean> {
    const local = DistributedLockManager.inMemoryLockFallback.get(lockKey);
    if (local && local.ownerId === ownerId) {
      DistributedLockManager.inMemoryLockFallback.delete(lockKey);
    }

    const adminClient = createAdminSupabaseClient();

    try {
      if (fencingToken !== undefined) {
        const { data, error } = await adminClient.rpc("release_distributed_lock_atomic", {
          p_lock_key: lockKey,
          p_owner_id: ownerId,
          p_fencing_token: fencingToken,
        });
        if (!error && typeof data === "boolean") {
          return data;
        }
      }

      // Fallback
      let query = adminClient
        .from("distributed_locks")
        .delete()
        .eq("lock_key", lockKey)
        .eq("owner_id", ownerId);

      if (fencingToken !== undefined) {
        query = query.eq("fencing_token", fencingToken);
      }

      const { error } = await query;
      return !error;
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
    ownerId: string = this.workerInstanceId
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
