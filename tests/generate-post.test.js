import { describe, expect, it } from "vitest";
import {
  buildFrontmatter,
  formatDenverDate,
  getEditionTime,
  getPostOutputPath,
  yamlScalar,
} from "../scripts/generate-post.js";

describe("yamlScalar", () => {
  it("quotes and flattens YAML-sensitive strings", () => {
    expect(yamlScalar('Title: "quoted"\nnext line')).toBe("\"Title: \\\"quoted\\\" next line\"");
  });
});

describe("buildFrontmatter", () => {
  it("escapes source titles and urls safely", () => {
    const frontmatter = buildFrontmatter(
      [
        {
          title: "A title:\nwith break",
          url: 'https://example.com/story?quote="yes"',
        },
      ],
      "morning",
      new Date("2026-04-16T12:00:00Z"),
    );

    expect(frontmatter).toContain('title: "Indie Wrestling Roundup - Morning Edition"');
    expect(frontmatter).toContain('type: "morning"');
    expect(frontmatter).toContain('time: "07:00"');
    expect(frontmatter).toContain('url: "https://example.com/story?quote=\\"yes\\""');
    expect(frontmatter).toContain('title: "A title: with break"');
  });

  it("uses the Denver local date after UTC midnight", () => {
    const now = new Date("2026-04-17T01:30:00Z");
    const frontmatter = buildFrontmatter([], "evening", now);

    expect(formatDenverDate(now)).toBe("2026-04-16");
    expect(getEditionTime("evening")).toBe("19:00");
    expect(frontmatter).toContain('date: "2026-04-16"');
    expect(frontmatter).toContain('time: "19:00"');
    expect(getPostOutputPath("evening", now)).toMatch(/2026-04-16-evening\.md$/);
  });
});
