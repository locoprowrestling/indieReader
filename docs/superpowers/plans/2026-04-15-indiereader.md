# indieReader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Astro site that aggregates indie wrestling news via GitHub Actions, displays it in a tabbed UI, and publishes AI-generated editorial blog posts twice daily to GitHub Pages.

**Architecture:** GitHub Actions runs on a cron schedule to fetch RSS feeds, scrape Cagematch, and pull social media posts — filtering out mainstream wrestling (WWE/AEW/TNA/ROH/NJPW unless crossover). A morning and evening workflow calls Claude or OpenAI to generate a narrative blog post from accumulated stories and commits it as Markdown. Astro builds the static site from those files and deploys to GitHub Pages on every push.

**Tech Stack:** Astro 4 (static SSG), Node.js 20, Vitest, rss-parser, cheerio, twitter-api-v2, @anthropic-ai/sdk, openai, GitHub Actions, GitHub Pages

---

## File Map

```
indieReader/
├── .github/workflows/
│   ├── deploy.yml           # builds + deploys to gh-pages on push to main
│   ├── fetch.yml            # runs every 3h: fetch all sources → data/
│   ├── morning.yml          # 13:00 UTC: generate morning post
│   └── evening.yml          # 00:00 UTC: generate evening post or set carry-over
├── config/
│   └── sources.json         # all source URLs, handles, blocklist, thresholds
├── data/
│   ├── state.json           # last_post_time, stories_since_last_post, carry_over
│   └── news-YYYY-MM-DD.json # daily news files (committed)
├── scripts/
│   ├── filter.js            # isIndieStory(), filterStories()
│   ├── dedupe.js            # storyId(), dedupeStories()
│   ├── state.js             # readState(), writeState(), incrementStoriesCount(), resetAfterPost(), setCarryOver()
│   ├── fetch-rss.js         # fetchRSSFeed(url) → Story[]
│   ├── fetch-scrape.js      # scrapeCagematch(config) → Story[]
│   ├── fetch-social.js      # fetchTwitter(), fetchYouTube(), fetchFacebook(), fetchInstagram()
│   ├── fetch.js             # CLI: orchestrates all fetching, writes data/news-*.json
│   ├── generate-post.js     # generatePost(stories, type) → writes src/content/posts/*.md
│   └── run-generate.js      # CLI: gathers stories, checks threshold, calls generatePost
├── src/
│   ├── content/
│   │   ├── config.ts        # Astro content collection schema for posts
│   │   └── posts/           # generated .md blog posts land here
│   ├── layouts/
│   │   └── BaseLayout.astro # <html>, <head>, global CSS
│   ├── components/
│   │   ├── Tabs.astro       # tab nav: News / Blog Post / Archive
│   │   ├── NewsFeed.astro   # list of story cards for a given date
│   │   ├── BlogPost.astro   # renders a single post's Markdown body
│   │   └── Archive.astro    # sorted list of past posts with links
│   └── pages/
│       ├── index.astro      # News tab (default page)
│       ├── blog.astro       # Blog Post tab (latest post)
│       └── archive.astro    # Archive tab
├── tests/
│   ├── filter.test.js
│   ├── dedupe.test.js
│   ├── state.test.js
│   └── fetch-rss.test.js
├── astro.config.mjs
├── package.json
└── .gitignore
```

---

## Phase 1 — Astro Scaffold + UI

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `.gitignore`

- [ ] **Step 1: Scaffold Astro in the project directory**

```bash
cd /Users/gecko1/Projects/indieReader
npm create astro@latest . -- --template minimal --typescript strict --install --no-git
```

When prompted, accept all defaults. Select TypeScript: `strict`.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install rss-parser cheerio twitter-api-v2 @anthropic-ai/sdk openai
npm install --save-dev vitest
```

- [ ] **Step 3: Update `package.json` scripts section**

Open `package.json` and replace the `scripts` block with:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "fetch": "node scripts/fetch.js",
  "generate": "node scripts/run-generate.js"
}
```

- [ ] **Step 4: Add `"type": "module"` to `package.json`**

Add `"type": "module"` as a top-level field so all `.js` scripts use ESM:

```json
{
  "type": "module",
  ...
}
```

- [ ] **Step 5: Replace `astro.config.mjs` with GitHub Pages config**

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://YOUR_GITHUB_USERNAME.github.io',
  base: '/indieReader',
  output: 'static',
});
```

Replace `YOUR_GITHUB_USERNAME` with the actual GitHub username before first deploy.

- [ ] **Step 6: Replace `.gitignore`**

```
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
.DS_Store
.superpowers/
```

- [ ] **Step 7: Add Vitest config to `package.json`**

Add this block to `package.json`:

```json
"vitest": {
  "environment": "node"
}
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: initialize Astro project with dependencies"
```

---

### Task 2: Base layout and global styles

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Delete: `src/pages/index.astro` (replace in Task 4)

- [ ] **Step 1: Create `src/layouts/BaseLayout.astro`**

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title?: string;
}
const { title = 'indieReader' } = Astro.props;
const base = import.meta.env.BASE_URL;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title} | indieReader</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #0f0f0f;
        color: #e8e8e8;
        min-height: 100vh;
      }

      header {
        background: #1a1a1a;
        border-bottom: 2px solid #e94560;
        padding: 1rem 1.5rem;
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      header h1 {
        font-size: 1.4rem;
        font-weight: 700;
        color: #e94560;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      header .tagline {
        font-size: 0.8rem;
        color: #888;
      }

      main {
        max-width: 900px;
        margin: 0 auto;
        padding: 1.5rem;
      }

      nav.tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid #333;
        margin-bottom: 1.5rem;
      }

      nav.tabs a {
        padding: 0.6rem 1.2rem;
        text-decoration: none;
        color: #888;
        font-size: 0.9rem;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: color 0.15s;
      }

      nav.tabs a:hover { color: #e8e8e8; }

      nav.tabs a.active {
        color: #e94560;
        border-bottom-color: #e94560;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>⚡ indieReader</h1>
      <span class="tagline">Indie wrestling news, daily</span>
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/
git commit -m "feat: add BaseLayout with global styles"
```

---

### Task 3: Tabs component

**Files:**
- Create: `src/components/Tabs.astro`

- [ ] **Step 1: Create `src/components/Tabs.astro`**

```astro
---
// src/components/Tabs.astro
interface Props {
  active: 'news' | 'blog' | 'archive';
}
const { active } = Astro.props;
const base = import.meta.env.BASE_URL;
---
<nav class="tabs">
  <a href={base} class={active === 'news' ? 'active' : ''}>News</a>
  <a href={`${base}blog`} class={active === 'blog' ? 'active' : ''}>Blog Post</a>
  <a href={`${base}archive`} class={active === 'archive' ? 'active' : ''}>Archive</a>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Tabs.astro
git commit -m "feat: add Tabs navigation component"
```

---

