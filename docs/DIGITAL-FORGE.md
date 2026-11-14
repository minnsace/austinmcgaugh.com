# Digital Forge

Design record for austinmcgaugh.com, written so minnsace.com can reuse the engine and the interface without copying them. Phase 1 is the website. The world comes after a URL can already land on a page.

Date: 14 November 2026.

## Vision

Austin McGaugh makes software and games at Minnsace Inc. The site should feel like a place with ambition, and it should still be a website: readable, shareable, and fast. Imagination is the point. A trick that does not help someone arrive, or understand where they are, does not ship.

The spectacular parts are the map and the route. They are added only after the page underneath is already worth opening.

## Design laws

These hold in every phase.

| Law | What it rules out |
| --- | --- |
| The HTML is the product. The post is in the first response. | A canvas the crawler cannot read. A loader in front of the article. Text drawn in WebGL. |
| One router. The nav, the keyboard, a portal, and the Back button all change the same URL. | A portal that is the only menu. A flythrough that ignores the address bar. |
| A URL is a place. `/journal/:slug` is that post. | Replaying an intro on a shared link. |
| The intro, when it exists, plays on `/` only, once, for a few seconds. | An unskippable sting. Intro assets on the way to a post. |
| Esc, a nav item, or any link skips a shot. Deep links never play one. | Scroll-jacking. A custom cursor. A cutscene between a section and a post. |
| Panels are real type on a solid surface, about 65 characters wide, selectable. | Glass text over a busy shader. |
| Quiet mode is the same pages with a still, no loop, and the choice is remembered. | A separate mobile site. A fallback that is a different design. |

Phase 1 is quiet mode for everyone. There is no scene, so there is nothing to turn down. The poster is the background, and `resolveQuality({ force: "quiet" })` is what the page records.

## Information architecture

Three sections. Each one is a portal in the later world. There is no Arena. That fourth section was in an earlier sketch and was dropped.

| Section | URL | Color | Symbol | What it holds |
| --- | --- | --- | --- | --- |
| Projects | `/projects/` | Electric blue | Cube | Games. Each game has its own page. |
| Journal | `/journal/` | Violet | Book | Articles and videos in one feed, newest first, with tags. A post is `/journal/:slug/`. |
| Workshop | `/workshop/` | Molten orange | Anvil | Minnsace Inc., and short progress notes. |

Cyan is the focus ring and the link color. Magenta is the personal mark beside the name. Neither is a section.

The home page is a short hero and a Latest strip: the newest article, the newest video, and the newest project or workshop note. About and contact live at `/about/` and in the footer. Contact is `/about/#contact`.

Old addresses redirect:

| From | To |
| --- | --- |
| `/writing/` and `/writing/*` | `/journal/` and `/journal/*` |
| `/knowledge/` and `/knowledge/*` | `/journal/` and `/journal/*` |
| `/work/` | `/projects/` |
| `/contact/` | `/about/#contact` |
| `/feed.xml` | The Journal RSS feed, same as `/journal/rss.xml` |

## Palette

The values live in `sites/austin/src/brand/manifest.ts`. This is the current Austin palette. A second site replaces the file. It does not edit the stylesheet.

| Token | Hex | Use |
| --- | --- | --- |
| Obsidian | `#090b10` | Page, header, footer |
| Graphite | `#10131a` | Cards on a panel |
| Panel | `#161a22` | The readable surface |
| Ink | `#f4f0e6` | Text |
| Muted | `#c3bdb2` | Meta text, still above 4.5:1 on a panel |
| Electric | `#3d7eff` | Projects, the cube, the primary button |
| Cyan | `#5ee7d8` | Links and focus |
| Violet | `#9b87ff` | Journal, the book |
| Magenta | `#ff4fa3` | The mark by the name |
| Amber | `#ff8a3d` | Workshop, the anvil |

Type is Instrument Serif for titles and Instrument Sans for everything else, self-hosted, Latin only. A system face is the fallback and paints if the files are late.

## Portal legend

