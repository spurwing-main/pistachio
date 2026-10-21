import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initFooter } from "./footer.js";

let destroy, footer, first, second, outside, height;
beforeEach(() => {
  document.body.innerHTML = `<button id="outside">Before</button><footer class="footer" style="position:sticky"><div class="footer_layout"><a href="#one">One</a><a href="#two">Two</a></div></footer>`;
  footer = document.querySelector("footer");
  [first, second] = footer.querySelectorAll("a");
  outside = document.querySelector("button");
  height = 600;
  vi.spyOn(footer, "getBoundingClientRect").mockImplementation(() => ({ height }));
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(5000);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  outside.focus();
});
afterEach(() => { destroy?.(); vi.restoreAllMocks(); document.body.innerHTML = ""; delete Element.prototype.scrollIntoView; });

it("reveals a pinned footer on entry, retaining focus without scrolling between links", () => {
  destroy = initFooter();
  first.focus();
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 5000, behavior: "instant" });
  expect(document.activeElement).toBe(first);
  second.focus();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  outside.focus();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  second.focus();
  expect(window.scrollTo).toHaveBeenCalledTimes(2);
});

it("leaves a normal-flow mobile footer to native focus scrolling", () => {
  footer.style.position = "relative";
  destroy = initFooter();
  first.focus();
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(first.scrollIntoView).not.toHaveBeenCalled();
});

it("unpins an oversized footer and keeps that fallback after focus leaves", () => {
  height = 900;
  destroy = initFooter();
  first.focus();
  expect(getComputedStyle(footer).position).toBe("relative");
  expect(first.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "instant" });
  expect(window.scrollTo).not.toHaveBeenCalled();
  outside.focus();
  expect(getComputedStyle(footer).position).toBe("relative");
});

it("handles a viewport/content resize while focus is already inside", () => {
  destroy = initFooter();
  first.focus();
  height = 900;
  window.dispatchEvent(new Event("resize"));
  expect(getComputedStyle(footer).position).toBe("relative");
  expect(first.scrollIntoView).toHaveBeenCalled();
});

it("is idempotent and restores its attributes/styles and listeners on cleanup", () => {
  destroy = initFooter();
  initFooter()();
  first.focus();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  destroy();
  expect(footer.hasAttribute("data-footer-keyboard")).toBe(false);
  expect(document.querySelector("style[data-footer-focus-style]")).toBeNull();
  outside.focus();
  first.focus();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
});
