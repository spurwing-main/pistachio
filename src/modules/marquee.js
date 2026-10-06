/**
 * Marquee: a row that scrolls sideways for ever (logo strips, testimonial sliders).
 * The items are copied once so the loop has no seam; the copy is hidden from screen readers
 * and taken out of the tab order. CSS does the movement (the `marquee` embed); this sets a
 * duration that keeps the same speed whatever the row holds, and marks the row offscreen so
 * it stops when nobody can see it.
 *
 * Markup (set in the Designer):
 *   [data-marquee]          the visible window (edge fades); gets data-marquee-visible and
 *                           data-marquee-paused
 *     [data-marquee-track]  the element whose children scroll (a Collection List's items)
 *   [data-marquee-pause]    optional pause button ("Pause Slider"), anywhere in the same block;
 *                           it stops and starts the rows near it and gets aria-pressed
 */

import { qsa } from "../utils/dom.js";

const PIXELS_PER_SECOND = 40;

function setupMarquee(root) {
  if (root.dataset.marqueeReady) return;
  const track = root.querySelector("[data-marquee-track]");
  if (!track || !track.children.length) return;
  root.dataset.marqueeReady = "true";

  Array.from(track.children).forEach((item) => {
    const copy = item.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    const focusable = "a, button, input, select, textarea, [tabindex]";
    [copy, ...qsa(copy, focusable)].filter((el) => el.matches(focusable)).forEach((el) => el.setAttribute("tabindex", "-1"));
    track.append(copy);
  });

  const setDuration = () => {
    root.style.setProperty("--marquee-duration", `${track.scrollWidth / 2 / PIXELS_PER_SECOND}s`);
  };
  setDuration();
  new ResizeObserver(setDuration).observe(track);

  new IntersectionObserver(([entry]) => {
    root.dataset.marqueeVisible = String(entry.isIntersecting);
  }).observe(root);
}

/** The rows a pause button controls: those inside the nearest block around it that has any. */
function rowsFor(button) {
  let block = button.parentElement;
  while (block && !block.querySelector("[data-marquee]")) block = block.parentElement;
  return block ? qsa(block, "[data-marquee]") : [];
}

function setupPause(button) {
  if (button.hasAttribute("aria-pressed")) return;
  const rows = rowsFor(button);
  if (!rows.length) return;
  rows.forEach((row, i) => {
    row.id ||= `marquee-${Math.random().toString(36).slice(2, 8)}-${i}`;
  });
  button.setAttribute("aria-controls", rows.map((row) => row.id).join(" "));
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    button.click();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const paused = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(paused));
    rows.forEach((row) => {
      row.dataset.marqueePaused = String(paused);
    });
  });
}

export function initMarquee(root = document) {
  qsa(root, "[data-marquee]").forEach(setupMarquee);
  qsa(root, "[data-marquee-pause]").forEach(setupPause);
}

export default { name: "marquee", init: initMarquee };
