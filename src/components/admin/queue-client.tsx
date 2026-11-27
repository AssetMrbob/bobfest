"use client";

import * as React from "react";
import { Clock, Plus, Play, Eye } from "lucide-react";
import { enqueueSubmission, dequeueSubmission, cancelPublicationBatch } from "@/app/admin/actions";
import { dryRunPublishBatchAction, getThreadsBatchPreviewAction } from "@/app/admin/social-actions";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormattedThreadsPayload } from "@/lib/threads/threads-formatter";

interface QueueBatch {
  id: string;
  scheduled_time: string;
  status: string;
  submission_id?: string | null;
  feed_asset_paths?: string[] | null;
  story_asset_path?: string | null;
  caption?: string | null;
  approved_for_publishing?: boolean;
  publication_items: Array<{
    id: string;
    slide_order: number;
    submission_id: string;
    submissions?: {
      id: string;
      public_code: string;
      message: string;
      recipient: string | null;
    };
  }>;
}

interface QueuedItem {
  id: string;
  public_code: string;
  recipient: string | null;
  message: string;
  created_at: string;
  media_assets?: Array<{
    id: string;
    mime_type?: string;
    media_type?: string;
  }>;
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
  const [testingBatchId, setTestingBatchId] = React.useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = React.useState<string | null>(null);
  const [previewData, setPreviewData] = React.useState<{
    batchId: string;
    publicCode: string;
    payload: FormattedThreadsPayload;
  } | null>(null);
  const [dryRunReport, setDryRunReport] = React.useState<{
    batchId: string;
    overallStatus: string;
    deliveries: Array<{
      platform: string;
      publicationType: string;
      status: string;
      error?: string;
      payloadText?: string;
    }>;
  } | null>(null);