### Task 4: NewsFeed component + fixture data

**Files:**
- Create: `src/components/NewsFeed.astro`
- Create: `data/fixture-news.json`
- Create: `src/pages/index.astro`

- [ ] **Step 1: Create `data/fixture-news.json`** (used during local dev)

```json
[
  {
    "id": "abc123",
    "title": "GCW announces Spring Fling card with 12 matches",
    "summary": "Game Changer Wrestling has revealed the full card for Spring Fling, featuring top indie talent from across North America.",
    "url": "https://example.com/gcw-spring-fling",
    "source": "Fightful",
    "published_at": "2026-04-15T10:00:00Z",
    "platform": "rss"
  },
  {
    "id": "def456",
    "title": "MLW signs three new talent to developmental deals",
    "summary": "Major League Wrestling has inked three rising indie stars to developmental contracts ahead of their summer TV tapings.",
    "url": "https://example.com/mlw-signings",
    "source": "PWInsider",
    "published_at": "2026-04-15T08:30:00Z",
    "platform": "rss"
  },
  {
    "id": "ghi789",
    "title": "Defy Wrestling returns to Seattle with stacked card",
    "summary": "Pacific Northwest favorite Defy Wrestling has announced their return to Seattle's Showbox venue with a card headlined by indie veterans.",
    "url": "https://example.com/defy-seattle",
    "source": "Cagematch",
    "published_at": "2026-04-15T07:00:00Z",
    "platform": "scrape"
  }
]
```

- [ ] **Step 2: Create `src/components/NewsFeed.astro`**

```astro
---
// src/components/NewsFeed.astro
interface Story {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  platform: string;
}

interface Props {
  stories: Story[];
}

const { stories } = Astro.props;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Denver',
  });
}

const platformIcon: Record<string, string> = {
  rss: '📡',
  scrape: '🕷️',
  twitter: '🐦',
  facebook: '👥',
  instagram: '📸',
  youtube: '▶️',
};
---
<style>
  .feed { display: flex; flex-direction: column; gap: 1rem; }

  .story {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 6px;
    padding: 1rem;
    transition: border-color 0.15s;
  }

  .story:hover { border-color: #e94560; }

  .story-meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.4rem;
    font-size: 0.75rem;
    color: #888;
  }

  .source-badge {
    background: #2a2a2a;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .story h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }

  .story h3 a {
    color: #e8e8e8;
    text-decoration: none;
  }

  .story h3 a:hover { color: #e94560; }

  .story p {
    font-size: 0.875rem;
    color: #aaa;
    line-height: 1.5;
  }

  .empty {
    text-align: center;
    color: #555;
    padding: 3rem;
    font-style: italic;
  }
</style>

{stories.length === 0 ? (
  <p class="empty">No stories fetched yet. Check back soon.</p>
) : (
  <div class="feed">
    {stories.map(story => (
      <article class="story">
        <div class="story-meta">
          <span>{platformIcon[story.platform] ?? '📰'}</span>
          <span class="source-badge">{story.source}</span>
          <span>{formatTime(story.published_at)} MT</span>
        </div>
        <h3><a href={story.url} target="_blank" rel="noopener">{story.title}</a></h3>
        <p>{story.summary}</p>
      </article>
    ))}
  </div>
)}
```

- [ ] **Step 3: Create `src/pages/index.astro`**

```astro
---
// src/pages/index.astro
import BaseLayout from '../layouts/BaseLayout.astro';
import Tabs from '../components/Tabs.astro';
import NewsFeed from '../components/NewsFeed.astro';
import fs from 'node:fs';
import path from 'node:path';

const today = new Date().toISOString().slice(0, 10);
const dataPath = path.resolve(`data/news-${today}.json`);
const fixturePath = path.resolve('data/fixture-news.json');

let stories = [];
if (fs.existsSync(dataPath)) {
  stories = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
} else if (fs.existsSync(fixturePath)) {
  stories = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

// Sort newest first
stories.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
---
<BaseLayout title="News">
  <Tabs active="news" />
  <h2 style="font-size:1rem; color:#888; margin-bottom:1rem;">
    {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric', timeZone:'America/Denver' })}
  </h2>
  <NewsFeed stories={stories} />
</BaseLayout>
```

- [ ] **Step 4: Run dev server to verify**

```bash
npm run dev
```

Expected: Browser shows indieReader header, three tabs (News active), three fixture news cards.

- [ ] **Step 5: Commit**

```bash
git add data/fixture-news.json src/components/NewsFeed.astro src/pages/index.astro
git commit -m "feat: news feed page with fixture data"
```

---

### Task 5: Astro content collection for blog posts

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/posts/2026-04-15-morning.md` (fixture post)

- [ ] **Step 1: Create `src/content/config.ts`**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    time: z.string(),
    type: z.enum(['morning', 'evening']),
    story_count: z.number(),
    ai_provider: z.string(),
    sources: z.array(z.object({
      url: z.string(),
      title: z.string(),
    })),
  }),
});

export const collections = { posts };
```

- [ ] **Step 2: Create `src/content/posts/2026-04-15-morning.md`** (fixture post for local dev)

```markdown
---
title: "Indie Wrestling Roundup — Morning Edition"
date: 2026-04-15
time: "07:00"
type: morning
story_count: 3
ai_provider: claude
sources:
  - url: "https://example.com/gcw-spring-fling"
    title: "GCW announces Spring Fling card with 12 matches"
  - url: "https://example.com/mlw-signings"
    title: "MLW signs three new talent to developmental deals"
  - url: "https://example.com/defy-seattle"
    title: "Defy Wrestling returns to Seattle with stacked card"
---

The indie wrestling scene is buzzing this Tuesday morning, and if you're not paying attention, you're going to miss something special.

Game Changer Wrestling continues to be the gold standard for chaotic, beautiful independent wrestling, and their Spring Fling card is shaping up to be exactly what fans have come to expect from Joey Janela's brainchild promotion — twelve matches of carefully curated carnage that puts mainstream TV tapings to shame.

Meanwhile, MLW is doing what the majors rarely do: investing in talent before they blow up. Signing three rising indie stars to developmental deals is a vote of confidence in the grassroots scene, and it signals that the promotion is serious about building something sustainable rather than just raiding the indie ranks after others do the work.

And then there's Defy Wrestling, the Pacific Northwest's finest, returning to Seattle's Showbox. If you've never been to a Defy show, you're missing one of the most intimate and electric atmospheres in all of wrestling. These are the shows that remind you why independent wrestling matters.
```

- [ ] **Step 3: Commit**

```bash
git add src/content/
git commit -m "feat: Astro content collection for blog posts with fixture post"
```

---

### Task 6: BlogPost component and blog page

**Files:**
- Create: `src/components/BlogPost.astro`
- Create: `src/pages/blog.astro`

- [ ] **Step 1: Create `src/components/BlogPost.astro`**

