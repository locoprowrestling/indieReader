import { describe, expect, it } from "vitest";
import {
  LOCO_STATIC_BLURB,
  assemblePostBody,
  buildColoradoSystemPrompt,
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

describe("assemblePostBody", () => {
  it("appends the LoCo static blurb to Colorado posts", () => {
    const body = "An editorial body.";
    const result = assemblePostBody(body, "colorado");

    expect(result.startsWith(body)).toBe(true);
    expect(result).toContain("LoCo Pro Wrestling");
    expect(result).toContain("locopro.pw");
    expect(result.endsWith(LOCO_STATIC_BLURB)).toBe(true);
  });

  it("returns body unchanged for morning edition", () => {
    const body = "A morning editorial.";
    expect(assemblePostBody(body, "morning")).toBe(body);
  });

  it("returns body unchanged for evening edition", () => {
    const body = "An evening editorial.";
    expect(assemblePostBody(body, "evening")).toBe(body);
  });
});

describe("buildColoradoSystemPrompt", () => {
  it("includes LoCo-aligned identity, the kayfabe guardrail, and the voice doc", () => {
    const prompt = buildColoradoSystemPrompt();

    expect(prompt).toContain("LoCo Pro Wrestling");
    expect(prompt).toContain("LoCo-aligned insider");
    expect(prompt).toContain("LEDE RULE");
    expect(prompt).toContain("KAYFABE GUARDRAIL");
    expect(prompt).toContain("Dickens Opera House");
  });

  it("forbids acknowledging the absence of LoCo news", () => {
    const prompt = buildColoradoSystemPrompt();

    expect(prompt).toContain("SILENCE-ON-ABSENCE RULE");
    expect(prompt).not.toContain("ALWAYS-ON RULE");
  });

  it("no longer references WrestleSphere or High Plains Wrestling", () => {
    const prompt = buildColoradoSystemPrompt();

    expect(prompt).not.toContain("WrestleSphere");
    expect(prompt).not.toContain("High Plains Wrestling");
  });

  it("inlines the voice doc content passed in", () => {
    const stub = "STUB_VOICE_DOC_CONTENT_12345";
    const prompt = buildColoradoSystemPrompt(stub);

    expect(prompt).toContain(stub);
    expect(prompt).toContain("## LoCo voice, roster, and lore");
  });
});
