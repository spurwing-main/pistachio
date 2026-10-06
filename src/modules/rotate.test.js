import { afterEach, beforeEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

let initRotate;
let reduced = false;
const observations = new WeakMap();
beforeAll(async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(root) {
        observations.set(root, this.callback);
        this.callback([{ isIntersecting: true }]);
      }
    },
  );
  ({ initRotate } = await import("./rotate.js"));
});

function mount(count = 3) {
  const slides = Array.from({ length: count }, (_, i) => `<div><p>Quote ${i}</p><div data-rotate-bar></div></div>`);
  document.body.innerHTML = `
    <div data-rotate="6">
      <div data-rotate-track>${slides.join("")}</div>
      <a href="#" data-rotate-pause>Pause</a>
    </div>`;
  initRotate(document);
  return document.querySelector("[data-rotate]");
}

describe("rotate", () => {
  it("shows the first quote and hides the others from screen readers", () => {
    const root = mount();
    const slides = root.querySelectorAll("[data-rotate-track] > *");
    expect(slides[0].hasAttribute("data-rotate-current")).toBe(true);
    expect(slides[1].getAttribute("aria-hidden")).toBe("true");
    expect(root.style.getPropertyValue("--rotate-duration")).toBe("6s");
  });

  it("rotates without a progress-line animation, and returns after the last", () => {
    const root = mount(2);
    const slides = root.querySelectorAll("[data-rotate-track] > *");
    vi.advanceTimersByTime(6000);
    expect(slides[1].hasAttribute("data-rotate-current")).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(slides[0].hasAttribute("data-rotate-current")).toBe(true);
  });

  it("pauses and plays with the button", () => {
    const root = mount();
    const button = root.querySelector("[data-rotate-pause]");
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(root.dataset.rotatePaused).toBe("true");
    vi.advanceTimersByTime(12000);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 0");
    button.click();
    vi.advanceTimersByTime(6000);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 1");
  });

  it("keeps the remaining time while offscreen", () => {
    const root = mount();
    vi.advanceTimersByTime(2000);
    observations.get(root)([{ isIntersecting: false }]);
    vi.advanceTimersByTime(12000);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 0");
    observations.get(root)([{ isIntersecting: true }]);
    vi.advanceTimersByTime(3999);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 0");
    vi.advanceTimersByTime(1);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 1");
  });

  it("stops while the pause control has keyboard focus", async () => {
    const root = mount();
    const button = root.querySelector("[data-rotate-pause]");
    button.focus();
    vi.advanceTimersByTime(12000);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 0");
    button.blur();
    await vi.advanceTimersByTimeAsync(6000);
    expect(root.querySelector("[data-rotate-current]").textContent).toContain("Quote 1");
  });

  it("does nothing with one quote, or with reduced motion", () => {
    expect(mount(1).dataset.rotateReady).toBeUndefined();
    reduced = true;
    const root = mount();
    reduced = false;
    expect(root.dataset.rotateReady).toBeUndefined();
    expect(root.querySelector("[data-rotate-pause]").hidden).toBe(true);
  });
});
