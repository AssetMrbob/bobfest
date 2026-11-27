"use client";

import * as React from "react";
import { BUSINESS_RULES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, ShieldCheck, HardDrive } from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function AdminSettingsPage() {
  const [saved, setSaved] = React.useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Settings & Business Rules
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Configure future system thresholds, publication cadences, and storage policies.
          </p>
        </div>
        {saved && (
          <span className="text-xs text-[#166534] bg-[#F0FDF4] px-2.5 py-1 rounded border border-[#DCFCE7]">
            Settings saved (Mock)
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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
                Max Daily Feed Batches
              </label>
              <Input
                defaultValue={BUSINESS_RULES.maxDailyFeedPublications}
                type="number"
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                Capped at 2 Feed batches daily to maintain algorithm health.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Daily Scheduled Slots (Asia/Jakarta)
              </label>
              <Input
                defaultValue={BUSINESS_RULES.scheduledSlotsWIB.join(", ")}
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                Fixed publication at 12:00 WIB and 19:00 WIB.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Max Messages per Carousel
              </label>
              <Input
                defaultValue={BUSINESS_RULES.maxMessagesPerCarousel}
                type="number"
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
                <span className="font-semibold text-[#2563EB]">Enabled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content & Upload Limits */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#171717]">
              Submission & Upload Constraints
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Max Character Count
              </label>
              <Input
                defaultValue={BUSINESS_RULES.maxCharacterCount}
                type="number"
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                500 characters max per menfess.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Max Image Attachment
              </label>
              <Input
                defaultValue={`${BUSINESS_RULES.maxImageSizeMB} MB`}
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                JPG, PNG, WEBP.
              </span>
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Max Video Attachment
              </label>
              <Input
                defaultValue={`${BUSINESS_RULES.maxVideoSizeMB} MB`}
                disabled
                className="h-9 text-xs"
              />
              <span className="text-[11px] text-[#737373] mt-1 block">
                MP4, QuickTime, WEBM.
              </span>
            </div>
          </div>
        </div>

        {/* Storage Lifecycle Policies */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <HardDrive className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#171717]">
              Supabase Storage & FIFO Cleanup
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Capacity Threshold
              </label>
              <Input
                defaultValue={`${BUSINESS_RULES.storageMaxCapacityThresholdPercent}%`}
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
                defaultValue={`${BUSINESS_RULES.storageFifoCleanupTargetPercent}%`}
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
            Save Configuration (Mock)
          </Button>
        </div>
      </form>
    </div>
  );
}
