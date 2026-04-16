import { describe, expect, it } from "vitest";
import { parseCagematchHTML } from "../scripts/fetch-scrape.js";

const scrapeConfig = {
  name: "Cagematch",
  url: "https://www.cagematch.net/?id=10",
  selector: ".news-item",
  titleSelector: ".news-title a",
  summarySelector: ".news-text",
  linkSelector: ".news-title a",
  baseUrl: "https://www.cagematch.net",
};

describe("parseCagematchHTML", () => {
  it("parses stories and resolves relative links", () => {
    const html = `
      <div class="news-item">
        <div class="news-title"><a href="/?id=123">GCW books title match</a></div>
        <time datetime="2026-04-15T09:30:00Z"></time>
        <div class="news-text">The promotion set the main event.</div>
      </div>
      <div class="news-item">
        <div class="news-title"><a href="https://example.com/full-story">Absolute link story</a></div>
        <div class="news-text">Already absolute.</div>
      </div>
      <div class="news-item">
        <div class="news-title"><a href="/?id=999"></a></div>
        <div class="news-text">Missing title should be skipped.</div>
      </div>
    `;

    const stories = parseCagematchHTML(html, scrapeConfig);

    expect(stories).toHaveLength(2);
    expect(stories[0]).toMatchObject({
      title: "GCW books title match",
      summary: "The promotion set the main event.",
      url: "https://www.cagematch.net/?id=123",
      source: "Cagematch",
      published_at: "2026-04-15T09:30:00.000Z",
      platform: "scrape",
    });
    expect(stories[1].url).toBe("https://example.com/full-story");
    expect(Number.isNaN(Date.parse(stories[0].published_at))).toBe(false);
  });
});
