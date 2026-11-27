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
        description="Guidelines to keep our anonymous space respectful and constructive."
      >
        <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">1. Respect Privacy (No Doxxing)</h3>
            <p className="text-[#737373]">
              Never submit full real names, phone numbers, personal social media handles, private addresses, or sensitive identifying information.
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
              Submissions undergo human and automated safety moderation before selection into batch carousels. Publication is never guaranteed.
            </p>
          </div>
          <div className="pt-2 border-t border-[#E5E7EB] text-[#737373]">
            Curated daily at 12:00 & 19:00 WIB into maximum 5-message carousels.
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
      description="How your anonymity is protected on menfess."
    >
      <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Public Anonymity</h3>
          <p className="text-[#737373]">
            No user accounts, emails, or personal identities are required to submit a menfess. What appears on Instagram includes only your message, optional recipient, and attachment if approved.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Data Storage</h3>
          <p className="text-[#737373]">
            Approved messages are selected into batched carousels. Archived media is subjected to automated FIFO cleanup to protect storage limits and user privacy.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Phase 01 Development Notice</h3>
          <p className="text-[#737373]">
            Currently operating in Phase 01 Mock Mode. Submissions are processed in client-side state for testing and demonstration purposes without persistent database writes.
          </p>
        </div>
      </div>
    </Modal>
  );
}
