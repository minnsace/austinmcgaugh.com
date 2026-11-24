import type { Brand } from "@digital-forge/ui/types";

/**
 * Austin McGaugh brand. minnsace.com will be a second site with its own file.
 * Do not copy these values into shared components.
 */
export const brand = {
  name: "Austin McGaugh",
  url: "https://austinmcgaugh.com",
  email: "contact@austinmcgaugh.com",
  description:
    "Austin McGaugh is a software engineer, game developer, and founder of Minnsace Inc. The Lethecary is in development. Deadlight Tavern is on Steam. FreeSnakeGame.com is a browser game.",
  tagline: "Software engineer, game developer, and founder of Minnsace Inc.",
  feed: "/journal/rss.xml",
  colors: {
    obsidian: "#090b10",
    graphite: "#10131a",
    panel: "#161a22",
    ink: "#f4f0e6",
    muted: "#c3bdb2",
    line: "rgba(244, 240, 230, 0.14)",
    electric: "#3d7eff",
    cyan: "#5ee7d8",
    violet: "#9b87ff",
    magenta: "#ff4fa3",
    amber: "#ff8a3d",
  },
  portals: [
    {
      id: "projects",
      label: "Projects",
      href: "/projects/",
      symbol: "cube",
      color: "electric",
      summary: "Software and games.",
    },
    {
      id: "journal",
      label: "Journal",
      href: "/journal/",
      symbol: "book",
      color: "violet",
      summary: "Articles and videos.",
    },
    {
      id: "workshop",
      label: "Workshop",
      href: "/workshop/",
      symbol: "anvil",
      color: "amber",
      summary: "Minnsace Inc.",
    },
  ],
  socials: [
    { id: "x", label: "X", href: "https://x.com/AustinMcGaugh" },
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/austinmcgaugh/" },
    { id: "youtube", label: "YouTube", href: "https://www.youtube.com/@AustinMcGaugh" },
    { id: "github", label: "GitHub", href: "https://github.com/minnsace" },
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/austinmcgaugh/" },
  ],
  organization: {
    name: "Minnsace Inc.",
    url: "https://minnsace.com/",
    email: "hello@minnsace.com",
    logo: "https://austinmcgaugh.com/apple-touch-icon.png",
    sameAs: [
      "https://www.linkedin.com/company/minnsace",
      "https://github.com/minnsace",
      "https://x.com/minnsace",
      "https://itch.io/profile/minnsace",
      "https://store.steampowered.com/app/2071710/Deadlight_Tavern/",
      "https://www.youtube.com/@Minnsace",
      "https://www.tiktok.com/@minnsace",
      "https://bsky.app/profile/minnsace.com",
      "https://www.facebook.com/profile.php?id=61577445890097",
    ],
    studioLinks: [
      { id: "site", label: "minnsace.com", href: "https://minnsace.com/" },
      { id: "github", label: "GitHub", href: "https://github.com/minnsace" },
      { id: "itch", label: "itch.io", href: "https://itch.io/profile/minnsace" },
    ],
  },
} satisfies Brand;

export type AustinBrand = typeof brand;

