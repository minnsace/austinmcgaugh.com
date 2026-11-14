import type { APIRoute } from "astro";
import { knowledgeFeed } from "../../lib/feed";

export const GET: APIRoute = (context) => knowledgeFeed(context);
