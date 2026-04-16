import fs from "node:fs";
import path from "node:path";

const DEFAULT_STATE = {
  last_post_time: null,
  stories_since_last_post: 0,
  carry_over: false,
};

function getStatePath() {
  return process.env.STATE_PATH || path.resolve("data/state.json");
}

export function readState() {
  const statePath = getStatePath();
  if (!fs.existsSync(statePath)) {
    return { ...DEFAULT_STATE };
  }

  const raw = fs.readFileSync(statePath, "utf-8").trim();
  if (!raw) {
    return { ...DEFAULT_STATE };
  }

  try {
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state) {
  const statePath = getStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function incrementStoriesCount(count = 1) {
  const state = readState();
  writeState({
    ...state,
    stories_since_last_post: state.stories_since_last_post + count,
  });
}

export function resetAfterPost(postTime) {
  const state = readState();
  writeState({
    ...state,
    last_post_time: postTime,
    stories_since_last_post: 0,
    carry_over: false,
  });
}

export function setCarryOver() {
  const state = readState();
  writeState({
    ...state,
    carry_over: true,
  });
}
