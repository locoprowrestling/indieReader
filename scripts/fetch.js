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
import { filterStories } from "./filter.js";
import { incrementStoriesCount } from "./state.js";

async function main() {
  const config = readConfig();
  const today = new Date().toISOString().slice(0, 10);
  const outputPath = path.resolve(`data/news-${today}.json`);

  const existingStories = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf-8"))
    : [];
  const existingIds = existingStories.map((story) => story.id);
  const rawStories = [];

  for (const url of config.rss) {
    try {
      const stories = await fetchRSSFeed(url);
      rawStories.push(...stories);
      console.log(`[RSS] ${url}: ${stories.length} items`);
    } catch (error) {
      console.warn(`[RSS] Failed ${url}: ${error.message}`);
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

  const social = config.social_allowlist;
  rawStories.push(...(await fetchTwitter(social.twitter || [])));
  rawStories.push(...(await fetchYouTube(social.youtube || [])));
  rawStories.push(...(await fetchFacebook(social.facebook || [])));
  rawStories.push(...(await fetchInstagram(social.instagram || [])));

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
  console.error(error);
  process.exit(1);
});
