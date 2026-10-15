import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAccordions } from "./accordions.js";

const item = () => `<div data-accordion-click-area><div data-accordion="item"><button data-accordion="trigger">Question</button><div data-accordion="content"><a href="#">Answer</a></div></div></div>`;
const group = (attributes = "") => `<div data-accordion="component" ${attributes}>${item()}${item()}</div>`;
const richItem = (id) => `<div data-accordion="item"><div data-accordion="label" id="${id}"><p>Rich <strong>question</strong></p></div><h3><button data-accordion="trigger" aria-labelledby="${id}">+</button></h3><div data-accordion="content">Answer</div></div>`;
const labels = () => [...document.querySelectorAll('[data-accordion="label"]')];
const triggers = () => [...document.querySelectorAll('[data-accordion="trigger"]')];
const panels = () => [...document.querySelectorAll('[data-accordion="content"]')];
const states = () => triggers().map((button) => button.getAttribute("aria-expanded"));
let cleanup;
beforeEach(() => {
  document.body.innerHTML = group();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => { cleanup?.(); window.getSelection().removeAllRanges(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("accordions", () => {
  it("toggles opted-in whole items without doubling the native button click", () => {
    document.body.innerHTML = group('data-accordion-item-toggle="true"');
    cleanup = initAccordions();
    const items = [...document.querySelectorAll('[data-accordion="item"]')];
    items[0].parentElement.click();
    expect(states()).toEqual(["true", "false"]);
    expect(document.activeElement).toBe(triggers()[0]);
    panels()[0].click();
    expect(states()).toEqual(["false", "false"]);
    triggers()[0].click();
    expect(states()).toEqual(["true", "false"]);
    items[1].click();
    expect(states()).toEqual(["false", "true"]);
  });

  it("leaves answer links, controls, selected text and nested items independent", () => {
    document.body.innerHTML = group('data-accordion-item-toggle="true"');
    panels()[0].innerHTML = `<a href="#answer">Link</a><label><input type="checkbox">Choice</label><p>Selectable answer</p>${group()}`;
    cleanup = initAccordions();
    triggers()[0].click();
    panels()[0].querySelector("a").click();
    panels()[0].querySelector("label").click();
    expect(states()[0]).toBe("true");
    const range = document.createRange();
    range.selectNodeContents(panels()[0].querySelector("p"));
    window.getSelection().addRange(range);
    panels()[0].querySelector("p").click();
    expect(states()[0]).toBe("true");
    window.getSelection().removeAllRanges();
    document.querySelectorAll('[data-accordion="item"]')[1].click();
    expect(states().slice(0, 2)).toEqual(["true", "true"]);
    cleanup();
    document.querySelector('[data-accordion="item"]').click();
    expect(triggers()[0].hasAttribute("aria-expanded")).toBe(false);
  });

  it("keeps whole-item behaviour off without the placement opt-in", () => {
    cleanup = initAccordions();
    document.querySelector('[data-accordion="item"]').click();
    expect(states()).toEqual(["false", "false"]);
  });

  it("does not forward outer padding to an unmarked nested accordion", () => {
    document.body.innerHTML = group('data-accordion-item-toggle="true"');
    panels()[0].innerHTML = `<div data-accordion="component"><div data-accordion="item"><button data-accordion="trigger">Inner</button><div data-accordion="content">Inner answer</div></div></div>`;
    cleanup = initAccordions();
    document.querySelector('[data-accordion-click-area]').click();
    expect(states().slice(0, 2)).toEqual(["true", "false"]);
    triggers()[1].click();
    expect(states().slice(0, 2)).toEqual(["true", "true"]);
  });

  it("forwards a natively associated rich label to its button, focus and peer closure", () => {
    document.body.innerHTML = `<div data-accordion="component">${richItem("question-one")}${richItem("question-two")}</div>`;
    cleanup = initAccordions();
    labels()[0].querySelector("strong").click();
    expect(states()).toEqual(["true", "false"]);
    expect(document.activeElement).toBe(triggers()[0]);
    labels()[1].click();
    expect(states()).toEqual(["false", "true"]);
    expect(triggers()[1].getAttribute("aria-labelledby")).toBe("question-two");
    expect(labels()[1].id).toBe("question-two");
    labels()[1].click();
    expect(states()).toEqual(["false", "false"]);
  });

  it("does not bind labels with unset or mismatched native IDs", () => {
    document.body.innerHTML = `<div data-accordion="component">${richItem("question-one")}${richItem("question-two")}</div>`;
    labels()[0].removeAttribute("id");
    triggers()[1].setAttribute("aria-labelledby", "another-label");
    const original = labels().map((label) => label.outerHTML);
    cleanup = initAccordions();
    labels().forEach((label) => label.click());
    expect(states()).toEqual(["false", "false"]);
    expect(labels().map((label) => label.outerHTML)).toEqual(original);
    triggers()[0].click();
    expect(states()).toEqual(["true", "false"]);
  });

  it("preserves text selection instead of toggling its rich question", () => {
    document.body.innerHTML = `<div data-accordion="component">${richItem("question-one")}</div>`;
    cleanup = initAccordions();
    const range = document.createRange();
    range.selectNodeContents(labels()[0].querySelector("strong"));
    window.getSelection().addRange(range);
    labels()[0].click();
    expect(states()).toEqual(["false"]);
    expect(window.getSelection().toString()).toBe("question");
    window.getSelection().removeAllRanges();
    labels()[0].click();
    expect(states()).toEqual(["true"]);
  });

  it("leaves interactive or cancelled label clicks to their existing action", () => {
    document.body.innerHTML = `<div data-accordion="component">${richItem("question-one")}</div>`;
    labels()[0].insertAdjacentHTML("beforeend", '<button type="button">Source</button>');
    cleanup = initAccordions();
    labels()[0].querySelector("button").click();
    expect(states()).toEqual(["false"]);
    labels()[0].addEventListener("click", (event) => event.preventDefault(), { capture: true });
    labels()[0].click();
    expect(states()).toEqual(["false"]);
  });

  it("removes rich label handlers on cleanup and does not duplicate them on repeated setup", () => {
    document.body.innerHTML = `<div data-accordion="component">${richItem("question-one")}</div>`;
    const original = document.body.innerHTML;
    cleanup = initAccordions();
    initAccordions();
    labels()[0].click();
    expect(states()).toEqual(["true"]);
    cleanup();
    expect(document.body.innerHTML).toBe(original);
    const buttonClick = vi.fn();
    triggers()[0].addEventListener("click", buttonClick);
    labels()[0].click();
    expect(buttonClick).not.toHaveBeenCalled();
    cleanup = initAccordions();
    labels()[0].click();
    expect(states()).toEqual(["true"]);
    expect(buttonClick).toHaveBeenCalledTimes(1);
  });

  it("keeps nested rich labels and their buttons owned by their own group", () => {
    document.body.innerHTML = `<div data-accordion="component">${richItem("outer-question")}</div>`;
    panels()[0].innerHTML = `<div data-accordion="component">${richItem("inner-question")}</div>`;
    cleanup = initAccordions();
    labels()[0].click();
    labels()[1].click();
    expect(states()).toEqual(["true", "true"]);
    expect(document.activeElement).toBe(triggers()[1]);
  });

  it("starts closed and connects each button to an inaccessible collapsed panel", () => {
    cleanup = initAccordions();
    expect(states()).toEqual(["false", "false"]);
    panels().forEach((panel, index) => {
      expect(panel.style.height).toBe("0px");
      expect(panel.hasAttribute("inert")).toBe(true);
      expect(panel.getAttribute("aria-hidden")).toBe("true");
      expect(triggers()[index].getAttribute("aria-controls")).toBe(panel.id);
    });
    expect(panels()[0].id).not.toBe(panels()[1].id);
  });

  it("opens the first item on request, closes siblings, and allows all items to close", () => {
    document.body.innerHTML = group('data-accordion-first-open="true"');
    cleanup = initAccordions();
    expect(states()).toEqual(["true", "false"]);
    triggers()[1].click();
    expect(states()).toEqual(["false", "true"]);
    expect(panels()[1].hasAttribute("inert")).toBe(false);
    expect(panels()[1].style.height).toBe("auto");
    triggers()[1].click();
    expect(states()).toEqual(["false", "false"]);
  });

  it("allows multiple open items when close-others is false", () => {
    document.body.innerHTML = group('data-accordion-close-others="false"');
    cleanup = initAccordions();
    triggers().forEach((button) => button.click());
    expect(states()).toEqual(["true", "true"]);
  });

  it("keeps nested and separate components independent", () => {
    panels()[0].innerHTML = group();
    document.body.insertAdjacentHTML("beforeend", group());
    cleanup = initAccordions();
    triggers()[0].click();
    triggers()[1].click();
    triggers()[4].click();
    expect(states()).toEqual(["true", "true", "false", "false", "true", "false"]);
  });

  it("includes a component passed as the scope and does not bind twice", () => {
    cleanup = initAccordions(document.body.firstElementChild);
    initAccordions();
    triggers()[0].click();
    expect(states()).toEqual(["true", "false"]);
  });

  it("restores markup on cleanup and permits initialization again", () => {
    const original = document.body.innerHTML;
    cleanup = initAccordions();
    triggers()[0].click();
    cleanup();
    expect(document.body.innerHTML).toBe(original);
    cleanup = initAccordions();
    triggers()[0].click();
    expect(states()).toEqual(["true", "false"]);
  });

  it("prevents a trigger inside a form from submitting it", () => {
    document.body.innerHTML = `<form>${group()}</form>`;
    cleanup = initAccordions();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    triggers()[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("initializes appended CMS items without resetting existing open items", () => {
    cleanup = initAccordions();
    triggers()[0].click();
    const component = document.body.firstElementChild;
    component.insertAdjacentHTML("beforeend", item());
    const cleanAdded = initAccordions(component.lastElementChild);
    expect(states()).toEqual(["true", "false", "false"]);
    triggers()[2].click();
    expect(states()).toEqual(["false", "false", "true"]);
    cleanAdded();
  });

  it("leaves malformed items visible and opens the first valid item", () => {
    document.body.innerHTML = group('data-accordion-first-open="true"');
    triggers()[0].remove();
    cleanup = initAccordions();
    expect(panels()[0].hasAttribute("style")).toBe(false);
    expect(states()).toEqual(["true"]);
  });

  it("keeps the latest state when an interrupted transition finishes late", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const animations = [];
    const panel = panels()[0];
    // jsdom has no Web Animations rendering; drive its completion boundary here.
    panel.animate = () => {
      const animation = { cancel() {} };
      animations.push(animation);
      return animation;
    };
    cleanup = initAccordions();
    triggers()[0].click();
    triggers()[0].click();
    animations[0].onfinish();
    expect(panel.style.overflow).toBe("hidden");
    expect(panel.style.height).toBe("0px");
    animations[1].onfinish();
    triggers()[0].click();
    animations[2].onfinish();
    expect(panel.style.height).toBe("auto");
    expect(panel.style.overflow).toBe("");
    expect(panel.hasAttribute("inert")).toBe(false);
  });

  it("skips transitions for reduced motion even when animation is available", () => {
    panels()[0].animate = () => { throw new Error("Reduced motion must not animate"); };
    cleanup = initAccordions();
    triggers()[0].click();
    expect(states()).toEqual(["true", "false"]);
    expect(panels()[0].style.height).toBe("auto");
  });
});
