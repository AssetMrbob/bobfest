import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/**
 * Mobile-First Textarea
 * Uses text-base (16px) on mobile to prevent iOS Safari auto-zoom,
 * adapting to sm:text-sm on larger screens.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full px-3.5 py-3 text-base sm:text-sm bg-[#FFFFFF] text-[#171717] placeholder:text-[#A3A3A3] border border-[#E5E7EB] rounded-[10px] transition-colors resize-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none disabled:bg-[#FAFAFA] disabled:text-[#737373] disabled:cursor-not-allowed",
          error && "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
