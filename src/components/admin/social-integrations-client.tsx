"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InstagramIcon } from "@/components/ui/icons";
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Palette,
} from "lucide-react";
import {
  testInstagramConnectionAction,
  syncInstagramUsernameAction,
  testThreadsConnectionAction,
  syncThreadsUsernameAction,
  refreshThreadsTokenAction,
  updateSocialSettingsAction,
  getBrandSettingsAction,
  updateBrandSettingsAction,
} from "@/app/admin/social-actions";
import { BrandSettings } from "@/lib/brand/brand-service";

interface SocialIntegrationsClientProps {
  initialSettings: {
    instagram_feed_enabled?: boolean;
    instagram_story_enabled?: boolean;
    threads_enabled?: boolean;
    threads_reply_enabled?: boolean;
    threads_prefix?: string;
    threads_suffix?: string;
    threads_show_ref_code?: boolean;
    [key: string]: unknown;
  };
}

export function SocialIntegrationsClient({ initialSettings }: SocialIntegrationsClientProps) {
  const [isTestingIg, setIsTestingIg] = React.useState(false);
  const [isSyncingIg, setIsSyncingIg] = React.useState(false);
  const [isTestingThreads, setIsTestingThreads] = React.useState(false);
  const [isSyncingThreads, setIsSyncingThreads] = React.useState(false);
  const [isRefreshingThreads, setIsRefreshingThreads] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [isSavingBrand, setIsSavingBrand] = React.useState(false);

  const [igResult, setIgResult] = React.useState<{
    status: string;
    username?: string;
    id?: string;
    permissions?: string[];
    error?: string;
    detectedUsername?: string;
  } | null>(null);

  const [threadsResult, setThreadsResult] = React.useState<{
    status: string;
    username?: string;
    id?: string;
    error?: string;
    detectedUsername?: string;
  } | null>(null);

  const [threadsRefreshMsg, setThreadsRefreshMsg] = React.useState<string | null>(null);

  // Form states
  const [igFeed, setIgFeed] = React.useState(initialSettings.instagram_feed_enabled !== false);
  const [igStory, setIgStory] = React.useState(initialSettings.instagram_story_enabled !== false);
  const [threadsEnabled, setThreadsEnabled] = React.useState(initialSettings.threads_enabled !== false);
  const [threadsReply, setThreadsReply] = React.useState(initialSettings.threads_reply_enabled !== false);
  const [threadsPrefix, setThreadsPrefix] = React.useState(initialSettings.threads_prefix || "");
  const [threadsSuffix, setThreadsSuffix] = React.useState(initialSettings.threads_suffix || "");
  const [threadsShowRefCode, setThreadsShowRefCode] = React.useState(initialSettings.threads_show_ref_code !== false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [brandSuccess, setBrandSuccess] = React.useState(false);

  // Dynamic Brand Settings state
  const [brandSettings, setBrandSettings] = React.useState<BrandSettings>({
    brand_name: "Kampung Inggris Fess",
    short_brand_name: "KIFess",
    tagline: "Tell ur untold story!",
    logo_url: "",
    favicon_url: "/favicon.ico",
    instagram_username: "kampunginggrisfess",
    instagram_url: "https://www.instagram.com/kampunginggrisfess/",
    threads_username: "kampunginggrisfess",
    threads_url: "https://www.threads.com/@kampunginggrisfess",
    managed_by: "Mr.BOB Kampung Inggris",
    footer_text: "An anonymous community platform for Kampung Inggris students, alumni, visitors, and locals. Managed by Mr.BOB Kampung Inggris.",
    default_caption: "Tell ur untold story! 🍃\n\nKirim menfess kamu via link di bio.\n\n#kampunginggris #kampunginggrispare #kampunginggrisfess #menfess",
  });

  React.useEffect(() => {
    getBrandSettingsAction().then((data) => {
      if (data) setBrandSettings(data);
    });
  }, []);

  const handleTestInstagram = async () => {
    setIsTestingIg(true);
    setIgResult(null);
    try {
      const res = await testInstagramConnectionAction();
      setIgResult(res);
    } catch (e) {
      setIgResult({ status: "error", error: (e as Error).message });
    } finally {
      setIsTestingIg(false);
    }
  };

  const handleSyncInstagramUsername = async () => {
    if (!igResult?.detectedUsername) return;
    setIsSyncingIg(true);
    try {
      const res = await syncInstagramUsernameAction(igResult.detectedUsername);
      if (res.success) {
        setIgResult({
          status: "connected",
          username: igResult.detectedUsername,
          id: igResult.id,
          permissions: igResult.permissions,
        });
      }
    } finally {
      setIsSyncingIg(false);
    }
  };

  const handleTestThreads = async () => {
    setIsTestingThreads(true);
    setThreadsResult(null);
    try {
      const res = await testThreadsConnectionAction();
      setThreadsResult(res);
    } catch (e) {
      setThreadsResult({ status: "error", error: (e as Error).message });
    } finally {
      setIsTestingThreads(false);
    }
  };

  const handleSyncThreadsUsername = async () => {
    if (!threadsResult?.detectedUsername) return;
    setIsSyncingThreads(true);
    try {
      const res = await syncThreadsUsernameAction(threadsResult.detectedUsername);
      if (res.success) {
        setThreadsResult({
          status: "connected",
          username: threadsResult.detectedUsername,
          id: threadsResult.id,
        });
      }
    } finally {
      setIsSyncingThreads(false);
    }
  };

  const handleRefreshThreads = async () => {
    setIsRefreshingThreads(true);
    setThreadsRefreshMsg(null);
    try {
      const res = await refreshThreadsTokenAction();
      if (res.success) {
        setThreadsRefreshMsg("Token successfully refreshed for 60 days.");
      } else {
        setThreadsRefreshMsg(`Refresh failed: ${res.error}`);
      }
    } catch (e) {
      setThreadsRefreshMsg(`Error: ${(e as Error).message}`);
    } finally {
      setIsRefreshingThreads(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await updateSocialSettingsAction({
        instagramFeedEnabled: igFeed,
        instagramStoryEnabled: igStory,
        threadsEnabled,
        threadsReplyEnabled: threadsReply,
        threadsPrefix,
        threadsSuffix,
        threadsShowRefCode,
      });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveBrandSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBrand(true);
    setBrandSuccess(false);
    try {
      const res = await updateBrandSettingsAction(brandSettings);
      if (res.success) {
        setBrandSuccess(true);
        setTimeout(() => setBrandSuccess(false), 3000);
      }
    } finally {
      setIsSavingBrand(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Connection Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instagram Unified Login Card */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <InstagramIcon className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#171717]">Instagram Unified Login</h3>
            </div>
            <span className="text-[11px] font-mono text-[#737373] bg-[#FAFAFA] px-2 py-0.5 rounded border border-[#E5E7EB]">
              v21.0
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
              <span className="text-[#737373]">Target Username:</span>
              <span className="font-semibold text-[#171717]">@{brandSettings.instagram_username || "kampunginggrisfess"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
              <span className="text-[#737373]">Account ID:</span>
              <span className="font-mono text-[#171717]">17841480301270114</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
              <span className="text-[#737373]">Required Scope:</span>
              <span className="font-mono text-[#2563EB]">instagram_content_publish</span>
            </div>
          </div>

          {igResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                igResult.status === "connected"
                  ? "bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534]"
                  : igResult.status === "username_changed"
                  ? "bg-[#FFFBEB] border border-[#FEF3C7] text-[#B45309]"
                  : "bg-[#FEF2F2] border border-[#FEE2E2] text-[#991B1B]"
              }`}
            >
              {igResult.status === "connected" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A] mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706] mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-semibold">
                  {igResult.status === "connected"
                    ? `Connected to @${igResult.username}`
                    : igResult.status === "username_changed"
                    ? "Username Change Detected"
                    : "Connection Check Failed"}
                </p>
                {igResult.error && <p className="leading-relaxed">{igResult.error}</p>}
                {igResult.permissions && (
                  <p className="text-[11px] text-[#166534]">
                    Granted: {igResult.permissions.join(", ")}
                  </p>
                )}
                {igResult.status === "username_changed" && igResult.detectedUsername && (
                  <Button
                    type="button"
                    onClick={handleSyncInstagramUsername}
                    disabled={isSyncingIg}
                    className="mt-2 h-7 px-2.5 text-xs bg-[#D97706] hover:bg-[#B45309] text-white"
                  >
                    {isSyncingIg ? "Syncing..." : `Sync to @${igResult.detectedUsername}`}
                  </Button>
                )}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleTestInstagram}
            disabled={isTestingIg}
            className="w-full h-9 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingIg ? "animate-spin" : ""}`} />
            {isTestingIg ? "Verifying Instagram..." : "Test Instagram Connection"}
          </Button>
        </div>

        {/* Threads Official API Card */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#171717]">Threads Official API</h3>
            </div>
            <span className="text-[11px] font-mono text-[#737373] bg-[#FAFAFA] px-2 py-0.5 rounded border border-[#E5E7EB]">
              v1.0
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
              <span className="text-[#737373]">Target Username:</span>
              <span className="font-semibold text-[#171717]">@{brandSettings.threads_username || "kampunginggrisfess"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
              <span className="text-[#737373]">User ID:</span>
              <span className="font-mono text-[#171717]">29202039439462395</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
              <span className="text-[#737373]">Token Type:</span>
              <span className="font-mono text-[#2563EB]">Long-Lived (60 days)</span>
            </div>
          </div>

          {threadsResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                threadsResult.status === "connected"
                  ? "bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534]"
                  : threadsResult.status === "username_changed"
                  ? "bg-[#FFFBEB] border border-[#FEF3C7] text-[#B45309]"
                  : "bg-[#FEF2F2] border border-[#FEE2E2] text-[#991B1B]"
              }`}
            >
              {threadsResult.status === "connected" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A] mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706] mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-semibold">
                  {threadsResult.status === "connected"
                    ? `Connected to @${threadsResult.username}`
                    : threadsResult.status === "username_changed"
                    ? "Username Change Detected"
                    : "Threads Check Failed"}
                </p>
                {threadsResult.error && <p className="leading-relaxed">{threadsResult.error}</p>}
                {threadsResult.status === "username_changed" && threadsResult.detectedUsername && (
                  <Button
                    type="button"
                    onClick={handleSyncThreadsUsername}
                    disabled={isSyncingThreads}
                    className="mt-2 h-7 px-2.5 text-xs bg-[#D97706] hover:bg-[#B45309] text-white"
                  >
                    {isSyncingThreads ? "Syncing..." : `Sync to @${threadsResult.detectedUsername}`}
                  </Button>
                )}
              </div>
            </div>
          )}

          {threadsRefreshMsg && (
            <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#334155]">
              {threadsRefreshMsg}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestThreads}
              disabled={isTestingThreads}
              className="flex-1 h-9 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingThreads ? "animate-spin" : ""}`} />
              {isTestingThreads ? "Verifying..." : "Test Connection"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshThreads}
              disabled={isRefreshingThreads}
              className="h-9 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isRefreshingThreads ? "animate-spin" : ""}`} />
              Refresh Token
            </Button>
          </div>
        </div>
      </div>

      {/* Dynamic Brand & Identity Settings */}
      <form onSubmit={handleSaveBrandSettings} className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-[#171717]">Brand Identity & Dynamic Profile Settings</h3>
          </div>
          {brandSuccess && (
            <span className="text-xs text-[#16A34A] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved Dynamically
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#171717] font-medium mb-1">Brand Name</label>
            <Input
              value={brandSettings.brand_name}
              onChange={(e) => setBrandSettings({ ...brandSettings, brand_name: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Short Brand Name / Wordmark</label>
            <Input
              value={brandSettings.short_brand_name}
              onChange={(e) => setBrandSettings({ ...brandSettings, short_brand_name: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Tagline</label>
            <Input
              value={brandSettings.tagline}
              onChange={(e) => setBrandSettings({ ...brandSettings, tagline: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Managed By Statement</label>
            <Input
              value={brandSettings.managed_by}
              onChange={(e) => setBrandSettings({ ...brandSettings, managed_by: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Instagram Username</label>
            <Input
              value={brandSettings.instagram_username}
              onChange={(e) => setBrandSettings({ ...brandSettings, instagram_username: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Instagram Profile URL</label>
            <Input
              value={brandSettings.instagram_url}
              onChange={(e) => setBrandSettings({ ...brandSettings, instagram_url: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Threads Username</label>
            <Input
              value={brandSettings.threads_username}
              onChange={(e) => setBrandSettings({ ...brandSettings, threads_username: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="block text-[#171717] font-medium mb-1">Threads Profile URL</label>
            <Input
              value={brandSettings.threads_url}
              onChange={(e) => setBrandSettings({ ...brandSettings, threads_url: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[#171717] font-medium mb-1">Footer Text / Community Positioning</label>
            <Input
              value={brandSettings.footer_text}
              onChange={(e) => setBrandSettings({ ...brandSettings, footer_text: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[#171717] font-medium mb-1">Default Publication Caption Template</label>
            <textarea
              value={brandSettings.default_caption}
              onChange={(e) => setBrandSettings({ ...brandSettings, default_caption: e.target.value })}
              rows={3}
              className="w-full p-2.5 text-xs bg-[#FFFFFF] border border-[#E5E7EB] rounded-[10px] text-[#171717] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isSavingBrand}
            className="h-9 px-4 text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] cursor-pointer"
          >
            {isSavingBrand ? "Saving..." : "Save Brand Settings"}
          </Button>
        </div>
      </form>

      {/* Multi-Platform Publishing Channel Preferences */}
      <form onSubmit={handleSavePreferences} className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-[#171717]">Publishing Channel Preferences</h3>
          </div>
          {saveSuccess && (
            <span className="text-xs text-[#16A34A] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Instagram Feed */}
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Instagram Feed</span>
              <input
                type="checkbox"
                checked={igFeed}
                onChange={(e) => setIgFeed(e.target.checked)}
                className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-[#737373]">
              Publish approved 1080×1350px rendered template assets as Feed post or 2-slide carousel.
            </p>
          </div>

          {/* Instagram Companion Story */}
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Instagram Companion Story</span>
              <input
                type="checkbox"
                checked={igStory && igFeed}
                disabled={!igFeed}
                onChange={(e) => setIgStory(e.target.checked)}
                className="w-4 h-4 text-[#2563EB] rounded cursor-pointer disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-[#737373]">
              Publish 1080×1920px Story asset strictly after Feed succeeds. Disabled if Feed is off.
            </p>
          </div>

          {/* Threads Main Post */}
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Threads Main Post</span>
              <input
                type="checkbox"
                checked={threadsEnabled}
                onChange={(e) => setThreadsEnabled(e.target.checked)}
                className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-[#737373]">
              Publish Slide 1 approved message text to Threads independently.
            </p>
          </div>

          {/* Threads Continuation Reply */}
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Threads Slide 2 Reply</span>
              <input
                type="checkbox"
                checked={threadsReply && threadsEnabled}
                disabled={!threadsEnabled}
                onChange={(e) => setThreadsReply(e.target.checked)}
                className="w-4 h-4 text-[#2563EB] rounded cursor-pointer disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-[#737373]">
              Publish Slide 2 as a threaded continuation reply to Slide 1.
            </p>
          </div>
        </div>

        {/* Threads Text Options */}
        <div className="pt-2 border-t border-[#E5E7EB] space-y-3 text-xs">
          <h4 className="font-medium text-[#171717]">Threads Text Formatting Options</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#737373] mb-1">Optional Prefix</label>
              <Input
                value={threadsPrefix}
                onChange={(e) => setThreadsPrefix(e.target.value)}
                placeholder="e.g. [Kampung Inggris Fess]"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[#737373] mb-1">Optional Suffix / Hashtags</label>
              <Input
                value={threadsSuffix}
                onChange={(e) => setThreadsSuffix(e.target.value)}
                placeholder="e.g. #KampungInggris"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="threadsShowRef"
              checked={threadsShowRefCode}
              onChange={(e) => setThreadsShowRefCode(e.target.checked)}
              className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
            />
            <label htmlFor="threadsShowRef" className="text-[#171717] cursor-pointer">
              Include Menfess Tracking Code (e.g. #KI-ABC123) in Threads payload
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isSavingSettings}
            className="h-9 px-4 text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] cursor-pointer"
          >
            {isSavingSettings ? "Saving..." : "Save Platform Preferences"}
          </Button>
        </div>
      </form>
    </div>
  );
}
