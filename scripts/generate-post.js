import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const DENVER_TIME_ZONE = "America/Denver";
const SYSTEM_PROMPT = `You are an indie wrestling enthusiast writing an editorial column for indieReader, a news site dedicated to independent professional wrestling.

Write flowing narrative prose in Markdown. Do not output bullets, frontmatter, or a title. Start with a strong opening sentence.

Focus on what matters to indie wrestling fans: talent movement, promotion momentum, noteworthy cards, and why the current stories matter to the scene.

Do not discuss WWE, AEW, TNA, ROH, or NJPW unless a story explicitly involves their direct impact on the indie scene.`;

const LOCO_VOICE_DOC_URL = new URL("../config/loco-voice.md", import.meta.url);

export const LOCO_STATIC_BLURB = `\n\n---\n\n*The Friday Colorado edition of indieReader is published by **LoCo Pro Wrestling**, a Longmont-based independent wrestling promotion running out of the historic Dickens Opera House. Upcoming cards, roster, and tickets: [locopro.pw](https://www.locopro.pw/) · [YouTube](https://www.youtube.com/channel/UCf3NpWaiORJKUdBi0GI1u9w).*\n`;

function readLocoVoiceDoc() {
  const locoVoicePath = fileURLToPath(LOCO_VOICE_DOC_URL);
  try {
    return fs.readFileSync(locoVoicePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read LoCo voice doc at ${locoVoicePath}: ${message}. ` +
        `This file is required to generate the Colorado edition.`,
    );
  }
}

export function buildColoradoSystemPrompt(voiceDoc = readLocoVoiceDoc()) {
  return `You are writing the Friday Colorado edition of indieReader, a site published by LoCo Pro Wrestling. You cover the full Colorado indie wrestling scene fairly, but you write as a LoCo-aligned insider — LoCo is not a competitor you describe from outside, it is home.

Write flowing narrative prose in Markdown. Do not output bullets, frontmatter, or a title. Start with a strong opening sentence.

Focus on what matters to Colorado fans: upcoming shows, local promotions (LoCo Pro Wrestling, Rocky Mountain Pro, Primos Premier Wrestling, and other Colorado promotions), talent working the CO scene, venue announcements, and results. Treat upcoming event listings as legitimate news worth covering. Write with the warmth of someone who drives up and down the Front Range to see a show in an opera house, a ballroom, or a high school gym.

LEDE RULE: If the input stories include LoCo-tagged items — any item whose source is @LoCoProWrestlng, @locoprowrestling, the LoCo Pro Wrestling YouTube channel, or any story with "LoCo Pro Wrestling" in the title — lead the column with them.

ALWAYS-ON RULE: Name LoCo Pro Wrestling at least once in the body, even when no LoCo story appears in the input. A footer blurb is appended automatically after your output — do not repeat its contents in your prose.

KAYFABE GUARDRAIL (absolute): Storyline events inside LoCo Pro Wrestling are not real news. Only treat items from the input stories as reportable facts. You may quote or paraphrase a LoCo YouTube video title as "a newly uploaded match" or "a new promo video" — but you must not assert in-universe outcomes (wins, losses, betrayals, championships, faction alignments) as real-world results unless the input story explicitly states so in a real-world voice. When in doubt, describe a LoCo input item as "a new video from LoCo Pro Wrestling" and stop there. Do not invent show dates, results, or roster moves.

## LoCo voice, roster, and lore

${voiceDoc}`;
}

export function assemblePostBody(body, type) {
  if (type === "colorado") {
    return `${body}${LOCO_STATIC_BLURB}`;
  }
  return body;
}

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

export function formatDenverDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DENVER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getPostOutputPath(type, now = new Date()) {
  return path.resolve(`src/content/posts/${formatDenverDate(now)}-${type}.md`);
}

export function getEditionTime(type) {
  if (type === "morning") return "07:00";
  if (type === "colorado") return "12:00";
  return "19:00";
}

export function buildFrontmatter(stories, type, now = new Date()) {
  const date = formatDenverDate(now);
  const time = getEditionTime(type);
  const titleMap = {
    morning: "Indie Wrestling Roundup - Morning Edition",
    evening: "Indie Wrestling Roundup - Evening Edition",
    colorado: "Colorado Indie Wrestling Roundup",
  };
  const title = titleMap[type] ?? "Indie Wrestling Roundup";
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

async function callOpenAI(stories, type) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate a post.");
  }

  const systemPrompt = type === "colorado" ? buildColoradoSystemPrompt() : SYSTEM_PROMPT;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildPrompt(stories) },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generatePost(stories, type) {
  const now = new Date();
  const body = await callOpenAI(stories, type);
  const assembledBody = assemblePostBody(body, type);
  const frontmatter = buildFrontmatter(stories, type, now);
  const outputPath = getPostOutputPath(type, now);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, frontmatter + assembledBody);
  console.log(`Generated post: ${outputPath}`);
  return outputPath;
}
