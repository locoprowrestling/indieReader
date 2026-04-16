import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    time: z.string(),
    type: z.enum(["morning", "evening"]),
    story_count: z.number(),
    ai_provider: z.string(),
    sources: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
      }),
    ),
  }),
});

export const collections = { posts };
