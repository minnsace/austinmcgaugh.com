import type { Brand } from "@digital-forge/ui/types";

/**
 * Austin McGaugh brand. minnsace.com will be a second site with its own file.
 * Do not copy these values into shared components.
 */
export const brand = {
  name: "Austin McGaugh",
  url: "https://austinmcgaugh.com",
  email: "contact@austinmcgaugh.com",
  description: "Personal site of Austin McGaugh, software engineer and founder of Minnsace Inc.",
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
  ],
  organization: {
    name: "Minnsace Inc.",
    url: "https://minnsace.com/",
    email: "contact@austinmcgaugh.com",
  },
} satisfies Brand;

export type AustinBrand = typeof brand;
