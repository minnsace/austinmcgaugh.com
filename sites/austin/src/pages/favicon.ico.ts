import type { APIRoute } from "astro";
import { faviconPng, icoFromPng } from "../lib/icons";

export const GET: APIRoute = async () => {
  const png = await faviconPng(32);
  const ico = icoFromPng(png, 32);
  return new Response(new Uint8Array(ico), {
    headers: { "Content-Type": "image/x-icon", "Cache-Control": "public, max-age=31536000, immutable" },
  });
};
