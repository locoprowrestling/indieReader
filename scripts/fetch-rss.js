import Parser from "rss-parser";

const parser = new Parser();
const DEFAULT_TIMEOUT_MS = 15000;

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

export async function fetchRSSFeed(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "indieReader/1.0 (+https://github.com/locoprowrestling/indieReader)",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const xml = await response.text();
  const feed = await parser.parseString(xml);
  return parseRSSItems(feed.items || [], feed.title || url);
}
