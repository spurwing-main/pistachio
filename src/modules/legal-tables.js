const instances = new WeakMap();

function mount(body) {
  if (instances.has(body)) return null;
  const doc = body.ownerDocument;
  const view = doc.defaultView;
  const records = new Map();
  const resize = view.ResizeObserver ? new view.ResizeObserver(measure) : null;

  function measure() {
    for (const { scroll, label } of records.values()) {
      const overflow = scroll.scrollWidth > scroll.clientWidth + 1;
      if (overflow) {
        scroll.setAttribute("tabindex", "0");
        scroll.setAttribute("role", "region");
        scroll.setAttribute("aria-label", label);
      } else {
        // Keep a focused region focusable until focus leaves it.
        if (doc.activeElement !== scroll) scroll.removeAttribute("tabindex");
        scroll.removeAttribute("role");
        scroll.removeAttribute("aria-label");
      }
    }
  }

  function refresh() {
    for (const [table, record] of records) {
      if (body.contains(table) && record.scroll.contains(table)) continue;
      resize?.unobserve(table);
      resize?.unobserve(record.scroll);
      record.scroll.removeEventListener("blur", measure);
      records.delete(table);
    }
    for (const table of body.querySelectorAll("table")) {
      if (records.has(table) || table.parentElement.closest("table")) continue;
      const headers = [...(table.rows[0]?.cells || [])].map(cell => cell.textContent.trim().replace(/\s+/g, " "));
      // TOC rebuilds can clone our wrappers; adopt them without nesting more.
      let scroll = table.parentElement.matches(".legal-table-scroll") ? table.parentElement : null;
      if (!scroll) {
        scroll = doc.createElement("div");
        scroll.className = "legal-table-scroll";
        table.before(scroll);
        scroll.append(table);
      }
      scroll.addEventListener("blur", measure);
      const label = `${headers.join(", ") || "Policy"} table. Scroll horizontally for more columns.`;
      records.set(table, { scroll, label });
      resize?.observe(table);
      resize?.observe(scroll);
    }
    measure();
  }

  const observer = new view.MutationObserver(refresh);
  refresh();
  observer.observe(body, { childList: true, subtree: true });
  view.addEventListener("resize", measure);
  const destroy = () => {
    observer.disconnect();
    resize?.disconnect();
    view.removeEventListener("resize", measure);
    for (const [table, { scroll }] of records) {
      scroll.removeEventListener("blur", measure);
      if (body.contains(scroll)) scroll.replaceWith(table);
    }
    records.clear();
    instances.delete(body);
  };
  instances.set(body, destroy);
  return destroy;
}

export function initLegalTables(scope = document) {
  const selector = "[data-legal-current] [data-legal-body]";
  const bodies = scope.matches?.(selector) ? [scope] : [...scope.querySelectorAll(selector)];
  const cleanups = bodies.map(mount).filter(Boolean);
  return () => cleanups.forEach(destroy => destroy());
}

export default { name: "legal-tables", init: initLegalTables };
