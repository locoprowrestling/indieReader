import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectLocoInSources,
  extractFrontmatterDate,
  extractSourceUrls,
  findMostRecentColoradoPost,
  formatReport,
  parsePost,
} from "../scripts/analyze-voice.js";

// ---------------------------------------------------------------------------
// parsePost
// ---------------------------------------------------------------------------

describe("parsePost", () => {
  it("splits frontmatter from body", () => {
    const content = `---\ntitle: "Test"\ndate: "2026-04-21"\n---\n\nBody text here.`;
    const { frontmatter, body } = parsePost(content);
    expect(frontmatter).toContain('title: "Test"');
    expect(body).toBe("Body text here.");
  });

  it("throws when frontmatter delimiters are missing", () => {
    expect(() => parsePost("No frontmatter at all.")).toThrow(
      "Could not parse post frontmatter.",
    );
  });
});

// ---------------------------------------------------------------------------
// extractFrontmatterDate
// ---------------------------------------------------------------------------

describe("extractFrontmatterDate", () => {
  it("extracts a quoted date", () => {
    expect(extractFrontmatterDate('date: "2026-04-17"')).toBe("2026-04-17");
  });

  it("extracts an unquoted date", () => {
    expect(extractFrontmatterDate("date: 2026-01-01")).toBe("2026-01-01");
  });

  it("returns null when no date field is present", () => {
    expect(extractFrontmatterDate("title: no date here")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractSourceUrls
// ---------------------------------------------------------------------------

describe("extractSourceUrls", () => {
  it("pulls all source URLs from frontmatter", () => {
    const frontmatter = `sources:\n  - url: "https://example.com/a"\n    title: "A"\n  - url: "https://example.com/b"\n    title: "B"`;
    expect(extractSourceUrls(frontmatter)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("returns empty array when no sources are present", () => {
    expect(extractSourceUrls("title: no sources")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectLocoInSources
// ---------------------------------------------------------------------------

describe("detectLocoInSources", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "indiereader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when a source URL matches a LoCo story in the data file", () => {
    const data = [
      {
        title: "Nicky Hyde vs Carter Cash",
        url: "https://www.youtube.com/watch?v=IUkP-Bb3DtE",
        source: "LoCo Pro Wrestling",
        published_at: "2026-04-20T12:15:47Z",
      },
    ];
    fs.writeFileSync(path.join(tmpDir, "news-2026-04-21.json"), JSON.stringify(data));

    const result = detectLocoInSources(
      "2026-04-21",
      ["https://www.youtube.com/watch?v=IUkP-Bb3DtE"],
      tmpDir,
    );
    expect(result).toBe(true);
  });

  it("returns false when matching URL is not from LoCo", () => {
    const data = [
      {
        title: "Some Show",
        url: "https://example.com/show",
        source: "RESPECT Women's Wrestling",
        published_at: "2026-04-21T10:00:00Z",
      },
    ];
    fs.writeFileSync(path.join(tmpDir, "news-2026-04-21.json"), JSON.stringify(data));

    const result = detectLocoInSources(
      "2026-04-21",
      ["https://example.com/show"],
      tmpDir,
    );
    expect(result).toBe(false);
  });

  it("falls back to the previous day's data file", () => {
    const data = [
      {
        title: "LoCo Promo",
        url: "https://www.youtube.com/watch?v=prevday",
        source: "LoCo Pro Wrestling",
        published_at: "2026-04-20T08:00:00Z",
      },
    ];
    fs.writeFileSync(path.join(tmpDir, "news-2026-04-20.json"), JSON.stringify(data));

    const result = detectLocoInSources(
      "2026-04-21",
      ["https://www.youtube.com/watch?v=prevday"],
      tmpDir,
    );
    expect(result).toBe(true);
  });

  it("returns false when no data files exist for the date range", () => {
    const result = detectLocoInSources("2026-04-21", ["https://example.com/x"], tmpDir);
    expect(result).toBe(false);
  });

  it("returns false when postDate is null", () => {
    expect(detectLocoInSources(null, ["https://example.com/x"], tmpDir)).toBe(false);
  });

  it("returns false when sourceUrls is empty", () => {
    expect(detectLocoInSources("2026-04-21", [], tmpDir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findMostRecentColoradoPost
// ---------------------------------------------------------------------------

describe("findMostRecentColoradoPost", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "indiereader-posts-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the alphabetically latest Colorado post", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-10-colorado.md"), "old");
    fs.writeFileSync(path.join(tmpDir, "2026-04-17-colorado.md"), "newer");
    fs.writeFileSync(path.join(tmpDir, "2026-04-17-morning.md"), "not colorado");

    const result = findMostRecentColoradoPost(tmpDir);
    expect(result).toMatch(/2026-04-17-colorado\.md$/);
  });

  it("throws when no Colorado posts exist", () => {
    expect(() => findMostRecentColoradoPost(tmpDir)).toThrow("No Colorado posts found.");
  });
});

// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------

describe("formatReport", () => {
  const baseAnalysis = {
    lede_rule: { applicable: false, pass: false, evidence: "N/A", note: "No LoCo sources." },
    silence_on_absence: {
      applicable: true,
      pass: true,
      evidence: "Post body does not mention LoCo.",
      note: "Correctly silent.",
    },
    kayfabe_guardrail: { pass: true, evidence: "N/A", note: "No storyline claims found." },
    insider_stance: { pass: false, evidence: "they run great shows", note: "Uses third person for LoCo." },
    tone: { pass: true, evidence: "driving up the Front Range", note: "Warm and community-focused." },
    promotion_order: { applicable: false, pass: false, evidence: "N/A", note: "Only one promotion mentioned." },
    no_competitor_hype: { pass: true, evidence: "N/A", note: "No excessive hype detected." },
    overall: { score: 78, summary: "Solid post but insider stance needs work." },
  };

  it("shows N/A for non-applicable checks", () => {
    const report = formatReport(baseAnalysis, "/posts/2026-04-17-colorado.md", false);
    expect(report).toContain("[N/A ] LEDE RULE");
    expect(report).toContain("[N/A ] PROMOTION ORDER");
  });

  it("shows PASS and FAIL for applicable checks", () => {
    const report = formatReport(baseAnalysis, "/posts/2026-04-17-colorado.md", false);
    expect(report).toContain("[PASS] SILENCE ON ABSENCE");
    expect(report).toContain("[FAIL] INSIDER STANCE");
  });

  it("includes notes and evidence", () => {
    const report = formatReport(baseAnalysis, "/posts/2026-04-17-colorado.md", false);
    expect(report).toContain("Correctly silent.");
    expect(report).toContain("Uses third person for LoCo.");
    expect(report).toContain('"they run great shows"');
  });

  it("includes file name, LoCo source status, and overall score", () => {
    const report = formatReport(baseAnalysis, "/posts/2026-04-17-colorado.md", false);
    expect(report).toContain("2026-04-17-colorado.md");
    expect(report).toContain("LoCo sources present: no");
    expect(report).toContain("Overall: 78/100");
    expect(report).toContain("Solid post but insider stance needs work.");
  });

  it("suppresses evidence lines when evidence is N/A", () => {
    const report = formatReport(baseAnalysis, "/posts/test.md", false);
    const evidenceLines = report.split("\n").filter((l) => l.includes('Evidence: "N/A"'));
    expect(evidenceLines).toHaveLength(0);
  });
});
