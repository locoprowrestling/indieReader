function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function getAccessToken() {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_ID,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`TikTok token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchTikTokAccount(token, handle) {
  const username = handle.replace(/^@/, "");

  const body = {
    query: {
      and: [{ operation: "EQ", field_name: "username", field_values: [username] }],
    },
    max_count: 10,
    fields: "id,description,create_time,username",
  };

  const response = await fetch("https://open.tiktokapis.com/v2/research/video/query/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (response.status === 401 || response.status === 403) {
    const error = new Error(`research_api_unavailable:${response.status}`);
    error.isResearchApiUnavailable = true;
    throw error;
  }

  if (!response.ok) {
    throw new Error(`TikTok Research API ${response.status}`);
  }

  const data = await response.json();
  const videos = data.data?.videos ?? [];

  return videos.map((video) => ({
    title: video.description ? video.description.slice(0, 120) : "TikTok video",
    summary: video.description || "",
    url: `https://www.tiktok.com/@${username}/video/${video.id}`,
    source: handle,
    published_at: new Date(video.create_time * 1000).toISOString(),
    platform: "tiktok",
  }));
}

export async function fetchTikTok(accounts) {
  if (!process.env.TIKTOK_CLIENT_ID || !process.env.TIKTOK_CLIENT_SECRET) {
    return [];
  }

  if (!accounts || accounts.length === 0) {
    return [];
  }

  const normalized = accounts.map((item) =>
    typeof item === "string" ? { id: item, region: null } : item,
  );

  let token;
  try {
    token = await getAccessToken();
  } catch (error) {
    console.warn(`[TikTok] Failed to get access token: ${getErrorMessage(error)}`);
    return [];
  }

  const stories = [];
  const settled = await Promise.allSettled(
    normalized.map((entry) => fetchTikTokAccount(token, entry.id)),
  );

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const region = normalized[index].region ?? null;
      stories.push(...result.value.map((s) => ({ ...s, region })));
      return;
    }

    const err = result.reason;
    if (err && err.isResearchApiUnavailable) {
      console.warn(
        "[TikTok] Research API not available — upgrade app access at developers.tiktok.com",
      );
      return;
    }

    console.warn(
      `[fetch-social] TikTok failed for ${normalized[index].id}: ${getErrorMessage(err)}`,
    );
  });

  return stories;
}
