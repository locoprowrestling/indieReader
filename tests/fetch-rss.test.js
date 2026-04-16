import { describe, expect, it } from "vitest";
import { parseRSSItems } from "../scripts/fetch-rss.js";

describe("parseRSSItems", () => {
  it("maps rss-parser items to story objects", () => {
    const items = [
      {
        title: "GCW announces card",
        contentSnippet: "Game Changer Wrestling sets card.",
        link: "https://pwinsider.com/gcw",
        isoDate: "2026-04-15T10:00:00Z",
      },
    ];
    const stories = parseRSSItems(items, "PWInsider");
    expect(stories).toHaveLength(1);
    expect(stories[0].title).toBe("GCW announces card");
    expect(stories[0].summary).toBe("Game Changer Wrestling sets card.");
    expect(stories[0].url).toBe("https://pwinsider.com/gcw");
    expect(stories[0].source).toBe("PWInsider");
    expect(stories[0].platform).toBe("rss");
    expect(stories[0].published_at).toBe("2026-04-15T10:00:00Z");
  });

  it("falls back to content when contentSnippet is missing", () => {
    const items = [
      {
        title: "T",
        content: "Full content",
        link: "https://x.com",
        isoDate: "2026-01-01T00:00:00Z",
      },
    ];
    expect(parseRSSItems(items, "Source")[0].summary).toBe("Full content");
  });

  it("uses an empty string for missing summary fields", () => {
    const items = [
      {
        title: "T",
        link: "https://x.com",
        isoDate: "2026-01-01T00:00:00Z",
      },
    ];
    expect(parseRSSItems(items, "Source")[0].summary).toBe("");
  });

  it("skips items with no title", () => {
    const items = [
      {
        contentSnippet: "body",
        link: "https://x.com",
        isoDate: "2026-01-01T00:00:00Z",
      },
    ];
    expect(parseRSSItems(items, "Source")).toHaveLength(0);
  });
});
