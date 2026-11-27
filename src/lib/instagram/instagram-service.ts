import { getActivePlatformToken } from "@/lib/security/credential-store";

/**
 * Official Instagram Graph API Integration for Unified Login
 * Host: graph.facebook.com
 * API Version: v21.0
 * Supported operations:
 * - Read-only account verification & permission checking
 * - Single image container creation & publishing
 * - Carousel item container creation, carousel container creation & publishing
 * - Story container creation & publishing
 */

export const INSTAGRAM_GRAPH_VERSION = "v21.0";
export const INSTAGRAM_GRAPH_HOST = "https://graph.facebook.com";

export interface InstagramAccountInfo {
  id: string;
  username: string;
  name: string;
  permissions?: string[];
  status: "connected" | "error" | "mismatch";
  error?: string;
}

export interface ContainerCreationResult {
  containerId: string;
}

export interface PublishResult {
  publishedMediaId: string;
  permalink?: string;
}

/**
 * Verifies account identity and active permissions with fail-closed security.
 */
export async function verifyInstagramConnection(): Promise<InstagramAccountInfo> {
  const credentials = await getActivePlatformToken("instagram");
  if (!credentials) {
    return {
      id: "",
      username: "",
      name: "",
      status: "error",
      error: "Instagram access token or account ID is not configured.",
    };
  }

  const { token, accountId: expectedId, username: expectedUsername } = credentials;

  try {
    // 1. Fetch account profile
    const profileUrl = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${expectedId}?fields=id,username,name&access_token=${encodeURIComponent(token)}`;
    const profileRes = await fetch(profileUrl, { method: "GET" });
    const profileData = await profileRes.json();

    if (!profileRes.ok || profileData.error) {
      return {
        id: expectedId,
        username: expectedUsername,
        name: "",
        status: "error",
        error: profileData.error?.message || `HTTP ${profileRes.status}`,
      };
    }

    // Fail closed if ID or username does not match
    if (profileData.id !== expectedId || profileData.username.toLowerCase() !== expectedUsername.toLowerCase()) {
      return {
        id: profileData.id,
        username: profileData.username,
        name: profileData.name || "",
        status: "mismatch",
        error: `Security alert: Account returned (${profileData.username}:${profileData.id}) does not match expected (${expectedUsername}:${expectedId}). Publishing blocked.`,
      };
    }

    // 2. Fetch permissions
    const permsUrl = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/me/permissions?access_token=${encodeURIComponent(token)}`;
    const permsRes = await fetch(permsUrl);
    const permsData = await permsRes.json();
    const grantedPerms: string[] = [];

    if (permsRes.ok && permsData.data) {
      for (const p of permsData.data) {
        if (p.status === "granted") grantedPerms.push(p.permission);
      }
    }

    const hasPublish = grantedPerms.includes("instagram_content_publish");
    if (!hasPublish) {
      return {
        id: profileData.id,
        username: profileData.username,
        name: profileData.name,
        permissions: grantedPerms,
        status: "error",
        error: "Missing required permission 'instagram_content_publish'.",
      };
    }

    return {
      id: profileData.id,
      username: profileData.username,
      name: profileData.name,
      permissions: grantedPerms,
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

/**
 * Waits for a container status to become FINISHED before publishing.
 */
export async function pollContainerStatus(
  containerId: string,
  token: string,
  maxWaitMs: number = 30000
): Promise<{ ready: boolean; error?: string }> {
  const start = Date.now();
  const url = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`;

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status_code === "FINISHED") {
        return { ready: true };
      }
      if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
        return { ready: false, error: data.status || `Container failed with code: ${data.status_code}` };
      }
    } catch {
      // transient network poll failure
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return { ready: false, error: "Container status check timed out after 30 seconds." };
}

/**
 * Creates a media container for a single Feed image.
 */
export async function createSingleImageFeedContainer(
  imageUrl: string,
  caption: string
): Promise<{ containerId?: string; error?: string }> {
  const credentials = await getActivePlatformToken("instagram");
  if (!credentials) return { error: "Instagram credentials not configured." };

  const url = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${credentials.accountId}/media`;
  const body = new URLSearchParams({
    image_url: imageUrl,
    caption,
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
      return { error: data.error?.message || `HTTP ${res.status} creating single image container` };
    }
    return { containerId: data.id };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Creates child containers and a parent carousel container for a two-slide submission.
 */
export async function createCarouselFeedContainer(
  imageUrls: [string, string],
  caption: string
): Promise<{ containerId?: string; error?: string }> {
  const credentials = await getActivePlatformToken("instagram");
  if (!credentials) return { error: "Instagram credentials not configured." };

  const url = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${credentials.accountId}/media`;
  const childContainerIds: string[] = [];

  // Create child items in order
  for (let i = 0; i < imageUrls.length; i++) {
    const itemBody = new URLSearchParams({
      image_url: imageUrls[i],
      is_carousel_item: "true",
      access_token: credentials.token,
    });

    const itemRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: itemBody,
    });
    const itemData = await itemRes.json();

    if (!itemRes.ok || !itemData.id) {
      return { error: itemData.error?.message || `Failed to create carousel child item ${i + 1}` };
    }
    childContainerIds.push(itemData.id);
  }

  // Poll readiness of child containers
  for (const childId of childContainerIds) {
    const poll = await pollContainerStatus(childId, credentials.token, 20000);
    if (!poll.ready) {
      return { error: `Carousel child container ${childId} not ready: ${poll.error}` };
    }
  }

  // Create parent carousel container
  const parentBody = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childContainerIds.join(","),
    caption,
    access_token: credentials.token,
  });

  const parentRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parentBody,
  });
  const parentData = await parentRes.json();

  if (!parentRes.ok || !parentData.id) {
    return { error: parentData.error?.message || "Failed to create parent carousel container." };
  }

  return { containerId: parentData.id };
}

/**
 * Creates a companion Story container (1080x1920).
 */
export async function createStoryContainer(
  storyImageUrl: string
): Promise<{ containerId?: string; error?: string }> {
  const credentials = await getActivePlatformToken("instagram");
  if (!credentials) return { error: "Instagram credentials not configured." };

  const url = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${credentials.accountId}/media`;
  const body = new URLSearchParams({
    image_url: storyImageUrl,
    media_type: "STORIES",
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
      return { error: data.error?.message || "Failed to create Story container." };
    }
    return { containerId: data.id };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Publishes an Instagram media container after verifying readiness.
 */
export async function publishInstagramContainer(
  containerId: string
): Promise<{ publishedMediaId?: string; permalink?: string; error?: string }> {
  const credentials = await getActivePlatformToken("instagram");
  if (!credentials) return { error: "Instagram credentials not configured." };

  // 1. Verify container is ready
  const poll = await pollContainerStatus(containerId, credentials.token);
  if (!poll.ready) {
    return { error: `Cannot publish: ${poll.error}` };
  }

  // 2. Publish container
  const url = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${credentials.accountId}/media_publish`;
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
      return { error: data.error?.message || "Failed to publish Instagram media container." };
    }

    const publishedMediaId = data.id;

    // 3. Attempt to fetch permalink
    let permalink: string | undefined;
    try {
      const mediaUrl = `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/${publishedMediaId}?fields=permalink&access_token=${encodeURIComponent(credentials.token)}`;
      const mediaRes = await fetch(mediaUrl);
      const mediaData = await mediaRes.json();
      if (mediaData.permalink) {
        permalink = mediaData.permalink;
      }
    } catch {
      // permalink fetch is non-fatal
    }

    return { publishedMediaId, permalink };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
