import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initReveal } from "./reveal.js";

const motion = vi.hoisted(() => ({
  animate: vi.fn(), inView: vi.fn(), complete: vi.fn(), stop: vi.fn(),
}));
vi.mock("motion/mini", () => ({ animate: motion.animate }));
vi.mock("motion", () => ({ inView: motion.inView }));

let media;
let enter;
let cleanup;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function () { return this.hidden ? [] : [{}]; });
  media = new EventTarget();
  media.matches = false;
  vi.stubGlobal("matchMedia", () => media);
  motion.inView.mockImplementation((block, callback) => { enter = callback; return motion.stop; });
  motion.animate.mockReturnValue({ complete: motion.complete });
  document.body.innerHTML = `<div data-reveal="group" style="--reveal-opacity:0;--motion-step:80ms;--reveal-duration:320ms;--reveal-from:translateY(0.5rem);--reveal-ease:cubic-bezier(0,0.6,0.5,1)"><h2>Heading</h2><p>Content</p></div>`;
  for (const child of document.querySelector("[data-reveal]").children) child.style.cssText=document.querySelector("[data-reveal]").style.cssText;
});
afterEach(() => { cleanup?.(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("entrance motion", () => {
  it("keeps content visible until it enters, and reads the shared motion values", () => {
    cleanup = initReveal();
    expect(motion.animate).not.toHaveBeenCalled();
    expect(document.querySelector("h2").style.opacity).toBe("");
    enter();
    expect(motion.animate.mock.calls.map(call=>call[0])).toEqual([...document.querySelector("[data-reveal]").children]);
    expect(motion.animate.mock.calls[0][2]).toMatchObject({ duration: 0.32, ease: [0, 0.6, 0.5, 1] });
    expect(motion.animate.mock.calls.map(call=>call[2].delay)).toEqual([0, 0.08]);
  });

  it("does not subscribe or animate when reduced motion is already selected", () => {
    media.matches = true;
    cleanup = initReveal();
    expect(motion.inView).not.toHaveBeenCalled();
    expect(motion.animate).not.toHaveBeenCalled();
  });

  it("finishes an active entrance when reduced motion changes", () => {
    cleanup = initReveal();
    enter();
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    expect(motion.stop).toHaveBeenCalled();
    expect(motion.complete).toHaveBeenCalled();
  });

  it("initializes each block once and releases it during cleanup", () => {
    cleanup = initReveal();
    initReveal();
    expect(motion.inView).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup = initReveal();
    expect(motion.inView).toHaveBeenCalledTimes(2);
  });

  it("sequences only marked hero content and respects the media's own entrance", () => {
    const root = document.querySelector("[data-reveal]");
    root.dataset.reveal = "hero";
    root.children[0].dataset.revealStep = "content";
    root.children[1].dataset.revealStep = "media";
    root.children[1].style.setProperty("--reveal-duration", "640ms");
    root.children[1].style.setProperty("--reveal-from", "translateY(1rem) scale(0.97)");
    root.append(document.createElement("aside"));
    cleanup = initReveal();
    enter();
    expect(motion.animate).toHaveBeenCalledTimes(2);
    expect(motion.animate.mock.calls[1][1].transform).toEqual(["translateY(1rem) scale(0.97)", "none"]);
    expect(motion.animate.mock.calls[1][2]).toMatchObject({ duration: 0.64, delay: 0.08 });
  });

  it("leaves hidden optional content out of the sequence", () => {
    document.querySelector("p").hidden = true;
    cleanup = initReveal();
    enter();
    expect(motion.animate).toHaveBeenCalledTimes(1);
    expect(motion.animate.mock.calls[0][0].tagName).toBe("H2");
  });
});
