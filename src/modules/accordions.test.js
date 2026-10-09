import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAccordions } from "./accordions.js";

const item = () => `<div data-accordion="item"><button data-accordion="trigger">Question</button><div data-accordion="content"><a href="#">Answer</a></div></div>`;
const group = (attributes = "") => `<div data-accordion="component" ${attributes}>${item()}${item()}</div>`;
const triggers = () => [...document.querySelectorAll('[data-accordion="trigger"]')];
const panels = () => [...document.querySelectorAll('[data-accordion="content"]')];
const states = () => triggers().map((button) => button.getAttribute("aria-expanded"));
let cleanup;
beforeEach(() => {
  document.body.innerHTML = group();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => { cleanup?.(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("accordions", () => {
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
