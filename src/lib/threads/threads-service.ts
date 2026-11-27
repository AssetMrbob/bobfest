import { getActivePlatformToken, savePlatformToken } from "@/lib/security/credential-store";

/**
 * Official Threads API Integration
 * Host: graph.threads.net
 * API Version: v1.0
 * Supported operations:
 * - Read-only account verification & token health
 * - Publishing text-based single slide post
 * - Publishing two-slide submission: Slide 1 (main post) + Slide 2 (continuation reply)
 * - Media-backed Threads posts (images/videos)
 * - Long-lived token refresh (POST graph.threads.net/refresh_access_token?grant_type=th_refresh_token)
 */

export const THREADS_API_VERSION = "v1.0";
export const THREADS_API_HOST = "https://graph.threads.net";

export interface ThreadsAccountInfo {
  id: string;
  username: string;
  name: string;
  profilePictureUrl?: string;
  status: "connected" | "error" | "mismatch" | "username_changed";
  error?: string;
  detectedUsername?: string;
}

/**
 * Synchronizes the verified Threads username when account ID matches but username changed.
 */
export async function syncThreadsUsername(newUsername: string): Promise<boolean> {
  const credentials = await getActivePlatformToken("threads");
  if (!credentials) return false;

  return await savePlatformToken({
    id: "threads_official",
    platform: "threads",
    accountId: credentials.accountId,
    accountUsername: newUsername,
    token: credentials.token,
    status: "connected",
    metadata: { synced_at: new Date().toISOString(), previous_username: credentials.username },
  });
}

/**
 * Verifies Threads account identity with fail-closed security.
 *
 * Rules:
 * 1. Account ID is the primary publishing identity.
 * 2. If Account ID matches but Username changed on Threads:
 *    - Detect username change.
 *    - Return status "username_changed" with detectedUsername.
 *    - Allow administrator to synchronize profile.
 *    - Publishing is NOT blocked solely because of a username rename on an authorized account.
 * 3. If Account ID differs:
 *    - Fail closed immediately (status: "mismatch").
 */
