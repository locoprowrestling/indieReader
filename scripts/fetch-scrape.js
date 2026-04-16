import * as cheerio from "cheerio";

function parsePublishedAt(root) {
  const candidates = [
    root.find("time[datetime]").first().attr("datetime"),
    root.find("[data-published-at]").first().attr("data-published-at"),
    root.find("[data-date]").first().attr("data-date"),
    root.find(".news-date").first().text(),
    root.find(".date").first().text(),
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) {
      continue;
    }

    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return null;
}

export function parseCagematchHTML(html, scrapeConfig) {
  const $ = cheerio.load(html);
  const items = [];

  $(scrapeConfig.selector).each((_, element) => {
    const root = $(element);
    const titleElement = root.find(scrapeConfig.titleSelector || "a").first();
    const title = titleElement.text().trim();
    if (!title) {
      return;
    }

    const href =
      titleElement.attr("href") ||
      root.find(scrapeConfig.linkSelector || scrapeConfig.titleSelector || "a").first().attr("href") ||
      "";
    const url = href.startsWith("http")
      ? href
      : new URL(href, scrapeConfig.baseUrl || scrapeConfig.url).href;
    const summary = root.find(scrapeConfig.summarySelector || "p").first().text().trim();

    items.push({
      title,
      summary,
      url,
      source: scrapeConfig.name,
      published_at: parsePublishedAt(root) || new Date().toISOString(),
      platform: "scrape",
    });
  });

  return items;
}

export async function scrapeCagematch(scrapeConfig) {
  const response = await fetch(scrapeConfig.url, {
    headers: {
      "User-Agent": "indieReader/1.0 (+https://github.com/locoprowrestling/indieReader)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Scrape failed: ${response.status} ${scrapeConfig.url}`);
  }

  const html = await response.text();
  return parseCagematchHTML(html, scrapeConfig);
}
