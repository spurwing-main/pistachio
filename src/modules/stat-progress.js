/** Independent, decorative stat bars. Set data-stat-progress on the fill itself. */
import { animate } from "motion/mini";
import { inView } from "motion";

const processed = new WeakSet();

export function progressRatio(value) {
  if (value == null || String(value).trim() === "") return 1;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(number, 100)) / 100 : 1;
}

export function initStatProgress(scope = document) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cleanups = [];
  const nextStarts = new WeakMap();
  const fills = [...scope.querySelectorAll("[data-stat-progress]")];
  if (scope.matches?.("[data-stat-progress]")) fills.unshift(scope);

  for (const fill of fills) {
    if (processed.has(fill)) continue;
    processed.add(fill);
    // Native component structure: card > track > fill. No root attribute required.
    const stat = fill.parentElement?.parentElement ?? fill;
    const end = `scaleX(${progressRatio(fill.getAttribute("data-stat-progress"))})`;
    let played = reduced.matches;
    let stop = () => {};
    let observe = () => {};
    let animation;
    fill.style.transformOrigin = "left center";
    fill.style.transform = end;

    const finish = () => {
      played = true;
      stop();
      animation?.complete();
      fill.style.transform = end;
    };

    if (!reduced.matches) {
      try {
        const style = window.getComputedStyle(stat);
        const milliseconds = parseFloat(style.getPropertyValue("--motion-reveal"));
        const curve = style.getPropertyValue("--ease-out-expo").trim();
        const easing = /^cubic-bezier\(([^)]+)\)$/.exec(curve)?.[1].split(",").map(Number);
        fill.style.transform = "scaleX(0)";
        const enter = () => {
          if (played) return;
          played = true;
          fill.style.transform = end;
          try {
            const group = stat.parentElement ?? stat;
            const now = performance.now() / 1000;
            // Stagger only cards arriving together, with no long queue for large slots.
            const delay = Math.max(0, Math.min((nextStarts.get(group) ?? now) - now, 0.3));
            nextStarts.set(group, now + delay + 0.1);
            animation = animate(fill, { transform: ["scaleX(0)", end] }, {
              delay,
              duration: Number.isFinite(milliseconds) ? Math.max(0, milliseconds) / 1000 : 0.9,
              ease: easing?.length === 4 && easing.every(Number.isFinite) ? easing : [0.16, 1, 0.3, 1],
            });
          } catch { fill.style.transform = end; }
          // No leave callback: Motion unobserves this item after its first entry.
        };
        observe = () => {
          stop();
          // IntersectionObserver percentage margins resolve against width, so use height in px.
          stop = inView(stat, enter, {
            margin: `0px 0px -${window.innerHeight * 0.25}px 0px`, amount: "some",
          });
        };
        observe();
      } catch { finish(); }
    }
    const onPreference = () => { if (reduced.matches) finish(); };
    const onResize = () => {
      if (played || reduced.matches) return;
      try { observe(); } catch { finish(); }
    };
    reduced.addEventListener("change", onPreference);
    window.addEventListener("resize", onResize);
    cleanups.push(() => {
      finish();
      reduced.removeEventListener("change", onPreference);
      window.removeEventListener("resize", onResize);
      processed.delete(fill);
    });
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

export default { name: "statProgress", init: initStatProgress };
