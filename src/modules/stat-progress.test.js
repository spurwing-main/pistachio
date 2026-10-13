import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { initStatProgress, progressRatio } from "./stat-progress.js";

const { entries, animations } = vi.hoisted(() => ({ entries: [], animations: [] }));
vi.mock("motion", () => ({ inView: (element, enter, options) => {
  const stop = vi.fn();
  entries.push({ element, enter, stop, options });
  return stop;
} }));
vi.mock("motion/mini", () => ({ animate: (element, keyframes, options) => {
  const control = { complete: vi.fn() };
  animations.push({ element, keyframes, control, options });
  return control;
} }));

let media;
let cleanup;
beforeEach(() => {
  entries.length = animations.length = 0;
  media = new EventTarget();
  media.matches = false;
  vi.stubGlobal("matchMedia", () => media);
});
afterEach(() => { cleanup?.(); cleanup = undefined; document.body.innerHTML = ""; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("progress values", () => {
  it.each([["77", .77], ["0", 0], ["72.5", .725], ["100", 1], ["150", 1],
    ["-5", 0], ["", 1], ["  ", 1], [null, 1], ["Always", 1], ["77%", 1],
    ["72oops", 1], ["Infinity", 1], ["NaN", 1]])("normalises %s to %s", (value, want) => {
    expect(progressRatio(value)).toBe(want);
  });
});

function mount() {
  document.body.innerHTML = `<div><div>Always on</div><div><div data-stat-fill data-stat-progress="77"></div></div></div>
    <div><div>Not a number</div><div><div data-stat-fill data-stat-progress="72"></div></div></div>`;
  return [...document.querySelectorAll("[data-stat-fill]")];
}

it("uses independent progress and reveals each bar only once", () => {
  const [a, b] = mount();
  cleanup = initStatProgress();
  expect(entries[0].element).toBe(a.parentElement.parentElement);
  expect(a.style.transform).toBe("scaleX(0)");
  entries[0].enter();
  entries[0].enter();
  expect(a.style.transform).toBe("scaleX(0.77)");
  expect(b.style.transform).toBe("scaleX(0)");
  expect(animations).toHaveLength(1);
  expect(animations[0].keyframes.transform).toEqual(["scaleX(0)", "scaleX(0.77)"]);
  entries[1].enter();
  expect(b.style.transform).toBe("scaleX(0.72)");
});

it("can initialise a fill directly without requiring root attributes", () => {
  const [fill] = mount();
  media.matches = true;
  cleanup = initStatProgress(fill);
  expect(fill.style.transform).toBe("scaleX(0.77)");
});

it("triggers a quarter viewport above the bottom and updates on resize without replay", () => {
  mount();
  vi.stubGlobal("innerHeight", 800);
  cleanup = initStatProgress();
  expect(entries[0].options).toEqual({ margin: "0px 0px -200px 0px", amount: "some" });
  entries[0].enter();
  vi.stubGlobal("innerHeight", 1000);
  window.dispatchEvent(new Event("resize"));
  expect(entries).toHaveLength(3);
  expect(entries[1].stop).toHaveBeenCalled();
  expect(entries[2].options.margin).toBe("0px 0px -250px 0px");
});

it("slightly staggers neighbouring entries without delaying a later scroll entry", () => {
  mount();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  cleanup = initStatProgress();
  entries[0].enter();
  entries[1].enter();
  expect(animations[0].options.delay).toBe(0);
  expect(animations[1].options.delay).toBeCloseTo(.1);
  cleanup();
  cleanup = initStatProgress();
  entries[2].enter();
  now = 2000;
  entries[3].enter();
  expect(animations[3].options.delay).toBe(0);
});

it("shows final values immediately for reduced motion", () => {
  const [a, b] = mount();
  media.matches = true;
  cleanup = initStatProgress();
  expect(a.style.transform).toBe("scaleX(0.77)");
  expect(b.style.transform).toBe("scaleX(0.72)");
  expect(entries).toHaveLength(0);
  expect(animations).toHaveLength(0);
});

it("finishes bars when reduced motion changes and on cleanup", () => {
  const [a, b] = mount();
  cleanup = initStatProgress();
  entries[0].enter();
  media.matches = true;
  media.dispatchEvent(new Event("change"));
  expect(a.style.transform).toBe("scaleX(0.77)");
  expect(b.style.transform).toBe("scaleX(0.72)");
  entries[1].enter();
  expect(animations).toHaveLength(1);
  expect(entries.every(({ stop }) => stop.mock.calls.length > 0)).toBe(true);
});

it("does not attach duplicate observers when initialised twice", () => {
  mount();
  cleanup = initStatProgress();
  const otherCleanup = initStatProgress();
  expect(entries).toHaveLength(2);
  otherCleanup();
  cleanup();
  cleanup = initStatProgress();
  expect(entries).toHaveLength(4);
});

it("leaves a final visible value if observation is unavailable", () => {
  const [a] = mount();
  // A malformed or unavailable browser observer must not strand a bar at zero.
  vi.spyOn(window, "getComputedStyle").mockImplementationOnce(() => { throw new Error("unavailable"); });
  cleanup = initStatProgress();
  expect(a.style.transform).toBe("scaleX(0.77)");
  vi.restoreAllMocks();
});
