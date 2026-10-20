import { afterEach, beforeEach, expect, it } from "vitest";
import { initLegalRevisions } from "./legal-revisions.js";

let cleanup;
const q = (s) => document.querySelector(s);
function record(revision, documentKey = "privacy-notice") {
  return `<div data-legal-record>
    <span data-legal-document-key hidden>${documentKey}</span>
    <div data-legal-content>
      <span data-legal-revision>${revision}</span>
      <span data-legal-date>7 October 2025</span>
      <div data-legal-body><h2 id="intro">Earlier ${revision}</h2><table><tbody><tr><td>Term</td></tr></tbody></table><a href="#intro">Introduction</a></div>
    </div>
  </div>`;
}
function mount(records = record("1.8")) {
  document.body.innerHTML = `<section data-legal-manager>
    <h1>Privacy Notice</h1>
    <span data-legal-document-key hidden>privacy-notice</span>
    <div data-legal-current>
      <span data-legal-revision>1.9</span>
      <span data-legal-date>7 October 2026</span>
      <div data-legal-body><h2 id="intro">Current wording</h2></div>
    </div>
    <div data-legal-controls hidden><label>Revision<select data-legal-select></select></label></div>
    <p data-legal-status role="status"></p>
    <div data-legal-sources hidden>${records}</div>
  </section>`;
}
function choose(value) {
  q("select").value = value;
  q("select").dispatchEvent(new Event("change", { bubbles: true }));
}
beforeEach(() => {
  history.replaceState(null, "", "/privacy-notice?utm_source=test");
  mount();
});
afterEach(() => { cleanup?.(); cleanup = undefined; document.body.innerHTML = ""; });

it("keeps the CMS current rendering and offers published history", () => {
  const original = q("[data-legal-current]").firstElementChild;
  cleanup = initLegalRevisions();
  expect(q("[data-legal-current]").firstElementChild).toBe(original);
  expect(q("select").value).toBe("1.9");
  expect([...q("select").options].map(o => o.value)).toEqual(["1.9", "1.8"]);
  expect(q("[data-legal-controls]").hidden).toBe(false);
  expect(document.querySelectorAll("#intro")).toHaveLength(1);
});

it("switches between sibling document and history collection lists inside one manager", () => {
  const root = q("[data-legal-manager]");
  const list = document.createElement("div");
  list.className = "w-dyn-list";
  const item = document.createElement("div");
  item.className = "w-dyn-item";
  root.prepend(list);
  list.append(item);
  item.append(q("[data-legal-document-key]"), q("[data-legal-current]"));
  const title = q("h1");
  item.prepend(title);
  cleanup = initLegalRevisions();
  choose("1.8");
  expect(item.querySelector("[data-legal-revision]").textContent).toBe("1.8");
  expect(item.querySelector("td").textContent).toBe("Term");
  expect(item.querySelector("h1")).toBe(title);
  expect(q("[data-legal-sources]").parentElement).toBe(root);
  choose("1.9");
  expect(item.querySelector("h2").textContent).toBe("Current wording");
});

it("switches body, date and revision together, preserving tables and links", () => {
  cleanup = initLegalRevisions();
  choose("1.8");
  const content = q("[data-legal-current]");
  expect(content.querySelector("[data-legal-revision]").textContent).toBe("1.8");
  expect(content.querySelector("[data-legal-date]").textContent).toBe("7 October 2025");
  expect(content.querySelector("td").textContent).toBe("Term");
  expect(content.querySelector("a").getAttribute("href")).toBe("#intro");
  expect(q("h1").textContent).toBe("Privacy Notice");
  expect(q("[data-legal-status]").textContent).toMatch(/historical/i);
  expect(location.search).toBe("?utm_source=test&revision=1.8");
  choose("1.9");
  expect(content.querySelector("h2").textContent).toBe("Current wording");
  expect(location.search).toBe("?utm_source=test");
});

