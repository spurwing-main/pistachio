import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initReveal } from "./reveal.js";

const motion = vi.hoisted(() => ({
  animate: vi.fn(), inView: vi.fn(), complete: vi.fn(), stop: vi.fn(),
}));
vi.mock("motion/mini", () => ({ animate: motion.animate }));
vi.mock("motion", () => ({ inView: motion.inView }));

const VALUES = "--motion-step:80ms;--reveal-duration:900ms;--reveal-from:translateY(1.5rem);--reveal-ease:cubic-bezier(0.16,1,0.3,1)";
const below = { top: 2000, bottom: 2400 };
const onScreen = { top: 100, bottom: 500 };

let media;
let enter;
let cleanup;
let rect;
beforeEach(() => {
  vi.clearAllMocks();
  rect = below;
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function () { return this.hidden ? [] : [{}]; });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => rect);
  media = new EventTarget();
  media.matches = false;
  vi.stubGlobal("matchMedia", () => media);
  motion.inView.mockImplementation((block, callback) => { enter = callback; return motion.stop; });
  motion.animate.mockReturnValue({ complete: motion.complete });
  document.body.innerHTML = `<div data-reveal="group" style="${VALUES}"><h2>Heading</h2><p>Content</p></div>`;
});
afterEach(() => { cleanup?.(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const block = () => document.querySelector("[data-reveal]");

describe("entrance motion", () => {
  it("sets a below-the-fold block's start state off screen, then plays it once in view", () => {
    cleanup = initReveal();
    expect(document.querySelector("h2").style.opacity).toBe("0");
    expect(document.querySelector("h2").style.transform).toBe("translateY(1.5rem)");
    expect(motion.animate).not.toHaveBeenCalled();
    enter();
    expect(motion.animate.mock.calls.map((call) => call[0])).toEqual([...block().children]);
    expect(motion.animate.mock.calls[0][1]).toEqual({ opacity: [0, 1], transform: ["translateY(1.5rem)", "none"] });
    expect(motion.animate.mock.calls[0][2]).toMatchObject({ duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    expect(motion.animate.mock.calls.map((call) => call[2].delay)).toEqual([0, 0.08]);
  });

  it("leaves a block that is already on screen alone, so nothing visible disappears", () => {
    rect = onScreen;
    cleanup = initReveal();
    expect(motion.inView).not.toHaveBeenCalled();
    expect(document.querySelector("h2").style.opacity).toBe("");
  });

  it("leaves the hero to CSS", () => {
    block().dataset.reveal = "hero";
    cleanup = initReveal();
    expect(motion.inView).not.toHaveBeenCalled();
    expect(document.querySelector("h2").style.opacity).toBe("");
  });

  it("staggers a lone wrapper's children, such as a slot", () => {
    document.body.innerHTML = `<div data-reveal="group" style="${VALUES}"><div class="slot"><article>A</article><article>B</article></div></div>`;
    cleanup = initReveal();
    enter();
    expect(motion.animate.mock.calls.map((call) => call[0].textContent)).toEqual(["A", "B"]);
  });

  it("brings in a plain block as one piece", () => {
    block().dataset.reveal = "";
    cleanup = initReveal();
    enter();
    expect(motion.animate).toHaveBeenCalledTimes(1);
    expect(motion.animate.mock.calls[0][0]).toBe(block());
  });

  it("does nothing when reduced motion is already selected", () => {
    media.matches = true;
    cleanup = initReveal();
    expect(motion.inView).not.toHaveBeenCalled();
    expect(document.querySelector("h2").style.opacity).toBe("");
  });

  it("shows everything at rest when reduced motion is switched on", () => {
    cleanup = initReveal();
    enter();
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    expect(motion.stop).toHaveBeenCalled();
    expect(motion.complete).toHaveBeenCalled();
    expect(document.querySelector("h2").style.opacity).toBe("");
  });

  it("initializes each block once and releases it during cleanup", () => {
    cleanup = initReveal();
    initReveal();
    expect(motion.inView).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup = initReveal();
    expect(motion.inView).toHaveBeenCalledTimes(2);
  });

  it("leaves hidden optional content out", () => {
    document.querySelector("p").hidden = true;
    cleanup = initReveal();
    enter();
    expect(motion.animate).toHaveBeenCalledTimes(1);
    expect(motion.animate.mock.calls[0][0].tagName).toBe("H2");
  });
});
