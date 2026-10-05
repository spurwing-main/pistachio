import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
    },
  );
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
});

let initMarquee;
beforeAll(async () => {
  ({ initMarquee } = await import("./marquee.js"));
});

function mount() {
  document.body.innerHTML = `
    <div data-marquee>
      <div data-marquee-track><a href="/a">A</a><a href="/b">B</a></div>
    </div>`;
  initMarquee(document);
  return document.querySelector("[data-marquee]");
}

describe("marquee", () => {
  it("copies the items once, hidden from screen readers and the tab order", () => {
    const root = mount();
    const items = root.querySelectorAll("[data-marquee-track] > *");
    expect(items).toHaveLength(4);
    expect(items[2].getAttribute("aria-hidden")).toBe("true");
    expect(items[2].getAttribute("tabindex")).toBe("-1");
    expect(items[0].hasAttribute("aria-hidden")).toBe(false);
  });

  it("sets a duration and marks the row visible", () => {
    const root = mount();
    expect(root.style.getPropertyValue("--marquee-duration")).toMatch(/s$/);
    expect(root.dataset.marqueeVisible).toBe("true");
  });

  it("does not copy twice when started again", () => {
    const root = mount();
    initMarquee(document);
    expect(root.querySelectorAll("[data-marquee-track] > *")).toHaveLength(4);
  });
});
