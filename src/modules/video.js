/**
 * Video: a link to a YouTube or Vimeo video plays in a pop-up on the page instead.
 * Any other link, or a page without this script, simply follows the link.
 *
 * Markup (set in the Designer, inside the Video card):
 *   a[data-video]                the link; its href is the Video card's Video prop
 *   dialog[data-video-dialog]    the pop-up beside it, styled in the Designer
 *     button[data-video-close]   closes it
 *     [data-video-frame]         where the player goes
 *
 * Closing it (button, Escape or a click outside the video) removes the player, so
 * nothing keeps playing. A link with no dialog near it simply follows its link.
 */

import { closestWithin } from "../utils/dom.js";

/** The player address for a YouTube or Vimeo link, or null for anything else. */
export function embedUrl(href) {
  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const path = url.pathname.split("/").filter(Boolean);

  let youtube = null;
  if (host === "youtu.be") youtube = path[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtube = ["embed", "shorts", "live"].includes(path[0]) ? path[1] : url.searchParams.get("v");
  }
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`;

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const at = path.findIndex((part) => /^\d+$/.test(part));
    if (at === -1) return null;
    const hash = url.searchParams.get("h") || (/^[0-9a-f]+$/.test(path[at + 1] || "") ? path[at + 1] : null);
    return `https://player.vimeo.com/video/${path[at]}?autoplay=1&dnt=1${hash ? `&h=${hash}` : ""}`;
  }
  return null;
}

const ready = new WeakSet();

/** The dialog in the nearest block around the link that has one. */
function dialogFor(link) {
  let block = link.parentElement;
  while (block && !block.querySelector("dialog[data-video-dialog]")) block = block.parentElement;
  return block ? block.querySelector("dialog[data-video-dialog]") : null;
}

function prepare(dialog) {
  if (ready.has(dialog)) return;
  ready.add(dialog);
  dialog.querySelector("[data-video-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.querySelector("[data-video-frame]").replaceChildren());
}

function play(dialog, src, label) {
  prepare(dialog);
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = label || "Video";
  frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  frame.allowFullscreen = true;
  dialog.setAttribute("aria-label", label || "Video");
  dialog.querySelector("[data-video-frame]").replaceChildren(frame);
  dialog.showModal();
}

function onClick(event) {
  const link = closestWithin(document, event.target, "a[data-video]");
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
  const src = embedUrl(link.getAttribute("href") || "");
  const dialog = src && dialogFor(link);
  if (!dialog) return;
  event.preventDefault();
  play(dialog, src, link.textContent.trim().replace(/\s+/g, " "));
}

export function initVideo() {
  document.querySelectorAll("a[data-video]").forEach((link) => {
    if (embedUrl(link.getAttribute("href") || "") && dialogFor(link)) link.setAttribute("aria-haspopup", "dialog");
  });
  document.addEventListener("click", onClick);
}

export default { name: "video", init: initVideo };