  const handlePreviewThreads = async (batchId: string) => {
    setPreviewLoadingId(batchId);
    try {
      const res = await getThreadsBatchPreviewAction(batchId);
      if (res.success && res.preview) {
        setPreviewData({
          batchId,
          publicCode: res.publicCode || "BATCH",
          payload: res.preview,
        });
      } else {
        alert(res.error || "Failed to load Threads preview.");
      }
    } catch (e) {
      alert(`Error loading preview: ${(e as Error).message}`);
    } finally {
      setPreviewLoadingId(null);
    }
  };

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
    if (!confirm("Cancel this scheduled batch? Included message will return to queued state.")) return;
    setIsProcessing(true);
    await cancelPublicationBatch(batchId);
    setIsProcessing(false);
    window.location.reload();
  };

  const handleDryRun = async (batchId: string) => {
    setTestingBatchId(batchId);
    setDryRunReport(null);
    try {
      const res = await dryRunPublishBatchAction(batchId);
      if (res.success && res.report) {
        setDryRunReport(res.report);
      } else {
        alert(`Dry run failed: ${res.error}`);
      }
    } catch (e) {
      alert(`Dry run exception: ${(e as Error).message}`);
    } finally {
      setTestingBatchId(null);
    }
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
            Cadence: 12:00 & 19:00 WIB (Asia/Jakarta) · 1 Menfess = 1 Instagram Feed + 1 Story + 1 Threads Post.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded border border-[#DBEAFE]">
            {queuedSubmissions.length} Queued Messages
          </div>
        </div>
      </div>

      {/* Dry Run Report Dialog/Card */}
      {dryRunReport && (
        <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <span className="font-semibold text-[#1E293B]">
              Dry Run Validation Report for Batch {dryRunReport.batchId.slice(0, 8)}...
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
              dryRunReport.overallStatus === "completed"
                ? "bg-[#DCFCE7] text-[#166534]"
                : "bg-[#FEF9C3] text-[#854D0E]"
            }`}>
              {dryRunReport.overallStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dryRunReport.deliveries.map((d, i) => (
              <div key={i} className="p-2.5 bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold capitalize text-[#334155]">
                    {d.platform} ({d.publicationType})
                  </span>
                  <span className={`text-[10px] font-medium ${
                    d.status === "published" ? "text-[#16A34A]" : "text-[#DC2626]"
                  }`}>
                    {d.status}
                  </span>
                </div>
                {d.error && <p className="text-[11px] text-[#DC2626]">{d.error}</p>}
                {d.payloadText && (
                  <div className="mt-1 pt-1 border-t border-[#E2E8F0]">
                    <span className="text-[10px] text-[#64748B] block font-mono">Payload ({d.payloadText.length} chars):</span>
                    <p className="text-[11px] text-[#0F172A] whitespace-pre-wrap font-sans bg-[#F1F5F9] p-2 rounded mt-0.5">
                      {d.payloadText}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDryRunReport(null)}
              className="h-7 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Scheduled Batches Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#171717]">Scheduled Batches (Ready for Publishing)</h2>
        {batches.length === 0 ? (
          <div className="p-8 text-center bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-xs text-[#737373]">
            No batches scheduled currently. Approved submissions queued below will be batched into the next available 12:00 or 19:00 slot.
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => {
              const slideCount = batch.feed_asset_paths?.length || batch.publication_items?.length || 1;
              return (
                <div key={batch.id} className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Clock className="w-4 h-4 text-[#2563EB]" />
                      <span className="text-xs font-semibold text-[#171717]">{formatDateTime(batch.scheduled_time)}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded capitalize">{batch.status}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded">
                        {slideCount === 1 ? "1 Slide (Feed Post)" : `${slideCount} Slides (Carousel)`}
                      </span>
                      {batch.story_asset_path && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#FDF2F8] text-[#BE185D] rounded">
                          + Companion Story
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F0FDF4] text-[#166534] rounded">
                        + Threads Post
                      </span>
                    </div>
                    <p className="text-xs text-[#737373]">
                      Targeting: Instagram (@kampunginggrisfess) & Threads (@kampunginggrisfess)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreviewThreads(batch.id)}
                      disabled={previewLoadingId === batch.id || isProcessing}
                      className="h-8 text-xs cursor-pointer flex items-center gap-1 text-[#2563EB] border-[#BFDBFE] hover:bg-[#EFF6FF]"
                    >
                      <Eye className={`w-3.5 h-3.5 ${previewLoadingId === batch.id ? "animate-spin" : ""}`} />
                      <span>{previewLoadingId === batch.id ? "Loading..." : "Preview Threads"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDryRun(batch.id)}
                      disabled={testingBatchId === batch.id || isProcessing}
                      className="h-8 text-xs cursor-pointer flex items-center gap-1"
                    >
                      <Play className={`w-3 h-3 ${testingBatchId === batch.id ? "animate-spin" : ""}`} />
                      <span>{testingBatchId === batch.id ? "Testing..." : "Dry Run"}</span>
                    </Button>
                    <button
                      onClick={() => handleCancelBatch(batch.id)}
                      disabled={isProcessing}
                      className="text-xs text-[#DC2626] hover:underline px-2 py-1 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
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
                    {sub.media_assets && sub.media_assets.length > 0 && (
                      <span className="text-[10px] bg-[#F3F4F6] text-[#4B5563] px-1.5 py-0.5 rounded">
                        {sub.media_assets[0].mime_type?.startsWith("video") ? "video" : "image"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#171717] truncate">&ldquo;{sub.message}&rdquo;</p>
                </div>
                <button
                  onClick={() => handleDequeue(sub.id)}
                  disabled={isProcessing}
                  className="text-xs text-[#737373] hover:text-[#DC2626] px-2 py-1 cursor-pointer"
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
                  className="px-3 py-1 bg-[#2563EB] text-white rounded text-xs font-medium inline-flex items-center gap-1 hover:bg-[#1D4ED8] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Queue</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Threads Payload Preview Modal */}
      {previewData && (
        <Modal
          isOpen={!!previewData}
          onClose={() => setPreviewData(null)}
          title={`Threads Payload Preview · ${previewData.publicCode}`}
          description="Exact 1:1 match with actual Threads API payload. Verified clean, natural text with zero automated branding prefixes, slide labels, or continuation headers."
        >
          <div className="space-y-4 text-xs">
            {/* Status overview */}
            <div className="flex items-center justify-between p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <span className="text-[#64748B]">Publication Structure:</span>
              <span className="font-semibold text-[#0F172A]">
                {previewData.payload.isMultiSlide ? "2-Slide Thread (Root Post + Reply)" : "Single-Slide Direct Post"}
              </span>
            </div>

            {/* Root Post (Slide 1) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Root Post (threads_main)
                </span>
                <span className={`font-mono text-[11px] ${
                  previewData.payload.rootPost.isExceedingLimit ? "text-[#DC2626] font-bold" : "text-[#64748B]"
                }`}>
                  {previewData.payload.rootPost.charCount} / 500 chars
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <p className="whitespace-pre-wrap font-sans text-xs text-[#0F172A] leading-relaxed">
                  {previewData.payload.rootPost.text}
                </p>
              </div>
              {previewData.payload.rootPost.error && (
                <p className="text-[11px] text-[#DC2626]">{previewData.payload.rootPost.error}</p>
              )}
            </div>

            {/* Threaded Reply (Slide 2, if multi-slide) */}
            {previewData.payload.replyPost && (
              <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    Threaded Reply (threads_reply)
                  </span>
                  <span className={`font-mono text-[11px] ${
                    previewData.payload.replyPost.isExceedingLimit ? "text-[#DC2626] font-bold" : "text-[#64748B]"
                  }`}>
                    {previewData.payload.replyPost.charCount} / 500 chars
                  </span>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <p className="whitespace-pre-wrap font-sans text-xs text-[#0F172A] leading-relaxed">
                    {previewData.payload.replyPost.text}
                  </p>
                </div>
                {previewData.payload.replyPost.error && (
                  <p className="text-[11px] text-[#DC2626]">{previewData.payload.replyPost.error}</p>
                )}
                <p className="text-[11px] text-[#64748B] italic">
                  Published as a direct reply to the root post with reply_to_id. No slide labels or continuation headers.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewData(null)}
                className="h-8 text-xs cursor-pointer"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}