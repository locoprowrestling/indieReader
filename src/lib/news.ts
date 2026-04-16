import fs from "node:fs";
import path from "node:path";

export interface Story {
  id?: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  platform: string;
}

const DATA_DIR = path.resolve("data");

export function loadStoriesForDate(date: string): Story[] {
  const dataPath = path.resolve(`data/news-${date}.json`);
  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const stories = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as Story[];
  return stories.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

export function loadLatestStories(): Story[] {
  const today = new Date().toISOString().slice(0, 10);
  const todayStories = loadStoriesForDate(today);
  if (todayStories.length > 0) {
    return todayStories;
  }

  if (!import.meta.env.DEV) {
    return [];
  }

  const fixturePath = path.resolve("data/fixture-news.json");
  if (!fs.existsSync(fixturePath)) {
    return [];
  }

  const stories = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as Story[];
  return stories.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

export function listNewsDates(): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => /^news-\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((file) => file.slice(5, 15))
    .sort((a, b) => b.localeCompare(a));
}
