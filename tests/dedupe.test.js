import { describe, expect, it } from "vitest";
import { dedupeStories, storyId } from "../scripts/dedupe.js";

describe("storyId", () => {
  it("returns the same hash for the same URL", () => {
    const story = { url: "https://example.com/story-1", title: "Story 1" };
    expect(storyId(story)).toBe(storyId(story));
  });

  it("returns different hashes for different URLs", () => {
    const first = { url: "https://example.com/story-1", title: "A" };
    const second = { url: "https://example.com/story-2", title: "B" };
    expect(storyId(first)).not.toBe(storyId(second));
  });

  it("falls back to the title when the URL is missing", () => {
    const story = { url: "", title: "Unique Title Here" };
    expect(storyId(story)).toHaveLength(32);
  });
});

describe("dedupeStories", () => {
  it("removes stories already present in the existing set", () => {
    const existing = ["abc123"];
    const stories = [
      { id: "abc123", title: "Already seen" },
      { id: "def456", title: "New story" },
    ];
    const result = dedupeStories(stories, existing);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("def456");
  });

  it("removes duplicates within the incoming batch", () => {
    const stories = [
      { id: "aaa", title: "Story A" },
      { id: "aaa", title: "Story A duplicate" },
      { id: "bbb", title: "Story B" },
    ];
    expect(dedupeStories(stories, [])).toHaveLength(2);
  });

  it("returns all stories when there are no existing IDs", () => {
    const stories = [
      { id: "x1", title: "One" },
      { id: "x2", title: "Two" },
    ];
    expect(dedupeStories(stories, [])).toHaveLength(2);
  });
});
