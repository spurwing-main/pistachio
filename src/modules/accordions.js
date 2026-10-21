/**
 * Native accordion hooks:
 *   data-accordion="component" contains item, trigger (button), and content hooks.
 *   data-accordion-first-open="true" opens the first valid item (default false).
 *   data-accordion-close-others="false" allows several open items (default true).
 * Items get is-open and data-accordion-open="true|false" for Designer styling.
 * Questions live inside native buttons; selecting their text does not toggle.
 * data-accordion-item-toggle="true" on an ancestor opts its items into whole-item
 * pointer toggling. data-accordion-click-area on the card includes its outer
 * padding, retaining the native button and interactive answer content.
 * Re-run initAccordions(scope) after inserting CMS content. Returns a cleanup function.
 */

const selector = (value) => `[data-accordion="${value}"]`;
const records = new WeakMap();
let nextId = 0;

function snapshot(element, names) {
  const values = names.map((name) => [name, element.getAttribute(name)]);
  return () =>
    values.forEach(([name, value]) => {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    });
}

function owned(item, kind) {
  return [...item.querySelectorAll(selector(kind))].find(
    (element) =>
      element.closest(selector("item")) === item &&
      element.closest(selector("component")) === item.closest(selector("component")),
  );
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
    do {
      nextId += 1;
    } while (content.ownerDocument.getElementById(`accordion-content-${nextId}`));
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

    if (
      !animate ||
      !content.animate ||
      view.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const to = view.getComputedStyle(content).height;
    content.style.overflow = "hidden";
    const current = content.animate(
      { height: [from, to] },
      {
        duration: 400,
        easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    );
    animation = current;
    current.onfinish = () => {
      if (animation !== current) return;
      animation = null;
      content.style.overflow = open ? "" : "hidden";
    };
  };

  const onClick = (event) => {
    event.preventDefault();
    const selection = item.ownerDocument.defaultView.getSelection();
    if (
      event.detail > 0 &&
      selection?.rangeCount &&
      !selection.isCollapsed &&
      selection.getRangeAt(0).intersectsNode(trigger)
    ) return;
    if (!open && component.dataset.accordionCloseOthers?.toLowerCase() !== "false") {
      component.querySelectorAll(selector("item")).forEach((other) => {
        if (other !== item && other.closest(selector("component")) === component) {
          records.get(other)?.setOpen(false);
        }
      });
    }
    setOpen(!open);
  };
  trigger.addEventListener("click", onClick);
  const area = item.closest("[data-accordion-click-area]");
  const wholeItem =
    item.closest('[data-accordion-item-toggle="true"]') &&
    area?.querySelector(selector("item")) === item;
  const clickArea = wholeItem ? area : null;
  const onAreaClick = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.target.closest("[data-accordion-click-area]") !== clickArea ||
      (event.target.closest(selector("item")) && event.target.closest(selector("item")) !== item) ||
      event.target.closest(
        "a,button,input,select,textarea,label,summary,[contenteditable],[role='button'],[role='link']",
      )
    )
      return;
    const selection = item.ownerDocument.defaultView.getSelection();
    if (!selection.isCollapsed && selection.getRangeAt(0).intersectsNode(clickArea)) return;
    trigger.focus();
    trigger.click();
  };
  if (clickArea) clickArea.addEventListener("click", onAreaClick);
  setOpen(initiallyOpen, false);
  const record = {
    setOpen,
    destroy() {
      if (records.get(item) !== record) return;
      animation?.cancel();
      animation = null;
      trigger.removeEventListener("click", onClick);
      if (clickArea) clickArea.removeEventListener("click", onAreaClick);
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
    const items = [...component.querySelectorAll(selector("item"))].filter(
      (item) => item.closest(selector("component")) === component,
    );
    let hasValidItem = false;
    items.forEach((item) => {
      if (records.has(item)) {
        hasValidItem = true;
        return;
      }
      const record = setupItem(
        item,
        component,
        !hasValidItem && component.dataset.accordionFirstOpen?.toLowerCase() === "true",
      );
      if (record) {
        created.push(record);
        hasValidItem = true;
      }
    });
  });
  return () => created.forEach((record) => record.destroy());
}

export default { name: "accordions", init: initAccordions };
