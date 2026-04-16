import * as cheerio from "cheerio";

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
      published_at: new Date().toISOString(),
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
