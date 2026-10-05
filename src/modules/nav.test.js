import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* nav.js asks matchMedia for the desktop width and for a fine pointer. jsdom has no
   matchMedia, so each test sets what the "device" answers. */
let media = { desktop: true, hover: true };
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query) => ({
    matches: query.includes("min-width") ? media.desktop : media.hover,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal("requestAnimationFrame", (fn) => fn());
});

let initNav;
let currentGroup;
beforeAll(async () => {
  ({ initNav, currentGroup } = await import("./nav.js"));
});

function mount(path = "/") {
  window.history.replaceState({}, "", path);
  document.body.innerHTML = `
    <nav data-nav>
      <a data-nav-menu-toggle href="#" aria-label="Open menu">Menu</a>
      <div data-nav-menu id="nav-menu">
        <div data-nav-group="platform">
          <a data-nav-trigger href="/human-risk-management">Platform</a>
          <div data-nav-panel><a href="/practice">Practice</a><a href="/presence">Presence</a></div>
        </div>
        <div data-nav-group="resources">
          <a data-nav-trigger href="/blog">Resources</a>
          <div data-nav-panel><a href="/blog">Blog</a></div>
        </div>
      </div>
    </nav>`;
  initNav(document);
  const nav = document.querySelector("[data-nav]");
  const [platform, resources] = document.querySelectorAll("[data-nav-group]");
  return { nav, platform, resources, toggle: nav.querySelector("[data-nav-menu-toggle]") };
}

const trigger = (group) => group.querySelector("[data-nav-trigger]");

beforeEach(() => {
  vi.useFakeTimers();
  media = { desktop: true, hover: true };
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove("nav-menu-open");
});

describe("current section", () => {
  it("matches a page and anything below it", () => {
    const { resources } = mount("/blog/how-exposed-is-your-business");
    expect(trigger(resources).getAttribute("aria-current")).toBe("true");
    expect(document.querySelector("[data-nav-menu]").hasAttribute("data-nav-has-current")).toBe(true);
  });

  it("marks nothing on a page outside every group", () => {
    const { platform, resources } = mount("/contact");
    expect(trigger(platform).hasAttribute("aria-current")).toBe(false);
    expect(trigger(resources).hasAttribute("aria-current")).toBe(false);
  });

  it("does not let a prefix of a word count as a match", () => {
    const group = document.createElement("div");
    group.innerHTML = '<a href="/press">Press</a>';
    expect(currentGroup([group], "/pressure")).toBeUndefined();
    expect(currentGroup([group], "/press/")).toBe(group);
  });

  it("ignores links to other sites and to the home page", () => {
    const group = document.createElement("div");
    group.innerHTML = '<a href="https://pistachioapp.com/platform/login">Login</a><a href="/">Home</a>';
    expect(currentGroup([group], "/")).toBeUndefined();
  });
});

describe("shrink on scroll", () => {
  it("marks the nav scrolled past 48px and not before", () => {
    const { nav } = mount();
    expect(nav.dataset.navScrolled).toBe("false");
    const scrollTo = (y) => Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    scrollTo(49);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
    expect(nav.dataset.navScrolled).toBe("true");
    scrollTo(0);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
    expect(nav.dataset.navScrolled).toBe("false");
  });
});

describe("desktop dropdowns", () => {
  it("opens on hover after a short delay and closes after leaving", () => {
    const { platform } = mount();
    platform.dispatchEvent(new Event("mouseenter"));
    expect(platform.dataset.open).toBe("false");
    vi.advanceTimersByTime(70);
    expect(platform.dataset.open).toBe("true");
    expect(trigger(platform).getAttribute("aria-expanded")).toBe("true");
    platform.dispatchEvent(new Event("mouseleave"));
    vi.advanceTimersByTime(120);
    expect(platform.dataset.open).toBe("false");
  });

  it("switches straight to the next group once one is open, from the side you came from", () => {
    const { platform, resources } = mount();
    const menu = document.querySelector("[data-nav-menu]");
    platform.dispatchEvent(new Event("mouseenter"));
    vi.advanceTimersByTime(70);
    expect(menu.hasAttribute("data-nav-switch")).toBe(false);
    platform.dispatchEvent(new Event("mouseleave"));
    resources.dispatchEvent(new Event("mouseenter"));
    vi.advanceTimersByTime(0);
    expect(resources.dataset.open).toBe("true");
    expect(menu.hasAttribute("data-nav-switch")).toBe(true);
    expect(menu.style.getPropertyValue("--nav-from")).toBe("-0.75rem");
    expect(platform.hasAttribute("data-nav-leaving")).toBe(true);
    resources.dispatchEvent(new Event("mouseleave"));
    vi.advanceTimersByTime(120);
    expect(menu.hasAttribute("data-nav-switch")).toBe(false);
    expect(platform.hasAttribute("data-nav-leaving")).toBe(false);
  });

  it("lets a mouse click go to the group's page", () => {
    const { platform } = mount();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    trigger(platform).dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("opens on click without a mouse, one group at a time", () => {
    media.hover = false;
    const { platform, resources } = mount();
    trigger(platform).click();
    expect(platform.dataset.open).toBe("true");
    trigger(resources).click();
    expect(platform.dataset.open).toBe("false");
    expect(resources.dataset.open).toBe("true");
  });

  it("closes on Escape and returns focus to the trigger", () => {
    media.hover = false;
    const { platform } = mount();
    trigger(platform).click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(platform.dataset.open).toBe("false");
    expect(document.activeElement).toBe(trigger(platform));
  });
});

describe("mobile menu", () => {
  beforeEach(() => {
    media = { desktop: false, hover: false };
  });

  it("opens and closes from the button, labelled for screen readers, and locks the page", () => {
    const { nav, toggle } = mount();
    toggle.click();
    expect(nav.dataset.navExpanded).toBe("true");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Close menu");
    expect(document.documentElement.classList.contains("nav-menu-open")).toBe(true);
    toggle.click();
    expect(nav.dataset.navExpanded).toBe("false");
    expect(document.documentElement.classList.contains("nav-menu-open")).toBe(false);
  });

  it("opens groups in place and closes when a real link is followed", () => {
    const { nav, platform, toggle } = mount();
    toggle.click();
    trigger(platform).click();
    expect(platform.dataset.open).toBe("true");
    platform.querySelector('[data-nav-panel] a[href="/practice"]').click();
    expect(nav.dataset.navExpanded).toBe("false");
    expect(platform.dataset.open).toBe("false");
  });

  it("moves focus into the menu once it is open", () => {
    // jsdom has no layout, so give elements the parent the visibility check looks for.
    const offsetParent = vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function () {
      return this.parentElement;
    });
    const { toggle } = mount();
    toggle.click();
    vi.advanceTimersByTime(1);
    expect(document.activeElement.closest("[data-nav-menu]")).not.toBeNull();
    offsetParent.mockRestore();
  });

  it("closes from a tap on the scrim", () => {
    const { nav, toggle } = mount();
    toggle.click();
    nav.click();
    expect(nav.dataset.navExpanded).toBe("false");
  });

  it("closes on Escape", () => {
    const { nav, toggle } = mount();
    toggle.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(nav.dataset.navExpanded).toBe("false");
  });
});