```astro
---
// src/components/BlogPost.astro
interface Props {
  title: string;
  date: Date;
  time: string;
  type: 'morning' | 'evening';
  story_count: number;
  ai_provider: string;
  body: string;
}

const { title, date, time, type, story_count, ai_provider, body } = Astro.props;

const dateStr = date.toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  timeZone: 'America/Denver',
});

const editionLabel = type === 'morning' ? '🌅 Morning Edition' : '🌆 Evening Edition';
---
<style>
  .post-header { margin-bottom: 1.5rem; border-bottom: 1px solid #2a2a2a; padding-bottom: 1rem; }
  .post-header h2 { font-size: 1.4rem; margin-bottom: 0.4rem; }
  .post-meta { font-size: 0.8rem; color: #888; display: flex; gap: 1rem; flex-wrap: wrap; }
  .edition { color: #e94560; font-weight: 600; }
  .post-body { line-height: 1.8; font-size: 0.95rem; color: #ccc; }
  .post-body p { margin-bottom: 1rem; }
  .post-body h2, .post-body h3 { color: #e8e8e8; margin: 1.5rem 0 0.5rem; }
</style>

<article>
  <div class="post-header">
    <h2>{title}</h2>
    <div class="post-meta">
      <span class="edition">{editionLabel}</span>
      <span>{dateStr} · {time} MT</span>
      <span>{story_count} stories · {ai_provider}</span>
    </div>
  </div>
  <div class="post-body" set:html={body} />
</article>
```

- [ ] **Step 2: Create `src/pages/blog.astro`**

```astro
---
// src/pages/blog.astro
import BaseLayout from '../layouts/BaseLayout.astro';
import Tabs from '../components/Tabs.astro';
import BlogPost from '../components/BlogPost.astro';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

const posts = await getCollection('posts');
posts.sort((a, b) => {
  const dateDiff = b.data.date.getTime() - a.data.date.getTime();
  if (dateDiff !== 0) return dateDiff;
  // evening after morning on same day
  return a.data.type === 'morning' ? 1 : -1;
});

const latest = posts[0];
const body = latest ? marked(latest.body ?? '') : '';
---
<BaseLayout title="Blog Post">
  <Tabs active="blog" />
  {latest ? (
    <BlogPost
      title={latest.data.title}
      date={latest.data.date}
      time={latest.data.time}
      type={latest.data.type}
      story_count={latest.data.story_count}
      ai_provider={latest.data.ai_provider}
      body={body}
    />
  ) : (
    <p style="color:#555; text-align:center; padding:3rem; font-style:italic;">
      No blog posts yet. Check back after the morning run.
    </p>
  )}
</BaseLayout>
```

- [ ] **Step 3: Install marked** (for Markdown-to-HTML in the blog page)

```bash
npm install marked
```

- [ ] **Step 4: Run dev and verify blog tab**

```bash
npm run dev
```

Navigate to `http://localhost:4321/indieReader/blog`. Expected: fixture post rendered with header, edition badge, and formatted body.

- [ ] **Step 5: Commit**

```bash
git add src/components/BlogPost.astro src/pages/blog.astro package.json package-lock.json
git commit -m "feat: blog post page showing latest generated post"
```

---

### Task 7: Archive component and page

**Files:**
- Create: `src/components/Archive.astro`
- Create: `src/pages/archive.astro`

- [ ] **Step 1: Create `src/components/Archive.astro`**

```astro
---
// src/components/Archive.astro
import type { CollectionEntry } from 'astro:content';

interface Props {
  posts: CollectionEntry<'posts'>[];
}

const { posts } = Astro.props;
const base = import.meta.env.BASE_URL;

// Group by date
const grouped = posts.reduce((acc, post) => {
  const dateKey = post.data.date.toISOString().slice(0, 10);
  if (!acc[dateKey]) acc[dateKey] = [];
  acc[dateKey].push(post);
  return acc;
}, {} as Record<string, typeof posts>);

const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
---
<style>
  .archive-day { margin-bottom: 1.5rem; }
  .archive-day h3 { font-size: 0.85rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; border-bottom: 1px solid #2a2a2a; padding-bottom: 0.3rem; }
  .post-link { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; text-decoration: none; color: #ccc; font-size: 0.9rem; transition: color 0.15s; }
  .post-link:hover { color: #e94560; }
  .edition-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .morning { background: #f5a623; }
  .evening { background: #4a9eff; }
  .post-meta { font-size: 0.75rem; color: #555; margin-left: auto; }
  .empty { text-align: center; color: #555; padding: 3rem; font-style: italic; }
</style>

{sortedDates.length === 0 ? (
  <p class="empty">No posts in the archive yet.</p>
) : (
  sortedDates.map(dateKey => (
    <div class="archive-day">
      <h3>{new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</h3>
      {grouped[dateKey]
        .sort((a, b) => a.data.type === 'morning' ? -1 : 1)
        .map(post => (
          <a class="post-link" href={`${base}posts/${post.slug}`}>
            <span class={`edition-dot ${post.data.type}`}></span>
            <span>{post.data.title}</span>
            <span class="post-meta">{post.data.story_count} stories · {post.data.ai_provider}</span>
          </a>
        ))
      }
    </div>
  ))
)}
```

- [ ] **Step 2: Create `src/pages/archive.astro`**

```astro
---
// src/pages/archive.astro
import BaseLayout from '../layouts/BaseLayout.astro';
import Tabs from '../components/Tabs.astro';
import Archive from '../components/Archive.astro';
import { getCollection } from 'astro:content';

const posts = await getCollection('posts');
posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
---
<BaseLayout title="Archive">
  <Tabs active="archive" />
  <Archive posts={posts} />
</BaseLayout>
```

- [ ] **Step 3: Create individual post pages at `src/pages/posts/[slug].astro`**

```astro
---
// src/pages/posts/[slug].astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import BlogPost from '../../components/BlogPost.astro';
import { getCollection, getEntry } from 'astro:content';
import { marked } from 'marked';

export async function getStaticPaths() {
  const posts = await getCollection('posts');
  return posts.map(post => ({ params: { slug: post.slug }, props: { post } }));
}

const { post } = Astro.props;
const body = marked(post.body ?? '');
---
<BaseLayout title={post.data.title}>
  <BlogPost
    title={post.data.title}
    date={post.data.date}
    time={post.data.time}
    type={post.data.type}
    story_count={post.data.story_count}
    ai_provider={post.data.ai_provider}
    body={body}
  />
</BaseLayout>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build completes with no errors. `dist/` contains static HTML files.

- [ ] **Step 5: Commit**

```bash
git add src/components/Archive.astro src/pages/archive.astro src/pages/posts/
git commit -m "feat: archive page and individual post pages"
```

---

### Task 8: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Push to GitHub to trigger first deploy**

First, create the GitHub repo (if not done yet):

```bash
gh repo create indieReader --public --source=. --remote=origin --push
```

Then enable GitHub Pages in the repo Settings → Pages → Source: GitHub Actions.

- [ ] **Step 3: Verify deployment**

```bash
gh run watch
```

Expected: Deploy workflow completes. Site is live at `https://YOUR_USERNAME.github.io/indieReader`.

