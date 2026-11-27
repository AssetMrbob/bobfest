"use client";

import * as React from "react";
import { Clock, Plus } from "lucide-react";
import { enqueueSubmission, dequeueSubmission, cancelPublicationBatch } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/utils";

interface QueueBatch {
  id: string;
  scheduled_time: string;
  status: string;
  publication_items: Array<{
    id: string;
    slide_order: number;
    submission_id: string;
  }>;
}

interface QueuedItem {
  id: string;
  public_code: string;
  recipient: string | null;
  message: string;
  created_at: string;
}

interface QueueClientProps {
  initialData: {
    isConfigured: boolean;
    batches: QueueBatch[];
    queuedSubmissions: QueuedItem[];
    approvedUnqueued: QueuedItem[];
  };
}

export function QueueClient({ initialData }: QueueClientProps) {
  const { batches, queuedSubmissions, approvedUnqueued } = initialData;
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleEnqueue = async (id: string) => {
    setIsProcessing(true);
    await enqueueSubmission(id);
    setIsProcessing(false);
    window.location.reload();
  };

  const handleDequeue = async (id: string) => {
    setIsProcessing(true);
    await dequeueSubmission(id);
    setIsProcessing(false);
    window.location.reload();
  };

  const handleCancelBatch = async (batchId: string) => {
    if (!confirm("Cancel this scheduled batch? Included messages will return to queued state.")) return;
    setIsProcessing(true);
    await cancelPublicationBatch(batchId);
    setIsProcessing(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Publishing Queue
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Cadence: 12:00 & 19:00 WIB (Asia/Jakarta) · Max 2 daily Feed batches · Max 5 slides per carousel.
          </p>
        </div>
        <div className="text-xs font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded border border-[#DBEAFE]">
          {queuedSubmissions.length} Queued Messages
        </div>
      </div>

      {/* Scheduled Batches Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#171717]">Scheduled Batches</h2>
        {batches.length === 0 ? (
          <div className="p-8 text-center bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-xs text-[#737373]">
            No batches scheduled currently. Approved submissions queued below will be batched into the next available 12:00 or 19:00 slot.
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => (
              <div key={batch.id} className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-semibold text-[#171717]">{formatDateTime(batch.scheduled_time)}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded capitalize">{batch.status}</span>
                  </div>
                  <p className="text-xs text-[#737373] mt-1">
                    {batch.publication_items?.length || 0} / 5 slides assigned
                  </p>
                </div>
                <button
                  onClick={() => handleCancelBatch(batch.id)}
                  disabled={isProcessing}
                  className="text-xs text-[#DC2626] hover:underline"
                >
                  Cancel Batch
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Queued Submissions */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-semibold text-[#171717]">Queued Submissions (Awaiting Batch Assignment)</h2>
        {queuedSubmissions.length === 0 ? (
          <div className="p-6 text-center bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-xs text-[#737373]">
            No messages currently in queue. Add approved messages below to queue them for publication.
          </div>
        ) : (
          <div className="space-y-2.5">
            {queuedSubmissions.map((sub) => (
              <div key={sub.id} className="p-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] font-semibold text-[#171717]">{sub.public_code}</span>
                    {sub.recipient && <span className="text-[#737373]">To: {sub.recipient}</span>}
                  </div>
                  <p className="text-xs text-[#171717] truncate">&ldquo;{sub.message}&rdquo;</p>
                </div>
                <button
                  onClick={() => handleDequeue(sub.id)}
                  disabled={isProcessing}
                  className="text-xs text-[#737373] hover:text-[#DC2626] px-2 py-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved But Unqueued Submissions */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-semibold text-[#171717]">Approved Submissions (Ready to Queue)</h2>
        {approvedUnqueued.length === 0 ? (
          <div className="p-6 text-center bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-xs text-[#737373]">
            No unqueued approved messages. Review pending submissions in the Inbox to approve more.
          </div>
        ) : (
          <div className="space-y-2.5">
            {approvedUnqueued.map((sub) => (
              <div key={sub.id} className="p-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] font-semibold text-[#171717]">{sub.public_code}</span>
                    {sub.recipient && <span className="text-[#737373]">To: {sub.recipient}</span>}
                  </div>
                  <p className="text-xs text-[#171717] truncate">&ldquo;{sub.message}&rdquo;</p>
                </div>
                <button
                  onClick={() => handleEnqueue(sub.id)}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-[#2563EB] text-white rounded text-xs font-medium inline-flex items-center gap-1 hover:bg-[#1D4ED8]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Queue</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