export async function verifyThreadsConnection(): Promise<ThreadsAccountInfo> {
  const credentials = await getActivePlatformToken("threads");
  if (!credentials) {
    return {
      id: "",
      username: "",
      name: "",
      status: "error",
      error: "Threads access token or user ID is not configured.",
    };
  }

  const { token, accountId: expectedId, username: expectedUsername } = credentials;

  try {
    const url = `${THREADS_API_HOST}/${THREADS_API_VERSION}/me?fields=id,username,name,threads_profile_picture_url&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      return {
        id: expectedId,
        username: expectedUsername,
        name: "",
        status: "error",
        error: data.error?.message || `HTTP ${res.status}`,
      };
    }

    if (data.id !== expectedId) {
      return {
        id: data.id,
        username: data.username,
        name: data.name || "",
        status: "mismatch",
        error: `Security alert: Threads account ID (${data.id}) does not match expected (${expectedId}). Publishing blocked.`,
      };
    }

    const isUsernameChanged = data.username && data.username.toLowerCase() !== expectedUsername.toLowerCase();

    if (isUsernameChanged) {
      return {
        id: data.id,
        username: expectedUsername,
        name: data.name || "",
        profilePictureUrl: data.threads_profile_picture_url,
        status: "username_changed",
        detectedUsername: data.username,
        error: `Notice: Threads username changed on platform from '@${expectedUsername}' to '@${data.username}'. Account ID verified. Profile sync available.`,
      };
    }

    return {
      id: data.id,
      username: data.username,
      name: data.name || "",
      profilePictureUrl: data.threads_profile_picture_url,
      status: "connected",
    };
  } catch (err) {
    return {
      id: expectedId,
      username: expectedUsername,
      name: "",
      status: "error",
      error: (err as Error).message,
    };
  }
}

// In-memory mutex to prevent concurrent refresh storms
let threadsRefreshPromise: Promise<{ success: boolean; error?: string; expiresIn?: number }> | null = null;

/**
 * Refreshes a long-lived Threads access token.
 * Minimum token age for refresh is 24 hours. Valid for 60 days.
 * Protected against concurrent refresh calls.
 */
export async function refreshThreadsToken(): Promise<{ success: boolean; error?: string; expiresIn?: number }> {
  if (threadsRefreshPromise) {
    return threadsRefreshPromise;
  }

  threadsRefreshPromise = (async () => {
    try {
      const credentials = await getActivePlatformToken("threads");
      if (!credentials) return { success: false, error: "Threads token not found." };

      const url = `${THREADS_API_HOST}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(credentials.token)}`;

      const res = await fetch(url, { method: "GET" });
      const data = await res.json();

      if (!res.ok || data.error || !data.access_token) {
        return { success: false, error: data.error?.message || "Failed to refresh Threads token" };
      }

      const newAccessToken = data.access_token;
      const expiresIn = data.expires_in; // seconds (typically 5184000 = 60 days)
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

      // Persist new token in secure store
      await savePlatformToken({
        id: "threads_official",
        platform: "threads",
        accountId: credentials.accountId,
        accountUsername: credentials.username,
        token: newAccessToken,
        expiresAt,
        status: "connected",
        metadata: { last_refreshed: new Date().toISOString(), expires_in_seconds: expiresIn },
      });

      return { success: true, expiresIn };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      threadsRefreshPromise = null;
    }
  })();

  return threadsRefreshPromise;
}

/**
 * Waits for a Threads container status to become FINISHED.
 */
export async function pollThreadsContainerStatus(
  containerId: string,
  token: string,
  maxWaitMs: number = 30000
): Promise<{ ready: boolean; error?: string }> {
  const start = Date.now();
  const url = `${THREADS_API_HOST}/${THREADS_API_VERSION}/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(token)}`;

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "FINISHED") {
        return { ready: true };
      }
      if (data.status === "ERROR" || data.status === "EXPIRED") {
        return { ready: false, error: data.error_message || `Threads container status: ${data.status}` };
      }
    } catch {
      // transient network poll failure
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return { ready: false, error: "Threads container status check timed out after 30 seconds." };
}

/**
 * Creates a Threads container for text or image media.
 * Supports reply_to_id for continuation threads.
 */
export async function createThreadsContainer(params: {
  text: string;
  imageUrl?: string;
  replyToId?: string;
}): Promise<{ containerId?: string; error?: string }> {
  const credentials = await getActivePlatformToken("threads");
  if (!credentials) return { error: "Threads credentials not configured." };

  const url = `${THREADS_API_HOST}/${THREADS_API_VERSION}/${credentials.accountId}/threads`;
  const bodyParams: Record<string, string> = {
    text: params.text,
    access_token: credentials.token,
  };

  if (params.imageUrl) {
    bodyParams.media_type = "IMAGE";
    bodyParams.image_url = params.imageUrl;
  } else {
    bodyParams.media_type = "TEXT";
  }

  if (params.replyToId) {
    bodyParams.reply_to_id = params.replyToId;
  }

  const body = new URLSearchParams(bodyParams);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();

    if (!res.ok || !data.id) {
      return { error: data.error?.message || `HTTP ${res.status} creating Threads container` };
    }

    return { containerId: data.id };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Publishes a Threads container.
 */
export async function publishThreadsContainer(
  containerId: string
): Promise<{ publishedMediaId?: string; permalink?: string; error?: string }> {
  const credentials = await getActivePlatformToken("threads");
  if (!credentials) return { error: "Threads credentials not configured." };

  // 1. Verify container readiness
  const poll = await pollThreadsContainerStatus(containerId, credentials.token);
  if (!poll.ready) {
    return { error: `Cannot publish Threads container: ${poll.error}` };
  }

  // 2. Publish
  const url = `${THREADS_API_HOST}/${THREADS_API_VERSION}/${credentials.accountId}/threads_publish`;
  const body = new URLSearchParams({
    creation_id: containerId,
    access_token: credentials.token,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();

    if (!res.ok || !data.id) {
      return { error: data.error?.message || "Failed to publish Threads container." };
    }

    const publishedMediaId = data.id;
    let permalink: string | undefined;

    // 3. Fetch permalink if available
    try {
      const pUrl = `${THREADS_API_HOST}/${THREADS_API_VERSION}/${publishedMediaId}?fields=permalink&access_token=${encodeURIComponent(credentials.token)}`;
      const pRes = await fetch(pUrl);
      const pData = await pRes.json();
      if (pData.permalink) {
        permalink = pData.permalink;
      }
    } catch {
      // permalink fetch is non-fatal
    }

    return { publishedMediaId, permalink };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
