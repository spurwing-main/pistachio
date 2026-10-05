/**
 * Nav: shrink on scroll, current section, desktop dropdowns and the mobile menu.
 * Adapted from Executive Life's nav (exec-life src/modules/nav.js): the bar shrinks
 * instead of hiding, and the mobile menu opens groups in place instead of sub-screens.
 *
 * Markup contract (set in the Designer):
 *   [data-nav]                 the nav root; gets data-nav-scrolled and data-nav-expanded
 *                              (not data-nav-menu-open: Webflow's navbar CSS styles that name)
 *   [data-nav-menu]            the menu (dropdown row on desktop, the panel on mobile)
 *   [data-nav-group]           one group; gets data-open. It is the current section when
 *                              the page matches any link inside it (its trigger or items),
 *                              so adding a Nav item is all it takes to add a page.
 *     [data-nav-trigger]       the group's link; gets aria-expanded and aria-current
 *     [data-nav-panel]         the group's panel
 *   [data-nav-menu-toggle]     the mobile menu button
 *
 * All looks live in the Nav embed's CSS, which styles off these attributes.
 */

import { closestWithin, qsa } from "../utils/dom.js";

const SCROLLED_AFTER = 48;
const OPEN_DELAY = 70;
const CLOSE_DELAY = 120;
const DESKTOP = "(min-width: 992px)";

const isDesktop = () => window.matchMedia(DESKTOP).matches;
const hoverable = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const mouseDesktop = () => isDesktop() && hoverable();

const focusables = (el) =>
  qsa(el, 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').filter(
    (node) => !node.disabled && node.offsetParent !== null,
  );

/** Site-relative paths of the links in a group, without trailing slashes. */
const groupPaths = (group) =>
  Array.from(group.querySelectorAll("a[href]"))
    .map((link) => {
      try {
        const url = new URL(link.getAttribute("href"), window.location.origin);
        return url.origin === window.location.origin ? url.pathname.replace(/\/+$/, "") : null;
      } catch {
        return null;
      }
    })
    .filter((path) => path && path !== "/");

/** The group holding a link to the current page or a page below one of its links, if any. */
export function currentGroup(groups, pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return groups.find((group) => groupPaths(group).some((p) => path === p || path.startsWith(`${p}/`)));
}

