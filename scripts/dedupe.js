import { createHash } from "node:crypto";

function storyKey(story) {
  return story.url || story.title || JSON.stringify(story);
}

export function storyId(story) {
  return createHash("sha256").update(storyKey(story)).digest("hex");
}

export function legacyStoryId(story) {
  return createHash("md5").update(storyKey(story)).digest("hex");
}

export function dedupeStories(newStories, existingIds) {
  const seen = new Set(existingIds);

  return newStories.filter((story) => {
    const currentId = story.id || storyId(story);
    const legacyId = legacyStoryId(story);

    if (seen.has(currentId) || seen.has(legacyId)) {
      return false;
    }

    seen.add(currentId);
    seen.add(legacyId);
    return true;
  });
}
