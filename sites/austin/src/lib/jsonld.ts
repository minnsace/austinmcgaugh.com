import type { CollectionEntry } from "astro:content";
import { resolveVideo } from "@digital-forge/ui/video";
import { brand } from "../brand/manifest";
import { absoluteUrl } from "./urls";

const personId = `${brand.url}/#person`;
const websiteId = `${brand.url}/#website`;
const organizationId = `${brand.organization.url}#organization`;

export function baseGraph(portraitUrl: string): Record<string, unknown>[] {
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
      jobTitle: "Software engineer and game developer",
      image: portraitUrl,
      sameAs: brand.socials.map((social) => social.href),
      worksFor: { "@id": organizationId },
    },
    {
      "@type": "Organization",
      "@id": organizationId,
      name: brand.organization.name,
      url: brand.organization.url,
      email: brand.organization.email,
      founder: { "@id": personId },
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
  return [
    {
      "@type": "VideoGame",
      name: project.data.title,
      description: project.data.description,
      url: project.data.url,
      sameAs: project.data.repository,
      datePublished: project.data.date ? project.data.date.toISOString().slice(0, 10) : undefined,
      operatingSystem: project.data.platform,
      author: { "@id": organizationId },
      publisher: { "@id": organizationId },
      offers: project.data.price
        ? {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: project.data.price,
            url: project.data.url,
          }
        : undefined,
    },
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
