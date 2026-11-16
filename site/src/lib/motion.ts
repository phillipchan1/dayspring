// ============================================================
// Motion core for the home page — one GSAP + ScrollTrigger + Lenis setup that
// every scene shares, so smooth scroll and the scroll-scrubbed timelines run
// off the same clock.
//
// Scenes are built on CSS sticky (a tall section, a 100vh sticky stage), not
// on ScrollTrigger pinning: no pin-spacers to fight, and with motion off the
// section simply collapses to its natural height and shows its final frame.
//
// prefers-reduced-motion: no Lenis, no scrubbing. Each scene checks `reduced`
// and sets its end state instead (see `.is-static` in landing.css).
// ============================================================
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

// `?still` forces the reduced-motion page, for checking it without changing
// the OS setting.
export const reduced =
  typeof window !== "undefined" &&
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    new URLSearchParams(window.location.search).has("still"));

let lenis: Lenis | null = null;
let booted = false;

export function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  document.documentElement.classList.toggle("motion-off", reduced);

  if (!reduced) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis?.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Whole-page progress → the sky. 0 at the top (night), 1 at the bottom
  // (dawn). Every scene reads --dawn for free.
  const root = document.documentElement;
  const setDawn = () => {
    const max = root.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    root.style.setProperty("--dawn", p.toFixed(4));
  };
  setDawn();
  if (lenis) lenis.on("scroll", setDawn);
  else window.addEventListener("scroll", setDawn, { passive: true });

  // Fonts and late layout move every trigger; refresh once things settle.
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  window.addEventListener("load", refresh);
}

/** A scrubbed timeline across a tall sticky section. */
export function scrubScene(
  section: Element,
  build: (tl: gsap.core.Timeline) => void,
  opts: { start?: string; end?: string; scrub?: number | boolean; invalidateOnRefresh?: boolean } = {},
) {
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: section,
      start: opts.start ?? "top top",
      end: opts.end ?? "bottom bottom",
      scrub: opts.scrub ?? 0.6,
      invalidateOnRefresh: opts.invalidateOnRefresh ?? false,
    },
  });
  build(tl);
  return tl;
}

export { gsap, ScrollTrigger };

/**
 * Entrance reveals for the inner pages — declarative, so each page's markup
 * says what rises and nothing else needs a script.
 *
 *   data-rv              rises in when it reaches the lower fifth of the screen
 *   data-rv="plate"      a product picture: tilts up out of the page as it rises
 *   data-rv-stagger      its direct children rise one after another
 *   .rv-h .split         a heading split by Split.astro: words rise letter-first
 *
 * With motion off nothing is hidden, so the page simply reads as content.
 */
export function reveal(root: ParentNode = document) {
  if (reduced) return;
  const enter = (el: Element) => ({ trigger: el, start: "top 86%", once: true });

  root.querySelectorAll<HTMLElement>(".rv-h .split").forEach((s) => {
    const ws = s.querySelectorAll(".w");
    gsap.from(ws, {
      yPercent: 110,
      opacity: 0,
      rotate: 3,
      filter: "blur(8px)",
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.05,
      scrollTrigger: enter(s),
    });
  });

  root.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => {
    const plate = el.dataset.rv === "plate";
    gsap.from(el, {
      y: plate ? 70 : 36,
      opacity: 0,
      rotateX: plate ? 12 : 0,
      scale: plate ? 0.96 : 1,
      transformPerspective: 1400,
      transformOrigin: "50% 100%",
      duration: plate ? 1.5 : 1.1,
      ease: "expo.out",
      scrollTrigger: enter(el),
    });
  });

  root.querySelectorAll<HTMLElement>("[data-rv-stagger]").forEach((el) => {
    gsap.from(el.children, {
      y: 30,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: Number(el.dataset.rvStagger) || 0.07,
      scrollTrigger: enter(el),
    });
  });
}
