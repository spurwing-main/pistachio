/** Native sticky positioning owns the stack; only its inner surfaces scale.
 * Missing CSS, small screens, reduced motion and tall cards retain normal flow.
 * Keyboard focus opts that stack out for the session, keeping covered links reachable.
 */
const processed = new WeakSet();

export function initRiskStack(scope = document) {
  const roots = [...scope.querySelectorAll(".risk-stack")];
  if (scope.matches?.(".risk-stack")) roots.unshift(scope);
  const cleanups = [];
  for (const root of roots) {
    if (processed.has(root)) continue;
    processed.add(root);
    const panels = [...root.querySelectorAll(".risk-panel")].filter(p => p.closest(".risk-stack") === root);
    const surfaces = panels.map(p => p.querySelector(".risk-panel_surface"));
    const original = surfaces.map(s => s?.style.transform || "");
    const indices = panels.map(p => p.style.getPropertyValue("--risk-stack-index"));
    panels.forEach((p, i) => p.style.setProperty("--risk-stack-index", i));
    const media = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    let active = false, keyboard = false, frame = 0, top = 112, destroyed = false, needsMeasure = false;
    const restore = () => surfaces.forEach((s, i) => { if (s) s.style.transform = original[i]; });
    const paint = () => {
      if (!active) return;
      // Read all positions before writing transforms. Sticky wrappers never scale.
      const positions = panels.map(p => p.getBoundingClientRect());
      surfaces.forEach((surface, i) => {
        if (!surface || i === panels.length - 1) return;
        const progress = Math.max(0, Math.min(1, 1 - (positions[i + 1].top - top - (i + 1) * 16) / positions[i].height));
        surface.style.transform = `scale(${1 - .06 * progress})`;
      });
    };
    const measure = () => {
      if (destroyed) return;
      const style = getComputedStyle(root);
      top = parseFloat(style.getPropertyValue("--risk-stack-top")) || 112;
      active = media.matches && !keyboard && panels.length > 1
        && style.getPropertyValue("--risk-stack-ready").trim() === "1"
        && panels.every((p, i) => p.getClientRects().length && p.offsetHeight > 0 && p.offsetHeight + top + i * 16 + 32 <= window.innerHeight);
      root.classList.toggle("is-risk-stack-active", active);
      if (active) paint(); else restore();
    };
    const queue = () => {
      if (frame || destroyed) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (needsMeasure) { needsMeasure = false; measure(); } else paint();
      });
    };
    const schedule = () => { needsMeasure = true; queue(); };
    const onScroll = () => {
      if (active) queue();
    };
    const focus = event => {
      // Pointer focus must not move a button between mousedown and click.
      if (!event.target.matches(":focus-visible")) return;
      keyboard = true;
      measure();
      // Browser focus scrolling may have occurred while the target was still sticky.
      root.ownerDocument.activeElement?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    panels.forEach(p => observer?.observe(p));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", measure);
    root.addEventListener("focusin", focus);
    measure();
    cleanups.push(() => {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", measure);
      root.removeEventListener("focusin", focus);
      root.classList.remove("is-risk-stack-active");
      restore();
      panels.forEach((p, i) => {
        if (indices[i]) p.style.setProperty("--risk-stack-index", indices[i]);
        else p.style.removeProperty("--risk-stack-index");
      });
      processed.delete(root);
    });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}

export default { name: "risk-stack", init: initRiskStack };
