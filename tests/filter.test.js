import { describe, expect, it } from "vitest";
import { filterStories, isIndieStory } from "../scripts/filter.js";

describe("isIndieStory", () => {
  it("keeps a pure indie story", () => {
    const story = {
      title: "GCW announces Spring Fling",
      summary: "Game Changer Wrestling returns.",
    };
    expect(isIndieStory(story)).toBe(true);
  });

  it("drops a mainstream WWE story", () => {
    const story = {
      title: "WWE signs new deal",
      summary: "World Wrestling Entertainment expands.",
    };
    expect(isIndieStory(story)).toBe(false);
  });

  it("drops an AEW story", () => {
    const story = {
      title: "AEW Dynamite results",
      summary: "All Elite Wrestling recap.",
    };
    expect(isIndieStory(story)).toBe(false);
  });

  it("drops an NJPW story", () => {
    const story = {
      title: "New Japan announces tour",
      summary: "NJPW returns to the US.",
    };
    expect(isIndieStory(story)).toBe(false);
  });

  it("keeps a WWE crossover story", () => {
    const story = {
      title: "Local indie star signs WWE ID program deal",
      summary: "Independent wrestler joins WWE ID.",
    };
    expect(isIndieStory(story)).toBe(true);
  });

  it("keeps an AEW partnership story", () => {
    const story = {
      title: "AEW announces partnership with indie promotion",
      summary: "Co-promotion deal with indie group.",
    };
    expect(isIndieStory(story)).toBe(true);
  });

  it("is case-insensitive for blocklist terms", () => {
    const story = {
      title: "wwe news",
      summary: "wwe smackdown results",
    };
    expect(isIndieStory(story)).toBe(false);
  });

  it("does not keep a mainstream story just because it mentions indies", () => {
    const story = {
      title: "Oba Femi calls WWE NXT his version of the indies",
      summary: "A WWE NXT talent compares the brand to the indies.",
    };
    expect(isIndieStory(story)).toBe(false);
  });
});

describe("filterStories", () => {
  it("removes mainstream stories from an array", () => {
    const stories = [
      { title: "GCW Spring Fling", summary: "Indie show announced." },
      { title: "WWE RAW results", summary: "WWE Monday night recap." },
      { title: "MLW announces card", summary: "Major League Wrestling card set." },
    ];

    const result = filterStories(stories);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("GCW Spring Fling");
    expect(result[1].title).toBe("MLW announces card");
  });
});