Color plus symbol is the map, before any 3D exists.

- Blue cube: Projects. Games.
- Violet book: Journal. Articles and videos.
- Amber anvil: Workshop. The studio.

The nav shows the symbol in its color on every page. The current section gets a line in that color and `aria-current="page"`. In phase 3 the matching portal lights, and choosing it is the same navigation as the text link.

## Architecture

```
packages/forge-runtime   quality switch, shot sequencer, renderer mount
packages/forge-ui        skip link, nav, footer, panels, symbols, video facade
sites/austin             content, pages, SEO, brand manifest
sites/minnsace           later: another manifest, same runtime and UI
```

Astro prerenders Markdown and MDX to static HTML. GitHub Actions uploads `sites/austin/dist` to Pages. The domain stays `austinmcgaugh.com`.

`forge-runtime` is vanilla Three.js when the scene exists. It is not React Three Fiber. A second component tree would fight the camera and the URL. Phase 1 does not import `three`, and the pages ship no application JavaScript. The stage element is `#forge-stage`. Phase 2 mounts the canvas inside it, over the poster, and fades the canvas in when the critical mesh is ready. The poster stays for quiet mode, reduced motion, Save-Data, a missing WebGL context, and a failed frame.

`forge-ui` receives the brand as props. Names, colors, social URLs, and portal definitions do not live in the components.

Content collections:

- `journal`: `title`, `description`, `date`, `tags`, `type` (`article` or `video`), optional `video`, optional `cover`, `draft`. Files live in `sites/austin/src/content/journal/`.
- `projects`: `title`, `description`, `url`, `linkLabel`, `status`, `kind`, optional `date`, `order`, optional `price`, optional `platform`, `draft`.
- `workshop`: `title`, `description`, `date`, `draft`.

A video page renders a facade: a real link, and an iframe only after a click. YouTube uses the privacy-enhanced embed. The thumbnail is the only third-party image, and only when the id is a real YouTube id.

## SEO and performance

Every page has a title, description, canonical URL, Open Graph and Twitter card, and JSON-LD. The graph always includes `WebSite`, `Person`, and `Organization` (Minnsace Inc.). Posts add `BlogPosting`. Video posts also add `VideoObject`. Games add `VideoGame`. The projects index adds `ItemList`.

Also shipped: `sitemap-index.xml`, `robots.txt`, `/journal/rss.xml`, `/feed.xml`, a favicon, and a generated social image.

The portrait is a responsive AVIF and WebP set. The poster is an AVIF with WebP and JPEG fallbacks. There is no Google font request.

## Phase roadmap

Each phase is usable on its own. The world does not come before the posts.

| Phase | What ships | Done when |
| --- | --- | --- |
| 1. The website | Nav, three sections, Markdown posts, sitemap, RSS, social cards, quiet-mode poster. No scene. | A fresh visit to a post URL shows the title and body immediately, by keyboard, with no WebGL. |
| 2. The stage | Runtime behind the panel. Poster until the critical mesh arrives. The loop stops offscreen. Reduced motion never starts it. | The panel is readable and clickable while a camera holds on an empty platform at the frame budget. |
| 3. Standing in it | Eye-level camera on the plaza, damped look, and a short flight to each island. Section pages are glass panels in the world. Deep links start already standing there. | Keyboard and pointer reach every section and every post. Back works. List view and quiet mode keep the page readable with the canvas gone or ignored. |
| 4. The shots | A short arrival on `/` only, once per session. A skippable spline between sections. Esc, the nav, and any link cut. | Opening a shared post never plays the intro. Skipping feels instant. |
| 5. Materials, fog, audio | Iridescent glass on the sculpture only, height fog, a few particles, beams toward the hovered destination, positional tones, mute. | A person can say what each color means. Nothing moves unless it points at a place or marks the one you are in. The frame budget holds. |
| 6. Find a post | A filter over the real Journal posts. An optional one-line answer only when it cites a post and links it. Quiet mode keeps the filter and drops any pulse. | Typing a title lands on that URL. The feature still works with the canvas removed. No key in the client. |
| 7. minnsace.com | The runtime reads a manifest. The studio site supplies its own sculpture, portals, and copy. | No renderer or nav code is copied. The personal site can stay wilder than the company site. |

