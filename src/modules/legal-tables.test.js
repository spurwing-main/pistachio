import { afterEach, expect, it, vi } from "vitest";
import { initLegalTables } from "./legal-tables.js";
import { cloneLegalBody } from "../utils/legal-content.js";

let destroy;
const table = `<table><thead><tr><th>Term</th><th>Definition</th></tr></thead><tbody><tr><td>Data Processing Agreement</td><td>A longer definition with a <a href="/policy">policy link</a>.</td></tr></tbody></table>`;
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
function mount() {
  document.body.innerHTML = `<div data-legal-manager><div data-legal-current><div data-legal-body>${table}</div></div><div data-legal-sources>${table}</div></div><article>${table}</article>`;
  destroy = initLegalTables();
}
afterEach(() => { destroy?.(); document.body.innerHTML = ""; vi.restoreAllMocks(); });

it("enhances only current legal bodies and retains native table content and links", () => {
  mount();
  expect(document.querySelectorAll(".legal-table-scroll")).toHaveLength(1);
  expect(document.querySelector(".legal-table-scroll table").textContent).toContain("Data Processing Agreement");
  expect(document.querySelector(".legal-table-scroll a").getAttribute("href")).toBe("/policy");
  expect(document.querySelector(".legal-table-scroll").hasAttribute("tabindex")).toBe(false);
});

it("offers a labelled keyboard scroll region only while overflowing", () => {
  let width = 1000;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function () {
    return this.matches(".legal-table-scroll") ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(700);
  mount();
  const region = document.querySelector(".legal-table-scroll");
  expect(region.tabIndex).toBe(0);
  expect(region.getAttribute("role")).toBe("region");
  expect(region.getAttribute("aria-label")).toContain("Term");
  width = 600;
  window.dispatchEvent(new Event("resize"));
  expect(region.hasAttribute("tabindex")).toBe(false);
  expect(region.hasAttribute("role")).toBe(false);
});

it("handles body replacement and repeated initialisation without duplicate wrappers", async () => {
  mount();
  initLegalTables()();
  const body = document.querySelector("[data-legal-body]");
  body.innerHTML = table;
  await tick();
  expect(body.querySelectorAll(".legal-table-scroll")).toHaveLength(1);
  body.innerHTML = body.innerHTML; // A TOC rebuild can clone the enhanced content.
  await tick();
  expect(body.querySelectorAll(".legal-table-scroll")).toHaveLength(1);
  expect(cloneLegalBody(body, document.querySelector("[data-legal-manager]")).querySelector(".legal-table-scroll")).toBeNull();
  destroy();
  expect(body.querySelector(".legal-table-scroll")).toBeNull();
  expect(body.querySelector("table")).not.toBeNull();
});

it("preserves focus when overflow ends, then removes the extra tab stop on blur", () => {
  let width = 1000;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(700);
  mount();
  const region = document.querySelector(".legal-table-scroll");
  region.focus();
  width = 600;
  window.dispatchEvent(new Event("resize"));
  expect(document.activeElement).toBe(region);
  expect(region.tabIndex).toBe(0);
  region.blur();
  expect(region.hasAttribute("tabindex")).toBe(false);
});
