import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const knowledge = defineCollection({
  loader: glob({ base: "./src/content/knowledge", pattern: "**/*.{md,mdx}" }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      type: z.enum(["article", "video"]),
      video: z.string().url().optional(),
      cover: z.string().optional(),
      draft: z.boolean().default(false),
    })
    .superRefine((value, context) => {
      if (value.type === "video" && !value.video) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A video post needs a video URL.",
          path: ["video"],
        });
      }
      if (value.type === "article" && value.video) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Remove video, or set type to video.",
          path: ["video"],
        });
      }
    }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.string().url(),
    linkLabel: z.string(),
    status: z.string(),
    kind: z.string(),
    date: z.coerce.date().optional(),
    order: z.number(),
    price: z.string().optional(),
    platform: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const workshop = defineCollection({
  loader: glob({ base: "./src/content/workshop", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { knowledge, projects, workshop };
