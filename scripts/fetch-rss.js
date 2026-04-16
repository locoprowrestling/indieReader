import Parser from "rss-parser";

const parser = new Parser();

export function parseRSSItems(items, feedTitle) {
  return items
    .filter((item) => item.title)
    .map((item) => ({
      title: item.title,
      summary: item.contentSnippet || item.content || "",
      url: item.link || "",
      source: feedTitle,
      published_at: item.isoDate || new Date().toISOString(),
      platform: "rss",
    }));
}

export async function fetchRSSFeed(url) {
  const feed = await parser.parseURL(url);
  return parseRSSItems(feed.items, feed.title || url);
}
