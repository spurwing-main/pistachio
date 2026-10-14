import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initRiskStack } from "./risk-stack.js";

let media, cleanup, observers, frames;
beforeEach(() => {
  media = new EventTarget();
  media.matches = true;
  observers = []; frames = [];
  vi.stubGlobal("matchMedia", () => media);
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("requestAnimationFrame", cb => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("ResizeObserver", class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  });
});
afterEach(() => { cleanup?.(); document.body.innerHTML = ""; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function mount(count = 3, height = 440) {
  document.body.innerHTML = `<section class="risk-stack" style="--risk-stack-ready:1;--risk-stack-top:112px"><div class="risk-stack_panels">${Array.from({length:count}, () => '<article class="risk-panel"><div class="risk-panel_surface"><a href="#">Learn more</a></div></article>').join("")}</div></section>`;
  const root = document.querySelector(".risk-stack");
  const panels = [...root.querySelectorAll(".risk-panel")];
  panels.forEach((panel, i) => {
    vi.spyOn(panel, "getClientRects").mockReturnValue([{}]);
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({top:112 + i * 472, height});
    Object.defineProperty(panel, "offsetHeight", {value:height, configurable:true});
  });
  return {root, panels};
}
const flush = () => { const pending = frames.splice(0); pending.forEach(cb => cb()); };
it("enhances multiple panels, scales the covered card, and restores authored styles", () => {
  const {root, panels} = mount();
  cleanup = initRiskStack();
  expect(root.classList.contains("is-risk-stack-active")).toBe(true);
  panels[1].getBoundingClientRect.mockReturnValue({top:112,height:440});
  window.dispatchEvent(new Event("scroll")); flush();
  expect(panels[0].querySelector(".risk-panel_surface").style.transform).toBe("scale(0.94)");
  expect(panels[2].querySelector(".risk-panel_surface").style.transform).toBe("");
  cleanup();
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
  expect(panels[0].querySelector(".risk-panel_surface").style.transform).toBe("");
  expect(observers.every(o => o.disconnected)).toBe(true);
});
it.each([0,1])("leaves %s panels static", count => {
  const {root} = mount(count); cleanup = initRiskStack();
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
});
it("leaves oversized cards static and rechecks when their size changes", () => {
  const {root,panels} = mount(2,850); cleanup = initRiskStack();
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
  panels.forEach(p => Object.defineProperty(p,"offsetHeight",{value:440,configurable:true}));
  observers[0].cb(); flush();
  expect(root.classList.contains("is-risk-stack-active")).toBe(true);
});
it("responds to small screen or reduced motion preference changes", () => {
  const {root} = mount(); cleanup = initRiskStack();
  media.matches = false; media.dispatchEvent(new Event("change"));
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
  media.matches = true; media.dispatchEvent(new Event("change"));
  expect(root.classList.contains("is-risk-stack-active")).toBe(true);
});
it("keeps focused links reachable by returning to normal flow", () => {
  const {root} = mount(); cleanup = initRiskStack();
  root.querySelector("a").focus();
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
  window.dispatchEvent(new Event("resize")); flush();
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
});
it("does not move a link when pointer focus precedes its click", () => {
  const {root} = mount(); cleanup = initRiskStack();
  const link = root.querySelector("a");
  vi.spyOn(link,"matches").mockReturnValue(false);
  link.focus();
  expect(root.classList.contains("is-risk-stack-active")).toBe(true);
});
it("does not initialise twice or animate without its CSS", () => {
  const {root} = mount(); cleanup = initRiskStack();
  const other = initRiskStack(); other();
  expect(root.classList.contains("is-risk-stack-active")).toBe(true);
  cleanup(); root.style.removeProperty("--risk-stack-ready"); cleanup = initRiskStack();
  expect(root.classList.contains("is-risk-stack-active")).toBe(false);
});
