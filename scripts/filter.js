import { readConfig } from "./config.js";

export function isIndieStory(story) {
  const config = readConfig();
  const text = `${story.title ?? ""} ${story.summary ?? ""}`.toLowerCase();

  const blocked = config.blocklist.some((term) => text.includes(term.toLowerCase()));
  if (!blocked) {
    return true;
  }

  return config.crossover_signals.some((signal) => text.includes(signal.toLowerCase()));
}

export function filterStories(stories) {
  return stories.filter((story) => isIndieStory(story));
}
