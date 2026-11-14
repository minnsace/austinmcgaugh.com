import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const dist = join(root, "sites/austin/dist");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function lin(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const left = luminance(a);
  const right = luminance(b);
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function read(path) {
  return readFileSync(join(dist, path), "utf8");
}

function pageUrl(page) {
  if (page === "index.html") return "https://austinmcgaugh.com/";
  if (page === "404.html") return "https://austinmcgaugh.com/404.html";
  return `https://austinmcgaugh.com/${page.replace(/index\.html$/, "")}`;
}

function localTarget(href, page) {
  if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  let url;
  try {
    url = new URL(href, pageUrl(page));
  } catch {
    return { missing: href };
  }
  if (url.origin !== "https://austinmcgaugh.com") return null;
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  else if (!extname(pathname)) pathname += "/index.html";
  return { file: pathname.replace(/^\//, ""), hash: url.hash.replace("#", "") };
}

const leftovers = ["Gemfile", "Gemfile.lock", "_config.yml", ".ruby-version", "index.html", "assets/js/forge.js", "assets/css/site.css"];
for (const leftover of leftovers) {
  check(!existsSync(join(root, leftover)), `Jekyll leftover still present: ${leftover}`);
}

check(existsSync(dist), "dist/ was not built");
const builtHtml = existsSync(dist) ? walk(dist).filter((file) => file.endsWith(".html")) : [];
for (const file of builtHtml) {
  const html = readFileSync(file, "utf8");
  check(!html.includes("hello@minnsace.com"), `${relative(dist, file)} still uses hello@minnsace.com`);
  check(!html.includes("linkedin.com/company"), `${relative(dist, file)} links a company LinkedIn page`);
}
const files = existsSync(dist) ? walk(dist) : [];
const htmlFiles = files.filter((file) => file.endsWith(".html")).map((file) => relative(dist, file));

const pages = [
  "index.html",
  "projects/index.html",
  "projects/deadlight-tavern/index.html",
  "projects/free-snake-game/index.html",
  "knowledge/index.html",
  "workshop/index.html",
  "about/index.html",
  "404.html",
];

for (const page of pages) check(htmlFiles.includes(page), `Missing route ${page}`);

const current = {
  "index.html": null,
  "projects/index.html": "/projects/",
  "projects/deadlight-tavern/index.html": "/projects/",
  "projects/free-snake-game/index.html": "/projects/",
  "knowledge/index.html": "/knowledge/",
  "workshop/index.html": "/workshop/",
  "about/index.html": null,
  "404.html": null,
};

for (const page of pages) {
  if (!htmlFiles.includes(page)) continue;
  const html = read(page);
  const { document } = parseHTML(html);
  check(document.documentElement.getAttribute("lang") === "en", `${page} lang`);
  check(document.querySelectorAll("h1").length === 1, `${page} should have one h1`);
  check(document.querySelector("a.skip-link")?.getAttribute("href") === "#main", `${page} skip link`);
  check(document.querySelector("main#main"), `${page} main`);
  check(document.querySelector("#forge-stage")?.getAttribute("data-quality") === "quiet", `${page} quiet stage`);
  check(document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.startsWith("https://austinmcgaugh.com"), `${page} canonical`);
  check(document.querySelector('meta[property="og:title"]'), `${page} og:title`);
  check(document.querySelector('meta[property="og:image"]')?.getAttribute("content")?.startsWith("https://"), `${page} og:image`);
  check(document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") === "summary_large_image", `${page} twitter card`);
  check(document.querySelector('script[type="application/ld+json"]')?.textContent?.includes("Person"), `${page} Person JSON-LD`);
  check(document.querySelector('script[type="application/ld+json"]')?.textContent?.includes("Minnsace Inc."), `${page} Organization JSON-LD`);
  const nav = [...document.querySelectorAll('nav[aria-label="Main"] a')].map((anchor) => ({
    text: anchor.textContent?.trim(),
    href: anchor.getAttribute("href"),
    current: anchor.getAttribute("aria-current"),
  }));
  check(nav.map((item) => item.text).join(",") === "Projects,Knowledge,Workshop", `${page} nav labels`);
  const marked = nav.filter((item) => item.current === "page");
  if (current[page]) {
    check(marked.length === 1 && marked[0].href === current[page], `${page} aria-current`);
  } else {
    check(marked.length === 0, `${page} should not mark a portal current`);
  }
  const scripts = [...document.querySelectorAll("script")].filter((script) => script.getAttribute("type") !== "application/ld+json");
  check(scripts.length === 0, `${page} should ship no executable script, found ${scripts.length}`);
  check(!html.includes("Example article") && !html.includes("REPLACE_ME"), `${page} published a draft`);

  const urls = [];
  for (const element of document.querySelectorAll("[href], [src], [srcset]")) {
    const href = element.getAttribute("href");
    const src = element.getAttribute("src");
    const srcset = element.getAttribute("srcset");
    if (href) urls.push(href);
    if (src) urls.push(src);
    if (srcset) urls.push(...srcset.split(",").map((part) => part.trim().split(/\s+/)[0]));
  }
  for (const value of urls) {
    const target = localTarget(value, page);
    if (!target) continue;
    if (target.missing) {
      errors.push(`${page} has unparseable URL: ${target.missing}`);
      continue;
    }
    check(existsSync(join(dist, target.file)), `${page} links to missing ${target.file}`);
    if (target.hash && existsSync(join(dist, target.file))) {
      const host = readFileSync(join(dist, target.file), "utf8");
      check(host.includes(`id="${target.hash}"`), `${page} #${target.hash} missing in ${target.file}`);
    }
  }
}

const home = htmlFiles.includes("index.html") ? read("index.html") : "";
check(home.includes("I’m Austin McGaugh, founder of Minnsace Inc."), "Home hero copy");
check(home.includes("Deadlight Tavern"), "Home latest project");
check(home.includes("Nothing published yet"), "Home empty knowledge slots");

const deadlight = htmlFiles.includes("projects/deadlight-tavern/index.html") ? read("projects/deadlight-tavern/index.html") : "";
check(deadlight.includes("July 18, 2022"), "Deadlight release date");
check(deadlight.includes("survival bar game"), "Deadlight Steam description");
check(deadlight.includes("https://store.steampowered.com/app/2071710/Deadlight_Tavern/"), "Deadlight Steam URL");
check(deadlight.includes("VideoGame"), "Deadlight VideoGame JSON-LD");

const snake = htmlFiles.includes("projects/free-snake-game/index.html") ? read("projects/free-snake-game/index.html") : "";
check(snake.includes("https://freesnakegame.com/"), "FreeSnake URL");
check(snake.includes("https://github.com/minnsace/free-snake-game"), "FreeSnake repo");
check(snake.includes("pygame-ce") && snake.includes("WebAssembly") && snake.includes("scent markers"), "FreeSnake story");
check(snake.includes("GitHub Copilot") && snake.includes("GoDaddy"), "FreeSnake origin");
check(!/power-ups|voice chat|battery level|pygbag/i.test(snake), "FreeSnake page invented a feature");

const knowledge = htmlFiles.includes("knowledge/index.html") ? read("knowledge/index.html") : "";
check(knowledge.includes("No posts yet."), "Knowledge empty state");

const workshop = htmlFiles.includes("workshop/index.html") ? read("workshop/index.html") : "";
check(workshop.includes("Minnsace Inc. is my company."), "Workshop carries the studio sentence");
check(workshop.includes("No progress notes yet."), "Workshop empty updates");
check(workshop.includes("contact@austinmcgaugh.com"), "Workshop uses the personal email");
check(!workshop.includes("hello@minnsace.com"), "Workshop still mentions the old studio email");
check(!workshop.includes("linkedin.com/company"), "Unverified company LinkedIn is linked");

const about = htmlFiles.includes("about/index.html") ? read("about/index.html") : "";
check(about.includes('alt="Portrait of Austin McGaugh"'), "Portrait alt text");
{
  const { document } = parseHTML(about);
  const portrait = document.querySelector('img[alt="Portrait of Austin McGaugh"]');
  const markup = portrait?.parentElement?.outerHTML ?? "";
  check(markup.includes(".avif") && markup.includes(".webp"), "Portrait picture is AVIF and WebP");
  check(!markup.includes(".png"), "Portrait picture still includes a PNG");
}
check(!about.includes("austin-mcgaugh.png"), "About page still references the source PNG");
check(about.includes('id="contact"'), "Contact anchor");
check(about.includes("contact@austinmcgaugh.com"), "Personal email");
for (const social of ["https://x.com/AustinMcGaugh", "https://www.linkedin.com/in/austinmcgaugh/", "https://www.youtube.com/@AustinMcGaugh"]) {
  check(about.includes(social), `Missing social ${social}`);
}

for (const [file, target] of [
  ["work/index.html", "/projects/"],
  ["writing/index.html", "/knowledge/"],
  ["contact/index.html", "/about/#contact"],
]) {
  check(htmlFiles.includes(file), `Missing redirect ${file}`);
  if (!htmlFiles.includes(file)) continue;
  const html = read(file);
  check(html.includes(target), `${file} should send people to ${target}`);
  check(/noindex/i.test(html), `${file} should be noindex`);
}

function readDist(path) {
  const file = join(dist, path);
  check(existsSync(file), `Missing ${path}`);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const feed = readDist("knowledge/rss.xml");
const legacy = readDist("feed.xml");
check(feed.includes("<rss") && feed.includes("Knowledge"), "Knowledge RSS");
check(!feed.includes("Example article") && !feed.includes("REPLACE_ME"), "RSS includes a draft");
check(legacy.includes("<rss"), "Legacy /feed.xml");
check(readDist("robots.txt").includes("https://austinmcgaugh.com/sitemap-index.xml"), "robots sitemap");
check(readDist("CNAME").trim() === "austinmcgaugh.com", "CNAME");
check(existsSync(join(dist, "favicon.svg")) && existsSync(join(dist, "favicon.ico")) && existsSync(join(dist, "og.png")), "Icons and social image");

const sitemapFiles = files.filter((file) => file.endsWith(".xml") && file.includes("sitemap"));
const sitemap = sitemapFiles.map((file) => readFileSync(file, "utf8")).join("\n");
for (const url of [
  "https://austinmcgaugh.com/",
  "https://austinmcgaugh.com/projects/",
  "https://austinmcgaugh.com/projects/deadlight-tavern/",
  "https://austinmcgaugh.com/projects/free-snake-game/",
  "https://austinmcgaugh.com/knowledge/",
  "https://austinmcgaugh.com/workshop/",
  "https://austinmcgaugh.com/about/",
]) {
  check(sitemap.includes(url), `Sitemap missing ${url}`);
}
check(!sitemap.includes("/work/") && !sitemap.includes("example-article"), "Sitemap includes a redirect or draft");

if (htmlFiles.includes("index.html")) {
  const { document } = parseHTML(read("index.html"));
  const style = document.documentElement.getAttribute("style") ?? "";
  const colors = Object.fromEntries([...style.matchAll(/--color-([a-z]+):([^;]+)/g)].map((match) => [match[1], match[2].trim()]));
  check(contrast(colors.ink, colors.panel) >= 7, `Ink contrast ${contrast(colors.ink ?? "#000", colors.panel ?? "#fff")}`);
  check(contrast(colors.muted, colors.panel) >= 4.5, `Muted contrast too low`);
  check(contrast(colors.cyan, colors.panel) >= 4.5, `Cyan link contrast too low`);
  check(contrast(colors.obsidian, colors.electric) >= 4.5, `Button contrast too low`);
}

for (const file of files) {
  const size = statSync(file).size;
  if (/\.(png|jpe?g|webp|avif|gif)$/i.test(file)) {
    check(size < 400_000, `${relative(dist, file)} is ${size} bytes`);
  }
}
check(!files.some((file) => file.endsWith("austin-mcgaugh.png")), "Source portrait was copied into dist");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const imageBytes = files
  .filter((file) => /\.(png|jpe?g|webp|avif)$/i.test(file))
  .map((file) => `${relative(dist, file)} ${statSync(file).size}`)
  .sort();
console.log(`Verified ${pages.length} routes, redirects, feed, sitemap, and contrast.`);
console.log(imageBytes.join("\n"));
