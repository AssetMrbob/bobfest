"use client";

import * as React from "react";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { HardDrive, RefreshCw, Trash2 } from "lucide-react";
import { triggerStorageReconciliation, triggerStorageCleanup } from "@/app/admin/actions";

interface OverviewMetricsData {
  totalSubmissions: number;
  queuedMessages: number;
  publishedToday: number;
  messagesNeedingReview: number;
  approvedCount?: number;
  rejectedCount?: number;
  storageMetrics?: {
    totalBudgetBytes: number;
    reconciledStoredBytes: number;
    activeReservedBytes: number;
    availableBytes: number;
    usedPercentage: number;
    lastReconciledAt: string;
  };
  integrations?: Record<string, { name: string; connected: boolean; statusText: string }>;
}

interface OverviewClientProps {
  initialMetrics: OverviewMetricsData;
}

export function OverviewClient({ initialMetrics }: OverviewClientProps) {
  const [metrics] = React.useState(initialMetrics);
  const [dateRange, setDateRange] = React.useState<"today" | "7d" | "30d" | "all">("all");
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  const storage = metrics.storageMetrics || {
    totalBudgetBytes: 1000000000,
    reconciledStoredBytes: 0,
    activeReservedBytes: 0,
    availableBytes: 950000000,
    usedPercentage: 0,
    lastReconciledAt: new Date().toISOString(),
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    setActionMessage(null);
    const res = await triggerStorageReconciliation();
    setIsReconciling(false);
    if (res && "success" in res && res.success) {
      setActionMessage(`Reconciled: ${(res.storedBytes / (1024 * 1024)).toFixed(2)} MB stored.`);
    } else {
      setActionMessage("Reconciliation failed.");
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Run FIFO cleanup? Oldest eligible rejected or completed media will be safely deleted.")) {
      return;
    }
    setIsCleaning(true);
    setActionMessage(null);
    const res = await triggerStorageCleanup(20971520);
    setIsCleaning(false);
    if (res && "success" in res && res.success) {
      const freedMb = (res.freedBytes / (1024 * 1024)).toFixed(2);
      setActionMessage(`Freed: ${freedMb} MB across ${res.deletedCount} files.`);
    } else {
      setActionMessage("Cleanup completed (no eligible files found).");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Overview
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Operational dashboard and database submission counts (Asia/Jakarta).
          </p>
        </div>

        {/* Date Filter */}
        <div className="inline-flex items-center gap-1 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg p-1 text-xs">
          {(["today", "7d", "30d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range
                  ? "bg-[#2563EB] text-white"
                  : "text-[#737373] hover:text-[#171717]"
              }`}
            >
              {range === "today" ? "Today" : range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Metrics */}
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
          label="Published Today"
          value={metrics.publishedToday}
        />
        <AdminStatCard
          label="Rejected"
          value={metrics.rejectedCount || 0}
        />
      </div>

      {/* Storage & Capacity Management Panel */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#171717]">
              Storage Capacity & Asset Health
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              className="px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E7EB] hover:bg-[#F5F5F5] text-xs font-medium text-[#171717] rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? "animate-spin" : ""}`} />
              <span>Reconcile</span>
            </button>
            <button
              onClick={handleCleanup}
              disabled={isCleaning}
              className="px-3 py-1.5 bg-[#FEF2F2] border border-[#FEE2E2] hover:bg-[#FEE2E2] text-xs font-medium text-[#991B1B] rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>FIFO Cleanup</span>
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-2.5 bg-[#EFF6FF] border border-[#DBEAFE] text-xs text-[#1E40AF] rounded-lg">
            {actionMessage}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
            <span className="text-[#737373] block mb-1">Stored Media</span>
            <strong className="text-sm text-[#171717] font-semibold">
              {(storage.reconciledStoredBytes / (1024 * 1024)).toFixed(2)} MB
            </strong>
          </div>
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
            <span className="text-[#737373] block mb-1">Active Reserved</span>
            <strong className="text-sm text-[#171717] font-semibold">
              {(storage.activeReservedBytes / (1024 * 1024)).toFixed(2)} MB
            </strong>
          </div>
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
            <span className="text-[#737373] block mb-1">Available Capacity</span>
            <strong className="text-sm text-[#171717] font-semibold">
              {(storage.availableBytes / (1024 * 1024)).toFixed(2)} MB
            </strong>
          </div>
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
            <span className="text-[#737373] block mb-1">Capacity Used</span>
            <strong className={`text-sm font-semibold ${storage.usedPercentage > 90 ? "text-[#DC2626]" : "text-[#171717]"}`}>
              {storage.usedPercentage}% of 1 GB
            </strong>
          </div>
        </div>
      </div>

      {/* Integration Status Section */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="pb-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#171717]">
            System Integrations & Service Health
          </h2>
          <p className="text-xs text-[#737373]">
            Verified operational status across platform services.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(metrics.integrations || {}).map(([key, item]) => (
            <div
              key={key}
              className="p-3 border border-[#E5E7EB] rounded-lg bg-[#FAFAFA] flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-medium text-[#171717] block">
                  {item.name}
                </span>
                <span className="text-[11px] text-[#737373]">
                  {item.statusText}
                </span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  item.connected ? "bg-[#16A34A]" : "bg-[#D1D5DB]"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
