import { readConfig } from "./config.js";

const MAX_STORY_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const GENERIC_HEADLINE_PATTERNS = [/^get more headlines/i];

function isFreshStory(story) {
  if (!story.published_at) {
    return true;
  }

  const publishedAt = new Date(story.published_at).getTime();
  if (Number.isNaN(publishedAt)) {
    return true;
  }

  return Date.now() - publishedAt <= MAX_STORY_AGE_MS;
}

function isGenericPromo(story) {
  const title = (story.title || "").trim();
  return GENERIC_HEADLINE_PATTERNS.some((pattern) => pattern.test(title));
}

export function isIndieStory(story) {
  const config = readConfig();
  const text = `${story.title ?? ""} ${story.summary ?? ""}`.toLowerCase();

  if (!story.title || isGenericPromo(story) || !isFreshStory(story)) {
    return false;
  }

  const blocked = config.blocklist.some((term) => text.includes(term.toLowerCase()));
  if (!blocked) {
    return true;
  }

  return config.crossover_signals.some((signal) => text.includes(signal.toLowerCase()));
}

export function filterStories(stories) {
  return stories.filter((story) => isIndieStory(story));
}
