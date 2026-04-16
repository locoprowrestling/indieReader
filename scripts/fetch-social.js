import { TwitterApi } from "twitter-api-v2";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function settleStories(items, label, fetchStories) {
  const settled = await Promise.allSettled(items.map((item) => fetchStories(item)));
  const stories = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      stories.push(...result.value);
      return;
    }

    console.warn(`[fetch-social] ${label} failed for ${items[index]}: ${getErrorMessage(result.reason)}`);
  });

  return stories;
}

async function fetchTwitterHandle(client, handle) {
  const cleanHandle = handle.replace(/^@/, "");
  const userResponse = await client.v2.userByUsername(cleanHandle);
  if (!userResponse.data) {
    console.warn(`[fetch-social] Twitter user not found for ${handle}`);
    return [];
  }

  const timeline = await client.v2.userTimeline(userResponse.data.id, {
    max_results: 10,
    "tweet.fields": ["created_at", "text"],
    exclude: ["retweets", "replies"],
  });

  return (timeline.data.data ?? []).map((tweet) => ({
    title: tweet.text.slice(0, 120),
    summary: tweet.text,
    url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
    source: handle,
    published_at: tweet.created_at || new Date().toISOString(),
    platform: "twitter",
  }));
}

export async function fetchTwitter(handles) {
  if (!process.env.TWITTER_BEARER_TOKEN || handles.length === 0) {
    return [];
  }

  const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

  return settleStories(handles, "Twitter", (handle) => fetchTwitterHandle(client, handle));
}

async function fetchYouTubeChannel(channelId) {
  const params = new URLSearchParams({
    key: process.env.YOUTUBE_API_KEY,
    channelId,
    part: "snippet",
    order: "date",
    maxResults: "5",
    type: "video",
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`YouTube API ${response.status}`);
  }

  const data = await response.json();
  return (data.items ?? []).map((item) => ({
    title: item.snippet.title,
    summary: item.snippet.description,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    source: item.snippet.channelTitle,
    published_at: item.snippet.publishedAt,
    platform: "youtube",
  }));
}

export async function fetchYouTube(channelIds) {
  if (!process.env.YOUTUBE_API_KEY || channelIds.length === 0) {
    return [];
  }

  return settleStories(channelIds, "YouTube", fetchYouTubeChannel);
}

async function fetchFacebookPage(pageId) {
  const params = new URLSearchParams({
    fields: "message,permalink_url,created_time",
    limit: "5",
    access_token: process.env.FACEBOOK_ACCESS_TOKEN,
  });
  const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/posts?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Facebook API ${response.status}`);
  }

  const data = await response.json();
  return (data.data ?? [])
    .filter((post) => post.message)
    .map((post) => ({
      title: post.message.slice(0, 120),
      summary: post.message,
      url: post.permalink_url,
      source: pageId,
      published_at: post.created_time,
      platform: "facebook",
    }));
}

export async function fetchFacebook(pageIds) {
  if (!process.env.FACEBOOK_ACCESS_TOKEN || pageIds.length === 0) {
    return [];
  }

  return settleStories(pageIds, "Facebook", fetchFacebookPage);
}

async function fetchInstagramAccount(accountId) {
  const params = new URLSearchParams({
    fields: "caption,permalink,timestamp",
    limit: "5",
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
  });
  const response = await fetch(`https://graph.instagram.com/${accountId}/media?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Instagram API ${response.status}`);
  }

  const data = await response.json();
  return (data.data ?? [])
    .filter((post) => post.caption)
    .map((post) => ({
      title: post.caption.slice(0, 120),
      summary: post.caption,
      url: post.permalink,
      source: accountId,
      published_at: post.timestamp,
      platform: "instagram",
    }));
}

export async function fetchInstagram(accountIds) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || accountIds.length === 0) {
    return [];
  }

  return settleStories(accountIds, "Instagram", fetchInstagramAccount);
}
