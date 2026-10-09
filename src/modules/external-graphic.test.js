import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initExternalGraphic } from "./external-graphic.js";
import { readFileSync } from "node:fs";

const markup = '<svg xmlns="http://www.w3.org/2000/svg" width="1125" height="818" viewBox="0 0 1125 818"><g data-graphic-item="card"><path d="M0 0h10"/></g></svg>';

beforeEach(() => {
  document.body.innerHTML = "";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(markup)));
});

describe("external graphic animation", () => {
  let gsap;
  let media;
  let timeline;
  let reduced;
  const animatedMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1125 818"><g id="line">
    <path data-graphic-line="outgoing" d="M0 0H10" stroke-width="3" stroke-dasharray="3 7"/>
    ${Array.from({ length: 10 }, (_, i) => `<path data-graphic-line="${String(i + 1).padStart(2, "0")}-${String(i + 2).padStart(2, "0")}" d="M0 0H10" stroke-width="1.5" stroke-dasharray="4 8"/>`).join("")}
    <path data-graphic-line="return" d="M0 0H10" stroke-width="3" stroke-dasharray="3 7"/>
  </g>${
    Array.from({ length: 11 }, (_, i) => `<g id="item ${String(11 - i).padStart(2, "0")}"/>`).join("")
  }<g id="main"/></svg>`;

  beforeEach(() => {
    reduced = false;
    timeline = { to: vi.fn().mockReturnThis() };
    media = { add: vi.fn((query, callback) => { if (!reduced) media.cleanup = callback(); }), revert: vi.fn() };
    gsap = {
      registerPlugin: vi.fn(), matchMedia: vi.fn(() => media),
      set: vi.fn(), timeline: vi.fn(() => timeline),
    };
    vi.stubGlobal("gsap", gsap);
    vi.stubGlobal("ScrollTrigger", { refresh: vi.fn() });
    vi.stubGlobal("Webflow", []);
    fetch.mockImplementation(async () => new Response(animatedMarkup));
  });

  function mountAnimated() {
    const root = mount();
    root.setAttribute("data-graphic-animation", "");
    return root;
  }

  it("waits for the SVG response and insertion before creating exactly one animation", async () => {
    const root = mountAnimated();
    let resolve;
    fetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    gsap.set.mockImplementation((target) => {
      const first = Array.isArray(target) ? target[0] : target;
      expect(root.contains(first)).toBe(true);
    });
    const pending = initExternalGraphic();
    expect(gsap.set).not.toHaveBeenCalled();
    expect(gsap.timeline).not.toHaveBeenCalled();
    resolve(new Response(animatedMarkup));
    await pending;
    await initExternalGraphic();
    window.Webflow.forEach((ready) => ready());
    expect(gsap.timeline).toHaveBeenCalledTimes(1);
  });

  it("draws visible connectors with consistent pacing and no hold after item 01", async () => {
    const root = mountAnimated();
    await initExternalGraphic();
    const [card, cardVars] = gsap.set.mock.calls[0];
    const [items, itemVars] = gsap.set.mock.calls[1];
    expect(card.id).toBe("main");
    expect(cardVars).toMatchObject({ autoAlpha: 0, scale: 0.97, transformOrigin: "50% 50%" });
    expect(items.map((item) => item.id)).toEqual([
      "item 01", "item 02", "item 03", "item 04", "item 05", "item 06",
      "item 07", "item 08", "item 09", "item 10", "item 11",
    ]);
    expect(itemVars).toMatchObject({ autoAlpha: 0, scale: 0.94 });
    const trigger = gsap.timeline.mock.calls[0][0].scrollTrigger;
    expect(trigger).toMatchObject({
      trigger: root, start: "top 75%", once: true, toggleActions: "play none none none",
    });
    expect(trigger.scrub).toBeUndefined();
    expect(timeline.to.mock.calls[0][0]).toBe(card);
    const calls = timeline.to.mock.calls;
    const masks = root.querySelectorAll("mask path");
    expect(masks).toHaveLength(12);
    expect(calls[1][0]).toBe(masks[0]);
    expect(calls[2][0]).toBe(items[0]);
    let previousItem = calls[2];
    const steps = items.slice(1).map((item, index) => {
      const connector = calls.find(([target]) => target === masks[index + 1]);
      const reveal = calls.find(([target]) => target === item);
      expect(connector[1]).toMatchObject({ attr: { "stroke-dashoffset": 0 }, ease: "none" });
      // No invisible travel time, even when the preceding item is a large card.
      expect(connector[2]).toBeLessThanOrEqual(previousItem[2] + previousItem[1].duration);
      expect(connector[2]).toBeGreaterThan(previousItem[2]);
      expect(reveal[2]).toBeCloseTo(connector[2] + connector[1].duration);
      previousItem = reveal;
      return connector;
    });
    expect(steps.every((step) => step[1].duration === steps[0][1].duration)).toBe(true);
    const lastItem = previousItem;
    const returnLine = calls.find(([target]) => target === masks[11]);
    expect(returnLine[2]).toBeGreaterThan(lastItem[2] + lastItem[1].duration);
    expect(root.querySelector('[data-graphic-line="01-02"]').getAttribute("stroke-dasharray")).toBe("4 8");
    expect(masks[1].getAttribute("pathLength")).toBe("1");
    expect(masks[1].getAttribute("stroke-dasharray")).toBe("1 1");
    const closingEmphasis = timeline.to.mock.calls.at(-1);
    expect(closingEmphasis[0]).toBe(card);
    expect(closingEmphasis[1]).toMatchObject({ scale: 1.025, repeat: 1, yoyo: true });
  });

  it("retries animation after Webflow is ready, only for the inserted graphic", async () => {
    mountAnimated();
    vi.stubGlobal("ScrollTrigger", undefined);
    await initExternalGraphic();
    expect(gsap.set).not.toHaveBeenCalled();
    vi.stubGlobal("ScrollTrigger", { refresh: vi.fn() });
    window.Webflow.forEach((ready) => ready());
    expect(gsap.timeline).toHaveBeenCalledTimes(1);
  });

  it("does not animate an SVG removed before Webflow becomes ready", async () => {
    const root = mountAnimated();
    vi.stubGlobal("ScrollTrigger", undefined);
    await initExternalGraphic();
    root.replaceChildren();
    vi.stubGlobal("ScrollTrigger", { refresh: vi.fn() });
    window.Webflow.forEach((ready) => ready());
    expect(gsap.set).not.toHaveBeenCalled();
  });

  it("does not set up animation for a failed load", async () => {
    const root = mountAnimated();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockResolvedValue(new Response("Not found", { status: 404 }));
    await initExternalGraphic();
    expect(root.textContent).toBe("Fallback");
    expect(gsap.matchMedia).not.toHaveBeenCalled();
    expect(window.Webflow).toHaveLength(0);
  });

  it("leaves unmarked and incomplete graphics static", async () => {
    mount();
    await initExternalGraphic();
    mountAnimated();
    fetch.mockResolvedValue(new Response(markup));
    await initExternalGraphic();
    expect(gsap.set).not.toHaveBeenCalled();
  });

  it("respects reduced motion through a reverting GSAP media context", async () => {
    const root = mountAnimated();
    reduced = true;
    await initExternalGraphic();
    expect(media.add.mock.calls[0][0]).toBe("(prefers-reduced-motion: no-preference)");
    expect(gsap.set).not.toHaveBeenCalled();
    expect(root.querySelector("mask")).toBeNull();
  });

  it("scopes each animation to its own loaded SVG", async () => {
    const first = mountAnimated();
    const second = first.cloneNode(true);
    document.body.append(second);
    await initExternalGraphic();
    expect(gsap.timeline).toHaveBeenCalledTimes(2);
    expect(gsap.set.mock.calls[0][0]).toBe(first.querySelector('[id="main"]'));
    expect(gsap.set.mock.calls.some(([target]) => target === second.querySelector('[id="main"]'))).toBe(true);
    const firstMask = first.querySelector("mask").id;
    const secondMask = second.querySelector("mask").id;
    expect(firstMask).not.toBe(secondMask);
    expect(first.querySelector('[data-graphic-line="outgoing"]').getAttribute("mask")).toBe(`url(#${firstMask})`);
  });

  it("removes reveal masks when the motion context is reverted", async () => {
    const root = mountAnimated();
    await initExternalGraphic();
    expect(root.querySelectorAll("mask")).toHaveLength(12);
    media.cleanup();
    expect(root.querySelectorAll("mask")).toHaveLength(0);
    expect(root.querySelectorAll("[data-graphic-line][mask]")).toHaveLength(0);
  });

  it("keeps a successfully loaded SVG ready even if animation setup fails", async () => {
    const root = mountAnimated();
    vi.spyOn(console, "error").mockImplementation(() => {});
    gsap.timeline.mockImplementation(() => { throw new Error("Animation failed"); });
    await initExternalGraphic();
    expect(root.dataset.externalGraphicReady).toBe("true");
    expect(root.querySelector("svg")).not.toBeNull();
    expect(media.revert).toHaveBeenCalledTimes(1);
    expect(root.querySelector("mask")).toBeNull();
    await initExternalGraphic();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("animates a converted Webflow image below the viewport", async () => {
    document.body.innerHTML = '<img data-external-graphic data-graphic-animation src="/graphic.svg" alt="Training journey">';
    await initExternalGraphic();
    const svg = document.body.firstElementChild;
    expect(svg.localName).toBe("svg");
    expect(gsap.timeline.mock.calls[0][0].scrollTrigger.trigger).toBe(svg);
    await initExternalGraphic();
    expect(gsap.timeline).toHaveBeenCalledTimes(1);
  });

  it("animates an already visible fallback on initial conversion", async () => {
    const root = mountAnimated();
    root.innerHTML = '<img src="/graphic.svg" alt="Training journey">';
    vi.spyOn(root.firstElementChild, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 500, width: 600, height: 400 });
    await initExternalGraphic();
    expect(root.querySelector("svg")).not.toBeNull();
    expect(gsap.timeline).toHaveBeenCalledTimes(1);
  });

  it("keeps an already loaded graphic static when its media context reactivates on screen", async () => {
    const root = mountAnimated();
    await initExternalGraphic();
    const svg = root.querySelector("svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 500, width: 600, height: 400 });
    media.cleanup();
    media.add.mock.calls[0][1]();
    expect(gsap.timeline).toHaveBeenCalledTimes(1);
    expect(svg.querySelector("mask")).toBeNull();
  });

  it("keeps a visible variant static when first fetched after a breakpoint switch", async () => {
    const root = mountAnimated();
    root.innerHTML = '<img src="/mobile.svg" alt="Training journey">';
    root.dataset.graphicMedia = "(max-width: 767px)";
    vi.spyOn(root.firstElementChild, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 500, width: 600, height: 400 });
    let change;
    const query = {
      matches: false,
      addEventListener: (name, callback) => { change = callback; },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => query);
    await initExternalGraphic();
    expect(fetch).not.toHaveBeenCalled();
    query.matches = true;
    change();
    await vi.waitFor(() => expect(root.querySelector("svg")).not.toBeNull());
    expect(gsap.set).not.toHaveBeenCalled();
    expect(gsap.timeline).not.toHaveBeenCalled();
  });

  it("runs the real mobile SVG as main then four connector/item pairs without a return pulse", async () => {
    const source = readFileSync("assets/graphics/security-awareness-training-mbl.svg", "utf8");
    fetch.mockResolvedValue(new Response(source));
    const root = mountAnimated();
    await initExternalGraphic();
    const svg = root.querySelector("svg");
    expect(svg.dataset.graphicLayout).toBe("linear");
    const masks = svg.querySelectorAll("mask[id^='graphic-reveal-'] path");
    expect(masks).toHaveLength(4);
    const calls = timeline.to.mock.calls;
    expect(calls).toHaveLength(9);
    expect(calls[0][0].id).toBe("main");
    for (let i = 0; i < 4; i++) {
      expect(calls[1 + i * 2][0]).toBe(masks[i]);
      expect(calls[2 + i * 2][0].id).toBe(`item ${String(i + 1).padStart(2, "0")}`);
      expect(calls[2 + i * 2][2]).toBeCloseTo(calls[1 + i * 2][2] + calls[1 + i * 2][1].duration);
    }
    expect(calls.at(-1)[1].repeat).toBeUndefined();
  });

  it("restricts the GSAP motion context to the image's viewport query", async () => {
    const root = mountAnimated();
    root.dataset.graphicMedia = "(min-width: 768px)";
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await initExternalGraphic();
    expect(media.add.mock.calls[0][0]).toBe("(prefers-reduced-motion: no-preference) and (min-width: 768px)");
  });
});

