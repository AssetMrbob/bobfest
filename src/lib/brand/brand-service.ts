import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { APP_CONFIG } from "@/lib/constants";

export interface BrandSettings {
  brand_name: string;
  short_brand_name: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;
  instagram_username: string;
  instagram_url: string;
  threads_username: string;
  threads_url: string;
  managed_by: string;
  footer_text: string;
  default_caption: string;
  updated_at?: string;
}

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  brand_name: APP_CONFIG.name,
  short_brand_name: APP_CONFIG.shortName,
  tagline: APP_CONFIG.tagline,
  logo_url: "",
  favicon_url: "/favicon.ico",
  instagram_username: APP_CONFIG.instagramHandle,
  instagram_url: APP_CONFIG.instagramUrl,
  threads_username: APP_CONFIG.threadsHandle,
  threads_url: APP_CONFIG.threadsUrl,
  managed_by: "Mr.BOB Kampung Inggris",
  footer_text: APP_CONFIG.description,
  default_caption: "Tell ur untold story! 🍃\n\nKirim menfess kamu via link di bio.\n\n#kampunginggris #kampunginggrispare #kampunginggrisfess #menfess",
};

/**
 * Fetches dynamic brand settings.
 * Durable persistence in app_credentials (id: 'brand_settings').
 * Falls back safely to DEFAULT_BRAND_SETTINGS without crashing.
 */
export async function getBrandSettings(): Promise<BrandSettings> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from("app_credentials")
      .select("metadata, updated_at")
      .eq("id", "brand_settings")
      .maybeSingle();

    if (!error && data && data.metadata && typeof data.metadata === "object") {
      const meta = data.metadata as Record<string, string>;
      return {
        brand_name: meta.brand_name || DEFAULT_BRAND_SETTINGS.brand_name,
        short_brand_name: meta.short_brand_name || DEFAULT_BRAND_SETTINGS.short_brand_name,
        tagline: meta.tagline || DEFAULT_BRAND_SETTINGS.tagline,
        logo_url: meta.logo_url || DEFAULT_BRAND_SETTINGS.logo_url,
        favicon_url: meta.favicon_url || DEFAULT_BRAND_SETTINGS.favicon_url,
        instagram_username: meta.instagram_username || DEFAULT_BRAND_SETTINGS.instagram_username,
        instagram_url: meta.instagram_url || DEFAULT_BRAND_SETTINGS.instagram_url,
        threads_username: meta.threads_username || DEFAULT_BRAND_SETTINGS.threads_username,
        threads_url: meta.threads_url || DEFAULT_BRAND_SETTINGS.threads_url,
        managed_by: meta.managed_by || DEFAULT_BRAND_SETTINGS.managed_by,
        footer_text: meta.footer_text || DEFAULT_BRAND_SETTINGS.footer_text,
        default_caption: meta.default_caption || DEFAULT_BRAND_SETTINGS.default_caption,
        updated_at: data.updated_at,
      };
    }
  } catch (err) {
    console.warn("[BrandService] Error reading brand settings from DB:", (err as Error).message);
  }

  return DEFAULT_BRAND_SETTINGS;
}

/**
 * Persists dynamic brand settings to durable DB storage.
 */
export async function updateBrandSettings(settings: Partial<BrandSettings>): Promise<boolean> {
  const current = await getBrandSettings();
  const merged: BrandSettings = {
    ...current,
    ...settings,
  };

  try {
    const adminClient = createAdminSupabaseClient();
    const { error } = await adminClient.from("app_credentials").upsert({
      id: "brand_settings",
      platform: "instagram",
      account_id: "brand_config",
      account_username: merged.instagram_username,
      encrypted_token: "not_applicable",
      iv: "none",
      auth_tag: "none",
      token_type: "config",
      last_status: "connected",
      metadata: merged as unknown as import("@/lib/supabase/types").Json,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[BrandService] Error updating brand settings:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[BrandService] Exception updating brand settings:", (err as Error).message);
    return false;
  }
}
