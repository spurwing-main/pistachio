/**
 * Nav: shrink on scroll, current section, desktop dropdowns and the mobile menu.
 * The script only sets attributes; every look and movement is in the Nav's own embed.
 *
 * Markup (set in the Designer):
 *   [data-nav]               root; gets data-nav-scrolled and data-nav-expanded (not
 *                            data-nav-menu-open: Webflow's navbar CSS styles that name)
 *   [data-nav-menu]          dropdown row on desktop, the menu panel on mobile; gets the
 *                            white box's place (--nav-panel-*) and --nav-from
 *   [data-nav-group]         one group; gets data-open (and data-nav-leaving while switching).
 *                            It is the current section when the page is, or is below, any
 *                            link inside it, so adding a Nav item is all it takes.
 *     [data-nav-trigger]     the group's link; gets aria-expanded and aria-current
 *     [data-nav-panel]       the group's items; its first child gets --nav-list-*
 *   [data-nav-menu-toggle]   the mobile menu button (href "#")
 */

import { closestWithin, qsa } from "../utils/dom.js";

const SCROLLED_AFTER = 48;
const OPEN_DELAY = 70;
const CLOSE_DELAY = 120;
const DESKTOP = "(min-width: 992px)";

const isDesktop = () => window.matchMedia(DESKTOP).matches;
const withMouse = () => isDesktop() && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const focusables = (el) =>
  qsa(el, 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').filter(
    (node) => !node.disabled && node.offsetParent !== null,
  );

/** Site-relative paths of the links in a group, without trailing slashes. */
const groupPaths = (group) =>
  qsa(group, "a[href]")
    .map((link) => {
      const url = new URL(link.getAttribute("href"), window.location.origin);
      return url.origin === window.location.origin ? url.pathname.replace(/\/+$/, "") : null;
    })
    .filter((path) => path && path !== "/");

/** The group holding a link to the current page or a page below one of its links, if any. */
export function currentGroup(groups, pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return groups.find((group) => groupPaths(group).some((p) => path === p || path.startsWith(`${p}/`)));
}

