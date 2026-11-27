import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-[#FAFAFA] text-[#171717] border border-[#E5E7EB]",
    secondary: "bg-[#F4F4F5] text-[#737373]",
    outline: "bg-transparent text-[#737373] border border-[#E5E7EB]",
    success: "bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7]",
    warning: "bg-[#FEFCE8] text-[#854D0E] border border-[#FEF08A]",
    destructive: "bg-[#FEF2F2] text-[#991B1B] border border-[#FEE2E2]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md tracking-tight",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
