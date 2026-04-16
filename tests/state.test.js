import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  incrementStoriesCount,
  readState,
  resetAfterPost,
  setCarryOver,
  writeState,
} from "../scripts/state.js";

const TEST_STATE_PATH = path.resolve("data/test-state.json");
process.env.STATE_PATH = TEST_STATE_PATH;

beforeEach(() => {
  if (fs.existsSync(TEST_STATE_PATH)) {
    fs.unlinkSync(TEST_STATE_PATH);
  }
});

afterEach(() => {
  if (fs.existsSync(TEST_STATE_PATH)) {
    fs.unlinkSync(TEST_STATE_PATH);
  }
});

describe("readState", () => {
  it("returns default state when the file does not exist", () => {
    const state = readState();
    expect(state.last_post_time).toBeNull();
    expect(state.stories_since_last_post).toBe(0);
    expect(state.carry_over).toBe(false);
  });

  it("reads existing state from disk", () => {
    fs.writeFileSync(
      TEST_STATE_PATH,
      JSON.stringify({
        last_post_time: "2026-04-15T07:00:00Z",
        stories_since_last_post: 7,
        carry_over: false,
      }),
    );
    expect(readState().stories_since_last_post).toBe(7);
  });
});

describe("incrementStoriesCount", () => {
  it("increments by one by default", () => {
    incrementStoriesCount();
    expect(readState().stories_since_last_post).toBe(1);
  });

  it("increments by a supplied amount", () => {
    incrementStoriesCount(5);
    incrementStoriesCount(3);
    expect(readState().stories_since_last_post).toBe(8);
  });
});

describe("resetAfterPost", () => {
  it("resets the counter and carry_over while setting last_post_time", () => {
    writeState({
      last_post_time: null,
      stories_since_last_post: 12,
      carry_over: true,
    });
    resetAfterPost("2026-04-15T13:00:00Z");
    const state = readState();
    expect(state.stories_since_last_post).toBe(0);
    expect(state.carry_over).toBe(false);
    expect(state.last_post_time).toBe("2026-04-15T13:00:00Z");
  });
});

describe("setCarryOver", () => {
  it("sets carry_over without touching the other fields", () => {
    writeState({
      last_post_time: "2026-04-14T13:00:00Z",
      stories_since_last_post: 3,
      carry_over: false,
    });
    setCarryOver();
    const state = readState();
    expect(state.carry_over).toBe(true);
    expect(state.stories_since_last_post).toBe(3);
    expect(state.last_post_time).toBe("2026-04-14T13:00:00Z");
  });
});
