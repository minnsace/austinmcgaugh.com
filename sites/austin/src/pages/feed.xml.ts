import type { APIRoute } from "astro";
import { knowledgeFeed } from "../lib/feed";

/** Legacy alias. The old Jekyll site published /feed.xml. */
export const GET: APIRoute = (context) => knowledgeFeed(context);
