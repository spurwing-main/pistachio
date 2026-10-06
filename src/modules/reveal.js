/**
 * Entrance motion belongs to the marked block, not its class name.
 * data-reveal="group" brings its direct children in together, slightly staggered.
 * data-reveal="" brings in the block itself. Content starts visible; no CSS hides it.
 * data-reveal="hero" sequences the marked heading, copy, actions and media.
 * CSS owns each target's entrance, timing and easing, including report artwork.
 * Each block runs once. Reduced motion stops pending entrances and finishes active ones.
 */
import { animate } from "motion/mini";
import { inView } from "motion";

const processed = new WeakSet();

export function initReveal(scope = document) {
  const cleanups = [];
  for (const block of scope.querySelectorAll("[data-reveal]")) {
    if (processed.has(block)) continue;
    processed.add(block);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = [];
    let stopObserving = () => {};
    const finish = () => {
      stopObserving();
      animations.forEach((animation) => animation.complete());
    };
    const onPreference = () => {
      if (reduced.matches) finish();
    };

    if (!reduced.matches) {
      stopObserving = inView(block, () => {
        const targets = block.dataset.reveal === "hero"
          ? Array.from(block.querySelectorAll("[data-reveal-step]"))
          : block.dataset.reveal === "group" ? Array.from(block.children) : [block];
        const step = parseFloat(getComputedStyle(block).getPropertyValue("--motion-step")) / 1000;
        targets.filter((target) => target.getClientRects().length).forEach((target, index) => {
          const style = getComputedStyle(target);
          const ease = style.getPropertyValue("--reveal-ease").trim().slice(13, -1).split(",").map(Number);
          animations.push(animate(target, {
            opacity: [parseFloat(style.getPropertyValue("--reveal-opacity")), 1],
            transform: [style.getPropertyValue("--reveal-from").trim(), "none"],
          }, {
            duration: parseFloat(style.getPropertyValue("--reveal-duration")) / 1000,
            ease,
            delay: index * step,
          }));
        });
      }, { amount: 0.15 });
    }
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
