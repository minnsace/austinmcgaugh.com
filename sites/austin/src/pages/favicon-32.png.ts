import type { APIRoute } from "astro";
import { faviconPng } from "../lib/icons";

export const GET: APIRoute = async () => {
  const png = await faviconPng(32);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
};