- [ ] **Step 4: Commit workflow file if not already pushed**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: add GitHub Pages deploy workflow"
git push
```

---

## Phase 2 — Filter, Dedupe, and State Scripts

### Task 9: Source configuration file

**Files:**
- Create: `config/sources.json`

- [ ] **Step 1: Create `config/sources.json`**

```json
{
  "rss": [
    "https://www.pwinsider.com/rss.php",
    "https://www.fightful.com/wrestling/rss.xml",
    "https://www.f4wonline.com/rss.xml"
  ],
  "scrape": [
    {
      "name": "Cagematch",
      "url": "https://www.cagematch.net/?id=10",
      "selector": ".news-item",
      "titleSelector": ".news-title a",
      "summarySelector": ".news-text",
      "linkSelector": ".news-title a",
      "baseUrl": "https://www.cagematch.net"
    }
  ],
  "social_allowlist": {
    "twitter": [],
    "youtube": [],
    "facebook": [],
    "instagram": []
  },
  "blocklist": [
    "WWE", "NXT", "RAW", "SmackDown", "WrestleMania", "SummerSlam",
    "AEW", "All Elite Wrestling",
    "TNA", "Impact Wrestling",
    "ROH", "Ring of Honor",
    "NJPW", "New Japan Pro-Wrestling", "New Japan"
  ],
  "crossover_signals": [
    "ID program", "WWE ID",
    "indie", "independent",
    "partnership", "co-promotion",
    "developmental deal", "local promotion",
    "open contract", "free agent"
  ],
  "min_stories_for_post": 5
}
```

**Note:** Cagematch selectors (`.news-item`, `.news-title`, `.news-text`) must be verified by inspecting Cagematch's actual HTML. Update `selector`, `titleSelector`, and `summarySelector` accordingly after verification.

- [ ] **Step 2: Commit**

```bash
git add config/sources.json
git commit -m "chore: add source configuration file"
```

---

### Task 10: Content filter module

**Files:**
- Create: `scripts/filter.js`
- Create: `tests/filter.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/filter.test.js
import { describe, it, expect } from 'vitest';
import { isIndieStory, filterStories } from '../scripts/filter.js';

describe('isIndieStory', () => {
  it('keeps a pure indie story', () => {
    const story = { title: 'GCW announces Spring Fling', summary: 'Game Changer Wrestling returns.' };
    expect(isIndieStory(story)).toBe(true);
  });

  it('drops a mainstream WWE story', () => {
    const story = { title: 'WWE signs new deal', summary: 'World Wrestling Entertainment expands.' };
    expect(isIndieStory(story)).toBe(false);
  });

  it('drops an AEW story', () => {
    const story = { title: 'AEW Dynamite results', summary: 'All Elite Wrestling recap.' };
    expect(isIndieStory(story)).toBe(false);
  });

  it('drops an NJPW story', () => {
    const story = { title: 'New Japan announces tour', summary: 'NJPW returns to the US.' };
    expect(isIndieStory(story)).toBe(false);
  });

  it('keeps a WWE crossover story (ID program)', () => {
    const story = { title: 'Local indie star signs WWE ID program deal', summary: 'Independent wrestler joins WWE ID.' };
    expect(isIndieStory(story)).toBe(true);
  });

  it('keeps an AEW crossover story (partnership)', () => {
    const story = { title: 'AEW announces partnership with indie promotion', summary: 'Co-promotion deal with indie group.' };
    expect(isIndieStory(story)).toBe(true);
  });

  it('is case-insensitive for blocklist', () => {
    const story = { title: 'wwe news', summary: 'wwe smackdown results' };
    expect(isIndieStory(story)).toBe(false);
  });
});

