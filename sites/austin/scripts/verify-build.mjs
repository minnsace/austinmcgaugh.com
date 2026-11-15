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
const files = existsSync(dist) ? walk(dist) : [];
const htmlFiles = files.filter((file) => file.endsWith(".html")).map((file) => relative(dist, file));

const pages = [
  "index.html",
  "projects/index.html",
  "projects/deadlight-tavern/index.html",
  "projects/free-snake-game/index.html",
  "journal/index.html",
  "journal/i-bought-a-5-domain-on-impulse/index.html",
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
  "journal/index.html": "/journal/",
  "journal/i-bought-a-5-domain-on-impulse/index.html": "/journal/",
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
  const canonicalLink = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (page === "404.html") check(!canonicalLink, "404 should not publish a canonical");
  else check(canonicalLink?.startsWith("https://austinmcgaugh.com"), `${page} canonical`);
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
  check(nav.map((item) => item.text).join(",") === "Projects,Journal,Workshop", `${page} nav labels`);
  const marked = nav.filter((item) => item.current === "page");
  if (current[page]) {
    check(marked.length === 1 && marked[0].href === current[page], `${page} aria-current`);
  } else {
    check(marked.length === 0, `${page} should not mark a portal current`);
  }
  const scripts = [...document.querySelectorAll("script")].filter((script) => script.getAttribute("type") !== "application/ld+json");
  const modules = scripts.filter((script) => script.getAttribute("type") === "module");
  const inline = scripts.filter((script) => script.getAttribute("type") !== "module");
  check(modules.length === 1, `${page} stage boot module`);
  check(inline.length === 1 && (inline[0].textContent || "").includes("forge-shell"), `${page} shell script`);
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
check(home.includes("The Lethecary"), "Home latest project");
check(home.includes("Deadlight Tavern is on Steam"), "Home description names Deadlight");
check(home.includes("FreeSnakeGame.com is a browser game"), "Home description names FreeSnakeGame");
check(home.includes("<title>Austin McGaugh — Software Engineer, Game Developer &amp; Founder of Minnsace Inc.</title>") || home.includes("<title>Austin McGaugh — Software Engineer, Game Developer & Founder of Minnsace Inc.</title>"), "Home title");
check(home.includes("I Bought a $5 Domain on Impulse."), "Home shows the journal post");
check(!home.includes("Nothing published yet"), "Home no longer renders an empty latest slot");
check(home.includes("https://austinmcgaugh.com/#person"), "Person @id");
check(home.includes("Founder of Minnsace Inc."), "Person jobTitle names the studio");
check(home.includes("https://austinmcgaugh.com/austin-mcgaugh.webp"), "Stable portrait URL");
check(home.includes("https://github.com/minnsace"), "Person sameAs includes GitHub");
check(home.includes("https://itch.io/profile/minnsace"), "Person sameAs includes itch");
check(home.includes("https://minnsace.com/#organization"), "Organization @id");
check(home.includes("hello@minnsace.com"), "Organization email");
check(home.includes("https://www.linkedin.com/company/minnsace"), "Organization LinkedIn");
check(home.includes('twitter:creator" content="@AustinMcGaugh"') || home.includes("twitter:creator"), "twitter:creator");
check(home.includes("og:image:alt"), "og:image:alt");
check(home.includes("Mobile version"), "Desktop offers the mobile version");
check(home.includes("forge-shell"), "Desktop carries the shell script");
{
  const { document } = parseHTML(home);
  const module = [...document.querySelectorAll('script[type="module"]')].find((script) => script.getAttribute("src"));
  const src = module?.getAttribute("src")?.replace(/^\//, "");
  check(Boolean(src), "Desktop boot module src");
  if (src && existsSync(join(dist, src))) {
    const source = readFileSync(join(dist, src), "utf8");
    check(!source.includes("WebGLRenderer"), "Desktop entry chunk does not include the scene");
  }
}

check(htmlFiles.includes("m/index.html"), "Missing mobile home");
check(htmlFiles.includes("m/projects/index.html"), "Missing mobile projects");
check(htmlFiles.includes("m/projects/the-lethecary/index.html"), "Missing mobile Lethecary");
check(htmlFiles.includes("m/journal/index.html"), "Missing mobile journal");
check(htmlFiles.includes("m/journal/i-bought-a-5-domain-on-impulse/index.html"), "Missing mobile journal post");
const mobileHome = htmlFiles.includes("m/index.html") ? read("m/index.html") : "";
check(mobileHome.includes("The Lethecary"), "Mobile home pins Lethecary");
check(mobileHome.indexOf("The Lethecary") < mobileHome.indexOf("I Bought a $5 Domain"), "Lethecary is the first latest card");
check(mobileHome.includes("Full 3D version"), "Mobile offers the full scene");
check(mobileHome.includes("contact@austinmcgaugh.com"), "Mobile home has the contact link");
check(mobileHome.includes("linkedin.com/in/austinmcgaugh"), "Mobile home has LinkedIn");
check(mobileHome.includes('aria-label="Sections"'), "Mobile tab bar");
check(!mobileHome.includes("forge-stage"), "Mobile home skips the stage");
check(!mobileHome.includes("WebGLRenderer"), "Mobile home skips Three.js");
const mobileLethe = htmlFiles.includes("m/projects/the-lethecary/index.html") ? read("m/projects/the-lethecary/index.html") : "";
check(mobileLethe.includes("rewrite the memory until they forget"), "Mobile Lethecary copy");
check(mobileLethe.includes("In development"), "Mobile Lethecary status");
const mobileJournal = htmlFiles.includes("m/journal/index.html") ? read("m/journal/index.html") : "";
check(mobileJournal.includes("I Bought a $5 Domain on Impulse."), "Mobile journal lists the post");
check(mobileJournal.includes("--color-violet"), "Mobile journal uses violet");
const mobileProjects = htmlFiles.includes("m/projects/index.html") ? read("m/projects/index.html") : "";
check(mobileProjects.includes("--color-electric"), "Mobile projects use electric blue");
const mobileWorkshop = htmlFiles.includes("m/workshop/index.html") ? read("m/workshop/index.html") : "";
check(mobileWorkshop.includes("--color-amber"), "Mobile workshop uses amber");
check(mobileWorkshop.includes("No progress notes yet."), "Mobile workshop empty updates");

const deadlight = htmlFiles.includes("projects/deadlight-tavern/index.html") ? read("projects/deadlight-tavern/index.html") : "";
check(deadlight.includes("July 18, 2022"), "Deadlight release date");
check(deadlight.includes("survival bar game"), "Deadlight Steam description");
check(deadlight.includes("https://store.steampowered.com/app/2071710/Deadlight_Tavern/"), "Deadlight Steam URL");
check(deadlight.includes("https://minnsace.com/"), "Deadlight links the studio");
check(deadlight.includes("https://minnsace.itch.io/deadlight-tavern"), "Deadlight links itch");
check(deadlight.includes("VideoGame"), "Deadlight VideoGame JSON-LD");
check(deadlight.includes('"url":"https://austinmcgaugh.com/projects/deadlight-tavern/"'), "Deadlight VideoGame url is the on-site page");

const snake = htmlFiles.includes("projects/free-snake-game/index.html") ? read("projects/free-snake-game/index.html") : "";
check(snake.includes("https://freesnakegame.com/"), "FreeSnake URL");
check(snake.includes("https://github.com/minnsace/free-snake-game"), "FreeSnake repo");
check(snake.includes("pygame-ce") && snake.includes("WebAssembly") && snake.includes("scent markers"), "FreeSnake story");
check(snake.includes("GitHub Copilot") && snake.includes("GoDaddy"), "FreeSnake origin");
check(snake.includes("/journal/i-bought-a-5-domain-on-impulse/"), "FreeSnake links the journal post");
check(!/power-ups|voice chat|battery level|pygbag/i.test(snake), "FreeSnake page invented a feature");

const lethecary = htmlFiles.includes("projects/the-lethecary/index.html") ? read("projects/the-lethecary/index.html") : "";
check(lethecary.includes("In development"), "Lethecary status");
check(lethecary.includes("rewrite the memory until they forget"), "Lethecary copy");
check(lethecary.includes("Being built in public"), "Lethecary public-build note");
check(lethecary.includes("/journal/"), "Lethecary links the journal");
check(!/<a [^>]*store\.steampowered\.com/.test(lethecary), "Lethecary hides the Steam link until a URL is set");
check(!lethecary.includes("View on Steam"), "Lethecary does not show a Steam button");
{
  const { document } = parseHTML(lethecary);
  const game = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((script) => JSON.parse(script.textContent)["@graph"] ?? [])
    .find((node) => node["@type"] === "VideoGame");
  check(game && !game.datePublished, "Lethecary VideoGame has no datePublished");
  check(game?.creativeWorkStatus === "In development", "Lethecary creativeWorkStatus");
  check(Array.isArray(game?.genre) && game.genre.includes("psychological horror"), "Lethecary genre");
  check(!game?.sameAs, "Lethecary VideoGame has no Steam or itch sameAs");
}

const journal = htmlFiles.includes("journal/index.html") ? read("journal/index.html") : "";
check(journal.includes("I Bought a $5 Domain on Impulse."), "Journal lists the post");
check(!journal.includes("No posts yet."), "Journal still shows the empty state");
check(!journal.includes("Example article"), "Journal published a draft");
const post = htmlFiles.includes("journal/i-bought-a-5-domain-on-impulse/index.html")
  ? read("journal/i-bought-a-5-domain-on-impulse/index.html")
  : "";
check(post.includes("An infinite world, and a snake that can smell"), "Post heading");
check(post.includes("November 14, 2026"), "Post date");
check(post.includes("BlogPosting"), "Post JSON-LD");
check(post.includes("https://freesnakegame.com"), "Post links the game");
check(!post.includes("Example video") && !post.includes("REPLACE_ME"), "Draft video was published");

const workshop = htmlFiles.includes("workshop/index.html") ? read("workshop/index.html") : "";
check(workshop.includes("Minnsace Inc. is my company."), "Workshop carries the studio sentence");
check(workshop.includes("No progress notes yet."), "Workshop empty updates");
check(workshop.includes("contact@austinmcgaugh.com"), "Workshop uses the personal email");
check(workshop.includes("The Lethecary"), "Workshop mentions The Lethecary");
check(workshop.includes("https://minnsace.com/"), "Workshop links the studio site");
check(workshop.includes("https://github.com/minnsace"), "Workshop links GitHub");
check(workshop.includes("https://itch.io/profile/minnsace"), "Workshop links itch");

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
for (const social of [
  "https://x.com/AustinMcGaugh",
  "https://www.linkedin.com/in/austinmcgaugh/",
  "https://www.youtube.com/@AustinMcGaugh",
  "https://minnsace.com/",
  "https://github.com/minnsace",
  "https://itch.io/profile/minnsace",
]) {
  check(about.includes(social), `Missing social ${social}`);
}

for (const [file, target] of [
  ["work/index.html", "/projects/"],
  ["writing/index.html", "/journal/"],
  ["knowledge/index.html", "/journal/"],
  ["knowledge/i-bought-a-5-domain-on-impulse/index.html", "/journal/i-bought-a-5-domain-on-impulse/"],
  ["writing/i-bought-a-5-domain-on-impulse/index.html", "/journal/i-bought-a-5-domain-on-impulse/"],
  ["contact/index.html", "/about/#contact"],
  ["projects/lethecary/index.html", "/projects/the-lethecary/"],
]) {
  check(htmlFiles.includes(file), `Missing redirect ${file}`);
  if (!htmlFiles.includes(file)) continue;
  const html = read(file);
  check(html.includes(target), `${file} should send people to ${target}`);
  check(/noindex/i.test(html), `${file} should be noindex`);
}
{
  const contact = htmlFiles.includes("contact/index.html") ? read("contact/index.html") : "";
  check(contact.includes('rel="canonical" href="https://austinmcgaugh.com/about/"'), "Contact canonical is /about/");
}

function readDist(path) {
  const file = join(dist, path);
  check(existsSync(file), `Missing ${path}`);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const feed = readDist("journal/rss.xml");
const legacy = readDist("feed.xml");
check(feed.includes("<rss") && feed.includes("Journal"), "Journal RSS");
check(feed.includes("I Bought a $5 Domain on Impulse."), "RSS includes the post");
check(!feed.includes("Example article") && !feed.includes("REPLACE_ME"), "RSS includes a draft");
check(legacy.includes("<rss") && legacy.includes("I Bought a $5 Domain on Impulse."), "Legacy /feed.xml");
check(readDist("robots.txt").includes("https://austinmcgaugh.com/sitemap-index.xml"), "robots sitemap");
check(readDist("robots.txt").includes("https://austinmcgaugh.com/sitemap.xml"), "robots sitemap.xml");
const sitemapXml = readDist("sitemap.xml");
check(sitemapXml.includes("<sitemapindex") || sitemapXml.includes("<urlset"), "sitemap.xml is a sitemap");
check(existsSync(join(dist, "apple-touch-icon.png")), "apple-touch-icon");
check(existsSync(join(dist, "site.webmanifest")), "web manifest");
check(readDist("site.webmanifest").includes("#090b10"), "manifest theme");
check(existsSync(join(dist, "austin-mcgaugh.webp")), "stable portrait");
check(readDist("CNAME").trim() === "austinmcgaugh.com", "CNAME");
check(existsSync(join(dist, "favicon.svg")) && existsSync(join(dist, "favicon.ico")) && existsSync(join(dist, "og.png")), "Icons and social image");
for (const asset of [
  "models/Forge_Asset01_web.glb",
  "models/Island_01_web.glb",
  "models/Island_02_web.glb",
  "models/Island_03_web.glb",
  "models/Island_Central_web.glb",
  "models/Debris_01_web.glb",
  "models/Distant_01_web.glb",
  "models/Bridge_Straight_2m_web.glb",
  "models/Forge_Env_Nebula.hdr",
  "models/Portal_Projects_web.glb",
  "models/Portal_Knowledge_web.glb",
  "models/Portal_Workshop_web.glb",
  "models/Bridge_Landing_web.glb",
  "models/Bridge_Span_8m_web.glb",
  "models/Bridge_Straight_4m_web.glb",
  "models/Bridge_Ramp_4m_web.glb",
  "models/Crystals_01_web.glb",
  "models/Crystals_05_web.glb",
  "models/quest/Bridge_Landing_quest.glb",
  "models/quest/Island_Central_quest.glb",
  "models/quest/Island_02_quest.glb",
  "models/quest/Distant_01_quest.glb",
  "draco/draco_decoder.wasm",
  "basis/basis_transcoder.wasm",
]) {
  check(existsSync(join(dist, asset)), `Missing stage asset ${asset}`);
}

const sitemapFiles = files.filter((file) => file.endsWith(".xml") && file.includes("sitemap"));
const sitemap = sitemapFiles.map((file) => readFileSync(file, "utf8")).join("\n");
for (const url of [
  "https://austinmcgaugh.com/",
  "https://austinmcgaugh.com/projects/",
  "https://austinmcgaugh.com/projects/deadlight-tavern/",
  "https://austinmcgaugh.com/projects/free-snake-game/",
  "https://austinmcgaugh.com/projects/the-lethecary/",
  "https://austinmcgaugh.com/journal/",
  "https://austinmcgaugh.com/journal/i-bought-a-5-domain-on-impulse/",
  "https://austinmcgaugh.com/workshop/",
  "https://austinmcgaugh.com/about/",
]) {
  check(sitemap.includes(url), `Sitemap missing ${url}`);
}
check(!sitemap.includes("/work/") && !sitemap.includes("/knowledge/") && !sitemap.includes("example-article"), "Sitemap includes a redirect or draft");
check(!sitemap.includes("/m/"), "Sitemap includes the mobile shell");
check(sitemap.includes("<lastmod>"), "Sitemap entries include lastmod");
check(!sitemap.includes("/projects/lethecary/"), "Sitemap includes the Lethecary alias");

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