describe("Webflow image conversion", () => {
  function mountImage() {
    document.body.innerHTML = '<img id="training" class="graphic w-image" data-external-graphic src="/graphic.svg" alt="Training journey" width="1125" height="818">';
    return document.body.firstElementChild;
  }

  it("retains the image while fetching and transfers its styling and accessible name", async () => {
    const img = mountImage();
    img.style.width = "80%";
    let resolve;
    fetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = initExternalGraphic();
    expect(document.body.firstElementChild).toBe(img);
    resolve(new Response(markup));
    await pending;
    const svg = document.body.firstElementChild;
    expect(svg.localName).toBe("svg");
    expect(svg.id).toBe("training");
    expect(svg.getAttribute("class")).toBe("graphic w-image");
    expect(svg.style.width).toBe("80%");
    expect(svg.style.aspectRatio).toBe("1125 / 818");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Training journey");
    expect(svg.hasAttribute("src")).toBe(false);
    await initExternalGraphic();
    expect(document.body.firstElementChild).toBe(svg);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("prefers the actual loaded image ratio over display dimensions", async () => {
    const img = mountImage();
    Object.defineProperties(img, { naturalWidth: { value: 900 }, naturalHeight: { value: 600 } });
    await initExternalGraphic();
    expect(document.body.firstElementChild.style.aspectRatio).toBe("900 / 600");
  });

  it("falls back to SVG geometry when image dimensions are not yet available", async () => {
    const img = mountImage();
    img.removeAttribute("width");
    img.removeAttribute("height");
    await initExternalGraphic();
    expect(document.body.firstElementChild.style.aspectRatio).toBe("1125 / 818");
  });

  it("preserves embedded Base64 images inside the inline SVG", async () => {
    mountImage();
    const embedded = "data:image/png;base64,iVBORw0KGgo=";
    fetch.mockResolvedValue(new Response(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="${embedded}" width="10" height="10"/></svg>`));
    await initExternalGraphic();
    expect(document.querySelector("svg image").getAttribute("href")).toBe(embedded);
  });

  it("replaces only the image inside a wrapper and derives its URL from currentSrc", async () => {
    document.body.innerHTML = '<div data-external-graphic data-svg-src="/obsolete.svg"><img src="/fallback.svg" alt=""><p>Caption</p></div>';
    const root = document.body.firstElementChild;
    Object.defineProperty(root.firstElementChild, "currentSrc", { value: "https://assets.example.com/selected.svg" });
    await initExternalGraphic();
    expect(fetch).toHaveBeenCalledWith("https://assets.example.com/selected.svg");
    expect(root.querySelector("p").textContent).toBe("Caption");
    expect(root.querySelector("svg").getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    () => new Response("Not found", { status: 404 }),
    () => new Response("<svg><g></svg>"),
    () => { throw new TypeError("Failed to fetch"); },
  ])("keeps the real image on load failure and permits retry", async (response) => {
    const img = mountImage();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => response());
    await initExternalGraphic();
    expect(document.body.firstElementChild).toBe(img);
    expect(img.getAttribute("src")).toBe("/graphic.svg");
    await initExternalGraphic();
    expect(document.body.firstElementChild.localName).toBe("svg");
  });

  it("does not insert a stale response if the editor changes the image source", async () => {
    const img = mountImage();
    let resolve;
    fetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = initExternalGraphic();
    img.src = "/new-graphic.svg";
    resolve(new Response(markup));
    await pending;
    expect(document.body.firstElementChild).toBe(img);
  });
});

describe("responsive graphic loading", () => {
  it("fetches only matching graphics and loads the other when its query matches", async () => {
    document.body.innerHTML = '<img data-external-graphic data-graphic-media="(min-width: 768px)" src="/desktop.svg"><img data-external-graphic data-graphic-media="(max-width: 767px)" src="/mobile.svg">';
    const listeners = new Set();
    const mobile = {
      matches: false,
      addEventListener: (name, listener) => listeners.add(listener),
      removeEventListener: (name, listener) => listeners.delete(listener),
    };
    vi.stubGlobal("matchMedia", (query) => query.includes("max-width") ? mobile : { matches: true });
    await initExternalGraphic();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/desktop.svg"]);
    expect(document.body.lastElementChild.localName).toBe("img");
    await initExternalGraphic();
    expect(listeners.size).toBe(1);
    mobile.matches = true;
    for (const listener of [...listeners]) listener();
    await vi.waitFor(() => expect(document.body.lastElementChild.localName).toBe("svg"));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/desktop.svg", "/mobile.svg"]);
    expect(listeners.size).toBe(0);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ratio = "1125 / 818") {
  document.body.innerHTML = `<div data-external-graphic data-svg-src="https://assets.example.com/graphic.svg" data-svg-aspect-ratio="${ratio}"><span>Fallback</span></div>`;
  return document.body.firstElementChild;
}

describe("external graphic", () => {
  it("reserves the requested ratio before loading, then inserts a responsive inline SVG", async () => {
    const root = mount();
    let resolve;
    fetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const loaded = vi.fn(() => expect(root.querySelector("svg g")).not.toBeNull());
    root.addEventListener("external-graphic:loaded", loaded);

    const pending = initExternalGraphic();
    expect(root.style.aspectRatio).toBe("1125 / 818");
    expect(root.textContent).toBe("Fallback");
    resolve(new Response(markup));
    await pending;

    const svg = root.querySelector("svg");
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1125 818");
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");
    expect(root.querySelector("span")).toBeNull();
    expect(root.dataset.externalGraphicReady).toBe("true");
    expect(loaded).toHaveBeenCalledTimes(1);
  });

  it("loads every wrapper in scope without replacing graphics on repeated initialisation", async () => {
    document.body.innerHTML = `<section><div data-external-graphic data-svg-src="/one.svg"></div><div data-external-graphic data-svg-src="/two.svg"></div></section><div data-external-graphic data-svg-src="/outside.svg"></div>`;
    const scope = document.querySelector("section");
    await Promise.all([initExternalGraphic(scope), initExternalGraphic(scope)]);
    const firstSvg = scope.querySelector("svg");
    firstSvg.dataset.animated = "true";
    await initExternalGraphic(scope);
    expect(scope.querySelectorAll("svg")).toHaveLength(2);
    expect(scope.querySelector("svg")).toBe(firstSvg);
    expect(document.body.lastElementChild.children).toHaveLength(0);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/one.svg", "/two.svg"]);
  });

  it.each(["", "nonsense", "0 / 818", "1125 / 0", "-1", "1 / 2 / 3"])(
    "keeps natural SVG sizing when the ratio is missing or invalid: %s", async (ratio) => {
      const root = mount(ratio);
      await initExternalGraphic();
      expect(root.style.aspectRatio).toBe("");
      expect(root.querySelector("svg").style.height).toBe("auto");
    },
  );

  it("accepts a positive decimal aspect ratio", async () => {
    const root = mount("1.5");
    await initExternalGraphic();
    expect(root.style.aspectRatio).toBe("1.5 / 1");
  });

  it.each([
    () => new Response("Not found", { status: 404 }),
    () => new Response("<svg><g></svg>"),
    () => new Response("<html><body>Not an SVG</body></html>"),
    () => { throw new Error("Network unavailable"); },
  ])("preserves fallback content on failure and allows a later retry", async (response) => {
    const root = mount();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => response());
    await initExternalGraphic();
    expect(root.textContent).toBe("Fallback");
    expect(root.dataset.externalGraphicReady).toBeUndefined();
    await initExternalGraphic();
    expect(root.querySelector("svg")).not.toBeNull();
  });

  it("skips empty sources while still applying the aspect ratio", async () => {
    const root = mount();
    root.removeAttribute("data-svg-src");
    await initExternalGraphic();
    expect(root.textContent).toBe("Fallback");
    expect(root.style.aspectRatio).toBe("1125 / 818");
    expect(fetch).not.toHaveBeenCalled();
  });
});
