"use client";

import Link from "next/link";
import {
  MOCK_DASHBOARD_METRICS,
  MOCK_SUBMISSIONS,
} from "@/lib/mock-data";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { formatBytes } from "@/lib/utils";
import { Clock, ArrowRight, Database, HardDrive } from "lucide-react";

export default function AdminOverviewPage() {
  const metrics = MOCK_DASHBOARD_METRICS;
  const recentSubmissions = MOCK_SUBMISSIONS.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Overview
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Operational dashboard and queue management status.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs text-[#171717]">
          <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Next Publication: <strong className="font-semibold">{metrics.nextScheduledSlot.time}</strong> ({metrics.nextScheduledSlot.countdownMinutes}m remaining)</span>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <AdminStatCard
          label="Total Submissions"
          value={metrics.totalSubmissions.toLocaleString()}
          subValue="+24 today"
        />
        <AdminStatCard
          label="Queued Messages"
          value={metrics.queuedMessages}
          subValue="Ready for 19:00 WIB"
          status="default"
        />
        <AdminStatCard
          label="Published Today"
          value={metrics.publishedToday}
          subValue="2 feed batches"
          status="success"
        />
        <AdminStatCard
          label="Needing Review"
          value={metrics.messagesNeedingReview}
          subValue="Pending manual check"
          status={metrics.messagesNeedingReview > 0 ? "warning" : "default"}
        />
      </div>

      {/* 2-Column Split: Storage & Schedule / Activity & Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Submission Activity & Recent Queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submission Activity Table */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#171717] tracking-tight">
                  Recent Submissions
                </h2>
                <p className="text-xs text-[#737373]">Live stream of incoming menfess items.</p>
              </div>
              <Link
                href="/admin/inbox"
                className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1"
              >
                <span>View Inbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {recentSubmissions.map((sub) => (
                <div key={sub.id} className="p-4 hover:bg-[#FAFAFA] transition-colors">
                  <div className="flex items-center justify-between text-xs text-[#737373] mb-1.5">
                    <span className="font-mono text-[11px] text-[#A3A3A3]">{sub.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                      sub.status === "queued"
                        ? "bg-[#EFF6FF] text-[#1D4ED8]"
                        : sub.status === "pending"
                        ? "bg-[#FEFCE8] text-[#854D0E]"
                        : sub.status === "approved"
                        ? "bg-[#F0FDF4] text-[#166534]"
                        : "bg-[#FAFAFA] text-[#737373]"
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  {sub.recipient && (
                    <div className="text-xs font-medium text-[#171717] mb-1">
                      To: {sub.recipient}
                    </div>
                  )}
                  <p className="text-xs text-[#737373] line-clamp-2 leading-relaxed">
                    &ldquo;{sub.message}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Publishing Schedule Status */}
          <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl">
            <h2 className="text-sm font-semibold text-[#171717] tracking-tight mb-2">
              Daily Publishing Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#737373]">
              <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
                <span className="font-medium text-[#171717] block mb-1">Slot 1 · Midday</span>
                <span>12:00 Asia/Jakarta · Max 5 slides per carousel + Companion Story</span>
              </div>
              <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
                <span className="font-medium text-[#171717] block mb-1">Slot 2 · Evening</span>
                <span>19:00 Asia/Jakarta · Max 5 slides per carousel + Companion Story</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Storage & Integration Status */}
        <div className="space-y-6">
          {/* Storage Capacity Monitor */}
          <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717] tracking-tight flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#2563EB]" />
                Storage Quota
              </span>
              <span className="text-xs font-mono font-medium text-[#171717]">
                {metrics.storage.percentUsed}%
              </span>
            </div>

            {/* Custom Minimal Progress Bar */}
            <div className="w-full h-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB]"
                style={{ width: `${metrics.storage.percentUsed}%` }}
              />
            </div>

            <div className="text-[11px] text-[#737373] space-y-1">
              <div className="flex justify-between">
                <span>Used:</span>
                <span className="font-mono text-[#171717]">
                  {formatBytes(metrics.storage.usedBytes)} / {formatBytes(metrics.storage.totalBytes)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>FIFO Target:</span>
                <span className="font-mono">{metrics.storage.targetFifoPercent}% threshold</span>
              </div>
              <div className="flex justify-between">
                <span>Emergency Cutoff:</span>
                <span className="font-mono text-[#EF4444]">{metrics.storage.thresholdPercent}%</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E5E7EB] text-[11px] text-[#737373]">
              Automatic FIFO deletes archived media if storage reaches 95%, cleaning down to 85%.
            </div>
          </div>

          {/* Integration Status (Prepared Phase 02) */}
          <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717] tracking-tight flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#2563EB]" />
                Integration Status
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded text-[#737373]">
                Phase 01
              </span>
            </div>

            <div className="divide-y divide-[#E5E7EB] text-xs">
              {Object.entries(metrics.integrations).map(([key, item]) => (
                <div key={key} className="py-2 flex items-center justify-between">
                  <span className="text-[#171717]">{item.name}</span>
                  <span className="text-[11px] text-[#737373] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" />
                    {item.statusText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
