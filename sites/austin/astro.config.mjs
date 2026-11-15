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
        !page.includes("/m/"),
    }),
  ],
  redirects: {
    "/work/": "/projects/",
    "/writing/": "/journal/",
    "/knowledge/": "/journal/",
    "/knowledge/rss.xml": "/journal/rss.xml",
    "/writing/rss.xml": "/journal/rss.xml",
    "/contact/": "/about/#contact",
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
