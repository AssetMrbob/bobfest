"use client";

import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import { SubmissionStatus } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Search, Filter, Check, X, Clock, AlertTriangle, Eye, HelpCircle } from "lucide-react";
import { moderateSubmission } from "@/app/admin/actions";

interface AdminSubmissionItem {
  id: string;
  rawId?: string;
  recipient?: string;
  message: string;
  status: SubmissionStatus;
  createdAt: string;
  moderationNotes?: string;
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

  return (
    <div className="space-y-6">
      {/* Configuration Status Notice */}
      {!isConfigured && (
        <div className="p-3 bg-[#FEFCE8] border border-[#FEF08A] rounded-xl text-xs text-[#854D0E] flex items-center justify-between">
          <span>Operating in local fallback mode. Populate Supabase credentials in <code>.env.local</code> to persist changes to PostgreSQL.</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Inbox
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Review incoming submissions and assign them to the publishing queue.
          </p>
        </div>
        <div className="text-xs text-[#737373]">
          Showing {filteredSubmissions.length} of {submissions.length} messages
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by message text, recipient, or reference ID..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "pending", "needs_review", "approved", "queued", "published", "rejected"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap cursor-pointer ${
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
      </div>

      {/* Submissions Table */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center">
            <Filter className="w-6 h-6 mx-auto text-[#A3A3A3] mb-2" />
            <h3 className="text-sm font-semibold text-[#171717]">No submissions found</h3>
            <p className="text-xs text-[#737373] mt-1">
              Try adjusting your search terms or filter selection.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-[#737373] font-medium">
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
                  <tr key={sub.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-[#737373]">
                      {sub.id}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded capitalize ${
                          sub.status === "queued"
                            ? "bg-[#EFF6FF] text-[#1D4ED8]"
                            : sub.status === "pending"
                            ? "bg-[#FEFCE8] text-[#854D0E]"
                            : sub.status === "needs_review"
                            ? "bg-[#FFF7ED] text-[#C2410C]"
                            : sub.status === "approved"
                            ? "bg-[#F0FDF4] text-[#166534]"
                            : sub.status === "rejected"
                            ? "bg-[#FEF2F2] text-[#991B1B]"
                            : "bg-[#FAFAFA] text-[#737373]"
                        }`}
                      >
                        {sub.status.replace("_", " ")}
                      </span>
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
                          onClick={() => setSelectedSubmission(sub)}
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
        )}
      </div>

      {/* Confirmation Modal for Reject */}
      {confirmRejectId && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmRejectId(null)}
          title="Confirm Rejection"
          description="Are you sure you want to reject this submission? This action will exclude it from publishing."
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
                className="h-8 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRejectId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                isLoading={isSubmitting}
                onClick={() => handleModerate(confirmRejectId, "rejected", moderationReason)}
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
          onClose={() => setSelectedSubmission(null)}
          title={`Submission ${selectedSubmission.id}`}
          description={`Created at ${formatDateTime(selectedSubmission.createdAt)}`}
        >
          <div className="space-y-4 text-xs">
            {selectedSubmission.recipient && (
              <div>
                <span className="text-[#737373] block mb-0.5">Recipient:</span>
                <p className="font-semibold text-[#171717]">
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

            {selectedSubmission.moderationNotes && (
              <div className="p-3 bg-[#FEFCE8] border border-[#FEF08A] rounded-lg text-[#854D0E] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Moderator Note:</span>
                  <span>{selectedSubmission.moderationNotes}</span>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
              <span className="text-[#737373]">
                Status: <strong className="text-[#171717] capitalize">{selectedSubmission.status.replace("_", " ")}</strong>
              </span>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmRejectId(selectedSubmission.id)}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleModerate(selectedSubmission.id, "approved")}
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