function setupNav(root) {
  if (root.dataset.navReady) return;
  root.dataset.navReady = "true";

  const menu = root.querySelector("[data-nav-menu]");
  const groups = qsa(root, "[data-nav-group]");
  const toggle = root.querySelector("[data-nav-menu-toggle]");
  const triggerOf = (group) => group.querySelector("[data-nav-trigger]");
  const panelOf = (group) => group.querySelector("[data-nav-panel]");

  /* ---- Shrink on scroll ---- */
  let ticking = false;
  const updateScrolled = () => {
    ticking = false;
    root.dataset.navScrolled = String(window.scrollY > SCROLLED_AFTER);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateScrolled);
    },
    { passive: true },
  );
  updateScrolled();

  /* ---- Current section ---- */
  const current = currentGroup(groups, window.location.pathname);
  if (current) {
    triggerOf(current)?.setAttribute("aria-current", "true");
    menu?.setAttribute("data-nav-has-current", "");
  }

  /* ---- Groups ---- */
  groups.forEach((group, index) => {
    const trigger = triggerOf(group);
    const panel = panelOf(group);
    if (!trigger || !panel) return;
    if (!panel.id) panel.id = `nav-panel-${group.dataset.navGroup || index}`;
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    group.dataset.open = "false";
  });

  const syncMenu = () => {
    const open = groups.some((group) => group.dataset.open === "true");
    if (open) menu?.setAttribute("data-nav-has-open", "");
    else menu?.removeAttribute("data-nav-has-open");
  };

  const setGroup = (group, open) => {
    group.dataset.open = String(open);
    triggerOf(group)?.setAttribute("aria-expanded", String(open));
  };

  const openGroup = (target) => {
    groups.forEach((group) => setGroup(group, group === target));
    syncMenu();
  };

  const closeGroups = () => {
    groups.forEach((group) => setGroup(group, false));
    syncMenu();
  };

  const isOpen = (group) => group.dataset.open === "true";

  /* Desktop: hover intent with a mouse, click or keyboard otherwise. */
  let openTimer;
  let closeTimer;
  const cancelTimers = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  };

  groups.forEach((group) => {
    const trigger = triggerOf(group);
    if (!trigger) return;

    group.addEventListener("mouseenter", () => {
      if (!mouseDesktop()) return;
      cancelTimers();
      openTimer = setTimeout(() => openGroup(group), OPEN_DELAY);
    });

    group.addEventListener("mouseleave", () => {
      if (!mouseDesktop()) return;
      cancelTimers();
      closeTimer = setTimeout(closeGroups, CLOSE_DELAY);
    });

    /* With a mouse on desktop the link goes to its page; otherwise it opens its group. */
    trigger.addEventListener("click", (event) => {
      if (mouseDesktop()) return;
      event.preventDefault();
      isOpen(group) ? closeGroups() : openGroup(group);
    });

    trigger.addEventListener("keydown", (event) => {
      if (!isDesktop()) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openGroup(group);
        setTimeout(() => focusables(panelOf(group))[0]?.focus(), 0);
      }
    });

    panelOf(group)?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = focusables(panelOf(group));
      if (!items.length) return;
      event.preventDefault();
      const at = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? items[at + 1] || items[0] : items[at - 1] || items[items.length - 1];
      next.focus();
    });
  });

  /* Desktop panels close on scroll and when focus leaves the nav. */
  window.addEventListener(
    "scroll",
    () => {
      if (isDesktop() && groups.some(isOpen)) closeGroups();
    },
    { passive: true },
  );

  root.addEventListener("focusout", () => {
    setTimeout(() => {
      if (isDesktop() && !root.contains(document.activeElement)) closeGroups();
    }, 0);
  });

  /* ---- Mobile menu ---- */
  let lastFocused = null;
  const menuOpen = () => root.dataset.navExpanded === "true";

  const setMenu = (open) => {
    root.dataset.navExpanded = String(open);
    document.documentElement.classList.toggle("nav-menu-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    if (open) {
      const active = document.activeElement;
      lastFocused = active && root.contains(active) ? active : toggle;
      setTimeout(() => focusables(menu || root)[0]?.focus(), 0);
    } else {
      closeGroups();
      lastFocused?.focus?.();
    }
  };

  /* The button links to #nav-menu so the menu opens without this script. With it, keep
     that out of the address: Webflow's in-page link handler would add it, and the CSS
     opens the menu for it. */
  const clearHash = () => {
    if (menu?.id && window.location.hash === `#${menu.id}`) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };
  clearHash();

  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    if (menu?.id) toggle.setAttribute("aria-controls", menu.id);
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMenu(!menuOpen());
      clearHash();
    });
  }

  /* A real link inside the open menu closes it. */
  root.addEventListener("click", (event) => {
    if (!menuOpen()) return;
    const link = closestWithin(root, event.target, "a[href]");
    if (!link || link.matches("[data-nav-trigger],[data-nav-menu-toggle]")) return;
    setMenu(false);
  });

  /* Keep focus inside the nav while the menu is open. */
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !menuOpen()) return;
    const items = focusables(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ---- Shared ---- */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = groups.find(isOpen);
    if (menuOpen()) setMenu(false);
    else if (open) {
      closeGroups();
      triggerOf(open)?.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target) && groups.some(isOpen) && isDesktop()) closeGroups();
  });

  window.matchMedia(DESKTOP).addEventListener?.("change", () => {
    if (menuOpen()) setMenu(false);
    closeGroups();
  });
}

export function initNav(root = document) {
  qsa(root, "[data-nav]").forEach(setupNav);
}

export default { name: "nav", init: initNav };
