import { readConfig } from "./config.js";

const MAX_STORY_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_REGIONAL_STORY_AGE_MS = 90 * 24 * 60 * 60 * 1000;
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

export function isIndieStory(story, config) {
  if (!story.title || isGenericPromo(story)) {
    return false;
  }

  // Region-tagged stories use a wider freshness window and bypass the national
  // blocklist so they always reach the data file for their dedicated edition.
  if (story.region) {
    if (!story.published_at) return true;
    const publishedAt = new Date(story.published_at).getTime();
    if (Number.isNaN(publishedAt)) return true;
    return Date.now() - publishedAt <= MAX_REGIONAL_STORY_AGE_MS;
  }

  if (!isFreshStory(story)) {
    return false;
  }

  const text = `${story.title ?? ""} ${story.summary ?? ""}`.toLowerCase();
  const blocked = config.blocklist.some((term) => text.includes(term.toLowerCase()));
  if (!blocked) {
    return true;
  }

  return config.crossover_signals.some((signal) => text.includes(signal.toLowerCase()));
}

export function filterStories(stories, config = readConfig()) {
  return stories.filter((story) => isIndieStory(story, config));
}

export function filterStoriesByRegion(stories, region, config = readConfig()) {
  return stories.filter((story) => {
    if (!story.title || isGenericPromo(story)) {
      return false;
    }
    if (story.region !== region) {
      return false;
    }
    if (!story.published_at) {
      return true;
    }
    const publishedAt = new Date(story.published_at).getTime();
    if (Number.isNaN(publishedAt)) {
      return true;
    }
    // Future-dated items (upcoming events) always pass. For past items, use a
    // wider 90-day window since niche regional sources publish sporadically.
    return Date.now() - publishedAt <= MAX_REGIONAL_STORY_AGE_MS;
  });
}
