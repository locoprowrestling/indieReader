import { TwitterApi } from "twitter-api-v2";

export async function fetchTwitter(handles) {
  if (!process.env.TWITTER_BEARER_TOKEN || handles.length === 0) {
    return [];
  }

  const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  const results = [];

  for (const handle of handles) {
    try {
      const cleanHandle = handle.replace(/^@/, "");
      const userResponse = await client.v2.userByUsername(cleanHandle);
      const timeline = await client.v2.userTimeline(userResponse.data.id, {
        max_results: 10,
        "tweet.fields": ["created_at", "text"],
        exclude: ["retweets", "replies"],
      });

      for (const tweet of timeline.data.data ?? []) {
        results.push({
          title: tweet.text.slice(0, 120),
          summary: tweet.text,
          url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
          source: handle,
          published_at: tweet.created_at || new Date().toISOString(),
          platform: "twitter",
        });
      }
    } catch (error) {
      console.warn(`[fetch-social] Twitter failed for ${handle}: ${error.message}`);
    }
  }

  return results;
}

export async function fetchYouTube(channelIds) {
  if (!process.env.YOUTUBE_API_KEY || channelIds.length === 0) {
    return [];
  }

  const results = [];

  for (const channelId of channelIds) {
    try {
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
      for (const item of data.items ?? []) {
        results.push({
          title: item.snippet.title,
          summary: item.snippet.description,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          source: item.snippet.channelTitle,
          published_at: item.snippet.publishedAt,
          platform: "youtube",
        });
      }
    } catch (error) {
      console.warn(`[fetch-social] YouTube failed for ${channelId}: ${error.message}`);
    }
  }

  return results;
}

export async function fetchFacebook(pageIds) {
  if (!process.env.FACEBOOK_ACCESS_TOKEN || pageIds.length === 0) {
    return [];
  }

  const results = [];

  for (const pageId of pageIds) {
    try {
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
      for (const post of data.data ?? []) {
        if (!post.message) {
          continue;
        }

        results.push({
          title: post.message.slice(0, 120),
          summary: post.message,
          url: post.permalink_url,
          source: pageId,
          published_at: post.created_time,
          platform: "facebook",
        });
      }
    } catch (error) {
      console.warn(`[fetch-social] Facebook failed for ${pageId}: ${error.message}`);
    }
  }

  return results;
}

export async function fetchInstagram(accountIds) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || accountIds.length === 0) {
    return [];
  }

  const results = [];

  for (const accountId of accountIds) {
    try {
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
      for (const post of data.data ?? []) {
        if (!post.caption) {
          continue;
        }

        results.push({
          title: post.caption.slice(0, 120),
          summary: post.caption,
          url: post.permalink,
          source: accountId,
          published_at: post.timestamp,
          platform: "instagram",
        });
      }
    } catch (error) {
      console.warn(`[fetch-social] Instagram failed for ${accountId}: ${error.message}`);
    }
  }

  return results;
}