/** An element's offset box measured from `container`. */
function boxWithin(container, el) {
  let x = 0;
  let y = 0;
  for (let node = el; node && node !== container; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function setBox(el, name, box) {
  Object.entries(box).forEach(([key, value]) => el.style.setProperty(`--nav-${name}-${key}`, `${value}px`));
}

function setupNav(root) {
  if (root.dataset.navReady) return;
  root.dataset.navReady = "true";

  const menu = root.querySelector("[data-nav-menu]");
  const toggle = root.querySelector("[data-nav-menu-toggle]");
  const groups = qsa(root, "[data-nav-group]");
  const triggerOf = (group) => group.querySelector("[data-nav-trigger]");
  const panelOf = (group) => group.querySelector("[data-nav-panel]");
  const isOpen = (group) => group.dataset.open === "true";
  const menuOpen = () => root.dataset.navExpanded === "true";

  /* ---- Current section ---- */
  const current = currentGroup(groups, window.location.pathname);
  if (current) triggerOf(current).setAttribute("aria-current", "true");

  /* ---- Groups (both sizes) ---- */
  groups.forEach((group, index) => {
    const panel = panelOf(group);
    panel.id ||= `nav-panel-${index}`;
    triggerOf(group).setAttribute("aria-controls", panel.id);
  });

  const show = (target) => {
    groups.forEach((group) => {
      group.dataset.open = String(group === target);
      triggerOf(group).setAttribute("aria-expanded", String(group === target));
    });
  };

  /* Desktop: the white box goes behind the new group; when switching it glides there and the
     new items come in from the side you came from. */
  const openGroup = (target) => {
    const prev = groups.find(isOpen);
    if (isDesktop()) {
      const switching = Boolean(prev) && prev !== target;
      groups.forEach((group) => group.toggleAttribute("data-nav-leaving", switching && group === prev));
      if (switching) {
        menu.style.setProperty("--nav-from", groups.indexOf(target) > groups.indexOf(prev) ? "-0.75rem" : "0.75rem");
        void menu.offsetWidth; // the new items take their starting side before they open
      }
      setBox(menu, "panel", boxWithin(menu, panelOf(target)));
      groups.forEach((group) => {
        const list = panelOf(group).firstElementChild;
        if (list) setBox(list, "list", boxWithin(menu, list));
      });
    }
    show(target);
  };

  const closeGroups = () => {
    show(null);
    groups.forEach((group) => group.removeAttribute("data-nav-leaving"));
    menu.style.removeProperty("--nav-from");
  };

  show(null);

  /* ---- Desktop dropdowns: hover intent with a mouse, click or keyboard otherwise ---- */
  let timer;
  groups.forEach((group) => {
    const trigger = triggerOf(group);

    group.addEventListener("mouseenter", () => {
      if (!withMouse()) return;
      clearTimeout(timer);
      /* Wait before the first panel opens; once one is open, switch straight away. */
      timer = setTimeout(() => openGroup(group), groups.some(isOpen) ? 0 : OPEN_DELAY);
    });

    group.addEventListener("mouseleave", () => {
      if (!withMouse()) return;
      clearTimeout(timer);
      timer = setTimeout(closeGroups, CLOSE_DELAY);
    });

    /* With a mouse on desktop the link goes to its page; otherwise it opens its group. */
    trigger.addEventListener("click", (event) => {
      if (withMouse()) return;
      event.preventDefault();
      isOpen(group) ? closeGroups() : openGroup(group);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" || !isDesktop()) return;
      event.preventDefault();
      openGroup(group);
      setTimeout(() => focusables(panelOf(group))[0]?.focus(), 0);
    });

    panelOf(group).addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = focusables(panelOf(group));
      event.preventDefault();
      const at = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? items[at + 1] || items[0] : items[at - 1] || items[items.length - 1];
      next?.focus();
    });
  });

  root.addEventListener("focusout", () => {
    setTimeout(() => {
      if (isDesktop() && !root.contains(document.activeElement)) closeGroups();
    }, 0);
  });

  document.addEventListener("click", (event) => {
    if (isDesktop() && !root.contains(event.target)) closeGroups();
  });

  /* ---- Mobile menu ---- */
  let lastFocused = null;

  const setMenu = (open) => {
    root.dataset.navExpanded = String(open);
    document.documentElement.classList.toggle("nav-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) {
      lastFocused = root.contains(document.activeElement) ? document.activeElement : toggle;
      setTimeout(() => focusables(menu)[0]?.focus(), 0);
    } else {
      closeGroups();
      lastFocused?.focus();
    }
  };

  toggle.setAttribute("aria-controls", menu.id);
  setMenu(false);

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    setMenu(!menuOpen());
  });

  /* A real link in the open menu closes it, and so does a tap on the scrim (the nav itself). */
  root.addEventListener("click", (event) => {
    if (!menuOpen()) return;
    const link = closestWithin(root, event.target, "a[href]");
    if (event.target === root || (link && !link.matches("[data-nav-trigger],[data-nav-menu-toggle]"))) {
      setMenu(false);
    }
  });

  /* Keep focus inside the nav while the menu is open. */
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !menuOpen()) return;
    const items = focusables(root);
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? items[items.length - 1] : items[0]).focus();
  });

  /* ---- Both ---- */
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    root.dataset.navScrolled = String(window.scrollY > SCROLLED_AFTER);
    if (isDesktop() && groups.some(isOpen)) closeGroups();
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    },
    { passive: true },
  );
  onScroll();

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = groups.find(isOpen);
    if (menuOpen()) setMenu(false);
    else if (open) {
      closeGroups();
      triggerOf(open).focus();
    }
  });

  window.matchMedia(DESKTOP).addEventListener("change", () => {
    if (menuOpen()) setMenu(false);
    closeGroups();
  });
}

export function initNav(root = document) {
  qsa(root, "[data-nav]").forEach(setupNav);
}

export default { name: "nav", init: initNav };
