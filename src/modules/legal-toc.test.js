import { afterEach, beforeEach, expect, it } from "vitest";
import { initLegalToc } from "./legal-toc.js";
import { vi } from "vitest";

let cleanup, root;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const ready = () => window.FinsweetAttributes[0][1]();
beforeEach(() => {
  window.FinsweetAttributes = [];
  document.body.innerHTML = `<section data-legal-manager>
    <div data-legal-current>
      <nav class="page-contents"><a href="#">Template</a></nav>
      <div data-legal-body><h2 id="intro">Introduction</h2></div>
    </div>
  </section>`;
  root = document.querySelector("section");
});
afterEach(() => { cleanup?.(); document.body.innerHTML = ""; delete window.FinsweetAttributes; });

it("marks the wrapper only after Finsweet is ready and links target the displayed body", () => {
  cleanup = initLegalToc();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  ready();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  root.querySelector("a").href = "#intro";
  ready();
  expect(root.getAttribute("data-legal-toc-ready")).toBe("true");
});

it("does not accept links to missing headings or historical source content", () => {
  root.insertAdjacentHTML("beforeend", '<div data-legal-sources hidden><h2 id="old">Old</h2></div>');
  cleanup = initLegalToc();
  root.querySelector("a").href = "#old";
  ready();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  root.querySelector("a").href = "#missing";
  ready();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
});

it("clears readiness on revision changes until the next successful init", () => {
  root.querySelector("a").href = "#intro";
  cleanup = initLegalToc();
  ready();
  root.dispatchEvent(new CustomEvent("legal:revisionchange", { bubbles: true }));
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  ready();
  expect(root.getAttribute("data-legal-toc-ready")).toBe("true");
});

it("removes readiness when generated links disappear", async () => {
  root.querySelector("a").href = "#intro";
  cleanup = initLegalToc();
  ready();
  root.querySelector("nav").replaceChildren();
  await Promise.resolve();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
});

it("cleans up and ignores late Finsweet callbacks", () => {
  root.querySelector("a").href = "#intro";
  cleanup = initLegalToc();
  ready();
  cleanup();
  ready();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
});

function installRestart({ fail = false, pause = null } = {}) {
  root.querySelector("nav").innerHTML = `<div class="page-contents_rows"><div class="page-contents_list">
    <a href="#"><span fs-toc-element="link">Heading</span></a>
  </div></div>`;
  root.querySelector("[data-legal-body]").setAttribute("fs-toc-element", "contents");
  const controls = {
    loading: Promise.resolve(),
    restart: vi.fn(async () => {
      if (pause) await pause();
      if (fail) throw new Error("TOC failed");
      const rows = root.querySelector(".page-contents_rows");
      const body = root.querySelector("[data-legal-body]");
      // Emulate Finsweet's consuming template and wrapping/ID-moving behaviour.
      const template = rows.querySelector('[fs-toc-element="link"]').closest("a");
      const output = [];
      for (const heading of [...body.children].filter(el => el.matches("h2"))) {
        const id = heading.id || heading.textContent.toLowerCase().replaceAll(" ", "-");
        const wrapper = document.createElement("div");
        wrapper.id = id;
        heading.removeAttribute("id");
        heading.before(wrapper);
        wrapper.append(heading);
        const link = template.cloneNode(true);
        link.href = `#${id}`;
        link.querySelector("span").textContent = heading.textContent;
        output.push(link);
      }
      rows.replaceChildren(...output);
    }),
  };
  window.FinsweetAttributes.modules = { toc: controls };
  return controls;
}

it("restarts only TOC after revision changes, restores its template, and marks the final result", async () => {
  const controls = installRestart();
  cleanup = initLegalToc();
  ready();
  await settle();
  expect(root.getAttribute("data-legal-toc-ready")).toBe("true");
  const body = root.querySelector("[data-legal-body]");
  body.innerHTML = '<h2 id="older">Earlier policy</h2>';
  root.dispatchEvent(new CustomEvent("legal:revisionchange"));
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  await settle();
  expect(controls.restart).toHaveBeenCalledTimes(2);
  expect(root.querySelector("nav a").hash).toBe("#older");
  expect(root.querySelector("nav a").textContent).toBe("Earlier policy");
  expect(root.getAttribute("data-legal-toc-ready")).toBe("true");
  root.dispatchEvent(new CustomEvent("legal:revisionchange"));
  await settle();
  expect(body.querySelectorAll("div[id]")).toHaveLength(1);
  expect(root.querySelectorAll("nav a")).toHaveLength(1);
});

it("keeps fallback state after a failed restart or a revision without headings", async () => {
  const controls = installRestart({ fail: true });
  cleanup = initLegalToc();
  ready();
  await settle();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  expect(root.querySelector("[data-legal-body]").textContent).toBe("Introduction");
  controls.restart.mockResolvedValue(undefined);
  root.querySelector("[data-legal-body]").innerHTML = "<p>No headings.</p>";
  root.dispatchEvent(new CustomEvent("legal:revisionchange"));
  await settle();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
});

it("serialises rapid changes and rebuilds for the latest revision", async () => {
  const pending = [];
  const controls = installRestart({ pause: () => new Promise(resolve => pending.push(resolve)) });
  cleanup = initLegalToc();
  ready();
  await settle();
  root.querySelector("[data-legal-body]").innerHTML = '<h2 id="second">Second</h2>';
  root.dispatchEvent(new CustomEvent("legal:revisionchange"));
  root.querySelector("[data-legal-body]").innerHTML = '<h2 id="third">Third</h2>';
  root.dispatchEvent(new CustomEvent("legal:revisionchange"));
  expect(controls.restart).toHaveBeenCalledTimes(1);
  pending.shift()();
  await settle();
  expect(root.hasAttribute("data-legal-toc-ready")).toBe(false);
  expect(controls.restart).toHaveBeenCalledTimes(2);
  pending.shift()();
  await settle();
  expect(root.querySelector("nav a").hash).toBe("#third");
  expect(root.querySelectorAll("[data-legal-body] div[id]")).toHaveLength(1);
  expect(root.getAttribute("data-legal-toc-ready")).toBe("true");
});

it("includes headings inside anonymous CMS divs without removing styled containers", async () => {
  installRestart();
  root.querySelector('[data-legal-body]').innerHTML = '<h2>First</h2><div><div><h2>Second</h2><p>Copy</p></div></div><div class="custom"><h2>Styled</h2></div>';
  cleanup = initLegalToc();
  ready();
  await settle();
  expect([...root.querySelectorAll('nav a')].map(el => el.textContent)).toEqual(['First', 'Second']);
  expect(root.querySelector('[data-legal-body] .custom h2').textContent).toBe('Styled');
});
