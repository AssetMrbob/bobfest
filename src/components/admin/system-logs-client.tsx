"use client";

import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import { FileText } from "lucide-react";
import { Json } from "@/lib/supabase/types";

interface SystemLogEntry {
  id: string;
  event_type: string;
  severity: string;
  metadata: Json;
  created_at: string;
}

interface SystemLogsClientProps {
  initialLogs: SystemLogEntry[];
}

export function SystemLogsClient({ initialLogs }: SystemLogsClientProps) {
  const [logs] = React.useState<SystemLogEntry[]>(initialLogs);
  const [filter, setFilter] = React.useState<string>("all");

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    return l.event_type?.toLowerCase().includes(filter.toLowerCase()) || l.severity === filter;
  });

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div>
          <h2 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            <span>Audit Trail & System Logs</span>
          </h2>
          <p className="text-xs text-[#737373]">
            Sanitized administrative and security events (zero secrets or IP addresses stored).
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "info", "warning", "error"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium capitalize transition-colors ${
                filter === sev ? "bg-[#2563EB] text-white" : "bg-[#FAFAFA] text-[#737373] border border-[#E5E7EB]"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[#737373] text-center py-6">
          No system events recorded.
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[#171717] uppercase">
                  {log.event_type}
                </span>
                <span className="text-[10px] text-[#737373]">
                  {formatDateTime(log.created_at)}
                </span>
              </div>
              <div className="text-[#737373] font-mono text-[11px] break-all">
                {typeof log.metadata === "object" && log.metadata !== null
                  ? JSON.stringify(log.metadata)
                  : String(log.metadata || "{}")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
