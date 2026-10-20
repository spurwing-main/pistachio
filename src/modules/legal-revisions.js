const instances = new WeakMap();
const text = (element, selector) => element.querySelector(selector)?.textContent.trim() || "";

function readContent(element) {
  if (!element) return null;
  const revision = text(element, "[data-legal-revision]");
  const date = text(element, "[data-legal-date]");
  const body = element.querySelector("[data-legal-body]");
  return revision && date && body?.textContent.trim() ? { revision, date, element } : null;
}

function mount(root) {
  if (instances.has(root)) return null;
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const current = root.querySelector("[data-legal-current]");
  const source = root.querySelector("[data-legal-sources]");
  const controls = root.querySelector("[data-legal-controls]");
  const select = controls?.querySelector("select[data-legal-select]");
  const status = root.querySelector("[data-legal-status]");
  const key = text(root, "[data-legal-document-key]");
  const initial = readContent(current);
  if (!key || !initial || !source || !select || !status ||
      current.contains(source) || current.contains(controls)) return null;

  const versions = new Map([[initial.revision, initial]]);
  const ambiguous = new Set();
  for (const record of source.querySelectorAll("[data-legal-record]")) {
    if (text(record, "[data-legal-document-key]") !== key) continue;
    const entry = readContent(record.querySelector("[data-legal-content]"));
    if (!entry || entry.revision === initial.revision) continue;
    if (versions.has(entry.revision)) ambiguous.add(entry.revision);
    versions.set(entry.revision, entry);
  }
  for (const revision of ambiguous) versions.delete(revision);

  // Keep CMS markup in memory, outside the document: historical headings and
  // footnote IDs must not collide with those in the visible revision.
  const sourceNodes = [...source.childNodes];
  source.replaceChildren();
  const originalNodes = [...current.childNodes];
  const originalOptions = [...select.childNodes];
  const originalStatus = status.textContent;
  const originalHidden = controls.hidden;
  select.replaceChildren();
  for (const [revision, entry] of versions) {
    const option = doc.createElement("option");
    option.value = revision;
    option.textContent = `Revision ${revision} — ${entry.date}${revision === initial.revision ? " (current)" : ""}`;
    select.append(option);
  }
  controls.hidden = versions.size < 2;
  let active = initial.revision;
  let destroyed = false;
  function render(requested) {
    const unavailable = requested !== null && !versions.has(requested);
    const revision = unavailable || requested === null ? initial.revision : requested;
    const entry = versions.get(revision);
    if (revision !== active) {
      current.replaceChildren(...(revision === initial.revision
        ? originalNodes
        : [...entry.element.childNodes].map(node => node.cloneNode(true))));
      active = revision;
      root.dispatchEvent(new view.CustomEvent("legal:revisionchange", {
        bubbles: true, detail: { revision, current: revision === initial.revision },
      }));
    }
    select.value = revision;
    status.textContent = unavailable
      ? `That revision is unavailable. Showing current revision ${initial.revision}.`
      : revision === initial.revision
        ? `Showing current revision ${revision}.`
        : `Showing historical revision ${revision}. The current revision is ${initial.revision}.`;
  }
  function fromUrl() {
    render(new URL(view.location.href).searchParams.get("revision"));
  }
  function onChange() {
    if (!versions.has(select.value)) return;
    const url = new URL(view.location.href);
    if (select.value === initial.revision) url.searchParams.delete("revision");
    else url.searchParams.set("revision", select.value);
    // A heading fragment from another revision may no longer exist.
    url.hash = "";
    if (url.href !== view.location.href) view.history.pushState(view.history.state, "", url);
    render(select.value);
  }
  select.addEventListener("change", onChange);
  view.addEventListener("popstate", fromUrl);
  fromUrl();
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    select.removeEventListener("change", onChange);
    view.removeEventListener("popstate", fromUrl);
    current.replaceChildren(...originalNodes);
    source.replaceChildren(...sourceNodes);
    select.replaceChildren(...originalOptions);
    controls.hidden = originalHidden;
    status.textContent = originalStatus;
    instances.delete(root);
  };
  instances.set(root, destroy);
  return destroy;
}

export function initLegalRevisions(scope = document) {
  const roots = scope.matches?.("[data-legal-manager]")
    ? [scope] : [...scope.querySelectorAll("[data-legal-manager]")];
  const cleanups = roots.map(mount).filter(Boolean);
  return () => cleanups.forEach(destroy => destroy());
}

export default { name: "legal-revisions", init: initLegalRevisions };
