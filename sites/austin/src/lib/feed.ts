import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { brand } from "../brand/manifest";
import { loadKnowledge } from "./content";

export async function knowledgeFeed(context: APIContext) {
  const posts = (await loadKnowledge()).filter((post) => !post.data.draft);
  return rss({
    title: `${brand.name} — Knowledge`,
    description: "Articles and videos by Austin McGaugh.",
    site: context.site ?? brand.url,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/knowledge/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: "<language>en-us</language>",
  });
}
