import { getAppSettings, saveAppSettings, getSystemLogs } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, ShieldCheck, HardDrive, AlertCircle } from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";
import { SystemLogsClient } from "@/components/admin/system-logs-client";
import { Suspense } from "react";

async function SettingsContent() {
  const settings = await getAppSettings();
  const logsData = await getSystemLogs("all", 50);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Settings & Business Rules
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Configure system thresholds, publication cadences, and storage policies.
          </p>
        </div>
        {!settings.isConfigured && (
          <span className="text-xs text-[#854D0E] bg-[#FEFCE8] px-2.5 py-1 rounded border border-[#FEF08A]">
            Service Unavailable
          </span>
        )}
      </div>

      {!settings.isConfigured && (
        <div className="p-3.5 bg-[#FEFCE8] border border-[#FEF08A] rounded-xl text-xs text-[#854D0E] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#CA8A04] mt-0.5" />
          <p>
            Dedicated Supabase database is not configured in <code>.env.local</code>. Settings cannot be loaded or persisted until live credentials are provided.
          </p>
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          "use server";
          await saveAppSettings(formData);
        }}
        className="space-y-6"
      >
        {/* Submission & Gatekeeper Controls */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#171717]">
              Submission Gatekeeper Controls
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Accept Anonymous Submissions
              </label>
              <select
                name="accept_submissions"
                defaultValue={settings.accept_submissions ? "true" : "false"}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-[#FFFFFF] border border-[#E5E7EB] rounded-[10px] text-[#171717] focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="true">Enabled (Accepting incoming submissions)</option>
                <option value="false">Paused (Reject new submissions with friendly notice)</option>
              </select>
              <span className="text-[11px] text-[#737373] mt-1 block">
                Emergency switch to pause all incoming public submissions.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Max Message Character Length
              </label>
              <Input
                defaultValue={settings.max_message_length}
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                Enforced server-side at 500 characters maximum.
              </span>
            </div>
          </div>
        </div>

        {/* Publishing Rules */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <InstagramIcon className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#171717]">
              Instagram Publishing Cadence
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Instagram Auto-Publishing Automation
              </label>
              <select
                name="auto_publish_enabled"
                defaultValue={settings.auto_publish_enabled ? "true" : "false"}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-[#FFFFFF] border border-[#E5E7EB] rounded-[10px] text-[#171717] focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="false">Disabled (Manual trigger only until Phase 04)</option>
                <option value="true">Enabled (Automated publish at scheduled slots)</option>
              </select>
              <span className="text-[11px] text-[#737373] mt-1 block">
                Kept disabled by default per Phase 02 security requirements.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Daily Scheduled Slots (Asia/Jakarta)
              </label>
              <Input
                defaultValue={settings.publish_times?.join(", ") ?? "12:00, 19:00"}
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                Fixed publication at 12:00 WIB and 19:00 WIB.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Max Carousel Slides per Batch
              </label>
              <Input
                defaultValue={settings.max_carousel_slides}
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                Maximum 5 messages per Feed carousel.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Companion Story Automation
              </label>
              <div className="p-2.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg flex items-center justify-between">
                <span>Auto-publish Story after Feed</span>
                <span className="font-semibold text-[#2563EB]">
                  {settings.auto_story_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Lifecycle Policies */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <HardDrive className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#171717]">
              Storage & FIFO Cleanup Targets
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Capacity Threshold
              </label>
              <Input
                defaultValue={`${settings.storage_capacity_limit_percent}%`}
                disabled
                className="h-9 text-xs font-mono"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                FIFO cleanup triggers automatically when used storage reaches 95%.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                FIFO Cleanup Target
              </label>
              <Input
                defaultValue={`${settings.storage_cleanup_target_percent}%`}
                disabled
                className="h-9 text-xs font-mono"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                Oldest published media purged down to 85% capacity. Never deletes pending jobs.
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Settings
          </Button>
        </div>
      </form>

      {/* Embedded System Audit Logs */}
      <SystemLogsClient initialLogs={logsData.logs} />
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[#737373]">
          Loading settings...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
