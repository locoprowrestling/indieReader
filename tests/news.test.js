import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getNewsNavigation, listNewsDates, loadStoriesForDate } from "../src/lib/news.ts";

const TEST_DATES = ["2099-01-03", "2099-01-02", "2099-01-01"];

function storyFilePath(date) {
  return path.resolve(`data/news-${date}.json`);
}

beforeEach(() => {
  fs.writeFileSync(
    storyFilePath("2099-01-03"),
    JSON.stringify([
      {
        title: "Newest story",
        summary: "Most recent update.",
        url: "https://example.com/newest",
        source: "Test",
        published_at: "2099-01-03T12:00:00Z",
        platform: "rss",
      },
      {
        title: "Older same-day story",
        summary: "Earlier update.",
        url: "https://example.com/older",
        source: "Test",
        published_at: "2099-01-03T08:00:00Z",
        platform: "rss",
      },
    ]),
  );

  fs.writeFileSync(
    storyFilePath("2099-01-02"),
    JSON.stringify([
      {
        title: "Middle story",
        summary: "Navigation anchor.",
        url: "https://example.com/middle",
        source: "Test",
        published_at: "2099-01-02T09:00:00Z",
        platform: "rss",
      },
    ]),
  );

  fs.writeFileSync(
    storyFilePath("2099-01-01"),
    JSON.stringify([
      {
        title: "Earliest story",
        summary: "Earliest navigation item.",
        url: "https://example.com/earliest",
        source: "Test",
        published_at: "2099-01-01T09:00:00Z",
        platform: "rss",
      },
    ]),
  );
});

afterEach(() => {
  TEST_DATES.forEach((date) => {
    const filePath = storyFilePath(date);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});

describe("loadStoriesForDate", () => {
  it("sorts stories newest first for a given date", () => {
    const stories = loadStoriesForDate("2099-01-03");

    expect(stories).toHaveLength(2);
    expect(stories[0].title).toBe("Newest story");
    expect(stories[1].title).toBe("Older same-day story");
  });
});

describe("listNewsDates", () => {
  it("lists available dates in descending order", () => {
    expect(listNewsDates().slice(0, 3)).toEqual(TEST_DATES);
  });
});

describe("getNewsNavigation", () => {
  it("returns older and newer dates for a middle entry", () => {
    const navigation = getNewsNavigation("2099-01-02");

    expect(navigation.olderDate).toBe("2099-01-01");
    expect(navigation.newerDate).toBe("2099-01-03");
    expect(navigation.isLatest).toBe(false);
    expect(navigation.isEarliest).toBe(false);
  });

  it("returns null navigation for a date that does not exist", () => {
    const navigation = getNewsNavigation("2099-02-01");

    expect(navigation.olderDate).toBeNull();
    expect(navigation.newerDate).toBeNull();
    expect(navigation.isLatest).toBe(false);
    expect(navigation.isEarliest).toBe(false);
  });
});
