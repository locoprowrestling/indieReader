import fs from "node:fs";
import path from "node:path";
import { readConfig } from "./config.js";
import { generatePost } from "./generate-post.js";
import { readJsonFile } from "./json-file.js";
import { filterStoriesByRegion } from "./filter.js";
import { readState, resetAfterPost, setCarryOver } from "./state.js";

const type = process.argv[2];

if (!["morning", "evening", "colorado"].includes(type)) {
  console.error("Usage: node scripts/run-generate.js morning|evening|colorado");
  process.exit(1);
}

function gatherStoriesSinceLastPost(lastPostTime) {
  const cutoff = lastPostTime ? new Date(lastPostTime) : new Date(0);
  const dates = [
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  ];
  const stories = [];

  for (const date of dates) {
    const filePath = path.resolve(`data/news-${date}.json`);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const dayStories = readJsonFile(filePath, `stories data for ${date}`);
    if (!Array.isArray(dayStories)) {
      throw new Error(`Expected stories data for ${date} at ${filePath} to be an array.`);
    }

    stories.push(...dayStories.filter((story) => new Date(story.published_at) > cutoff));
  }

  return stories.sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
  );
}

async function main() {
  const config = readConfig();
  const state = readState();
  // Colorado edition is not gated by last_post_time — freshness is handled by
  // filterStoriesByRegion's 90-day window. National editions still use the cutoff
  // to avoid reprinting the same stories across morning and evening.
  const allStories = gatherStoriesSinceLastPost(type === "colorado" ? null : state.last_post_time);

  let stories;
  if (type === "colorado") {
    stories = filterStoriesByRegion(allStories, "CO", config);
  } else {
    // Exclude region-tagged stories from the national morning/evening editions.
    stories = allStories.filter((s) => !s.region);
  }

  console.log(`[run-generate] type=${type} stories=${stories.length}`);

  if (stories.length === 0) {
    console.log("No stories available for post generation.");
    return;
  }

  // Morning editions intentionally publish whenever there is at least one story.
  // The minimum threshold only applies to the second daily edition so the evening
  // run does not publish a thin recap and instead carries stories forward.
  // Colorado editions have no minimum — even a single upcoming show is worth covering.
  if (type === "evening" && stories.length < config.min_stories_for_post) {
    console.log(
      `Not enough stories for an evening post (${stories.length}/${config.min_stories_for_post}).`,
    );
    setCarryOver();
    return;
  }

  await generatePost(stories, type);
  if (type !== "colorado") {
    resetAfterPost(new Date().toISOString());
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[run-generate] ${message}`);
  process.exit(1);
});
