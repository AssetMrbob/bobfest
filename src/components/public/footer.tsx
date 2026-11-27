"use client";

import * as React from "react";
import { APP_CONFIG } from "@/lib/constants";
import { GuidelinesModal } from "./guidelines-modal";

export function Footer() {
  const [modalState, setModalState] = React.useState<"guidelines" | "privacy" | null>(null);

  return (
    <footer className="w-full py-8 mt-auto border-t border-[#E5E7EB] bg-[#FFFFFF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737373]">
        <p className="text-center sm:text-left">
          Anonymous to the public.
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setModalState("guidelines")}
            className="hover:text-[#171717] transition-colors underline-offset-4 hover:underline"
          >
            Guidelines
          </button>
          <span>·</span>
          <button
            onClick={() => setModalState("privacy")}
            className="hover:text-[#171717] transition-colors underline-offset-4 hover:underline"
          >
            Privacy
          </button>
          <span>·</span>
          <a
            href={APP_CONFIG.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#171717] transition-colors underline-offset-4 hover:underline"
          >
            Instagram
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
