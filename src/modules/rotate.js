/**
 * Rotate: one quote at a time (the Book a demo quote card). A line along the card fills while
 * the quote shows; when it is full the next quote fades in. CSS draws the fade and the line
 * (the `rotate` embed); this marks the current quote and moves on when its line ends.
 * It stops on hover, while anything inside has keyboard focus, offscreen and with the pause
 * button. With reduced motion it shows the first quote only and hides the button.
 *
 * Markup (set in the Designer):
 *   [data-rotate]              the box; gets data-rotate-ready, -visible and -paused.
 *                              Its value is the seconds each quote shows (default 8).
 *     [data-rotate-track]      the element whose children are the quotes (a Collection List's
 *                              items); the shown one gets data-rotate-current
 *       [data-rotate-bar]      the line in each quote that fills
 *     [data-rotate-pause]      optional pause button; gets aria-pressed
 */

import { qsa } from "../utils/dom.js";

const SECONDS = 8;

function setupRotate(root) {
  if (root.dataset.rotateReady) return;
  const track = root.querySelector("[data-rotate-track]");
  const slides = track ? Array.from(track.children) : [];
  const button = root.querySelector("[data-rotate-pause]");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (slides.length < 2 || still) {
    if (button) button.hidden = true;
    return;
  }
  root.dataset.rotateReady = "true";
  root.style.setProperty("--rotate-duration", `${Number(root.dataset.rotate) || SECONDS}s`);

  let current = 0;
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === current;
      slide.toggleAttribute("data-rotate-current", on);
      slide.inert = !on;
      slide.setAttribute("aria-hidden", String(!on));
    });
  };
  show(0);

  track.addEventListener("animationend", (event) => {
    if (event.target.matches("[data-rotate-bar]")) show(current + 1);
  });

  if (button) {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const paused = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(paused));
      root.dataset.rotatePaused = String(paused);
    });
  }

  new IntersectionObserver(([entry]) => {
    root.dataset.rotateVisible = String(entry.isIntersecting);
  }).observe(root);
}

export function initRotate(root = document) {
  qsa(root, "[data-rotate]").forEach(setupRotate);
}

export default { name: "rotate", init: initRotate };
