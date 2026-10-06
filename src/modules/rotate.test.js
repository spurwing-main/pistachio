import { beforeAll, describe, expect, it, vi } from "vitest";

let initRotate;
let reduced = false;
beforeAll(async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
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

const endBar = (slide) => {
  const event = new Event("animationend", { bubbles: true });
  slide.querySelector("[data-rotate-bar]").dispatchEvent(event);
};

describe("rotate", () => {
  it("shows the first quote and hides the others from screen readers", () => {
    const root = mount();
    const slides = root.querySelectorAll("[data-rotate-track] > *");
    expect(slides[0].hasAttribute("data-rotate-current")).toBe(true);
    expect(slides[1].getAttribute("aria-hidden")).toBe("true");
    expect(root.style.getPropertyValue("--rotate-duration")).toBe("6s");
  });

  it("moves on when the line is full, and back to the first after the last", () => {
    const root = mount(2);
    const slides = root.querySelectorAll("[data-rotate-track] > *");
    endBar(slides[0]);
    expect(slides[1].hasAttribute("data-rotate-current")).toBe(true);
    endBar(slides[1]);
    expect(slides[0].hasAttribute("data-rotate-current")).toBe(true);
  });

  it("pauses and plays with the button", () => {
    const root = mount();
    const button = root.querySelector("[data-rotate-pause]");
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(root.dataset.rotatePaused).toBe("true");
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