describe('filterStories', () => {
  it('removes mainstream stories from array', () => {
    const stories = [
      { title: 'GCW Spring Fling', summary: 'Indie show announced.' },
      { title: 'WWE RAW results', summary: 'WWE Monday night recap.' },
      { title: 'MLW announces card', summary: 'Major League Wrestling card set.' },
    ];
    const result = filterStories(stories);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('GCW Spring Fling');
    expect(result[1].title).toBe('MLW announces card');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/filter.test.js
```

Expected: FAIL — `Cannot find module '../scripts/filter.js'`

- [ ] **Step 3: Create `scripts/filter.js`**

```javascript
// scripts/filter.js
import config from '../config/sources.json' assert { type: 'json' };

export function isIndieStory(story) {
  const text = `${story.title} ${story.summary}`.toLowerCase();

  const isBlocked = config.blocklist.some(term =>
    text.includes(term.toLowerCase())
  );

  if (!isBlocked) return true;

  const hasCrossover = config.crossover_signals.some(signal =>
    text.includes(signal.toLowerCase())
  );

  return hasCrossover;
}

export function filterStories(stories) {
  return stories.filter(isIndieStory);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/filter.test.js
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/filter.js tests/filter.test.js
git commit -m "feat: content filter with indie/mainstream logic"
```

---

### Task 11: Deduplication module

**Files:**
- Create: `scripts/dedupe.js`
- Create: `tests/dedupe.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/dedupe.test.js
import { describe, it, expect } from 'vitest';
import { storyId, dedupeStories } from '../scripts/dedupe.js';

describe('storyId', () => {
  it('returns same hash for same URL', () => {
    const story = { url: 'https://example.com/story-1', title: 'Story 1' };
    expect(storyId(story)).toBe(storyId(story));
  });

  it('returns different hash for different URL', () => {
    const a = { url: 'https://example.com/story-1', title: 'A' };
    const b = { url: 'https://example.com/story-2', title: 'B' };
    expect(storyId(a)).not.toBe(storyId(b));
  });

  it('falls back to title hash when url is empty', () => {
    const story = { url: '', title: 'Unique Title Here' };
    const id = storyId(story);
    expect(id).toBeTruthy();
    expect(id).toHaveLength(32); // MD5 hex
  });
});

describe('dedupeStories', () => {
  it('removes stories whose IDs are in the existing set', () => {
    const existing = ['abc123'];
    const stories = [
      { id: 'abc123', title: 'Already seen' },
      { id: 'def456', title: 'New story' },
    ];
    const result = dedupeStories(stories, existing);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('def456');
  });

  it('removes duplicates within the new batch itself', () => {
    const stories = [
      { id: 'aaa', title: 'Story A' },
      { id: 'aaa', title: 'Story A duplicate' },
      { id: 'bbb', title: 'Story B' },
    ];
    const result = dedupeStories(stories, []);
    expect(result).toHaveLength(2);
  });

  it('returns all stories when existingIds is empty', () => {
    const stories = [
      { id: 'x1', title: 'One' },
      { id: 'x2', title: 'Two' },
    ];
    expect(dedupeStories(stories, [])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/dedupe.test.js
```

Expected: FAIL — `Cannot find module '../scripts/dedupe.js'`

- [ ] **Step 3: Create `scripts/dedupe.js`**

```javascript
// scripts/dedupe.js
import { createHash } from 'crypto';

export function storyId(story) {
  const key = story.url || story.title;
  return createHash('md5').update(key).digest('hex');
}

export function dedupeStories(newStories, existingIds) {
  const seen = new Set(existingIds);
  return newStories.filter(story => {
    const id = story.id || storyId(story);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/dedupe.test.js
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/dedupe.js tests/dedupe.test.js
git commit -m "feat: story deduplication module"
```

---

### Task 12: State management module

**Files:**
- Create: `scripts/state.js`
- Create: `tests/state.test.js`
- Create: `data/.gitkeep`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/state.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readState, writeState, incrementStoriesCount, resetAfterPost, setCarryOver } from '../scripts/state.js';

const TEST_STATE_PATH = path.resolve('data/test-state.json');

// Override STATE_PATH via env var for tests
process.env.STATE_PATH = TEST_STATE_PATH;

beforeEach(() => {
  if (fs.existsSync(TEST_STATE_PATH)) fs.unlinkSync(TEST_STATE_PATH);
});

afterEach(() => {
  if (fs.existsSync(TEST_STATE_PATH)) fs.unlinkSync(TEST_STATE_PATH);
});

describe('readState', () => {
  it('returns default state when file does not exist', () => {
    const state = readState();
    expect(state.last_post_time).toBeNull();
    expect(state.stories_since_last_post).toBe(0);
    expect(state.carry_over).toBe(false);
  });

  it('reads existing state from file', () => {
    fs.writeFileSync(TEST_STATE_PATH, JSON.stringify({ last_post_time: '2026-04-15T07:00:00Z', stories_since_last_post: 7, carry_over: false }));
    const state = readState();
    expect(state.stories_since_last_post).toBe(7);
  });
});

describe('incrementStoriesCount', () => {
  it('increments by 1 by default', () => {
    incrementStoriesCount();
    expect(readState().stories_since_last_post).toBe(1);
  });

  it('increments by given amount', () => {
    incrementStoriesCount(5);
    incrementStoriesCount(3);
    expect(readState().stories_since_last_post).toBe(8);
  });
});

describe('resetAfterPost', () => {
  it('resets counter and carry_over, sets last_post_time', () => {
    writeState({ last_post_time: null, stories_since_last_post: 12, carry_over: true });
    resetAfterPost('2026-04-15T13:00:00Z');
    const state = readState();
    expect(state.stories_since_last_post).toBe(0);
    expect(state.carry_over).toBe(false);
    expect(state.last_post_time).toBe('2026-04-15T13:00:00Z');
  });
});

describe('setCarryOver', () => {
  it('sets carry_over to true without touching other fields', () => {
    writeState({ last_post_time: '2026-04-14T13:00:00Z', stories_since_last_post: 3, carry_over: false });
    setCarryOver();
    const state = readState();
    expect(state.carry_over).toBe(true);
    expect(state.stories_since_last_post).toBe(3);
    expect(state.last_post_time).toBe('2026-04-14T13:00:00Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/state.test.js
```

Expected: FAIL — `Cannot find module '../scripts/state.js'`

- [ ] **Step 3: Create `scripts/state.js`**

```javascript
// scripts/state.js
import fs from 'node:fs';
import path from 'node:path';

function getStatePath() {
  return process.env.STATE_PATH || path.resolve('data/state.json');
}

const DEFAULT_STATE = {
  last_post_time: null,
  stories_since_last_post: 0,
  carry_over: false,
};

export function readState() {
  const statePath = getStatePath();
  if (!fs.existsSync(statePath)) return { ...DEFAULT_STATE };
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

export function writeState(state) {
  const statePath = getStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function incrementStoriesCount(count = 1) {
  const state = readState();
  writeState({ ...state, stories_since_last_post: state.stories_since_last_post + count });
}

export function resetAfterPost(postTime) {
  const state = readState();
  writeState({ ...state, last_post_time: postTime, stories_since_last_post: 0, carry_over: false });
}

export function setCarryOver() {
  const state = readState();
  writeState({ ...state, carry_over: true });
}
```

- [ ] **Step 4: Create `data/.gitkeep` and initial `data/state.json`**

```bash
touch data/.gitkeep
echo '{"last_post_time":null,"stories_since_last_post":0,"carry_over":false}' > data/state.json
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/state.test.js
```

Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/state.js tests/state.test.js data/.gitkeep data/state.json
git commit -m "feat: state management module for carry-over logic"
```

---

## Phase 3 — Fetch Pipeline

### Task 13: RSS fetch module

**Files:**
- Create: `scripts/fetch-rss.js`
- Create: `tests/fetch-rss.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/fetch-rss.test.js
import { describe, it, expect, vi } from 'vitest';
import { parseRSSItems } from '../scripts/fetch-rss.js';

describe('parseRSSItems', () => {
  it('maps rss-parser items to Story shape', () => {
    const feedTitle = 'PWInsider';
    const items = [
      {
        title: 'GCW announces card',
        contentSnippet: 'Game Changer Wrestling sets card.',
        link: 'https://pwinsider.com/gcw',
        isoDate: '2026-04-15T10:00:00Z',
      },
    ];
    const stories = parseRSSItems(items, feedTitle);
    expect(stories).toHaveLength(1);
    expect(stories[0].title).toBe('GCW announces card');
    expect(stories[0].summary).toBe('Game Changer Wrestling sets card.');
    expect(stories[0].url).toBe('https://pwinsider.com/gcw');
    expect(stories[0].source).toBe('PWInsider');
    expect(stories[0].platform).toBe('rss');
    expect(stories[0].published_at).toBe('2026-04-15T10:00:00Z');
  });

  it('falls back to content when contentSnippet is missing', () => {
    const items = [{ title: 'T', content: 'Full content', link: 'https://x.com', isoDate: '2026-01-01T00:00:00Z' }];
    const stories = parseRSSItems(items, 'Source');
    expect(stories[0].summary).toBe('Full content');
  });

  it('uses empty string for missing summary fields', () => {
    const items = [{ title: 'T', link: 'https://x.com', isoDate: '2026-01-01T00:00:00Z' }];
    const stories = parseRSSItems(items, 'Source');
    expect(stories[0].summary).toBe('');
  });

  it('skips items with no title', () => {
    const items = [{ contentSnippet: 'body', link: 'https://x.com', isoDate: '2026-01-01T00:00:00Z' }];
    const stories = parseRSSItems(items, 'Source');
    expect(stories).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/fetch-rss.test.js
```

Expected: FAIL — `Cannot find module '../scripts/fetch-rss.js'`

- [ ] **Step 3: Create `scripts/fetch-rss.js`**

```javascript
// scripts/fetch-rss.js
import Parser from 'rss-parser';

const parser = new Parser();

export function parseRSSItems(items, feedTitle) {
  return items
    .filter(item => item.title)
    .map(item => ({
      title: item.title,
      summary: item.contentSnippet || item.content || '',
      url: item.link || '',
      source: feedTitle,
      published_at: item.isoDate || new Date().toISOString(),
      platform: 'rss',
    }));
}

export async function fetchRSSFeed(url) {
  const feed = await parser.parseURL(url);
  return parseRSSItems(feed.items, feed.title || url);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/fetch-rss.test.js
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-rss.js tests/fetch-rss.test.js
git commit -m "feat: RSS feed fetching module"
```

---

### Task 14: Cagematch scraper module

**Files:**
- Create: `scripts/fetch-scrape.js`

- [ ] **Step 1: Create `scripts/fetch-scrape.js`**

```javascript
// scripts/fetch-scrape.js
import * as cheerio from 'cheerio';

export function parseCagematchHTML(html, scrapeConfig) {
  const $ = cheerio.load(html);
  const items = [];

  $(scrapeConfig.selector).each((i, el) => {
    const $el = $(el);
    const titleEl = $el.find(scrapeConfig.titleSelector || 'a').first();
    const title = titleEl.text().trim();
    if (!title) return;

    const href = titleEl.attr('href') || '';
    const url = href.startsWith('http')
      ? href
      : new URL(href, scrapeConfig.baseUrl || scrapeConfig.url).href;

    const summary = $el.find(scrapeConfig.summarySelector || 'p').first().text().trim();

    items.push({
      title,
      summary,
      url,
      source: scrapeConfig.name,
      published_at: new Date().toISOString(),
      platform: 'scrape',
    });
  });

  return items;
}

export async function scrapeCagematch(scrapeConfig) {
  const response = await fetch(scrapeConfig.url, {
    headers: { 'User-Agent': 'indieReader/1.0 (+https://github.com/YOUR_USERNAME/indieReader)' },
  });
  if (!response.ok) throw new Error(`Scrape failed: ${response.status} ${scrapeConfig.url}`);
  const html = await response.text();
  return parseCagematchHTML(html, scrapeConfig);
}
```

**Note:** Replace `YOUR_USERNAME` with your GitHub username. After this step, inspect Cagematch's actual HTML at `https://www.cagematch.net/?id=10` in a browser to verify/update the selectors in `config/sources.json`.

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-scrape.js
git commit -m "feat: Cagematch HTML scraper module"
```

---

### Task 15: Social media fetch module

**Files:**
- Create: `scripts/fetch-social.js`

- [ ] **Step 1: Create `scripts/fetch-social.js`**

```javascript
// scripts/fetch-social.js
import { TwitterApi } from 'twitter-api-v2';

export async function fetchTwitter(handles) {
  if (!process.env.TWITTER_BEARER_TOKEN || handles.length === 0) return [];
  const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  const results = [];

  for (const handle of handles) {
    try {
      const clean = handle.replace(/^@/, '');
      const { data: user } = await client.v2.userByUsername(clean);
      const timeline = await client.v2.userTimeline(user.id, {
        max_results: 10,
        'tweet.fields': ['created_at', 'text'],
        exclude: ['retweets', 'replies'],
      });
      for (const tweet of timeline.data.data ?? []) {
        results.push({
          title: tweet.text.slice(0, 120),
          summary: tweet.text,
          url: `https://twitter.com/${clean}/status/${tweet.id}`,
          source: handle,
          published_at: tweet.created_at ?? new Date().toISOString(),
          platform: 'twitter',
        });
      }
    } catch (e) {
      console.warn(`[fetch-social] Twitter failed for ${handle}: ${e.message}`);
    }
  }
  return results;
}

export async function fetchYouTube(channelIds) {
  if (!process.env.YOUTUBE_API_KEY || channelIds.length === 0) return [];
  const results = [];

  for (const channelId of channelIds) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=5&type=video`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`YouTube API ${res.status}`);
      const data = await res.json();
      for (const item of data.items ?? []) {
        results.push({
          title: item.snippet.title,
          summary: item.snippet.description,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          source: item.snippet.channelTitle,
          published_at: item.snippet.publishedAt,
          platform: 'youtube',
        });
      }
    } catch (e) {
      console.warn(`[fetch-social] YouTube failed for ${channelId}: ${e.message}`);
    }
  }
  return results;
}

export async function fetchFacebook(pageIds) {
  if (!process.env.FACEBOOK_ACCESS_TOKEN || pageIds.length === 0) return [];
  const results = [];

  for (const pageId of pageIds) {
    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=message,permalink_url,created_time&limit=5&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Facebook API ${res.status}`);
      const data = await res.json();
      for (const post of data.data ?? []) {
        if (!post.message) continue;
        results.push({
          title: post.message.slice(0, 120),
          summary: post.message,
          url: post.permalink_url,
          source: pageId,
          published_at: post.created_time,
          platform: 'facebook',
        });
      }
    } catch (e) {
      console.warn(`[fetch-social] Facebook failed for ${pageId}: ${e.message}`);
    }
  }
  return results;
}

export async function fetchInstagram(accountIds) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || accountIds.length === 0) return [];
  const results = [];

  for (const accountId of accountIds) {
    try {
      const url = `https://graph.instagram.com/${accountId}/media?fields=caption,permalink,timestamp&limit=5&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Instagram API ${res.status}`);
      const data = await res.json();
      for (const post of data.data ?? []) {
        if (!post.caption) continue;
        results.push({
          title: post.caption.slice(0, 120),
          summary: post.caption,
          url: post.permalink,
          source: accountId,
          published_at: post.timestamp,
          platform: 'instagram',
        });
      }
    } catch (e) {
      console.warn(`[fetch-social] Instagram failed for ${accountId}: ${e.message}`);
    }
  }
  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-social.js
git commit -m "feat: social media fetch module (Twitter, YouTube, Facebook, Instagram)"
```

---

### Task 16: Fetch orchestrator

**Files:**
- Create: `scripts/fetch.js`

- [ ] **Step 1: Create `scripts/fetch.js`**

```javascript
// scripts/fetch.js
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/sources.json' assert { type: 'json' };
import { fetchRSSFeed } from './fetch-rss.js';
import { scrapeCagematch } from './fetch-scrape.js';
import { fetchTwitter, fetchYouTube, fetchFacebook, fetchInstagram } from './fetch-social.js';
import { filterStories } from './filter.js';
import { storyId, dedupeStories } from './dedupe.js';
import { incrementStoriesCount } from './state.js';

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const dataPath = path.resolve(`data/news-${today}.json`);

  const existing = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    : [];
  const existingIds = existing.map(s => s.id);

  const raw = [];

  // RSS feeds
  for (const url of config.rss) {
    try {
      const stories = await fetchRSSFeed(url);
      raw.push(...stories);
      console.log(`[RSS] ${url}: ${stories.length} items`);
    } catch (e) {
      console.warn(`[RSS] Failed: ${url} — ${e.message}`);
    }
  }

  // Scrape targets
  for (const scrapeConf of config.scrape) {
    try {
      const stories = await scrapeCagematch(scrapeConf);
      raw.push(...stories);
      console.log(`[Scrape] ${scrapeConf.name}: ${stories.length} items`);
    } catch (e) {
      console.warn(`[Scrape] Failed: ${scrapeConf.name} — ${e.message}`);
    }
  }

  // Social media
  const social = config.social_allowlist;
  raw.push(...await fetchTwitter(social.twitter ?? []));
  raw.push(...await fetchYouTube(social.youtube ?? []));
  raw.push(...await fetchFacebook(social.facebook ?? []));
  raw.push(...await fetchInstagram(social.instagram ?? []));

  // Filter to indie-only, then dedupe
  const filtered = filterStories(raw);
  const tagged = filtered.map(s => ({ ...s, id: s.id || storyId(s) }));
  const newStories = dedupeStories(tagged, existingIds);

  if (newStories.length === 0) {
    console.log('No new stories found.');
    return;
  }

  const all = [...existing, ...newStories];
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(all, null, 2));

  incrementStoriesCount(newStories.length);

  console.log(`✓ Added ${newStories.length} new stories to ${dataPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Test the fetch script manually**

```bash
node scripts/fetch.js
```

Expected: Outputs fetch results for each source. If API keys are missing, social sources log warnings and continue. At minimum, RSS feeds should return stories.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch.js
git commit -m "feat: fetch orchestrator combining RSS, scrape, and social sources"
```

---

## Phase 4 — AI Blog Post Generation

### Task 17: Post generation module

**Files:**
- Create: `scripts/generate-post.js`

- [ ] **Step 1: Create `scripts/generate-post.js`**

```javascript
// scripts/generate-post.js
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an indie wrestling enthusiast writing an editorial column for indieReader — a news site dedicated to independent professional wrestling.

Your voice is passionate, opinionated, and deeply invested in the grassroots wrestling scene. You write flowing narrative prose — not bullet points or listicles. Weave the day's stories into a cohesive, compelling read that indie wrestling fans will love.

Focus on what matters to indie fans: the talent, the promotions, the moments that make the independent scene special. When a story matters, tell the reader WHY it matters.

Do not discuss WWE, AEW, TNA, ROH, or NJPW unless a story explicitly involves their direct impact on the indie scene (e.g., a development program, a partnership with an indie promotion).

Write in Markdown. Output ONLY the body of the post — no title, no frontmatter. Start with a strong opening sentence.`;

function buildUserPrompt(stories) {
  const list = stories
    .map(s => `- **${s.title}** (via ${s.source})\n  ${s.summary}\n  ${s.url}`)
    .join('\n\n');
  return `Here are today's indie wrestling stories. Write your editorial column:\n\n${list}`;
}

async function callClaude(stories) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(stories) }],
  });
  return response.content[0].text;
}

async function callOpenAI(stories) {
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(stories) },
    ],
  });
  return response.choices[0].message.content;
}

export async function generatePost(stories, type) {
  const provider = process.env.AI_PROVIDER || 'claude';
  const body = provider === 'openai'
    ? await callOpenAI(stories)
    : await callClaude(stories);

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Denver',
  });

  const title = type === 'morning'
    ? 'Indie Wrestling Roundup — Morning Edition'
    : 'Indie Wrestling Roundup — Evening Edition';

  const sourcesYaml = stories
    .map(s => `  - url: "${s.url.replace(/"/g, '\\"')}"\n    title: "${s.title.replace(/"/g, '\\"')}"`)
    .join('\n');

  const frontmatter = `---
title: "${title}"
date: ${date}
time: "${time}"
type: ${type}
story_count: ${stories.length}
ai_provider: ${provider}
sources:
${sourcesYaml}
---

`;

  const filename = `${date}-${type}.md`;
  const filepath = path.resolve(`src/content/posts/${filename}`);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, frontmatter + body);

  console.log(`✓ Generated post: ${filepath}`);
  return filepath;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-post.js
git commit -m "feat: AI blog post generation supporting Claude and OpenAI"
```

---

### Task 18: Generate CLI runner

**Files:**
- Create: `scripts/run-generate.js`

- [ ] **Step 1: Create `scripts/run-generate.js`**

```javascript
// scripts/run-generate.js
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/sources.json' assert { type: 'json' };
import { readState, resetAfterPost, setCarryOver } from './state.js';
import { generatePost } from './generate-post.js';

const type = process.argv[2];
if (!['morning', 'evening'].includes(type)) {
  console.error('Usage: node scripts/run-generate.js morning|evening');
  process.exit(1);
}

function gatherStoriesSinceLastPost(lastPostTime) {
  const cutoff = lastPostTime ? new Date(lastPostTime) : new Date(0);
  const stories = [];

  // Read today and yesterday to catch stories across midnight
  const dates = [
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  ];

  for (const date of dates) {
    const filePath = path.resolve(`data/news-${date}.json`);
    if (!fs.existsSync(filePath)) continue;
    const day = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    stories.push(...day.filter(s => new Date(s.published_at) > cutoff));
  }

  return stories;
}

async function main() {
  const state = readState();
  const stories = gatherStoriesSinceLastPost(state.last_post_time);

  console.log(`[run-generate] type=${type}, stories since last post: ${stories.length}`);

  if (type === 'evening' && stories.length < config.min_stories_for_post) {
    console.log(`Not enough stories (${stories.length} < ${config.min_stories_for_post}). Setting carry-over.`);
    setCarryOver();
    process.exit(0);
  }

  if (stories.length === 0) {
    console.log('No stories to generate from. Exiting.');
    process.exit(0);
  }

  await generatePost(stories, type);
  resetAfterPost(new Date().toISOString());
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Test manually with fixture data**

Ensure `data/state.json` has `last_post_time: null` and `data/fixture-news.json` exists (it does from Task 4). Copy it to today's date:

```bash
cp data/fixture-news.json data/news-$(date +%Y-%m-%d).json
```

Run with `AI_PROVIDER` set:

```bash
AI_PROVIDER=claude ANTHROPIC_API_KEY=your_key node scripts/run-generate.js morning
```

Expected: A new file appears at `src/content/posts/YYYY-MM-DD-morning.md` with frontmatter and narrative body.

- [ ] **Step 3: Commit**

```bash
git add scripts/run-generate.js
git commit -m "feat: generate CLI runner with threshold and carry-over logic"
```

---

## Phase 5 — GitHub Actions Workflows

### Task 19: Fetch workflow

**Files:**
- Create: `.github/workflows/fetch.yml`

- [ ] **Step 1: Create `.github/workflows/fetch.yml`**

```yaml
# .github/workflows/fetch.yml
name: Fetch News

on:
  schedule:
    - cron: '0 */3 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Fetch news from all sources
        run: node scripts/fetch.js
        env:
          TWITTER_BEARER_TOKEN: ${{ secrets.TWITTER_BEARER_TOKEN }}
          FACEBOOK_ACCESS_TOKEN: ${{ secrets.FACEBOOK_ACCESS_TOKEN }}
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}

      - name: Commit new stories
        run: |
          git config user.name "indieReader Bot"
          git config user.email "noreply@indiereader"
          git add data/
          git diff --staged --quiet || (git commit -m "chore: fetch news $(date -u +%Y-%m-%dT%H:%M:%SZ)" && git push)
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/fetch.yml
git commit -m "chore: add fetch.yml GitHub Actions workflow"
```

---

### Task 20: Morning post workflow

**Files:**
- Create: `.github/workflows/morning.yml`

- [ ] **Step 1: Create `.github/workflows/morning.yml`**

```yaml
# .github/workflows/morning.yml
name: Generate Morning Post

on:
  schedule:
    - cron: '0 13 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Generate morning blog post
        run: node scripts/run-generate.js morning
        env:
          AI_PROVIDER: ${{ secrets.AI_PROVIDER }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Commit post and updated state
        run: |
          git config user.name "indieReader Bot"
          git config user.email "noreply@indiereader"
          git add src/content/posts/ data/state.json
          git diff --staged --quiet || (git commit -m "feat: morning post $(date -u +%Y-%m-%d)" && git push)
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/morning.yml
git commit -m "chore: add morning.yml GitHub Actions workflow"
```

---

### Task 21: Evening post workflow

**Files:**
- Create: `.github/workflows/evening.yml`

- [ ] **Step 1: Create `.github/workflows/evening.yml`**

```yaml
# .github/workflows/evening.yml
name: Generate Evening Post

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Generate evening blog post (or set carry-over)
        run: node scripts/run-generate.js evening
        env:
          AI_PROVIDER: ${{ secrets.AI_PROVIDER }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Commit post or carry-over state
        run: |
          git config user.name "indieReader Bot"
          git config user.email "noreply@indiereader"
          git add src/content/posts/ data/state.json
          git diff --staged --quiet || (git commit -m "feat: evening post or carry-over $(date -u +%Y-%m-%d)" && git push)
```

- [ ] **Step 2: Commit and push all workflows**

```bash
git add .github/workflows/evening.yml
git commit -m "chore: add evening.yml GitHub Actions workflow"
git push
```

- [ ] **Step 3: Add GitHub Secrets**

In the GitHub repo Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `AI_PROVIDER` | `claude` or `openai` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `TWITTER_BEARER_TOKEN` | Twitter API v2 Bearer Token (optional) |
| `FACEBOOK_ACCESS_TOKEN` | Meta Graph API token (optional) |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram Graph API token (optional) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (optional) |

Social secrets are optional — the scripts log a warning and skip if missing.

- [ ] **Step 4: Trigger fetch workflow manually to verify**

```bash
gh workflow run fetch.yml
gh run watch
```

Expected: Workflow completes, stories committed to `data/`, deploy workflow triggers and rebuilds the site.

- [ ] **Step 5: Trigger morning workflow manually to verify**

```bash
gh workflow run morning.yml
gh run watch
```

Expected: A post is generated at `src/content/posts/YYYY-MM-DD-morning.md`, committed, and the site rebuilds showing it in the Blog Post tab.

---

---

## Phase 6 — Date Navigation on News Tab

### Task 22: Previous day navigation on news page

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/news/[date].astro`

- [ ] **Step 1: Create `src/pages/news/[date].astro`** (per-day news page)

```astro
---
// src/pages/news/[date].astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import Tabs from '../../components/Tabs.astro';
import NewsFeed from '../../components/NewsFeed.astro';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export async function getStaticPaths() {
  const files = await glob('data/news-*.json');
  return files.map(file => {
    const date = path.basename(file, '.json').replace('news-', '');
    return { params: { date } };
  });
}

const { date } = Astro.params;
const dataPath = path.resolve(`data/news-${date}.json`);
let stories = fs.existsSync(dataPath)
  ? JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  : [];
stories.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

const base = import.meta.env.BASE_URL;
const prev = new Date(new Date(date).getTime() - 86_400_000).toISOString().slice(0, 10);
const next = new Date(new Date(date).getTime() + 86_400_000).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
---
<BaseLayout title={`News — ${date}`}>
  <Tabs active="news" />
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
    <h2 style="font-size:1rem; color:#888;">
      {new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
    </h2>
    <div style="display:flex; gap:0.5rem; font-size:0.85rem;">
      <a href={`${base}news/${prev}`} style="color:#888; text-decoration:none;">← Previous</a>
      {date !== today && <a href={`${base}news/${next}`} style="color:#888; text-decoration:none;">Next →</a>}
      {date !== today && <a href={base} style="color:#e94560; text-decoration:none;">Today</a>}
    </div>
  </div>
  <NewsFeed stories={stories} />
</BaseLayout>
```

- [ ] **Step 2: Add "View previous days" link to `src/pages/index.astro`**

Add the following after the `<NewsFeed>` component in `src/pages/index.astro`:

```astro
---
// Add at top of frontmatter (after existing imports):
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const base = import.meta.env.BASE_URL;
---
```

And after `<NewsFeed stories={stories} />`, add:

```astro
<div style="text-align:center; margin-top:1.5rem;">
  <a href={`${base}news/${yesterday}`} style="color:#888; font-size:0.85rem; text-decoration:none;">
    ← View yesterday's news
  </a>
</div>
```

- [ ] **Step 3: Install glob**

```bash
npm install glob
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds. `dist/news/YYYY-MM-DD/index.html` pages generated for each day that has a `data/news-*.json` file.

- [ ] **Step 5: Commit**

```bash
git add src/pages/news/ src/pages/index.astro package.json package-lock.json
git commit -m "feat: date navigation for news archive"
```

---

## Verification Checklist

- [ ] `npm run dev` — site loads, all three tabs work, fixture data visible
- [ ] `npm run build` — build succeeds with no type errors
- [ ] `npm test` — all tests pass (filter, dedupe, state, fetch-rss)
- [ ] `node scripts/fetch.js` — fetches from RSS sources, writes to `data/`
- [ ] `node scripts/run-generate.js morning` — generates post to `src/content/posts/`
- [ ] Carry-over: set `stories_since_last_post: 2` in state.json, run evening script — verify no post generated and `carry_over: true` in state.json
- [ ] GitHub Actions: all 4 workflows appear and run without errors
- [ ] Site live at `https://YOUR_USERNAME.github.io/indieReader`
- [ ] Adding a new source to `config/sources.json` requires no code changes
