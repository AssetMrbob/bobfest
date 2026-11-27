"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Mobile-First Accessible Modal / Bottom Sheet
 * Adapts to mobile viewports (320px–430px) with safe-area padding and 44px touch targets.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#000000] opacity-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          "relative z-10 w-full max-w-lg bg-[#FFFFFF] border-t sm:border border-[#E5E7EB] rounded-t-2xl sm:rounded-xl p-5 sm:p-6 shadow-none max-h-[90dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-[#E5E7EB]">
          <div className="pr-2">
            <h2 className="text-base font-semibold text-[#171717] tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-[#737373] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {/* Minimum 44×44px touch target for close button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-[#737373] hover:text-[#171717] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
