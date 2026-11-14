import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { brand } from "../brand/manifest";
import { loadJournal } from "./content";

export async function journalFeed(context: APIContext) {
  const posts = (await loadJournal()).filter((post) => !post.data.draft);
  return rss({
    title: `${brand.name} — Journal`,
    description: "Articles and videos by Austin McGaugh.",
    site: context.site ?? brand.url,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/journal/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: "<language>en-us</language>",
  });
}
