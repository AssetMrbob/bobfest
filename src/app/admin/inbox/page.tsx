"use client";

import * as React from "react";
import { MOCK_SUBMISSIONS } from "@/lib/mock-data";
import { Submission, SubmissionStatus } from "@/lib/types/submission";
import { formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Search, Filter, Check, X, Clock, AlertTriangle, Eye } from "lucide-react";

export default function AdminInboxPage() {
  const [submissions, setSubmissions] = React.useState<Submission[]>(MOCK_SUBMISSIONS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = React.useState<Submission | null>(null);

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

  const updateStatus = (id: string, newStatus: SubmissionStatus) => {
    setSubmissions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    if (selectedSubmission?.id === id) {
      setSelectedSubmission((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  return (
    <div className="space-y-6">
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
            placeholder="Search by message text, recipient, or ID..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "pending", "queued", "approved", "rejected", "published"] as const).map(
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
                {tab}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table Container */}
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
                  <th className="py-2.5 px-4 w-24">ID</th>
                  <th className="py-2.5 px-4 w-32">Status</th>
                  <th className="py-2.5 px-4 w-40">To</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4 w-32">Date</th>
                  <th className="py-2.5 px-4 w-36 text-right">Actions</th>
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
                            : sub.status === "approved"
                            ? "bg-[#F0FDF4] text-[#166534]"
                            : sub.status === "rejected"
                            ? "bg-[#FEF2F2] text-[#991B1B]"
                            : "bg-[#FAFAFA] text-[#737373]"
                        }`}
                      >
                        {sub.status}
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
                          className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#E5E7EB] rounded"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateStatus(sub.id, "queued")}
                          disabled={sub.status === "queued"}
                          className="p-1.5 text-[#2563EB] hover:bg-[#EFF6FF] rounded disabled:opacity-30"
                          title="Queue for publishing"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateStatus(sub.id, "approved")}
                          disabled={sub.status === "approved"}
                          className="p-1.5 text-[#16A34A] hover:bg-[#F0FDF4] rounded disabled:opacity-30"
                          title="Approve"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateStatus(sub.id, "rejected")}
                          disabled={sub.status === "rejected"}
                          className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded disabled:opacity-30"
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
                Status: <strong className="text-[#171717] capitalize">{selectedSubmission.status}</strong>
              </span>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(selectedSubmission.id, "rejected")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => updateStatus(selectedSubmission.id, "queued")}
                >
                  Queue for Publication
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
