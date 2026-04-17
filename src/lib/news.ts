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
export const NEWS_BEGINNING_PATH = "/news/beginning/";

function sortStories(stories: Story[]): Story[] {
  return stories.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

export function loadStoriesForDate(date: string): Story[] {
  const dataPath = path.resolve(`data/news-${date}.json`);
  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const stories = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as Story[];
  return sortStories(stories);
}

export function loadLatestStories(): Story[] {
  const latestDate = listNewsDates()[0];
  if (latestDate) {
    return loadStoriesForDate(latestDate);
  }

  if (!import.meta.env.DEV) {
    return [];
  }

  const fixturePath = path.resolve("data/fixture-news.json");
  if (!fs.existsSync(fixturePath)) {
    return [];
  }

  const stories = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as Story[];
  return sortStories(stories);
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

export function getNewsNavigation(date: string) {
  const dates = listNewsDates();
  const index = dates.indexOf(date);

  if (index === -1) {
    return {
      dates,
      olderDate: null,
      newerDate: null,
      isLatest: false,
      isEarliest: false,
    };
  }

  return {
    dates,
    olderDate: dates[index + 1] || null,
    newerDate: dates[index - 1] || null,
    isLatest: index === 0,
    isEarliest: index === dates.length - 1,
  };
}