it("preserves the current layout, TOC, metadata and Rich Text elements across revisions", () => {
  const current = q("[data-legal-current]");
  const body = current.querySelector("[data-legal-body]");
  body.className = "text-rich-text is-article";
  body.setAttribute("fs-toc-element", "contents");
  const shell = document.createElement("div");
  shell.className = "legal_layout-inner";
  current.append(shell);
  const toc = document.createElement("nav");
  toc.className = "page-contents";
  shell.append(toc, body);
  const revision = current.querySelector("[data-legal-revision]");
  cleanup = initLegalRevisions();
  choose("1.8");
  expect(current.querySelector(".legal_layout-inner")).toBe(shell);
  expect(current.querySelector(".page-contents")).toBe(toc);
  expect(current.querySelector("[data-legal-body]")).toBe(body);
  expect(current.querySelector("[data-legal-revision]")).toBe(revision);
  expect(body.getAttribute("fs-toc-element")).toBe("contents");
  expect(body.querySelector("h2").textContent).toBe("Earlier 1.8");
  choose("1.9");
  expect(current.querySelector(".page-contents")).toBe(toc);
  expect(body.querySelector("h2").textContent).toBe("Current wording");
});

it("restores deep links and responds to browser history without extra entries", () => {
  history.replaceState(null, "", "?revision=1.8#intro");
  cleanup = initLegalRevisions();
  expect(q("select").value).toBe("1.8");
  history.replaceState({ other: true }, "", "?utm_source=back");
  const length = history.length;
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(q("select").value).toBe("1.9");
  expect(history.length).toBe(length);
  expect(history.state).toEqual({ other: true });
});

it("clearly falls back to current for an unavailable revision without rewriting the URL", () => {
  history.replaceState(null, "", "?revision=missing");
  cleanup = initLegalRevisions();
  expect(q("select").value).toBe("1.9");
  expect(q("[data-legal-status]").textContent).toMatch(/unavailable/i);
  expect(q("[data-legal-current] h2").textContent).toBe("Current wording");
  expect(location.search).toBe("?revision=missing");
});

it("excludes records from another document and incomplete records", () => {
  mount(record("3.2", "terms") + record("1.7").replace("data-legal-body", "data-missing-body"));
  cleanup = initLegalRevisions();
  expect([...q("select").options].map(o => o.value)).toEqual(["1.9"]);
  expect(q("[data-legal-controls]").hidden).toBe(true);
});

it("does not guess between duplicate historical revision labels", () => {
  mount(record("1.8") + record("1.8"));
  cleanup = initLegalRevisions();
  expect([...q("select").options].map(o => o.value)).toEqual(["1.9"]);
});

it("uses CMS current content even if history includes that revision", () => {
  mount(record("1.9") + record("1.8"));
  cleanup = initLegalRevisions();
  choose("1.8");
  choose("1.9");
  expect(q("[data-legal-current] h2").textContent).toBe("Current wording");
});

it("retains the original nodes on return and restores the DOM on cleanup", () => {
  const body = q("[data-legal-body]");
  cleanup = initLegalRevisions();
  choose("1.8");
  choose("1.9");
  expect(q("[data-legal-body]")).toBe(body);
  choose("1.8");
  cleanup();
  expect(q("[data-legal-body]")).toBe(body);
  expect(q("[data-legal-sources] [data-legal-record]")).not.toBeNull();
  expect(q("[data-legal-controls]").hidden).toBe(true);
  cleanup = initLegalRevisions();
  expect(q("select").options).toHaveLength(2);
});

it("leaves incomplete setups untouched and avoids duplicate initialisation", () => {
  q("[data-legal-date]").remove();
  const html = document.body.innerHTML;
  cleanup = initLegalRevisions();
  expect(document.body.innerHTML).toBe(html);
  cleanup();
  mount();
  cleanup = initLegalRevisions();
  const secondCleanup = initLegalRevisions();
  secondCleanup();
  choose("1.8");
  expect(q("[data-legal-current] h2").textContent).toBe("Earlier 1.8");
});
