export type AccentName = "electric" | "cyan" | "violet" | "magenta" | "amber";

export type SymbolName = "cube" | "book" | "anvil";

export interface BrandColors {
  obsidian: string;
  graphite: string;
  panel: string;
  ink: string;
  muted: string;
  line: string;
  electric: string;
  cyan: string;
  violet: string;
  magenta: string;
  amber: string;
}

export interface Portal {
  id: string;
  label: string;
  href: string;
  symbol: SymbolName;
  color: AccentName;
  summary: string;
}

export interface SocialLink {
  id: string;
  label: string;
  href: string;
}

export interface BrandOrganization {
  name: string;
  url: string;
  email?: string;
  sameAs?: string[];
}

/**
 * Everything that changes between austinmcgaugh.com and a later minnsace.com.
 * Shared components read this. They do not hard-code a name, color, or URL.
 */
export interface Brand {
  name: string;
  url: string;
  email: string;
  description: string;
  tagline: string;
  /** RSS or Atom URL for this site's journal. */
  feed: string;
  colors: BrandColors;
  portals: Portal[];
  socials: SocialLink[];
  organization: BrandOrganization;
}
