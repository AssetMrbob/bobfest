"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";

interface GuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "guidelines" | "privacy";
}

export function GuidelinesModal({
  isOpen,
  onClose,
  type,
}: GuidelinesModalProps) {
  if (type === "guidelines") {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Community Guidelines"
        description="Editorial and safety rules governing all menfess submissions."
      >
        <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">1. Respect Privacy (No Doxxing)</h3>
            <p className="text-[#737373]">
              Never submit full names, telephone numbers, personal email addresses, private social handles, or home addresses. Our automated filters immediately reject submissions containing personal contact information.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">2. Zero Tolerance for Harassment</h3>
            <p className="text-[#737373]">
              Hate speech, defamation, sexual harassment, bullying, and threatening language are strictly rejected during moderation.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">3. Moderation Notice</h3>
            <p className="text-[#737373]">
              Every submission is screened by automated filters and human editors before selection into daily batches. Submitting a message does not guarantee it will be published.
            </p>
          </div>
          <div className="pt-2 border-t border-[#E5E7EB] text-[#737373]">
            Curated daily at 12:00 & 19:00 Asia/Jakarta into maximum 5-message carousels.
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Privacy Policy"
      description="How your data is handled and what anonymous means on menfess."
    >
      <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Anonymity & Public Display</h3>
          <p className="text-[#737373]">
            No user account, email, or name is required to submit a menfess. Sender identities are not displayed publicly. However, please note that absolute anonymity cannot be promised across public internet infrastructure.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Data Retention & Moderation</h3>
          <p className="text-[#737373]">
            Submissions are stored in our secure database with a unique reference code. Approved entries are queued for publication on Instagram. Raw IP addresses are never permanently logged; hashed identifiers are used solely for rate limiting.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Removal Requests</h3>
          <p className="text-[#737373]">
            If you need a submitted message reviewed or removed, please contact our administrative team referencing your unique submission code.
          </p>
        </div>
      </div>
    </Modal>
  );
}
