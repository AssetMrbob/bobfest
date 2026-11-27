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
        description="Editorial, safety, and publishing rules for Kampung Inggris Fess."
      >
        <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">1. Community Scope</h3>
            <p className="text-[#737373]">
              Kampung Inggris Fess is an open anonymous community platform for all students, alumni, visitors, teachers, and locals across all Kampung Inggris courses and institutions. Content includes confessions, crushes, daily life, recommendations, learning experiences, discussions, and constructive feedback.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">2. Constructive Feedback Welcome</h3>
            <p className="text-[#737373]">
              Constructive criticism and honest feedback regarding courses, camps, facilities, or institutions (including Mr.BOB and others) are welcome and not rejected solely for being critical, provided they remain civil and factual.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">3. Respect Privacy (Strictly No Doxxing)</h3>
            <p className="text-[#737373]">
              Never submit full names, telephone numbers, personal email addresses, private social media handles, WhatsApp numbers, room numbers, or precise addresses. Automated filters and human moderation will reject doxxing immediately.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">4. Zero Tolerance for Harassment & Defamation</h3>
            <p className="text-[#737373]">
              Hate speech, sexual harassment, targeted bullying, threats, and unverified personal allegations are strictly prohibited.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#171717] mb-1">5. Multi-Platform Publishing</h3>
            <p className="text-[#737373]">
              Approved submissions may be published publicly to Instagram (@kampunginggrisfess) and Threads (@kampunginggrisfess). Curated daily at 12:00 & 19:00 WIB.
            </p>
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
      description="How your data is handled on Kampung Inggris Fess."
    >
      <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Anonymity & Public Platforms</h3>
          <p className="text-[#737373]">
            No user registration, account, email, or identity is required to submit a menfess. Sender identities are anonymous to the public. Approved messages are published to our official Instagram and Threads channels. Note that while we protect your privacy, no online service is completely untraceable.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Data Storage & Protection</h3>
          <p className="text-[#737373]">
            Submissions are stored securely with a unique tracking code. Raw IP addresses are never permanently logged; hashed identifiers are used solely for rate limiting and spam protection. Uploaded attachments are scanned and stored in private buckets.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#171717] mb-1">Takedown & Removal Requests</h3>
          <p className="text-[#737373]">
            If you need a submitted or published message reviewed, edited, or removed, contact our administrative team via Instagram DM (@kampunginggrisfess) quoting your unique reference code.
          </p>
        </div>
        <div className="pt-2 border-t border-[#E5E7EB] text-[#737373]">
          Platform managed and maintained by Mr.BOB Kampung Inggris as a community service.
        </div>
      </div>
    </Modal>
  );
}
