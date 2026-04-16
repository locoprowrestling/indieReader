import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are an indie wrestling enthusiast writing an editorial column for indieReader, a news site dedicated to independent professional wrestling.

Write flowing narrative prose in Markdown. Do not output bullets, frontmatter, or a title. Start with a strong opening sentence.

Focus on what matters to indie wrestling fans: talent movement, promotion momentum, noteworthy cards, and why the current stories matter to the scene.

Do not discuss WWE, AEW, TNA, ROH, or NJPW unless a story explicitly involves their direct impact on the indie scene.`;

function buildPrompt(stories) {
  const storyList = stories
    .map(
      (story) =>
        `- ${story.title}\n  Source: ${story.source}\n  Summary: ${story.summary}\n  URL: ${story.url}`,
    )
    .join("\n\n");

  return `Write an indieReader editorial from the following stories:\n\n${storyList}`;
}

export function yamlScalar(value) {
  const normalized = String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .trim();
  return JSON.stringify(normalized);
}

export function buildFrontmatter(stories, type, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Denver",
  });
  const title =
    type === "morning"
      ? "Indie Wrestling Roundup - Morning Edition"
      : "Indie Wrestling Roundup - Evening Edition";
  const sourcesYaml =
    stories.length === 0
      ? "  []"
      : stories
          .map(
            (story) =>
              `  - url: ${yamlScalar(story.url)}\n    title: ${yamlScalar(story.title)}`,
          )
          .join("\n");

  return `---
title: ${yamlScalar(title)}
date: ${yamlScalar(date)}
time: ${yamlScalar(time)}
type: ${yamlScalar(type)}
story_count: ${stories.length}
ai_provider: ${yamlScalar("openai")}
sources:
${sourcesYaml}
---

`;
}

async function callOpenAI(stories) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate a post.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4",
    max_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(stories) },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generatePost(stories, type) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const body = await callOpenAI(stories);
  const frontmatter = buildFrontmatter(stories, type, now);

  const outputPath = path.resolve(`src/content/posts/${date}-${type}.md`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, frontmatter + body);
  console.log(`Generated post: ${outputPath}`);
  return outputPath;
}
