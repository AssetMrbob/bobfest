import * as React from "react";
import { cn } from "@/lib/utils";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  status?: "default" | "warning" | "success";
  className?: string;
}

export function AdminStatCard({
  label,
  value,
  subValue,
  status = "default",
  className,
}: AdminStatCardProps) {
  const statusColor = {
    default: "text-[#171717]",
    warning: "text-[#854D0E]",
    success: "text-[#166534]",
  }[status];

  return (
    <div
      className={cn(
        "p-3 sm:p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl flex flex-col justify-between",
        className
      )}
    >
      <span className="text-[11px] sm:text-xs font-medium text-[#737373] tracking-tight leading-tight">
        {label}
      </span>
      <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between">
        <span className={cn("text-xl sm:text-2xl font-semibold tracking-tight tabular-nums", statusColor)}>
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] sm:text-[11px] text-[#737373] tabular-nums">
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}
