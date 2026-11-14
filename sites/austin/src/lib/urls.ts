import { brand } from "../brand/manifest";

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${brand.url}/`).href;
}

export function pageTitle(title?: string): string {
  if (!title || title === brand.name) return brand.name;
  return `${title} — ${brand.name}`;
}

export function brandStyle(): string {
  const colors = brand.colors;
  return [
    `--color-obsidian:${colors.obsidian}`,
    `--color-graphite:${colors.graphite}`,
    `--color-panel:${colors.panel}`,
    `--color-ink:${colors.ink}`,
    `--color-muted:${colors.muted}`,
    `--color-line:${colors.line}`,
    `--color-electric:${colors.electric}`,
    `--color-cyan:${colors.cyan}`,
    `--color-violet:${colors.violet}`,
    `--color-magenta:${colors.magenta}`,
    `--color-amber:${colors.amber}`,
  ].join(";");
}
