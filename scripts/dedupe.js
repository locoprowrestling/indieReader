import { createHash } from "node:crypto";

export function storyId(story) {
  const key = story.url || story.title || JSON.stringify(story);
  return createHash("md5").update(key).digest("hex");
}

export function dedupeStories(newStories, existingIds) {
  const seen = new Set(existingIds);

  return newStories.filter((story) => {
    const id = story.id || storyId(story);
    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}
