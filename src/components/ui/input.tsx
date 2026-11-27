import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full h-10 px-3 py-2 text-sm bg-[#FFFFFF] text-[#171717] placeholder:text-[#A3A3A3] border border-[#E5E7EB] rounded-[10px] transition-colors focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none disabled:bg-[#FAFAFA] disabled:text-[#737373] disabled:cursor-not-allowed",
          error && "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
