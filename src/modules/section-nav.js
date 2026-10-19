// Opt-in section links. CSS owns the header offset and current appearance.
const records = new WeakMap();

export function initSectionNav(
  scope = document,
  { selector = "[data-section-nav]", capture = false } = {},
) {
  const roots = [...scope.querySelectorAll(selector)];
  if (scope.matches?.(selector)) roots.unshift(scope);
  const created = [];
  for (const root of roots) {
    if (records.has(root)) continue;
    const entries = [...root.querySelectorAll('a[href^="#"]')].map((link) => ({
      link,
      target: root.ownerDocument.getElementById(decodeURIComponent(link.hash.slice(1))),
      original: link.getAttribute("aria-current"),
    }));
    const view = root.ownerDocument.defaultView;
    const select = (entry) =>
      entries.forEach((item) => {
        if (item === entry) item.link.setAttribute("aria-current", "location");
        else item.link.removeAttribute("aria-current");
      });
    const update = () => {
      let current = entries[0];
      for (const entry of entries) {
        const offset = parseFloat(view.getComputedStyle(entry.target).scrollMarginTop);
        if (entry.target.getBoundingClientRect().top <= offset + 1) current = entry;
      }
      select(current);
    };
    let frame;
    const schedule = () => {
      if (frame !== undefined) return;
      frame = view.requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    };
    const click = (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      const entry = entries.find((item) => item.link.contains(event.target));
      if (!entry) return;
      event.preventDefault();
      // This nav owns its scrolling; do not also run Webflow's body handler.
      event.stopPropagation();
      select(entry);
      if (view.location.hash !== entry.link.hash) view.history.pushState(null, "", entry.link.hash);
      entry.target.scrollIntoView({
        block: "start",
        behavior: view.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    };
    root.addEventListener("click", click, capture);
    view.addEventListener("scroll", schedule, { passive: true });
    view.addEventListener("resize", schedule);
    view.addEventListener("hashchange", schedule);
    update();
    const record = {
      destroy() {
        root.removeEventListener("click", click, capture);
        view.removeEventListener("scroll", schedule);
        view.removeEventListener("resize", schedule);
        view.removeEventListener("hashchange", schedule);
        if (frame !== undefined) view.cancelAnimationFrame(frame);
        entries.forEach(({ link, original }) =>
          original === null
            ? link.removeAttribute("aria-current")
            : link.setAttribute("aria-current", original),
        );
        records.delete(root);
      },
    };
    records.set(root, record);
    created.push(record);
  }
  return () => created.forEach((record) => record.destroy());
}

export default { name: "section-nav", init: initSectionNav };
