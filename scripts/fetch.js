import fs from "node:fs";
import path from "node:path";
import { readConfig } from "./config.js";
import { dedupeStories, storyId } from "./dedupe.js";
import { fetchRSSFeed } from "./fetch-rss.js";
import { scrapeCagematch } from "./fetch-scrape.js";
import {
  fetchFacebook,
  fetchInstagram,
  fetchTwitter,
  fetchYouTube,
} from "./fetch-social.js";
import { fetchTikTok } from "./fetch-tiktok.js";
import { filterStories } from "./filter.js";
import { readJsonFileIfExists } from "./json-file.js";
import { incrementStoriesCount } from "./state.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function readExistingStories(filePath) {
  const stories = readJsonFileIfExists(filePath, [], "existing stories data");
  if (!Array.isArray(stories)) {
    throw new Error(`Expected existing stories data at ${filePath} to be an array.`);
  }

  return stories;
}

async function main() {
  const config = readConfig();
  const today = new Date().toISOString().slice(0, 10);
  const outputPath = path.resolve(`data/news-${today}.json`);

  const existingStories = readExistingStories(outputPath);
  const existingIds = existingStories.map((story) => story.id);
  const rawStories = [];

  for (const feedConfig of config.rss) {
    const feedUrl = typeof feedConfig === "string" ? feedConfig : feedConfig.url;
    try {
      const stories = await fetchRSSFeed(feedConfig);
      rawStories.push(...stories);
      console.log(`[RSS] ${feedUrl}: ${stories.length} items`);
    } catch (error) {
      console.warn(`[RSS] Failed ${feedUrl}: ${error.message}`);
    }
  }

  for (const scrapeConfig of config.scrape) {
    try {
      const stories = await scrapeCagematch(scrapeConfig);
      rawStories.push(...stories);
      console.log(`[Scrape] ${scrapeConfig.name}: ${stories.length} items`);
    } catch (error) {
      console.warn(`[Scrape] Failed ${scrapeConfig.name}: ${error.message}`);
    }
  }

  const social = config.social_allowlist || {};
  for (const [label, fetcher, targets] of [
    ["Twitter", fetchTwitter, social.twitter || []],
    ["YouTube", fetchYouTube, social.youtube || []],
    ["Facebook", fetchFacebook, social.facebook || []],
    ["Instagram", fetchInstagram, social.instagram || []],
    ["TikTok", fetchTikTok, social.tiktok || []],
  ]) {
    try {
      rawStories.push(...(await fetcher(targets)));
    } catch (error) {
      console.warn(`[${label}] Failed: ${getErrorMessage(error)}`);
    }
  }

  const filteredStories = filterStories(rawStories);
  const taggedStories = filteredStories.map((story) => ({
    ...story,
    id: story.id || storyId(story),
  }));
  const newStories = dedupeStories(taggedStories, existingIds);

  if (newStories.length === 0) {
    console.log("No new stories found.");
    return;
  }

  const allStories = [...existingStories, ...newStories].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(allStories, null, 2));
  incrementStoriesCount(newStories.length);

  console.log(`Added ${newStories.length} stories to ${outputPath}`);
}

main().catch((error) => {
  console.error(`[fetch] ${getErrorMessage(error)}`);
  process.exit(1);
});
