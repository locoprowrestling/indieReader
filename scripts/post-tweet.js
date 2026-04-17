import fs from "node:fs";
import { TwitterApi } from "twitter-api-v2";

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  for (const line of yaml.split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv) {
      result[kv[1]] = kv[2].replace(/\\"/g, '"');
    }
  }
  return result;
}

function buildTweetText(type, storyCount, url) {
  const n = Number(storyCount) || 0;
  const countStr = `${n} ${n === 1 ? "story" : "stories"}`;
  if (type === "morning") {
    return `Morning Indie Wrestling Roundup is live — ${countStr} from the scene. ${url}`;
  }
  if (type === "evening") {
    return `Evening Indie Wrestling Roundup is live — ${countStr} from the scene. ${url}`;
  }
  if (type === "colorado") {
    return `Colorado Indie Wrestling Roundup is up — ${countStr} from the Front Range. ${url}`;
  }
  return `Indie Wrestling Roundup is live — ${countStr} from the scene. ${url}`;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/post-tweet.js <post-file-path>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Post file not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const fm = parseFrontmatter(content);
  const { type, date, story_count } = fm;

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    console.warn("SITE_URL is not set — skipping tweet.");
    process.exit(0);
  }

  const missingCreds = [];
  if (!process.env.TWITTER_CONSUMER_KEY) missingCreds.push("TWITTER_CONSUMER_KEY");
  if (!process.env.TWITTER_SECRET_KEY) missingCreds.push("TWITTER_SECRET_KEY");
  if (!process.env.TWITTER_ACCESS_TOKEN) missingCreds.push("TWITTER_ACCESS_TOKEN");
  if (!process.env.TWITTER_ACCESS_SECRET) missingCreds.push("TWITTER_ACCESS_SECRET");

  if (missingCreds.length > 0) {
    console.warn(
      `Skipping tweet — missing Twitter credentials: ${missingCreds.join(", ")}`
    );
    process.exit(0);
  }

  const postPath = `/posts/${date}-${type}`;
  const url = `${siteUrl.replace(/\/$/, "")}${postPath}`;
  const tweetText = buildTweetText(type, story_count, url);

  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_SECRET_KEY,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  try {
    const result = await client.v2.tweet(tweetText);
    console.log(`Tweet posted successfully: ${result.data.id}`);
    console.log(`Tweet text: ${tweetText}`);
  } catch (err) {
    console.error("Failed to post tweet:", err.message || err);
    process.exit(1);
  }
}

main();
