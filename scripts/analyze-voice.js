import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const LOCO_VOICE_DOC_URL = new URL("../config/loco-voice.md", import.meta.url);
const POSTS_DIR = fileURLToPath(new URL("../src/content/posts/", import.meta.url));
const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const LOCO_SOURCE_NAME = "LoCo Pro Wrestling";

function readLocoVoiceDoc() {
  return fs.readFileSync(fileURLToPath(LOCO_VOICE_DOC_URL), "utf8");
}

export function parsePost(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
  if (!match) throw new Error("Could not parse post frontmatter.");
  return { frontmatter: match[1], body: match[2] };
}

export function extractFrontmatterDate(frontmatter) {
  const match = frontmatter.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  return match ? match[1] : null;
}

export function extractSourceUrls(frontmatter) {
  const urls = [];
  const regex = /^\s+- url:\s*"([^"]+)"/gm;
  let match;
  while ((match = regex.exec(frontmatter)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

export function detectLocoInSources(postDate, sourceUrls, dataDir = DATA_DIR) {
  if (!postDate || sourceUrls.length === 0) return false;
  const prevDate = new Date(new Date(postDate).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const sourceUrlSet = new Set(sourceUrls);

  for (const date of [postDate, prevDate]) {
    const dataFile = path.join(dataDir, `news-${date}.json`);
    if (!fs.existsSync(dataFile)) continue;
    try {
      const stories = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      if (stories.some((s) => sourceUrlSet.has(s.url) && s.source === LOCO_SOURCE_NAME)) {
        return true;
      }
    } catch {
      // ignore unreadable data files
    }
  }
  return false;
}

export function findMostRecentColoradoPost(postsDir = POSTS_DIR) {
  const files = fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith("-colorado.md"))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error("No Colorado posts found.");
  return path.join(postsDir, files[0]);
}

async function callOpenAI(body, hasLoco, voiceDoc) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are an editor reviewing a Colorado indie wrestling post for adherence to narrator voice guidelines.

## LoCo Narrator Voice Guidelines

${voiceDoc}

## Evaluation task

The post ${hasLoco ? "DOES" : "does NOT"} have LoCo Pro Wrestling stories in its source list.

Evaluate the post body against each guideline. Return a JSON object with these fields:

- lede_rule: { applicable (true only when hasLoco=true), pass, evidence (short quote or "N/A"), note }
- silence_on_absence: { applicable (true only when hasLoco=false), pass, evidence, note }
- kayfabe_guardrail: { pass, evidence, note }
- insider_stance: { pass, evidence, note }  (correct use of "we"/"our" for LoCo, third person for others)
- tone: { pass, evidence, note }  (warm, defiant, folk-hero, community-focused)
- promotion_order: { applicable (true if 2+ CO promotions listed), pass, evidence, note }
- no_competitor_hype: { pass, evidence, note }
- overall: { score (0-100), summary }`;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Post body:\n\n${body}` },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

export function formatReport(analysis, filePath, hasLoco) {
  const lines = [
    `Voice Analysis: ${path.basename(filePath)}`,
    `LoCo sources present: ${hasLoco ? "yes" : "no"}`,
    "",
  ];

  const checks = [
    ["LEDE RULE", analysis.lede_rule],
    ["SILENCE ON ABSENCE", analysis.silence_on_absence],
    ["KAYFABE GUARDRAIL", analysis.kayfabe_guardrail],
    ["INSIDER STANCE", analysis.insider_stance],
    ["TONE", analysis.tone],
    ["PROMOTION ORDER", analysis.promotion_order],
    ["NO COMPETITOR HYPE", analysis.no_competitor_hype],
  ];

  for (const [label, check] of checks) {
    if (!check) continue;
    if (check.applicable === false) {
      lines.push(`[N/A ] ${label}`);
    } else {
      lines.push(`[${check.pass ? "PASS" : "FAIL"}] ${label}`);
    }
    if (check.note) lines.push(`       ${check.note}`);
    if (check.evidence && check.evidence !== "N/A") {
      lines.push(`       Evidence: "${check.evidence}"`);
    }
    lines.push("");
  }

  if (analysis.overall) {
    lines.push(`Overall: ${analysis.overall.score}/100`);
    lines.push(analysis.overall.summary);
  }

  return lines.join("\n");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to analyze narrator voice.");
  }

  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : findMostRecentColoradoPost();

  console.log(`Analyzing: ${path.basename(filePath)}\n`);

  const content = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parsePost(content);
  const postDate = extractFrontmatterDate(frontmatter);
  const sourceUrls = extractSourceUrls(frontmatter);
  const hasLoco = detectLocoInSources(postDate, sourceUrls);
  const voiceDoc = readLocoVoiceDoc();

  const analysis = await callOpenAI(body, hasLoco, voiceDoc);
  console.log(formatReport(analysis, filePath, hasLoco));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
