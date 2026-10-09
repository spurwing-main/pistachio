/**
 * Accordion hooks match TPF and Suttons:
 *   data-accordion="component" contains item, trigger (button), and content hooks.
 *   data-accordion-first-open="true" opens the first valid item (default false).
 *   data-accordion-close-others="false" allows several open items (default true).
 * Items get is-open and data-accordion-open="true|false" for Designer styling.
 * Re-run initAccordions(scope) after inserting CMS content. Returns a cleanup function.
 */

const selector = (value) => `[data-accordion="${value}"]`;
const records = new WeakMap();
let nextId = 0;

function snapshot(element, names) {
  const values = names.map((name) => [name, element.getAttribute(name)]);
  return () => values.forEach(([name, value]) => {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  });
}

function owned(item, kind) {
  return [...item.querySelectorAll(selector(kind))].find((element) =>
    element.closest(selector("item")) === item &&
    element.closest(selector("component")) === item.closest(selector("component")));
}

function setupItem(item, component, initiallyOpen) {
  const trigger = owned(item, "trigger");
  const content = owned(item, "content");
  if (!trigger || trigger.tagName !== "BUTTON" || !content) return null;

  const restore = [
    snapshot(item, ["class", "data-accordion-open"]),
    snapshot(trigger, ["aria-expanded", "aria-controls"]),
    snapshot(content, ["id", "aria-hidden", "inert", "style"]),
  ];
  if (!content.id) {
    do { nextId += 1; } while (content.ownerDocument.getElementById(`accordion-content-${nextId}`));
    content.id = `accordion-content-${nextId}`;
  }
  trigger.setAttribute("aria-controls", content.id);

  let open;
  let animation;
  const setOpen = (value, animate = true) => {
    if (open === value) return;
    const view = content.ownerDocument.defaultView;
    const from = view.getComputedStyle(content).height;
    animation?.cancel();
    animation = null;
    open = value;
    if (!open && content.contains(content.ownerDocument.activeElement)) trigger.focus();
    item.classList.toggle("is-open", open);
    item.dataset.accordionOpen = String(open);
    trigger.setAttribute("aria-expanded", String(open));
    content.setAttribute("aria-hidden", String(!open));
    content.toggleAttribute("inert", !open);
    content.style.height = open ? "auto" : "0px";
    content.style.overflow = open ? "" : "hidden";

    if (!animate || !content.animate || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const to = view.getComputedStyle(content).height;
    content.style.overflow = "hidden";
    const current = content.animate({ height: [from, to] }, {
      duration: 400,
      easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    });
    animation = current;
    current.onfinish = () => {
      if (animation !== current) return;
      animation = null;
      content.style.overflow = open ? "" : "hidden";
    };
  };

  const onClick = (event) => {
    event.preventDefault();
    if (!open && component.dataset.accordionCloseOthers !== "false") {
      component.querySelectorAll(selector("item")).forEach((other) => {
        if (other !== item && other.closest(selector("component")) === component) {
          records.get(other)?.setOpen(false);
        }
      });
    }
    setOpen(!open);
  };
  trigger.addEventListener("click", onClick);
  setOpen(initiallyOpen, false);
  const record = {
    setOpen,
    destroy() {
      if (records.get(item) !== record) return;
      animation?.cancel();
      animation = null;
      trigger.removeEventListener("click", onClick);
      restore.forEach((reset) => reset());
      records.delete(item);
    },
  };
  records.set(item, record);
  return record;
}

export function initAccordions(scope = document) {
  const components = [...scope.querySelectorAll(selector("component"))];
  if (scope.matches?.(selector("component"))) components.unshift(scope);
  const parent = scope.closest?.(selector("component"));
  if (parent && !components.includes(parent)) components.unshift(parent);
  const created = [];
  components.forEach((component) => {
    const items = [...component.querySelectorAll(selector("item"))].filter((item) =>
      item.closest(selector("component")) === component);
    let hasValidItem = false;
    items.forEach((item) => {
      if (records.has(item)) { hasValidItem = true; return; }
      const record = setupItem(item, component,
        !hasValidItem && component.dataset.accordionFirstOpen === "true");
      if (record) { created.push(record); hasValidItem = true; }
    });
  });
  return () => created.forEach((record) => record.destroy());
}

export default { name: "accordions", init: initAccordions };
