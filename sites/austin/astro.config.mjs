import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://austinmcgaugh.com",
  trailingSlash: "always",
  compressHTML: true,
  prefetch: false,
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !/\.(png|xml|svg|jpg|jpeg|webp|avif|ico)$/.test(page) &&
        !/\/(404|work|writing|knowledge|contact)(\/|\.html)?$/.test(page) &&
        !page.includes("/writing/") &&
        !page.includes("/knowledge/") &&
        !page.includes("/m/") &&
        !page.includes("/projects/lethecary/"),
      serialize(item) {
        return { ...item, lastmod: item.lastmod ?? new Date().toISOString() };
      },
    }),
    {
      name: "sitemap-xml",
      hooks: {
        "astro:build:done": async ({ dir }) => {
          const root = fileURLToPath(dir);
          await copyFile(join(root, "sitemap-index.xml"), join(root, "sitemap.xml"));
        },
      },
    },
  ],
  redirects: {
    "/work/": "/projects/",
    "/writing/": "/journal/",
    "/knowledge/": "/journal/",
    "/knowledge/rss.xml": "/journal/rss.xml",
    "/writing/rss.xml": "/journal/rss.xml",
    "/projects/lethecary/": "/projects/the-lethecary/",
  },
  build: {
    format: "directory",
  },
  vite: {
    ssr: {
      noExternal: ["@digital-forge/ui"],
    },
  },
});
