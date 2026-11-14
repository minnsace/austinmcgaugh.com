import { getCollection, type CollectionEntry } from "astro:content";

export function isPublished<T extends { data: { draft?: boolean } }>(entry: T): boolean {
  return import.meta.env.DEV || entry.data.draft !== true;
}

function byDateDesc<T extends { data: { date?: Date } }>(a: T, b: T): number {
  return (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0);
}

export async function loadKnowledge(): Promise<CollectionEntry<"knowledge">[]> {
  const entries = await getCollection("knowledge");
  return entries.filter(isPublished).sort(byDateDesc);
}

export async function loadProjects(): Promise<CollectionEntry<"projects">[]> {
  const entries = await getCollection("projects");
  return entries.filter(isPublished).sort((a, b) => a.data.order - b.data.order);
}

export async function loadWorkshop(): Promise<CollectionEntry<"workshop">[]> {
  const entries = await getCollection("workshop");
  return entries.filter(isPublished).sort(byDateDesc);
}

export function tagSlug(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function knowledgeTags(posts: CollectionEntry<"knowledge">[]) {
  const tags = new Map<string, { slug: string; name: string; count: number }>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const existing = tags.get(slug);
      if (existing) existing.count += 1;
      else tags.set(slug, { slug, name: tag, count: 1 });
    }
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Calendar date from a content value, read in UTC so it cannot slip a day. */
export function formatDate(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function isoDate(date: Date): string {
  return date.toISOString();
}
