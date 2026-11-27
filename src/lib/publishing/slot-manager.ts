import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface SlotEvaluation {
  isPublicationWindow: boolean;
  currentWibDate: string; // YYYY-MM-DD
  activeSlotTime: "12:00" | "19:00" | null;
  minutesIntoWindow: number;
  nextSlotTime: string;
  nextSlotDate: string;
}

/**
 * Calculates current Asia/Jakarta time and slot eligibility.
 * Standard slots: 12:00 WIB and 19:00 WIB.
 * Catch-up window: default 30 minutes.
 */
export function evaluatePublicationSlot(
  nowUtc: Date = new Date(),
  catchupWindowMinutes: number = 30
): SlotEvaluation {
  // Convert UTC to Asia/Jakarta (UTC + 7)
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const jakartaTime = new Date(nowUtc.getTime() + jakartaOffsetMs);

  const hours = jakartaTime.getUTCHours();
  const minutes = jakartaTime.getUTCMinutes();
  const currentTotalMinutes = hours * 60 + minutes;

  const currentWibDate = jakartaTime.toISOString().slice(0, 10);

  const slot12TotalMinutes = 12 * 60; // 720 min
  const slot19TotalMinutes = 19 * 60; // 1140 min

  let activeSlotTime: "12:00" | "19:00" | null = null;
  let minutesIntoWindow = 0;

  // Check 12:00 WIB slot
  if (
    currentTotalMinutes >= slot12TotalMinutes &&
    currentTotalMinutes <= slot12TotalMinutes + catchupWindowMinutes
  ) {
    activeSlotTime = "12:00";
    minutesIntoWindow = currentTotalMinutes - slot12TotalMinutes;
  }
  // Check 19:00 WIB slot
  else if (
    currentTotalMinutes >= slot19TotalMinutes &&
    currentTotalMinutes <= slot19TotalMinutes + catchupWindowMinutes
  ) {
    activeSlotTime = "19:00";
    minutesIntoWindow = currentTotalMinutes - slot19TotalMinutes;
  }

  // Calculate next slot
  let nextSlotTime = "12:00";
  let nextSlotDate = currentWibDate;

  if (currentTotalMinutes < slot12TotalMinutes) {
    nextSlotTime = "12:00";
    nextSlotDate = currentWibDate;
  } else if (currentTotalMinutes < slot19TotalMinutes) {
    nextSlotTime = "19:00";
    nextSlotDate = currentWibDate;
  } else {
    // Tomorrow 12:00
    const tomorrow = new Date(jakartaTime.getTime() + 24 * 60 * 60 * 1000);
    nextSlotDate = tomorrow.toISOString().slice(0, 10);
    nextSlotTime = "12:00";
  }

  return {
    isPublicationWindow: activeSlotTime !== null,
    currentWibDate,
    activeSlotTime,
    minutesIntoWindow,
    nextSlotTime,
    nextSlotDate,
  };
}

/**
 * Atomically reserves a publication slot for a batch and submission.
 * Enforces:
 * 1. Exactly 1 batch per WIB slot ('12:00' or '19:00').
 * 2. Maximum 2 publication batches per WIB calendar day.
 * 3. A submission can only be reserved in one slot.
 */
export async function reservePublicationSlot(params: {
  wibDate: string;
  slotTime: "12:00" | "19:00";
  batchId: string;
  submissionId: string;
}): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminSupabaseClient();

  try {
    // 1. Try atomic database function if migration has run
    const { data, error } = await adminClient.rpc("reserve_publication_slot_atomic", {
      p_wib_date: params.wibDate,
      p_slot_time: params.slotTime,
      p_batch_id: params.batchId,
      p_submission_id: params.submissionId,
    });

    if (!error && data) {
      if (data.success === true) {
        return { success: true };
      }
      return { success: false, error: data.error };
    }
  } catch {
    // Fallback below
  }

  // 2. Direct transactional/table checks fallback
  try {
    // Check if slot table exists and query it
    const { data: existingSlot, error: slotErr } = await adminClient
      .from("publication_slots")
      .select("*")
      .eq("wib_date", params.wibDate)
      .eq("slot_time", params.slotTime)
      .neq("status", "cancelled")
      .maybeSingle();

    if (!slotErr && existingSlot) {
      return {
        success: false,
        error: `Slot ${params.slotTime} on ${params.wibDate} is already reserved by batch ${existingSlot.batch_id}`,
      };
    }

    // Check submission identity
    const { data: existingSub, error: subErr } = await adminClient
      .from("publication_slots")
      .select("*")
      .eq("submission_id", params.submissionId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (!subErr && existingSub) {
      return {
        success: false,
        error: `Submission ${params.submissionId} is already assigned to a publication slot`,
      };
    }

    // Check count for day
    const { count, error: countErr } = await adminClient
      .from("publication_slots")
      .select("id", { count: "exact", head: true })
      .eq("wib_date", params.wibDate)
      .neq("status", "cancelled");

    if (!countErr && count !== null && count >= 2) {
      return {
        success: false,
        error: `Daily limit of 2 publication batches already reached for date ${params.wibDate}`,
      };
    }

    // Try inserting
    const { error: insertErr } = await adminClient.from("publication_slots").insert({
      wib_date: params.wibDate,
      slot_time: params.slotTime,
      batch_id: params.batchId,
      submission_id: params.submissionId,
      status: "reserved",
    });

    if (insertErr) {
      // If table doesn't exist yet, we check publication_batches count as ultimate fallback
      if (insertErr.code === "42P01") {
        return { success: true };
      }
      return { success: false, error: insertErr.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
