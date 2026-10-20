import { cloneLegalBody } from "../utils/legal-content.js";
import { initSectionNav } from "./section-nav.js";

const instances = new WeakMap();
const attribute = "data-legal-toc-ready";

function mount(root) {
  if (instances.has(root)) return null;
  const view = root.ownerDocument.defaultView;
  let active = true;
  let initialised = false;
  let loaded = false;
  let running = false;
  let requested = 0;
  let completed = 0;
  let destroyNav = null;
  const body = root.querySelector("[data-legal-current] [data-legal-body]");
  const toc = root.querySelector(".page-contents");
  const rows = toc?.querySelector(".page-contents_rows");
  // A single authored template (including nested heading levels). If FS has
  // already run, its first generated component retains the template markers.
  const template = rows?.firstElementChild?.querySelector('[fs-toc-element="link"]')
    ? rows.firstElementChild.cloneNode(true) : null;
  let bodyCopy = body ? cloneLegalBody(body, root) : null;
  root.removeAttribute(attribute);

  function update() {
    if (!active) return false;
    const links = [...(toc?.querySelectorAll('a[href^="#"]:not([href="#"])') || [])];
    const ids = new Set([...(body?.querySelectorAll("[id]") || [])].map(el => el.id));
    const valid = initialised && links.length > 0 && links.every(link => {
      try { return ids.has(decodeURIComponent(link.hash.slice(1))); }
      catch { return false; }
    });
    if (valid) {
      if (root.getAttribute(attribute) !== "true") root.setAttribute(attribute, "true");
      if (!destroyNav) destroyNav = initSectionNav(toc, { selector: ".page-contents_rows", capture: true });
    } else {
      root.removeAttribute(attribute);
      destroyNav?.();
      destroyNav = null;
    }
    return valid;
  }
  function invalidate() {
    initialised = false;
    root.removeAttribute(attribute);
    destroyNav?.();
    destroyNav = null;
  }
  async function rebuild() {
    const controls = view.FinsweetAttributes?.modules?.toc;
    if (running || !loaded || !template || !body || !rows || !controls?.restart) return;
    running = true;
    try {
      while (active && completed < requested) {
        const generation = requested;
        invalidate();
        // Destroy cannot restore consumed templates or unwrap rich text.
        // Always rebuild from our latest clean revision snapshot.
        body.replaceChildren(...[...bodyCopy.childNodes].map(node => node.cloneNode(true)));
        rows.replaceChildren(template.cloneNode(true));
        try {
          await controls.restart();
          if (!active) break;
          if (generation === requested) {
            initialised = true;
            update();
          }
        } catch {
          // A failed library load keeps the document readable and the optional
          // TOC absent. A later revision change can try again.
          invalidate();
        }
        completed = generation;
      }
    } finally {
      running = false;
    }
  }
  function revisionChanged() {
    invalidate();
    if (body) bodyCopy = cloneLegalBody(body, root);
    requested++;
    void rebuild();
  }
  const observer = new view.MutationObserver(update);
  observer.observe(root, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["href", "id"],
  });
  root.addEventListener("legal:beforerevisionchange", invalidate);
  root.addEventListener("legal:revisionchange", revisionChanged);
  view.FinsweetAttributes ||= [];
  view.FinsweetAttributes.push(["toc", () => {
    if (!active) return;
    loaded = true;
    initialised = true;
    if (!template) {
      update();
      return;
    }
    // Rebuild once from the clean snapshot even if auto-init produced links:
    // imported CMS wrappers may have hidden some headings from its first pass.
    if (completed === 0 || requested > completed || !update()) {
      requested++;
      invalidate();
      void rebuild();
    }
  }]);
  const destroy = () => {
    active = false;
    observer.disconnect();
    root.removeEventListener("legal:beforerevisionchange", invalidate);
    root.removeEventListener("legal:revisionchange", revisionChanged);
    invalidate();
    instances.delete(root);
  };
  instances.set(root, destroy);
  return destroy;
}

export function initLegalToc(scope = document) {
  const roots = scope.matches?.("[data-legal-manager]")
    ? [scope] : [...scope.querySelectorAll("[data-legal-manager]")];
  const cleanups = roots.map(mount).filter(Boolean);
  return () => cleanups.forEach(destroy => destroy());
}

export default { name: "legal-toc", init: initLegalToc };
