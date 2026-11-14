import { isReadingPath, stanceIdFromPath } from "@digital-forge/runtime";

interface StageHandle {
  goTo: (id: string, options?: { fly?: boolean; reading?: boolean }) => void;
  setPresentation: (mode: "world" | "list" | "dock") => void;
}

const STANCES = ["plaza", "projects", "journal", "workshop"] as const;

export interface WorldController {
  panels: () => { id: string; element: HTMLElement }[];
  attach: (handle: StageHandle) => void;
  detach: () => void;
  open: (href: string) => void;
}

export function createWorld(): WorldController {
  const main = document.getElementById("main");
  const anchor = document.createComment("forge-main");
  if (main?.parentElement) main.parentElement.insertBefore(anchor, main);

  const root = document.createElement("div");
  root.className = "forge-world";
  root.hidden = true;
  const slots = STANCES.map((id) => {
    const article = document.createElement("article");
    article.className = "forge-glass";
    article.dataset.stance = id;
    article.inert = id !== "plaza";
    if (id !== "plaza") article.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "forge-glass-copy";
    article.append(copy);
    root.append(article);
    return { id, article, copy };
  });
  document.body.append(root);

  const preview = document.createElement("aside");
  preview.className = "forge-preview";
  preview.hidden = true;
  const previewKicker = document.createElement("p");
  previewKicker.className = "kicker";
  const previewTitle = document.createElement("h2");
  const previewCopy = document.createElement("p");
  const previewLink = document.createElement("a");
  previewLink.className = "text-link";
  previewLink.textContent = "Open";
  preview.append(previewKicker, previewTitle, previewCopy, previewLink);
  root.append(preview);

  let previewTimer = 0;
  let suppressPreview = 0;
  let picked: HTMLElement | null = null;

  function clearPicked() {
    picked?.classList.remove("is-picked");
    picked = null;
  }

  function hidePreview() {
    window.clearTimeout(previewTimer);
    preview.hidden = true;
    clearPicked();
  }

  function cardOf(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const card = target.closest<HTMLAnchorElement>(".latest-card, .feed-card, .portal-card");
    if (!card || !card.closest(".forge-glass.is-active")) return null;
    return card;
  }

  function showPreview(card: HTMLAnchorElement) {
    if (listed() || narrow() || performance.now() < suppressPreview) {
      hidePreview();
      return;
    }
    const kicker =
      card.querySelector(".kicker")?.textContent?.trim() ||
      card.querySelector(".badge")?.textContent?.trim() ||
      "Selected";
    const title = card.querySelector("h2, h3")?.textContent?.trim() || "Open";
    const copy =
      [...card.querySelectorAll("p")].map((node) => node.textContent?.trim() ?? "").find((line) => line && line !== kicker) ??
      "";
    previewKicker.textContent = kicker;
    previewTitle.textContent = title;
    previewCopy.textContent = copy;
    previewCopy.hidden = copy.length === 0;
    previewLink.href = card.href;
    previewLink.setAttribute("aria-label", `Open ${title}`);
    preview.hidden = false;
    if (picked !== card) {
      clearPicked();
      picked = card;
      card.classList.add("is-picked");
    }
  }

  document.addEventListener("pointerover", (event) => {
    const card = cardOf(event.target);
    if (!card) return;
    window.clearTimeout(previewTimer);
    showPreview(card);
  });
  document.addEventListener("pointerout", (event) => {
    const card = cardOf(event.target);
    if (!card) return;
    const next = event.relatedTarget;
    if (next instanceof Node && (card.contains(next) || preview.contains(next))) return;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      if (preview.matches(":hover")) return;
      hidePreview();
    }, 180);
  });
  document.addEventListener("focusin", (event) => {
    const card = cardOf(event.target);
    if (card) showPreview(card);
  });
  document.addEventListener("focusout", () => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      const active = document.activeElement;
      if (active && (preview.contains(active) || cardOf(active))) return;
      hidePreview();
    }, 120);
  });

  const listToggle = document.querySelector<HTMLAnchorElement>(".list-toggle");
  const skip = document.querySelector<HTMLAnchorElement>(".skip-link");
  const narrowQuery = window.matchMedia("(max-width: 800px)");
  let handle: StageHandle | null = null;
  let stance: ReturnType<typeof stanceIdFromPath> = stanceIdFromPath(window.location.pathname);
  let reading = isReadingPath(window.location.pathname);
  const cache = new Map<string, { title: string; html: string }>();

  const listed = () => document.body.classList.contains("is-list");
  const narrow = () => narrowQuery.matches;

  function presentation(): "world" | "list" | "dock" {
    if (!handle || listed()) return "list";
    return narrow() ? "dock" : "world";
  }

  function parkMain() {
    if (!main || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(main, anchor.nextSibling);
  }

  function mount(id: ReturnType<typeof stanceIdFromPath>) {
    stance = id;
    if (!main) return;
    for (const slot of slots) {
      const active = slot.id === id;
      slot.article.classList.toggle("is-active", active);
      slot.article.classList.toggle("is-reading", active && reading);
      slot.copy.hidden = active;
      slot.article.inert = !active;
      if (active) {
        slot.article.removeAttribute("aria-hidden");
        slot.article.append(main);
      } else {
        slot.article.setAttribute("aria-hidden", "true");
      }
    }
  }

  function applyMode() {
    const on = listed();
    document.body.classList.toggle("is-narrow", Boolean(handle) && narrow() && !on);
    document.body.classList.toggle("is-world", Boolean(handle) && !on);
    if (listToggle) {
      listToggle.textContent = on ? "Stand in the world" : "List view";
      listToggle.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (!handle) {
      parkMain();
      root.hidden = true;
      return;
    }
    if (on) {
      parkMain();
      root.hidden = true;
    } else {
      root.hidden = false;
      mount(stance);
    }
    handle.setPresentation(presentation());
    if (on || narrow()) hidePreview();
  }

  function setList(on: boolean) {
    document.body.classList.toggle("is-list", on);
    try {
      sessionStorage.setItem("forge-list", on ? "1" : "0");
    } catch {
      /* private mode */
    }
    applyMode();
  }

  function armVideos(scope: ParentNode) {
    scope.querySelectorAll<HTMLAnchorElement>("[data-video-facade]").forEach((link) => {
      if (link.dataset.ready === "true") return;
      link.dataset.ready = "true";
      link.addEventListener("click", (event) => {
        const embed = link.dataset.embed;
        if (!embed) return;
        event.preventDefault();
        const frame = document.createElement("iframe");
        frame.className = "video-frame";
        frame.src = embed;
        frame.title = link.dataset.title || "Video";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        link.replaceWith(frame);
      });
    });
  }

  async function pageMain(pathname: string) {
    const cached = cache.get(pathname);
    if (cached) return cached;
    const response = await fetch(pathname);
    if (!response.ok) throw new Error(String(response.status));
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const html = doc.querySelector("#main")?.innerHTML ?? "";
    const record = { title: doc.title, html };
    cache.set(pathname, record);
    return record;
  }

  function markNav(pathname: string) {
    const id = stanceIdFromPath(pathname);
    document.querySelectorAll<HTMLAnchorElement>(".nav-link").forEach((link) => {
      const href = link.getAttribute("href") ?? "";
      if (id !== "plaza" && stanceIdFromPath(href) === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  async function fillInactive() {
    const pages: Record<string, string> = {
      plaza: "/",
      projects: "/projects/",
      journal: "/journal/",
      workshop: "/workshop/",
    };
    await Promise.all(
      slots.map(async (slot) => {
        if (slot.id === stance) return;
        try {
          const page = await pageMain(pages[slot.id] ?? "/");
          slot.copy.innerHTML = page.html;
          armVideos(slot.copy);
        } catch {
          slot.copy.textContent = "";
        }
      }),
    );
  }

  async function show(url: URL, push: boolean) {
    const nextStance = stanceIdFromPath(url.pathname);
    const nextReading = isReadingPath(url.pathname);
    const path = `${url.pathname}${url.search}`;
    if (!handle) {
      window.location.assign(path);
      return;
    }
    reading = nextReading;
    stance = nextStance;
    suppressPreview = performance.now() + 700;
    hidePreview();
    handle.goTo(nextStance, { fly: true, reading: nextReading });
    if (push) history.pushState({ stance: nextStance }, "", path);
    if (!listed()) mount(nextStance);
    markNav(url.pathname);
    try {
      const page = await pageMain(url.pathname);
      if (main) {
        main.innerHTML = page.html;
        armVideos(main);
      }
      hidePreview();
      if (page.title) document.title = page.title;
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute("href", new URL(url.pathname, "https://austinmcgaugh.com").href);
    } catch {
      window.location.assign(path);
    }
  }

  function onClick(event: MouseEvent) {
    if (!handle || listed()) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest("a");
    if (!link) return;
    if (link.classList.contains("skip-link") || link.classList.contains("list-toggle")) return;
    if (link.target && link.target !== "_self") return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) return;
    const stanceId = stanceIdFromPath(url.pathname);
    const known = url.pathname === "/" || url.pathname.startsWith("/about") || stanceId !== "plaza" || url.pathname.startsWith("/projects") || url.pathname.startsWith("/journal") || url.pathname.startsWith("/workshop");
    if (!known) return;
    if (/\.(xml|txt|png|jpe?g|webp|avif|svg|glb|hdr)$/i.test(url.pathname)) return;
    event.preventDefault();
    void show(url, true);
  }

  function onPop() {
    if (!handle || listed()) return;
    const url = new URL(window.location.href);
    reading = isReadingPath(url.pathname);
    stance = stanceIdFromPath(url.pathname);
    hidePreview();
    handle.goTo(stance, { fly: true, reading });
    if (!listed()) mount(stance);
    markNav(url.pathname);
    void pageMain(url.pathname)
      .then((page) => {
        if (main) {
          main.innerHTML = page.html;
          armVideos(main);
        }
        if (page.title) document.title = page.title;
      })
      .catch(() => undefined);
  }

  document.addEventListener("click", onClick);
  window.addEventListener("popstate", onPop);
  narrowQuery.addEventListener("change", () => applyMode());
  listToggle?.addEventListener("click", (event) => {
    if (!handle) return;
    event.preventDefault();
    setList(!listed());
    main?.focus();
  });
  skip?.addEventListener("click", (event) => {
    if (!handle || listed()) return;
    event.preventDefault();
    setList(true);
    main?.focus();
  });

  try {
    if (sessionStorage.getItem("forge-list") === "1") document.body.classList.add("is-list");
  } catch {
    /* private mode */
  }

  return {
    panels: () => slots.map((slot) => ({ id: slot.id, element: slot.article })),
    attach(next) {
      handle = next;
      stance = stanceIdFromPath(window.location.pathname);
      reading = isReadingPath(window.location.pathname);
      applyMode();
      next.goTo(stance, { fly: false, reading });
      void fillInactive();
    },
    detach() {
      handle = null;
      document.body.classList.remove("is-world", "is-narrow", "is-list");
      parkMain();
      root.hidden = true;
      if (listToggle) {
        listToggle.textContent = "List view";
        listToggle.setAttribute("aria-pressed", "false");
      }
    },
    open(href) {
      void show(new URL(href, window.location.origin), true);
    },
  };
}
