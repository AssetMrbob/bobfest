"use client";

import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import { SubmissionStatus } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Search, Filter, Check, X, Clock, AlertTriangle, Eye, HelpCircle, CheckSquare, Square, Sparkles, RefreshCw } from "lucide-react";
import { moderateSubmission, bulkModerateSubmissions, getAdminMediaSignedUrl, retrySubmissionModeration, triggerModerationWorker } from "@/app/admin/actions";

interface AdminSubmissionItem {
  id: string;
  rawId?: string;
  recipient?: string;
  message: string;
  status: SubmissionStatus;
  createdAt: string;
  moderationNotes?: string;
  mediaAsset?: {
    id: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
  };
}

interface InboxClientProps {
  initialSubmissions: AdminSubmissionItem[];
  isConfigured: boolean;
}

export function InboxClient({ initialSubmissions, isConfigured }: InboxClientProps) {
  const [submissions, setSubmissions] = React.useState<AdminSubmissionItem[]>(initialSubmissions);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = React.useState<AdminSubmissionItem | null>(null);
  const [moderationReason, setModerationReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmRejectId, setConfirmRejectId] = React.useState<string | null>(null);
  const [activeMediaSignedUrl, setActiveMediaSignedUrl] = React.useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Trigger signed preview fetch when an item is selected
  const handleSelectSubmission = (item: AdminSubmissionItem) => {
    setSelectedSubmission(item);
    if (item.mediaAsset?.storagePath) {
      setLoadingMedia(true);
      setActiveMediaSignedUrl(null);
      getAdminMediaSignedUrl(item.mediaAsset.storagePath).then((res) => {
        if (res.signedUrl) {
          setActiveMediaSignedUrl(res.signedUrl);
        }
        setLoadingMedia(false);
      });
    } else {
      setActiveMediaSignedUrl(null);
      setLoadingMedia(false);
    }
  };

  const handleCloseDetailModal = () => {
    setSelectedSubmission(null);
    setActiveMediaSignedUrl(null);
    setLoadingMedia(false);
  };

  // Filter logic
  const filteredSubmissions = submissions.filter((item) => {
    const matchesFilter =
      statusFilter === "all" ? true : item.status === statusFilter;
    const matchesQuery =
      item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.recipient && item.recipient.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const handleModerate = async (
    id: string,
    newStatus: SubmissionStatus,
    reason?: string
  ) => {
    setIsSubmitting(true);
    const result = await moderateSubmission(id, newStatus, reason);

    if (result && "error" in result && result.error) {
      alert(result.error);
      setIsSubmitting(false);
      return;
    }

    setSubmissions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newStatus, moderationNotes: reason || item.moderationNotes } : item
      )
    );

    if (selectedSubmission?.id === id) {
      setSelectedSubmission((prev) =>
        prev ? { ...prev, status: newStatus, moderationNotes: reason || prev.moderationNotes } : null
      );
    }

    setIsSubmitting(false);
    setConfirmRejectId(null);
    setModerationReason("");
  };

  const handleBulkModerate = async (newStatus: SubmissionStatus) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setIsSubmitting(true);
    const result = await bulkModerateSubmissions(ids, newStatus);
    if (!result.success && result.error) {
      alert(result.error);
      setIsSubmitting(false);
      return;
    }

    setSubmissions((prev) =>
      prev.map((item) =>
        selectedIds.has(item.id) ? { ...item, status: newStatus } : item
      )
    );
    setSelectedIds(new Set());
    setIsSubmitting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSubmissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubmissions.map((s) => s.id)));
    }
  };

  const getStatusBadge = (status: SubmissionStatus) => {
    const styles = {
      queued: "bg-[#EFF6FF] text-[#1D4ED8]",
      pending: "bg-[#FEFCE8] text-[#854D0E]",
      needs_review: "bg-[#FFF7ED] text-[#C2410C]",
      approved: "bg-[#F0FDF4] text-[#166534]",
      rejected: "bg-[#FEF2F2] text-[#991B1B]",
      publishing: "bg-[#F5F3FF] text-[#6D28D9]",
      published: "bg-[#FAFAFA] text-[#171717] border border-[#E5E7EB]",
      failed: "bg-[#FEF2F2] text-[#991B1B]",
    }[status] || "bg-[#FAFAFA] text-[#737373]";

    return (
      <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded capitalize ${styles}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Configuration Status Notice */}
      {!isConfigured && (
        <div className="p-3.5 bg-[#FEFCE8] border border-[#FEF08A] rounded-xl text-xs text-[#854D0E] flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#CA8A04] mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[#713F12]">
              Database Service Unavailable
            </p>
            <p>
              Dedicated BOBFESS Supabase database credentials are not configured in <code>.env.local</code>. No simulated or mock submissions are displayed.
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 pb-3 sm:pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Inbox
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Review incoming submissions and assign them to the publishing queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setIsSubmitting(true);
              await triggerModerationWorker(10);
              setIsSubmitting(false);
              window.location.reload();
            }}
            disabled={isSubmitting}
            className="px-3 py-1.5 bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="Run Gemini Moderation Worker on unreviewed messages"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run AI Moderation</span>
          </button>
          <div className="text-xs text-[#737373]">
            Showing {filteredSubmissions.length} of {submissions.length} messages
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Mobile optimized scroll) */}
      <div className="space-y-2.5">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by text, recipient, or code..."
            className="pl-9 h-11 sm:h-9 text-base sm:text-xs"
          />
        </div>

        {/* Status Filters Pills - Horizontal scroll with 44px tap height */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
          <div className="flex items-center gap-1.5">
            {(["all", "pending", "needs_review", "approved", "queued", "published", "rejected"] as const).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`min-h-[38px] sm:min-h-[32px] px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap cursor-pointer touch-manipulation ${
                    statusFilter === tab
                      ? "bg-[#2563EB] text-[#FFFFFF]"
                      : "bg-[#FAFAFA] text-[#737373] hover:text-[#171717] border border-[#E5E7EB]"
                  }`}
                >
                  {tab.replace("_", " ")}
                </button>
              )
            )}
          </div>

          {filteredSubmissions.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-[#737373] hover:text-[#171717] flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] min-h-[38px] sm:min-h-[32px] cursor-pointer"
            >
              {selectedIds.size > 0 && selectedIds.size === filteredSubmissions.length ? (
                <CheckSquare className="w-4 h-4 text-[#2563EB]" />
              ) : (
                <Square className="w-4 h-4 text-[#737373]" />
              )}
              <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select All"}</span>
            </button>
          )}
        </div>

        {/* Bulk Actions Banner */}
        {selectedIds.size > 0 && (
          <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#1E40AF]">
              {selectedIds.size} message{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleBulkModerate("approved")}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-[#16A34A] text-white rounded-lg text-xs font-medium hover:bg-[#15803D] disabled:opacity-50"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBulkModerate("queued")}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-medium hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                Queue All
              </button>
              <button
                onClick={() => handleBulkModerate("rejected")}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-[#DC2626] text-white rounded-lg text-xs font-medium hover:bg-[#B91C1C] disabled:opacity-50"
              >
                Reject All
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 text-xs text-[#737373] hover:text-[#171717]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredSubmissions.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-8 sm:p-12 text-center">
          <Filter className="w-6 h-6 mx-auto text-[#A3A3A3] mb-2" />
          <h3 className="text-sm font-semibold text-[#171717]">
            {!isConfigured ? "Database Connection Required" : "No submissions found"}
          </h3>
          <p className="text-xs text-[#737373] mt-1">
            {!isConfigured
              ? "Live submissions will be displayed here once dedicated Supabase credentials are configured in .env.local."
              : "Try adjusting your search terms or filter selection."}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE LIST VIEW (Under 768px): Card based, no horizontal table scroll, 44px touch targets */}
          <div className="block md:hidden space-y-3">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className={`bg-[#FFFFFF] border rounded-xl p-4 space-y-3 transition-colors ${
                  selectedIds.has(sub.id) ? "border-[#2563EB] ring-1 ring-[#2563EB]" : "border-[#E5E7EB]"
                }`}
              >
                {/* Card Top: Code + Status + Date */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSelect(sub.id)}
                      className="p-1 -m-1 text-[#737373] hover:text-[#171717] cursor-pointer"
                    >
                      {selectedIds.has(sub.id) ? (
                        <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#A3A3A3]" />
                      )}
                    </button>
                    <span className="font-mono text-[11px] font-semibold text-[#171717]">
                      {sub.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(sub.status)}
                    <span className="text-[11px] text-[#737373]">
                      {formatDateTime(sub.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Recipient */}
                {sub.recipient && (
                  <div className="text-xs font-semibold text-[#171717]">
                    To: <span className="font-normal text-[#737373]">{sub.recipient}</span>
                  </div>
                )}

                {/* Message Body */}
                <p className="text-sm text-[#171717] leading-relaxed line-clamp-3">
                  &ldquo;{sub.message}&rdquo;
                </p>

                {sub.moderationNotes && (
                  <div className="p-2 bg-[#FEFCE8] border border-[#FEF08A] rounded text-[11px] text-[#854D0E]">
                    Note: {sub.moderationNotes}
                  </div>
                )}

                {/* Mobile Moderation Action Bar (Minimal taps, 44×44px touch targets) */}
                <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-1">
                  <button
                    onClick={() => handleSelectSubmission(sub)}
                    className="min-h-[44px] px-3 inline-flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#171717] rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleModerate(sub.id, "approved")}
                      disabled={sub.status === "approved" || isSubmitting}
                      className="w-11 h-11 inline-flex items-center justify-center text-[#16A34A] bg-[#F0FDF4] hover:bg-[#DCFCE7] rounded-lg disabled:opacity-30 cursor-pointer touch-manipulation"
                      title="Approve"
                      aria-label="Approve submission"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleModerate(sub.id, "needs_review")}
                      disabled={sub.status === "needs_review" || isSubmitting}
                      className="w-11 h-11 inline-flex items-center justify-center text-[#EA580C] bg-[#FFF7ED] hover:bg-[#FFEDD5] rounded-lg disabled:opacity-30 cursor-pointer touch-manipulation"
                      title="Mark Needs Review"
                      aria-label="Mark needs review"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleModerate(sub.id, "queued")}
                      disabled={sub.status === "queued" || isSubmitting}
                      className="w-11 h-11 inline-flex items-center justify-center text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-lg disabled:opacity-30 cursor-pointer touch-manipulation"
                      title="Queue for publishing"
                      aria-label="Queue for publishing"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmRejectId(sub.id)}
                      disabled={sub.status === "rejected" || isSubmitting}
                      className="w-11 h-11 inline-flex items-center justify-center text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-lg disabled:opacity-30 cursor-pointer touch-manipulation"
                      title="Reject"
                      aria-label="Reject submission"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE VIEW (768px and up) */}
          <div className="hidden md:block bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-[#737373] font-medium">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        onClick={toggleSelectAll}
                        className="cursor-pointer text-[#737373] hover:text-[#171717]"
                      >
                        {selectedIds.size > 0 && selectedIds.size === filteredSubmissions.length ? (
                          <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#A3A3A3]" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-4 w-28">Ref Code</th>
                    <th className="py-2.5 px-4 w-32">Status</th>
                    <th className="py-2.5 px-4 w-40">To</th>
                    <th className="py-2.5 px-4">Message</th>
                    <th className="py-2.5 px-4 w-32">Date</th>
                    <th className="py-2.5 px-4 w-44 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className={`hover:bg-[#FAFAFA] transition-colors ${
                        selectedIds.has(sub.id) ? "bg-[#F8FAFC]" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleSelect(sub.id)}
                          className="cursor-pointer text-[#737373] hover:text-[#171717]"
                        >
                          {selectedIds.has(sub.id) ? (
                            <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#A3A3A3]" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#737373]">
                        {sub.id}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(sub.status)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#171717] truncate max-w-[150px]">
                        {sub.recipient || <span className="text-[#A3A3A3] font-normal">—</span>}
                      </td>
                      <td className="py-3 px-4 text-[#171717] line-clamp-2 max-w-md">
                        {sub.message}
                      </td>
                      <td className="py-3 px-4 text-[#737373] whitespace-nowrap">
                        {formatDateTime(sub.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleSelectSubmission(sub)}
                            className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#E5E7EB] rounded cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleModerate(sub.id, "approved")}
                            disabled={sub.status === "approved" || isSubmitting}
                            className="p-1.5 text-[#16A34A] hover:bg-[#F0FDF4] rounded disabled:opacity-30 cursor-pointer"
                            title="Approve"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleModerate(sub.id, "needs_review")}
                            disabled={sub.status === "needs_review" || isSubmitting}
                            className="p-1.5 text-[#EA580C] hover:bg-[#FFF7ED] rounded disabled:opacity-30 cursor-pointer"
                            title="Mark Needs Review"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleModerate(sub.id, "queued")}
                            disabled={sub.status === "queued" || isSubmitting}
                            className="p-1.5 text-[#2563EB] hover:bg-[#EFF6FF] rounded disabled:opacity-30 cursor-pointer"
                            title="Queue for publishing"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmRejectId(sub.id)}
                            disabled={sub.status === "rejected" || isSubmitting}
                            className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded disabled:opacity-30 cursor-pointer"
                            title="Reject"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal for Reject */}
      {confirmRejectId && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmRejectId(null)}
          title="Confirm Rejection"
          description="Are you sure you want to reject this submission? This action excludes it from publishing."
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[#171717] font-medium mb-1">
                Reason for Rejection <span className="text-[#A3A3A3]">(Optional)</span>
              </label>
              <Input
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="e.g. Contains private contact info or off-topic content"
                className="h-11 sm:h-9 text-base sm:text-xs"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                size="md"
                onClick={() => setConfirmRejectId(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="md"
                isLoading={isSubmitting}
                onClick={() => handleModerate(confirmRejectId, "rejected", moderationReason)}
                className="w-full sm:w-auto"
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <Modal
          isOpen={true}
          onClose={handleCloseDetailModal}
          title={`Submission ${selectedSubmission.id}`}
          description={`Created at ${formatDateTime(selectedSubmission.createdAt)}`}
        >
          <div className="space-y-4 text-xs">
            {selectedSubmission.recipient && (
              <div>
                <span className="text-[#737373] block mb-0.5">Recipient:</span>
                <p className="font-semibold text-[#171717] text-sm">
                  {selectedSubmission.recipient}
                </p>
              </div>
            )}

            <div>
              <span className="text-[#737373] block mb-0.5">Message:</span>
              <p className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-sm text-[#171717] whitespace-pre-wrap leading-relaxed">
                {selectedSubmission.message}
              </p>
            </div>

            {/* Media Attachment Preview */}
            {selectedSubmission.mediaAsset && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[#737373] block">Attached Media:</span>
                <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
                  {loadingMedia && (
                    <p className="text-xs text-[#737373]">Loading secure preview...</p>
                  )}
                  {activeMediaSignedUrl && selectedSubmission.mediaAsset.mimeType.startsWith("image/") && (
                    <div className="rounded overflow-hidden max-h-72 flex items-center justify-center bg-black/5">
                      <img
                        src={activeMediaSignedUrl}
                        alt="Submitted media preview"
                        className="max-h-72 object-contain"
                      />
                    </div>
                  )}
                  {activeMediaSignedUrl && selectedSubmission.mediaAsset.mimeType.startsWith("video/") && (
                    <video
                      src={activeMediaSignedUrl}
                      controls
                      className="w-full max-h-72 rounded bg-black"
                    />
                  )}
                  {!loadingMedia && !activeMediaSignedUrl && (
                    <p className="text-xs text-[#991B1B]">Media is deleted or preview unavailable.</p>
                  )}
                  <p className="text-[10px] text-[#737373] mt-2">
                    {selectedSubmission.mediaAsset.mimeType} • {(selectedSubmission.mediaAsset.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            )}

            {selectedSubmission.moderationNotes && (
              <div className="p-3 bg-[#FEFCE8] border border-[#FEF08A] rounded-lg text-[#854D0E] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Moderator Note:</span>
                  <span>{selectedSubmission.moderationNotes}</span>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[#737373]">
                Status: {getStatusBadge(selectedSubmission.status)}
              </span>

              <div className="grid grid-cols-2 sm:flex gap-2">
                <Button
                  size="md"
                  variant="outline"
                  onClick={async () => {
                    if (selectedSubmission.rawId) {
                      setIsSubmitting(true);
                      await retrySubmissionModeration(selectedSubmission.rawId);
                      setIsSubmitting(false);
                      window.location.reload();
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto text-xs inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-evaluate AI</span>
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => setConfirmRejectId(selectedSubmission.id)}
                  className="w-full sm:w-auto text-xs"
                >
                  Reject
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => handleModerate(selectedSubmission.id, "approved")}
                  className="w-full sm:w-auto text-xs"
                >
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
