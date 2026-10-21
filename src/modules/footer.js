const instances = new WeakMap();

function mount(footer) {
  if (instances.has(footer)) return null;
  const doc = footer.ownerDocument;
  const view = doc.defaultView;
  const previous = footer.getAttribute("data-footer-keyboard");
  footer.setAttribute("data-footer-keyboard", "ready");

  // Ship the keyboard fallback with the handler, without depending on a Webflow CSS publish.
  const style = doc.createElement("style");
  style.setAttribute("data-footer-focus-style", "");
  style.textContent = `
    .footer[data-footer-keyboard="flow"] { position: relative !important; top: auto !important; bottom: auto !important; }
    .footer[data-footer-keyboard="flow"] .footer_layout,
    .footer[data-footer-keyboard]:focus-within .footer_layout {
      animation: none !important; opacity: 1 !important; transform: none !important;
    }
  `;
  doc.head.append(style);

  function reveal() {
    const active = doc.activeElement;
    if (!footer.contains(active)) return;
    const position = view.getComputedStyle(footer).position;
    if (position !== "sticky" && position !== "fixed") return;
    if (footer.getBoundingClientRect().height > view.innerHeight) {
      // Latch normal flow for this visit: restoring pinning on blur would jump the page.
      footer.setAttribute("data-footer-keyboard", "flow");
      active.scrollIntoView({ block: "center", behavior: "instant" });
    } else {
      // Scrolling the fixed/sticky link itself cannot uncover it beneath main-wrap.
      view.scrollTo({ top: (doc.scrollingElement || doc.documentElement).scrollHeight, behavior: "instant" });
    }
  }

  function onFocus(event) {
    if (event.relatedTarget instanceof view.Node && footer.contains(event.relatedTarget)) return;
    reveal();
  }
  footer.addEventListener("focusin", onFocus);
  view.addEventListener("resize", reveal);
  const observer = view.ResizeObserver ? new view.ResizeObserver(reveal) : null;
  observer?.observe(footer);
  reveal();

  const destroy = () => {
    footer.removeEventListener("focusin", onFocus);
    view.removeEventListener("resize", reveal);
    observer?.disconnect();
    style.remove();
    if (previous === null) footer.removeAttribute("data-footer-keyboard");
    else footer.setAttribute("data-footer-keyboard", previous);
    instances.delete(footer);
  };
  instances.set(footer, destroy);
  return destroy;
}

export function initFooter(scope = document) {
  const doc = scope.ownerDocument || scope;
  if (doc.documentElement.classList.contains("wf-design-mode")) return () => {};
  const footers = scope.matches?.(".footer") ? [scope] : [...scope.querySelectorAll(".footer")];
  const cleanups = footers.map(mount).filter(Boolean);
  return () => cleanups.forEach(destroy => destroy());
}

export default { name: "footer", init: initFooter };
