import fs from "node:fs";
import path from "node:path";
import { readConfig } from "./config.js";
import { generatePost } from "./generate-post.js";
import { readState, resetAfterPost, setCarryOver } from "./state.js";

const type = process.argv[2];

if (!["morning", "evening"].includes(type)) {
  console.error("Usage: node scripts/run-generate.js morning|evening");
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

    const dayStories = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    stories.push(...dayStories.filter((story) => new Date(story.published_at) > cutoff));
  }

  return stories.sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
  );
}

async function main() {
  const config = readConfig();
  const state = readState();
  const stories = gatherStoriesSinceLastPost(state.last_post_time);

  console.log(`[run-generate] type=${type} stories=${stories.length}`);

  if (stories.length === 0) {
    console.log("No stories available for post generation.");
    return;
  }

  if (type === "evening" && stories.length < config.min_stories_for_post) {
    console.log(
      `Not enough stories for an evening post (${stories.length}/${config.min_stories_for_post}).`,
    );
    setCarryOver();
    return;
  }

  await generatePost(stories, type);
  resetAfterPost(new Date().toISOString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
