"use client";

import * as React from "react";
import { APP_CONFIG } from "@/lib/constants";
import { GuidelinesModal } from "./guidelines-modal";

export function Footer() {
  const [modalState, setModalState] = React.useState<"guidelines" | "privacy" | null>(null);

  return (
    <footer className="w-full pt-8 pb-[max(2rem,env(safe-area-inset-bottom,1.5rem))] mt-auto border-t border-[#E5E7EB] bg-[#FFFFFF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737373]">
        <p className="text-center sm:text-left text-xs">
          Anonymous community platform · Managed by Mr.BOB Kampung Inggris
        </p>

        {/* Touch-friendly 44px hit areas for mobile users */}
        <div className="flex items-center gap-1 sm:gap-4 flex-wrap justify-center">
          <button
            onClick={() => setModalState("guidelines")}
            className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#737373] hover:text-[#171717] transition-colors underline-offset-4 hover:underline cursor-pointer"
          >
            Guidelines
          </button>
          <span className="text-[#D1D5DB]">·</span>
          <button
            onClick={() => setModalState("privacy")}
            className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#737373] hover:text-[#171717] transition-colors underline-offset-4 hover:underline cursor-pointer"
          >
            Privacy
          </button>
          <span className="text-[#D1D5DB]">·</span>
          <a
            href={APP_CONFIG.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#737373] hover:text-[#171717] transition-colors underline-offset-4 hover:underline cursor-pointer"
          >
            Instagram
          </a>
          <span className="text-[#D1D5DB]">·</span>
          <a
            href={APP_CONFIG.threadsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#737373] hover:text-[#171717] transition-colors underline-offset-4 hover:underline cursor-pointer"
          >
            Threads
          </a>
        </div>
      </div>

      <GuidelinesModal
        isOpen={modalState !== null}
        onClose={() => setModalState(null)}
        type={modalState || "guidelines"}
      />
    </footer>
  );
}
