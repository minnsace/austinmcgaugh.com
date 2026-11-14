# Austin McGaugh

Personal site for [austinmcgaugh.com](https://austinmcgaugh.com), rebuilt as phase 1 of the Digital Forge. The HTML is the product. A later phase hangs the same pages over a Three.js scene. [minnsace.com](https://minnsace.com/) can reuse the runtime and the interface with its own brand file.

The design notes live in [docs/DIGITAL-FORGE.md](docs/DIGITAL-FORGE.md).

## Requirements

Node.js 22 or newer.

## Local development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4321/

Drafts are visible in dev, with a banner, and are left out of production.

```bash
npm test          # runtime tests, production build, route checks
npm run check     # TypeScript
npm run preview   # serve sites/austin/dist
```

## Repository

| Path | What it is |
| --- | --- |
| `packages/forge-runtime` | Renderer, shot sequencer, and quality switch. Phase 1 is a stub and does not import Three.js. |
| `packages/forge-ui` | Skip link, navigation, footer, panels, portal symbols, and the video facade. |
| `sites/austin` | This site: pages, Markdown, and the brand manifest. |
| `sites/austin/src/brand/manifest.ts` | Name, colors, socials, portals, and the studio record. |

Shared components read the manifest. They do not hard-code Austin’s name, colors, or links, so a second site can supply a different manifest later.

## Add a journal post

Create one file, either Markdown or MDX:

`sites/austin/src/content/journal/my-note.md`

```markdown
---
title: "A real title"
description: "One or two sentences. This is the index, the RSS item, and the social card."
date: 2026-11-14
tags:
  - notes
type: article
draft: true
---

Write the piece here. Set `draft: false` when it should go live.
```

A video is the same kind of file, with `type: video` and a URL:

```markdown
---
title: "A real video title"
description: "What the video is about."
date: 2026-11-14
tags:
  - video
type: video
video: https://www.youtube.com/watch?v=xxxxxxxxxxx
cover: /images/my-cover.jpg
draft: true
---

A short introduction. The player is a link until someone presses play, so the first load does not embed YouTube.
```

`video` accepts a YouTube or Vimeo URL. Anything else stays an ordinary link. `cover` is optional. Put the image in `sites/austin/public/images/` and it becomes the Open Graph image for that post.

The feed is newest first, at `/journal/`, and includes articles and videos together. Tags get their own pages. RSS is `/journal/rss.xml`. `/feed.xml` is the same feed, kept so the old address still works. `/knowledge/` and `/writing/` redirect to `/journal/`, including each post and tag.

## Add a project

`sites/austin/src/content/projects/my-game.md`

```markdown
---
title: My Game
description: "A sentence that can stand alone on the projects list."
url: https://example.com/my-game
linkLabel: View the game
status: In progress
kind: Game
date: 2026-11-14
order: 3
platform: Web
---

What the game is, in your own words, plus where to play it.
```

`date` and `price` are optional. Leave `date` off when you do not have a real release date. `order` is the projects list, smallest first. The home page “latest project” uses the newest `date`.

## Add a workshop update

`sites/austin/src/content/workshop/2026-11-14-what-changed.md`

```markdown
---
title: "What changed"
description: "One sentence for the workshop list and the home page."
date: 2026-11-14
draft: true
---

A short progress note.
```

The studio introduction itself is the page at `sites/austin/src/pages/workshop/index.astro`.

## Drafts

`draft: true` keeps a file on disk and shows it when you run `npm run dev`. `npm run build` omits it from the HTML, the sitemap, and the RSS feed. Remove the line, or set `draft: false`, to publish.

## Images

The portrait source is `sites/austin/src/assets/austin-mcgaugh.png`. The build writes responsive AVIF and WebP. Do not put that PNG in `public/`. The background still is `sites/austin/src/assets/color-orbit.jpg`. It is the fixed poster behind the panels. Phase 2 mounts the canvas in that same frame.

## Deploy

GitHub Actions builds this package and deploys `sites/austin/dist` to Pages. The custom domain is `austinmcgaugh.com`, from `sites/austin/public/CNAME`.

After this lands on `main`, turn on **Enforce HTTPS** in the repository’s Pages settings. The certificate already covers the domain. HTTP still answers until that switch is on, and the repo cannot flip it.
