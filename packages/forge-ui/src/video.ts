const YOUTUBE_ID = /^[\w-]{11}$/;

export interface ResolvedVideo {
  href: string;
  provider?: "youtube" | "vimeo";
  /** Embed URL without autoplay. The facade adds autoplay only after a click. */
  embed?: string;
  poster?: string;
}

function youtube(href: string, id: string): ResolvedVideo {
  if (!YOUTUBE_ID.test(id)) return { href };
  return {
    href,
    provider: "youtube",
    embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

/**
 * Turn a public video URL into a light facade.
 * Unknown hosts stay ordinary links. No iframe is implied until `embed` is set.
 */
export function resolveVideo(input: string): ResolvedVideo {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { href: input };
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return youtube(input, id);
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const fromQuery = url.searchParams.get("v") ?? "";
    const parts = url.pathname.split("/").filter(Boolean);
    const fromPath = ["embed", "shorts", "v", "live"].includes(parts[0] ?? "") ? (parts[1] ?? "") : "";
    return youtube(input, fromQuery || fromPath);
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    if (!id) return { href: input };
    return {
      href: input,
      provider: "vimeo",
      embed: `https://player.vimeo.com/video/${id}`,
    };
  }

  return { href: input };
}
