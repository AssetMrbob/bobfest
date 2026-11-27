"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Cpu,
  Play,
  RotateCw,
  HardDrive,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldCheck,
  PauseCircle,
  Activity,
} from "lucide-react";
import {
  AutomationDashboardData,
  updateAutomationSettingsAction,
  runWorkerDiagnosticsAction,
  triggerTokenRefreshCheckAction,
  triggerStorageMaintenanceAction,
  triggerModerationBatchAction,
} from "@/app/admin/automation-actions";

interface Props {
  initialData: AutomationDashboardData;
}

export function AutomationControlsClient({ initialData }: Props) {
  const [data, setData] = useState<AutomationDashboardData>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const handleToggleMaster = async (enabled: boolean) => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await updateAutomationSettingsAction({
        masterAutomationEnabled: enabled,
        moderationMode: data.moderationMode,
        catchupWindowMinutes: data.catchupWindowMinutes,
      });
      if (res.error) {
        setActionMessage({ type: "error", text: res.error });
      } else {
        setData((prev) => ({ ...prev, masterAutomationEnabled: enabled }));
        setActionMessage({
          type: "success",
          text: `Automation master switch is now ${enabled ? "ENABLED" : "PAUSED"}.`,
        });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeMode = async (mode: "manual" | "ai_assisted" | "smart_auto") => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await updateAutomationSettingsAction({
        masterAutomationEnabled: data.masterAutomationEnabled,
        moderationMode: mode,
        catchupWindowMinutes: data.catchupWindowMinutes,
      });
      if (res.error) {
        setActionMessage({ type: "error", text: res.error });
      } else {
        setData((prev) => ({ ...prev, moderationMode: mode }));
        setActionMessage({ type: "success", text: `Moderation mode updated to ${mode.toUpperCase()}.` });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setRunningAction("diagnostic");
    setActionMessage(null);
    try {
      const res = await runWorkerDiagnosticsAction();
      setActionMessage({
        type: "info",
        text: `Diagnostic run completed: ${res.message} (Status: ${res.status})`,
      });
    } catch (err) {
      setActionMessage({ type: "error", text: (err as Error).message });
    } finally {
      setRunningAction(null);
    }
  };

  const handleRunTokens = async () => {
    setRunningAction("tokens");
    setActionMessage(null);
    try {
      const res = await triggerTokenRefreshCheckAction();
      setActionMessage({
        type: "info",
        text: `Token check complete: IG ${res.instagram.status}, Threads ${res.threads.status} (${res.threads.daysRemaining ?? "unknown"} days remaining, auto-refreshed: ${res.refreshedThreads ? "Yes" : "No"}).`,
      });
    } catch (err) {
      setActionMessage({ type: "error", text: (err as Error).message });
    } finally {
      setRunningAction(null);
    }
  };

  const handleRunStorage = async () => {
    setRunningAction("storage");
    setActionMessage(null);
    try {
      const res = await triggerStorageMaintenanceAction();
      setActionMessage({
        type: "info",
        text: `Storage maintenance complete: Usage is ${res.usedPercentage}%, Freed ${res.freedBytes} bytes across ${res.cleanedFilesCount} files.`,
      });
    } catch (err) {
      setActionMessage({ type: "error", text: (err as Error).message });
    } finally {
      setRunningAction(null);
    }
  };

  const handleRunModeration = async () => {
    setRunningAction("moderation");
    setActionMessage(null);
    try {
      const res = await triggerModerationBatchAction(5);
      setActionMessage({
        type: "info",
        text: `Moderation batch processed ${res.processed} items: ${res.approved} approved, ${res.needsReview} needs review, ${res.rejected} rejected.`,
      });
    } catch (err) {
      setActionMessage({ type: "error", text: (err as Error).message });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[#2563EB]" />
          <div>
            <h2 className="text-sm font-semibold text-[#171717]">
              Phase 08: Publishing Scheduler & Background Automation
            </h2>
            <p className="text-xs text-[#737373]">
              Serverless worker coordination, atomic slots (12:00 & 19:00 WIB), and health monitoring.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              data.masterAutomationEnabled
                ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
                : "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                data.masterAutomationEnabled ? "bg-[#10B981] animate-pulse" : "bg-[#9CA3AF]"
              }`}
            />
            {data.masterAutomationEnabled ? "Automation Active" : "Automation Paused"}
          </span>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
            actionMessage.type === "success"
              ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
              : actionMessage.type === "error"
              ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
              : "bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]"
          }`}
        >
          {actionMessage.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          {actionMessage.type === "error" && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          {actionMessage.type === "info" && <Activity className="w-4 h-4 shrink-0 mt-0.5" />}
          <p>{actionMessage.text}</p>
        </div>
      )}

      {/* Grid: Health Telemetry & Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span>Next Publication Slot</span>
            <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
          </div>
          <p className="text-sm font-semibold text-[#171717]">{data.nextSlotTime}</p>
          <p className="text-[11px] text-[#737373]">
            {data.isPublicationWindow ? (
              <span className="text-[#059669] font-medium">Currently in slot window ({data.activeSlotTime} WIB)</span>
            ) : (
              "Outside publication window"
            )}
          </p>
        </div>

        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span>Last Worker Run</span>
            <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
          </div>
          <p className="text-sm font-semibold text-[#171717]">
            {data.lastWorkerRunAt ? new Date(data.lastWorkerRunAt).toLocaleTimeString("id-ID") : "No recorded run"}
          </p>
          <p className="text-[11px] text-[#737373]">Status: {data.lastWorkerStatus}</p>
        </div>

        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span>Approved Queue</span>
            <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
          </div>
          <p className="text-sm font-semibold text-[#171717]">{data.approvedQueueCount} Menfess</p>
          <p className="text-[11px] text-[#737373]">
            {data.retryDeliveriesCount > 0 ? (
              <span className="text-[#D97706]">{data.retryDeliveriesCount} retries pending</span>
            ) : (
              "0 retries pending"
            )}
          </p>
        </div>

        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span>Threads Token Health</span>
            <RotateCw className="w-3.5 h-3.5 text-[#2563EB]" />
          </div>
          <p className="text-sm font-semibold text-[#171717]">
            {data.threadsTokenDaysLeft !== undefined ? `${data.threadsTokenDaysLeft} Days Remaining` : "Configured"}
          </p>
          <p className="text-[11px] text-[#737373]">Auto-refresh: &lt;= 30 days</p>
        </div>
      </div>

      {/* Settings Form & Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E5E7EB] text-xs">
        <div>
          <label className="block font-medium text-[#171717] mb-1">
            Master Automation Switch
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={data.masterAutomationEnabled ? "destructive" : "primary"}
              size="sm"
              disabled={isUpdating}
              onClick={() => handleToggleMaster(!data.masterAutomationEnabled)}
              className="text-xs h-8"
            >
              {data.masterAutomationEnabled ? (
                <>
                  <PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause Automation
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1" /> Enable Automation
                </>
              )}
            </Button>
            <span className="text-[11px] text-[#737373]">
              Default is OFF. When paused, no automatic public posts occur.
            </span>
          </div>
        </div>

        <div>
          <label className="block font-medium text-[#171717] mb-1">
            Moderation Automation Mode
          </label>
          <select
            value={data.moderationMode}
            disabled={isUpdating}
            onChange={(e) => handleChangeMode(e.target.value as "manual" | "ai_assisted" | "smart_auto")}
            className="w-full h-8 px-2.5 text-xs bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-[#171717] focus:ring-1 focus:ring-[#2563EB]"
          >
            <option value="manual">Manual (Admin reviews all submissions)</option>
            <option value="ai_assisted">AI-Assisted (Gemini recommends, admin approves)</option>
            <option value="smart_auto">Smart Auto (Auto-approve low-risk text; media requires human)</option>
          </select>
          <span className="text-[11px] text-[#737373] mt-1 block">
            Smart Auto requires low-risk text without media.
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-[#E5E7EB]">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={runningAction !== null}
            onClick={handleRunDiagnostic}
            className="text-xs h-8"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-[#2563EB]" />
            {runningAction === "diagnostic" ? "Inspecting..." : "Run Read-Only Diagnostics"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={runningAction !== null}
            onClick={handleRunTokens}
            className="text-xs h-8"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1 text-[#059669]" />
            {runningAction === "tokens" ? "Checking..." : "Check Token Health"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={runningAction !== null}
            onClick={handleRunStorage}
            className="text-xs h-8"
          >
            <HardDrive className="w-3.5 h-3.5 mr-1 text-[#D97706]" />
            {runningAction === "storage" ? "Reconciling..." : "Run Storage Maintenance"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={runningAction !== null}
            onClick={() => handleRunModeration()}
            className="text-xs h-8"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-[#9333EA]" />
            {runningAction === "moderation" ? "Processing..." : "Process Moderation Queue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
