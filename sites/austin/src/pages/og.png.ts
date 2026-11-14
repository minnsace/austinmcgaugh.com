import type { APIRoute } from "astro";
import sharp from "sharp";
import { brand } from "../brand/manifest";

export const GET: APIRoute = async () => {
  const [projects, knowledge, workshop] = brand.portals;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${brand.colors.obsidian}"/>
  <circle cx="1060" cy="70" r="240" fill="${brand.colors.electric}" fill-opacity="0.38"/>
  <circle cx="140" cy="590" r="210" fill="${brand.colors.amber}" fill-opacity="0.34"/>
  <circle cx="900" cy="540" r="170" fill="${brand.colors.violet}" fill-opacity="0.36"/>
  <circle cx="1120" cy="430" r="80" fill="${brand.colors.magenta}" fill-opacity="0.45"/>
  <rect x="72" y="78" width="22" height="22" rx="11" fill="${brand.colors.magenta}"/>
  <text x="72" y="292" fill="${brand.colors.ink}" font-family="Liberation Serif, DejaVu Serif, serif" font-size="92">${brand.name}</text>
  <text x="72" y="360" fill="${brand.colors.muted}" font-family="Inter, Liberation Sans, sans-serif" font-size="30">${brand.tagline}</text>
  <text x="72" y="530" fill="${brand.colors.electric}" font-family="Inter, Liberation Sans, sans-serif" font-size="22" letter-spacing="3">${projects.label.toUpperCase()}</text>
  <text x="280" y="530" fill="${brand.colors.violet}" font-family="Inter, Liberation Sans, sans-serif" font-size="22" letter-spacing="3">${knowledge.label.toUpperCase()}</text>
  <text x="530" y="530" fill="${brand.colors.amber}" font-family="Inter, Liberation Sans, sans-serif" font-size="22" letter-spacing="3">${workshop.label.toUpperCase()}</text>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
};
