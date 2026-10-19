import { qsa } from "../utils/dom.js";

function setupTeam(group) {
  if (group.dataset.aboutTeamStarted) return;
  group.dataset.aboutTeamStarted = "true";
  const rows = [...group.querySelectorAll("[data-about-team-row]")];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const layout = (row, track, originals) => {
    track.querySelectorAll("[data-about-team-clone]").forEach((item) => item.remove());
    row.dataset.aboutTeamEmpty = String(originals.length === 0);
    if (!originals.length) return;
    const distance = originals.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0);
    if (!distance || !row.clientWidth) return;
    row.style.setProperty("--about-team-distance", distance + "px");
    row.style.setProperty("--about-team-duration", distance / 10 + "s");
    if (!reduce.matches) {
      const repeats = Math.ceil(row.clientWidth / distance);
      const copies = document.createDocumentFragment();
      for (let i = 0; i < repeats; i++)
        originals.forEach((item) => {
          const copy = item.cloneNode(true);
          copy.dataset.aboutTeamClone = "";
          copy.setAttribute("aria-hidden", "true");
          [copy, ...copy.querySelectorAll("[id]")].forEach((node) => node.removeAttribute("id"));
          copy
            .querySelectorAll("a,button,input,select,textarea,[tabindex]")
            .forEach((node) => node.setAttribute("tabindex", "-1"));
          copies.append(copy);
        });
      track.append(copies);
    }
    row.dataset.aboutTeamReady = "";
  };
  const layouts = [];
  rows.forEach((row) => {
    const track = row.querySelector("[data-about-team-track]");
    if (!track) return;
    const originals = [...track.children].filter(
      (item) => !item.hasAttribute("data-about-team-clone"),
    );
    if (row.hasAttribute("data-about-team-duplicate")) {
      row.setAttribute("aria-hidden", "true");
      row
        .querySelectorAll("a,button,[tabindex]")
        .forEach((node) => node.setAttribute("tabindex", "-1"));
    }
    const refresh = () => layout(row, track, originals);
    layouts.push(refresh);
    new ResizeObserver(refresh).observe(row);
    new IntersectionObserver(([entry]) => {
      row.dataset.aboutTeamVisible = String(entry.isIntersecting);
    }).observe(row);
    track.querySelectorAll("img").forEach((image) => {
      if (!image.complete) image.addEventListener("load", refresh, { once: true });
    });
    refresh();
  });
  reduce.addEventListener("change", () => layouts.forEach((refresh) => refresh()));
}

export function initAboutTeam(root = document) {
  qsa(root, "[data-about-team]").forEach(setupTeam);
}

export default { name: "about-team", init: initAboutTeam };
