/**
 * Entrance motion: one effect, a short rise and fade, staggered inside a block.
 * The hero is CSS only (the `motion` embed): it plays on first paint, so nothing flashes.
 * data-reveal="" brings in the block itself; data-reveal="group" brings in its children,
 * or a lone wrapper's children (such as a slot).
 * A block already on screen when the page starts is left alone, so nothing visible
 * disappears and comes back. A block below the fold takes its start state while it is
 * still off screen, and plays once when it scrolls in.
 * CSS owns the duration, easing, distance and stagger. Reduced motion shows everything at rest.
 */
import { animate } from "motion/mini";
import { inView } from "motion";

const processed = new WeakSet();

function targetsOf(block) {
  if (block.dataset.reveal !== "group") return [block];
  let items = Array.from(block.children);
  if (items.length === 1 && items[0].children.length > 1) items = Array.from(items[0].children);
  return items.filter((item) => item.getClientRects().length);
}

function onScreen(block) {
  const rect = block.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

export function initReveal(scope = document) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cleanups = [];

  for (const block of scope.querySelectorAll("[data-reveal]")) {
    if (processed.has(block) || block.dataset.reveal === "hero") continue;
    processed.add(block);
    if (reduced.matches || onScreen(block)) {
      cleanups.push(() => processed.delete(block));
      continue;
    }

    const style = getComputedStyle(block);
    const from = style.getPropertyValue("--reveal-from").trim();
    const duration = parseFloat(style.getPropertyValue("--reveal-duration")) / 1000;
    const step = parseFloat(style.getPropertyValue("--motion-step")) / 1000;
    const ease = style.getPropertyValue("--reveal-ease").trim().slice(13, -1).split(",").map(Number);
    const targets = targetsOf(block);
    const animations = [];

    targets.forEach((target) => {
      target.style.opacity = "0";
      target.style.transform = from;
    });
    const rest = () => targets.forEach((target) => {
      target.style.opacity = "";
      target.style.transform = "";
    });

    const stopObserving = inView(block, () => {
      targets.forEach((target, index) => {
        animations.push(animate(target, { opacity: [0, 1], transform: [from, "none"] }, {
          duration, ease, delay: index * step,
        }));
      });
    }, { amount: 0.15 });

    const finish = () => {
      stopObserving();
      animations.forEach((animation) => animation.complete());
      rest();
    };
    const onPreference = () => {
      if (reduced.matches) finish();
    };
    reduced.addEventListener("change", onPreference);
    cleanups.push(() => {
      finish();
      reduced.removeEventListener("change", onPreference);
      processed.delete(block);
    });
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

export default { name: "reveal", init: initReveal };
