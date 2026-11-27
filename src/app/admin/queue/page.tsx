"use client";

import * as React from "react";
import { MOCK_QUEUE_SLOTS } from "@/lib/mock-data";
import { QueueSlot } from "@/lib/types/admin";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function AdminQueuePage() {
  const [slots, setSlots] = React.useState<QueueSlot[]>(MOCK_QUEUE_SLOTS);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const simulatePublish = (slotId: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: "published" } : s))
      );
      setIsProcessing(false);
    }, 800);
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
            Automated batching for Instagram Feed Carousels and companion Stories.
          </p>
        </div>
        <div className="text-xs text-[#737373]">
          Maximum 2 Feed batches daily · Max 5 slides per carousel
        </div>
      </div>

      {/* Queue Slots */}
      <div className="space-y-6">
        {slots.map((slot) => {
          const filledCount = slot.submissions.length;
          const maxCount = 5;

          return (
            <div
              key={slot.id}
              className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden"
            >
              {/* Slot Header */}
              <div className="p-4 bg-[#FAFAFA] border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[#171717]">
                      {slot.timeSlot} — {slot.scheduledDate}
                    </h2>
                    <span className="text-xs text-[#737373]">
                      {slot.carouselTitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded text-[#171717]">
                    {filledCount}/{maxCount} Slides
                  </span>

                  <Button
                    size="sm"
                    variant={slot.status === "published" ? "secondary" : "primary"}
                    disabled={filledCount === 0 || slot.status === "published" || isProcessing}
                    onClick={() => simulatePublish(slot.id)}
                    className="text-xs"
                  >
                    {slot.status === "published" ? "Published" : "Trigger Batch (Mock)"}
                  </Button>
                </div>
              </div>

              {/* Submissions in this Batch */}
              {filledCount === 0 ? (
                <div className="p-8 text-center text-xs text-[#737373]">
                  No messages queued for this slot yet. Approve items in Inbox to fill this batch.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {slot.submissions.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="p-4 flex items-start justify-between gap-4 hover:bg-[#FAFAFA] transition-colors text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-md bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center font-mono text-xs text-[#737373] shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          {sub.recipient && (
                            <span className="font-semibold text-[#171717] block mb-0.5">
                              To: {sub.recipient}
                            </span>
                          )}
                          <p className="text-[#171717] line-clamp-2 leading-relaxed">
                            {sub.message}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#A3A3A3] shrink-0">
                        {sub.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Automation Rules Summary */}
              <div className="p-3 bg-[#FFFFFF] border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#737373]">
                <span className="flex items-center gap-1.5">
                  <InstagramIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  Companion Story will be published automatically upon Feed publish.
                </span>
                <span>Asia/Jakarta Time</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
