import Link from "next/link";
import { getDashboardMetrics } from "@/app/admin/actions";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ArrowRight, Database, AlertCircle } from "lucide-react";

export default async function AdminOverviewPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div className="space-y-6">
      {/* Credential Status Banner if not connected to live Supabase */}
      {!metrics.isConfigured && (
        <div className="p-3.5 bg-[#FEFCE8] border border-[#FEF08A] rounded-xl text-xs text-[#854D0E] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#CA8A04] mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[#713F12]">
              Supabase Project Connection Pending
            </p>
            <p>
              Live database credentials (<code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>) are not yet populated in <code>.env.local</code>. Database operations are currently operating in prepared fallback mode.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Overview
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Operational dashboard and database submission counts.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs text-[#171717]">
          <span>Database: <strong className="font-semibold">{metrics.isConfigured ? "Connected (Live)" : "Local Fallback"}</strong></span>
        </div>
      </div>

      {/* Primary KPI Metrics from Database */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <AdminStatCard
          label="Total Submissions"
          value={metrics.totalSubmissions.toLocaleString()}
        />
        <AdminStatCard
          label="Pending Review"
          value={metrics.messagesNeedingReview}
          status={metrics.messagesNeedingReview > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Approved"
          value={metrics.approvedCount || 0}
          status="success"
        />
        <AdminStatCard
          label="In Queue"
          value={metrics.queuedMessages}
        />
        <AdminStatCard
          label="Published"
          value={metrics.publishedToday}
        />
        <AdminStatCard
          label="Rejected"
          value={metrics.rejectedCount || 0}
        />
      </div>

      {/* 2-Column Split: Database Quick Actions & Integration Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Submission Management Quick Links & Guidelines */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-sm font-semibold text-[#171717] tracking-tight">
                  Submission Moderation Queue
                </h2>
                <p className="text-xs text-[#737373]">
                  Process incoming anonymous menfess entries.
                </p>
              </div>
              <Link
                href="/admin/inbox"
                className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1"
              >
                <span>Open Inbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
                <span className="font-semibold text-[#171717] block mb-1">
                  1. Content Moderation
                </span>
                <span className="text-[#737373] leading-relaxed">
                  Review submissions to ensure no phone numbers, full names, or abusive content are present.
                </span>
              </div>
              <div className="p-3.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
                <span className="font-semibold text-[#171717] block mb-1">
                  2. Batch Assignment
                </span>
                <span className="text-[#737373] leading-relaxed">
                  Move approved submissions to <code>queued</code> status to prepare for the 12:00 or 19:00 WIB daily publication.
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl">
            <h2 className="text-sm font-semibold text-[#171717] tracking-tight mb-2">
              Publication Schedule Rules
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

        {/* Right Column (1 col): Real Integration Status */}
        <div className="space-y-6">
          <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <span className="text-xs font-semibold text-[#171717] tracking-tight flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#2563EB]" />
                Integration Status
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded text-[#737373]">
                Phase 02
              </span>
            </div>

            <div className="divide-y divide-[#E5E7EB] text-xs">
              {Object.entries(metrics.integrations).map(([key, item]) => (
                <div key={key} className="py-2.5 flex items-center justify-between">
                  <span className="text-[#171717] font-medium">{item.name}</span>
                  <span className="text-[11px] text-[#737373] flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.connected ? "bg-[#16A34A]" : "bg-[#D1D5DB]"
                      }`}
                    />
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
