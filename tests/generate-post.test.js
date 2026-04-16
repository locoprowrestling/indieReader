import { describe, expect, it } from "vitest";
import { buildFrontmatter, yamlScalar } from "../scripts/generate-post.js";

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
    expect(frontmatter).toContain('url: "https://example.com/story?quote=\\"yes\\""');
    expect(frontmatter).toContain('title: "A title: with break"');
  });
});
