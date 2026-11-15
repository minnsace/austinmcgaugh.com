/** Remembered presentation. "full" is the desktop/Quest scene. "mobile" is /m/. */
export const SHELL_KEY = "forge-shell";

export type ShellChoice = "mobile" | "full" | null;
export type ShellName = "mobile" | "full";

const PHONE_UA = /iPhone|iPod|Android.+Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i;
const QUEST_UA = /Quest|OculusBrowser|\bOculus\b/i;

export function isQuestUa(ua: string): boolean {
  return QUEST_UA.test(ua);
}

export function isQuestBrand(brand: string): boolean {
  return /Oculus|Quest/i.test(brand);
}

export function isPhoneUa(ua: string): boolean {
  return PHONE_UA.test(ua);
}

/**
 * Pick a shell.
 *
 * An explicit choice wins, except Quest never auto-switches.
 * Otherwise a phone is a coarse pointer, a small viewport (short side counts,
 * so landscape still matches), and a mobile client hint. When UA-CH is missing,
 * the UA regex stands in for that hint.
 */
export function decideShell(input: {
  choice: ShellChoice;
  quest: boolean;
  coarse: boolean;
  small: boolean;
  uaMobile: boolean | null;
  ua: string;
}): ShellName {
  if (input.choice === "mobile") return "mobile";
  if (input.choice === "full" || input.quest) return "full";
  const declared = input.uaMobile === null ? isPhoneUa(input.ua) : input.uaMobile;
  if (input.coarse && input.small && declared) return "mobile";
  return "full";
}

export function toMobilePath(pathname: string): string {
  const path = pathname || "/";
  if (path === "/404" || path === "/404/" || path === "/404.html") return "/m/";
  if (path === "/m" || path.startsWith("/m/")) return path.endsWith("/") || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`;
  if (path === "/") return "/m/";
  const withSlash = path.endsWith("/") || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`;
  return `/m${withSlash}`;
}

export function toFullPath(pathname: string): string {
  if (pathname === "/m" || pathname === "/m/") return "/";
  if (pathname.startsWith("/m/")) {
    const rest = pathname.slice(2);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname || "/";
}

/**
 * Blocking head script. Sets `documentElement.dataset.shell` and swaps
 * `/…` with `/m/…` before the desktop scene module is requested.
 */
export const shellScript = `(function(){
  var KEY = "forge-shell";
  function quest() {
    var ua = navigator.userAgent || "";
    if (/Quest|OculusBrowser|\\bOculus\\b/i.test(ua)) return true;
    var data = navigator.userAgentData;
    var brands = data && data.brands;
    if (brands) {
      for (var i = 0; i < brands.length; i++) {
        if (/Oculus|Quest/i.test(brands[i].brand || "")) return true;
      }
    }
    return false;
  }
  function phoneUa(ua) {
    return /iPhone|iPod|Android.+Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua);
  }
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  var coarse = false;
  var small = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
    small = window.matchMedia("(max-width: 900px), (max-height: 500px)").matches;
  } catch (e) {}
  var data = navigator.userAgentData;
  var uaMobile = data && typeof data.mobile === "boolean" ? data.mobile : null;
  var ua = navigator.userAgent || "";
  var declared = uaMobile === null ? phoneUa(ua) : uaMobile;
  var shell = "full";
  if (choice === "mobile") shell = "mobile";
  else if (choice === "full" || quest()) shell = "full";
  else if (coarse && small && declared) shell = "mobile";
  document.documentElement.dataset.shell = shell;
  var path = location.pathname || "/";
  if (path !== "/" && !path.endsWith("/") && !/\\.[a-z0-9]+$/i.test(path)) path += "/";
  var onMobile = path === "/m/" || path.indexOf("/m/") === 0;
  var skip = /\\.(xml|txt|png|jpe?g|webp|avif|svg|glb|hdr|ico|js|css|map|woff2?)$/i.test(path) || path === "/404.html";
  if (!skip && shell === "mobile" && !onMobile) {
    document.documentElement.style.visibility = "hidden";
    location.replace((path === "/" ? "/m/" : "/m" + path) + location.search + location.hash);
  } else if (!skip && shell === "full" && onMobile) {
    document.documentElement.style.visibility = "hidden";
    var rest = path.slice(2) || "/";
    if (rest.charAt(0) !== "/") rest = "/" + rest;
    location.replace(rest + location.search + location.hash);
  }
  document.addEventListener("click", function (event) {
    var node = event.target;
    var link = node && node.closest ? node.closest("[data-shell]") : null;
    if (!link) return;
    var next = link.getAttribute("data-shell");
    if (next !== "mobile" && next !== "full") return;
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();`;
