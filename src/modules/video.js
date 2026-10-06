/**
 * Video: a link to a YouTube or Vimeo video plays in a pop-up on the page instead.
 * Any other link, or a page without this script, simply follows the link.
 *
 * Markup (set in the Designer):
 *   a[data-video]   the link; its href is the Video card's Video prop
 *
 * The pop-up is one native <dialog>, made on first use and styled in the video embed.
 * Closing it (button, Escape or a click outside the video) removes the player, so
 * nothing keeps playing.
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

let dialog;

function getDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "video-dialog";
  dialog.innerHTML = `
    <button class="video-dialog_close" type="button" aria-label="Close video">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <div class="video-dialog_frame"></div>`;
  dialog.querySelector(".video-dialog_close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.querySelector(".video-dialog_frame").replaceChildren());
  document.body.append(dialog);
  return dialog;
}

function play(src, label) {
  const box = getDialog();
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = label || "Video";
  frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  frame.allowFullscreen = true;
  box.setAttribute("aria-label", label || "Video");
  box.querySelector(".video-dialog_frame").replaceChildren(frame);
  box.showModal();
}

function onClick(event) {
  const link = closestWithin(document, event.target, "a[data-video]");
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
  const src = embedUrl(link.getAttribute("href") || "");
  if (!src) return;
  event.preventDefault();
  play(src, link.textContent.trim().replace(/\s+/g, " "));
}

export function initVideo() {
  document.querySelectorAll("a[data-video]").forEach((link) => {
    if (embedUrl(link.getAttribute("href") || "")) link.setAttribute("aria-haspopup", "dialog");
  });
  document.addEventListener("click", onClick);
}

export default { name: "video", init: initVideo };
