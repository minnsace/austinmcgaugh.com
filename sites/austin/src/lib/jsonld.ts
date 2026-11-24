import type { CollectionEntry } from "astro:content";
import { resolveVideo } from "@digital-forge/ui/video";
import { brand } from "../brand/manifest";
import { absoluteUrl } from "./urls";

const personId = `${brand.url}/#person`;
const websiteId = `${brand.url}/#website`;
const organizationId = "https://minnsace.com/#organization";
const portraitUrl = absoluteUrl("/austin-mcgaugh.webp");
const shareImage = absoluteUrl("/og.png");

const personSameAs = [
  "https://x.com/AustinMcGaugh",
  "https://www.linkedin.com/in/austinmcgaugh/",
  "https://www.youtube.com/@AustinMcGaugh",
  "https://github.com/minnsace",
  "https://github.com/AustinMcGaugh",
  "https://www.instagram.com/austinmcgaugh/",
  "https://minnsace.com/",
  "https://itch.io/profile/minnsace",
];

export function baseGraph(): Record<string, unknown>[] {
  return [
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: `${brand.url}/`,
      name: brand.name,
      description: brand.description,
      publisher: { "@id": personId },
      inLanguage: "en",
    },
    {
      "@type": "Person",
      "@id": personId,
      name: brand.name,
      url: `${brand.url}/`,
      email: brand.email,
      description: brand.tagline,
      jobTitle: "Software engineer, game developer, and Founder of Minnsace Inc.",
      image: portraitUrl,
      sameAs: personSameAs,
      worksFor: { "@id": organizationId },
    },
    {
      "@type": "Organization",
      "@id": organizationId,
      name: brand.organization.name,
      url: brand.organization.url,
      email: brand.organization.email,
      logo: {
        "@type": "ImageObject",
        url: brand.organization.logo,
      },
      founder: { "@id": personId },
      sameAs: brand.organization.sameAs,
    },
  ];
}

export function articleGraph(post: CollectionEntry<"journal">, canonical: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [
    {
      "@type": "BlogPosting",
      "@id": `${canonical}#post`,
      headline: post.data.title,
      description: post.data.description,
      datePublished: post.data.date.toISOString(),
      dateModified: post.data.date.toISOString(),
      url: canonical,
      mainEntityOfPage: canonical,
      keywords: post.data.tags.join(", "),
      articleSection: "Journal",
      inLanguage: "en",
      author: { "@id": personId },
      publisher: { "@id": personId },
      image: post.data.cover ? absoluteUrl(post.data.cover) : undefined,
    },
    breadcrumb([
      { name: "Journal", url: absoluteUrl("/journal/") },
      { name: post.data.title, url: canonical },
    ]),
  ];

  if (post.data.type === "video" && post.data.video) {
    const video = resolveVideo(post.data.video);
    nodes.push({
      "@type": "VideoObject",
      "@id": `${canonical}#video`,
      name: post.data.title,
      description: post.data.description,
      uploadDate: post.data.date.toISOString(),
      contentUrl: video.href,
      embedUrl: video.embed,
      thumbnailUrl: video.poster ?? (post.data.cover ? absoluteUrl(post.data.cover) : undefined),
      publisher: { "@id": personId },
    });
  }

  return nodes;
}

export function projectGraph(project: CollectionEntry<"projects">, canonical: string): Record<string, unknown>[] {
  const lethecary = project.id === "the-lethecary";
  const deadlight = project.id === "deadlight-tavern";
  const game: Record<string, unknown> = {
    "@type": "VideoGame",
    name: project.data.title,
    description: project.data.description,
    url: deadlight || lethecary ? canonical : (project.data.url ?? canonical),
    image: shareImage,
    inLanguage: "en",
    author: { "@id": organizationId },
    publisher: { "@id": organizationId },
  };
  if (lethecary) {
    game.genre = ["psychological horror", "first-person"];
    game.gamePlatform = ["PC", "Windows"];
    game.creativeWorkStatus = "In development";
  } else if (deadlight) {
    game.genre = ["Action", "Indie"];
    game.gamePlatform = project.data.platform;
    game.sameAs = project.data.url ? [project.data.url] : undefined;
    game.datePublished = project.data.date ? project.data.date.toISOString().slice(0, 10) : undefined;
    game.offers = project.data.price
      ? {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: project.data.price,
          url: canonical,
        }
      : undefined;
  } else {
    game.sameAs = project.data.repository;
    game.operatingSystem = project.data.platform;
    game.datePublished = project.data.date ? project.data.date.toISOString().slice(0, 10) : undefined;
    game.offers = project.data.price
      ? {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: project.data.price,
          url: project.data.url ?? canonical,
        }
      : undefined;
  }
  return [
    game,
    breadcrumb([
      { name: "Projects", url: absoluteUrl("/projects/") },
      { name: project.data.title, url: canonical },
    ]),
  ];
}

export function projectListGraph(projects: CollectionEntry<"projects">[]): Record<string, unknown>[] {
  return [
    {
      "@type": "ItemList",
      name: "Projects",
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: project.data.title,
        url: absoluteUrl(`/projects/${project.id}/`),
      })),
    },
  ];
}

function breadcrumb(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