Frame budget, from here on: 60fps at a 1.5 pixel cap on a mid laptop, with the panel interactive. Transmission, bloom, and the spline are desktop. Mobile and quiet mode use the poster or a single unlit view, large tap targets, and the same links. Particles in the thousands only on desktop. A few hundred if a low-power device insists on WebGL. Zero in quiet mode.

Fog is analytic, not a volume, so mobile can drop it. The composer is selective bloom on emissive surfaces, plus SMAA. Audio starts only after a gesture. A hidden tab stops the loop. Context loss restores the scene or falls back to the poster.

## Decisions

- Leave Jekyll and the injected Primer stylesheet. Astro builds a static site. The Pages workflow is Node, not Ruby.
- Three.js, not React Three Fiber, and not in phase 1. The stub exports the quality switch, the shot sequencer, and `mount`. Phase 2 is allowed to import `three` inside the runtime only.
- Arena is dropped. Three portals, not four.
- Journal is one feed. A video is a post with a URL, not a separate section. The section was named Knowledge, then renamed; the URL is `/journal/`.
- Drafts are how examples live in the repo without being published as if they were real.
- Brand-specific values stay in the manifest: colors, names, socials, portals, the studio record.
- The panels are opaque. The poster shows in the margins and between panels. Phase 2 does not need a new layout to float those panels over a canvas.
- The old copy, socials, email, and portrait stay. Project facts come from the Steam page, freesnakegame.com, and minnsace.com. Missing facts stay missing.
- The only email on this site is contact@austinmcgaugh.com, including where the studio is mentioned. The personal LinkedIn is https://www.linkedin.com/in/austinmcgaugh/. A company LinkedIn URL is not linked until it can be verified.
- `/writing/`, `/knowledge/`, and `/work/` redirect, rather than disappearing. Post and tag URLs under `/writing/` and `/knowledge/` redirect to the same path under `/journal/`.

## The stage

Phase 2 mounts the Three.js scene in `#forge-stage` after the page has painted. The poster stays until the Forge mesh is ready, and it stays up in quiet mode. Three copies of Island_01 float around the Forge. Each one carries one portal: Projects, Journal (the violet book, from `Portal_Knowledge`), and Workshop. Bridges between the islands are not in this phase.

The quality tiers are quiet, standard for phones, high for desktop, and quest for an immersive session. High uses full-resolution bloom with a high threshold, a multisampled composer target, and FXAA, so thin emissive edges stay clean. The desktop pixel ratio caps at 2. Phones cap at 1.5 and keep antialiasing on. Quest skips the composer, loads the quest bridge and crystal files, turns transmission off, keeps foveation at full, and adds a few additive halos. Enter VR is shown only when the browser can start `immersive-vr`. In the headset, travel is a blink, the glass panels are world-space meshes, and a portal select opens that page.

Phase 3 puts the visitor on the plaza at eye height. Look is a damped drag, a gentle edge glance, or motion after a permission tap. It does not follow the pointer on its own. Choosing a portal or a nav item eases the camera over to that island in about two seconds, and the URL changes with it. Deep links start already standing there. The page text stays real HTML on a frosted panel, with a glass slab in the scene behind it. List view and the skip link put that text back in the document. Bridges run from the dais to each island, and crystal clusters stand on the decks. Their cores and the bridge edge lights pulse.
- HTTPS enforcement is a GitHub Pages setting. The certificate is already there. Austin turns the setting on. The repository cannot.

## What not to add

A character, a chatbot in the corner, or an oracle you have to talk to before reading. A custom cursor. Scroll-jacking. A second mobile site. A loader that blocks a post. Copy that was not on the current site, the Steam page, freesnakegame.com, or minnsace.com.
