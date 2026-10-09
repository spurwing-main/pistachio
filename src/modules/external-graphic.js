/**
 * Insert a trusted, externally hosted SVG inline so its groups can be animated.
 *
 * [data-external-graphic]       Webflow Image, or a wrapper containing one
 *                             The image stays visible until fetch/parse succeeds.
 *                             src/currentSrc and image dimensions supply the URL
 *                             and ratio. Legacy data-svg-src wrappers still work.
 *   data-graphic-media        optional viewport query, e.g. "(max-width: 767px)".
 *                             Match the image's Webflow breakpoint visibility.
 *   data-graphic-animation    optional card / item scroll reveal, using
 *                             Webflow's window.gsap and window.ScrollTrigger
 *                             Plays once at top 75%, then runs on elapsed time.
 *                             SVG data-graphic-layout="linear" selects the mobile
 *                             four-item sequence; desktop keeps its circular route.
 *
 * The ratio reserves space before loading. Without it the SVG sizes naturally.
 * On success, sets data-external-graphic-ready and emits a bubbling
 * external-graphic:loaded event. Animation is set up directly after insertion,
 * before emitting this event. This signals DOM
 * insertion, not completion of any images referenced inside the SVG.
 * Use only trusted SVGs: parsing validates XML, it does not sanitise content.
 */
import { qsa } from "../utils/dom.js";

const loads = new WeakMap();
const mediaWatches = new WeakMap();
const SVG_NS = "http://www.w3.org/2000/svg";
let maskSequence = 0;

// Seconds, kept together for visual tuning after the first published review.
const timing = {
  main: 0.6, mainHold: 0.2, connector: 0.3,
  item: 0.4, importantItem: 0.45, itemOverlap: 0.12,
  lastHold: 0.5, pulse: 0.18,
};

function createLineMasks(svg, lines) {
  const defs = document.createElementNS(SVG_NS, "defs");
  const bounds = (svg.getAttribute("viewBox") || "0 0 1125 818").trim().split(/[\s,]+/).map(Number);
  const previousMasks = lines.map((line) => line.getAttribute("mask"));
  const paths = lines.map((line) => {
    const mask = document.createElementNS(SVG_NS, "mask");
    mask.id = `graphic-reveal-${++maskSequence}`;
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("maskContentUnits", "userSpaceOnUse");
    mask.setAttribute("x", bounds[0] - 8);
    mask.setAttribute("y", bounds[1] - 8);
    mask.setAttribute("width", bounds[2] + 16);
    mask.setAttribute("height", bounds[3] + 16);
    const path = document.createElementNS(SVG_NS, "path");
    const attributes = {
      d: line.getAttribute("d"), fill: "none", stroke: "white",
      "stroke-width": Number(line.getAttribute("stroke-width")) + 4,
      "stroke-linecap": "butt", pathLength: 1, "stroke-dasharray": "1 1",
    };
    Object.entries(attributes).forEach(([name, value]) => path.setAttribute(name, value));
    mask.append(path);
    defs.append(mask);
    line.setAttribute("mask", `url(#${mask.id})`);
    return path;
  });
  svg.append(defs);
  return {
    paths,
    cleanup() {
      lines.forEach((line, index) => {
        if (previousMasks[index] === null) line.removeAttribute("mask");
        else line.setAttribute("mask", previousMasks[index]);
      });
      defs.remove();
    },
  };
}

function report(root, message, details = {}, level = "log") {
  const image = root.matches("img") ? root : root.querySelector("img");
  console[level](`[external-graphic] ${message}`, {
    element: root,
    source: image ? imageSource(image) : root.dataset.svgSrc,
    ...details,
  });
}

function setupAnimation(root, svg, { fromBreakpoint = false, wasVisible = false } = {}) {
  if (!root.hasAttribute("data-graphic-animation")) {
    report(root, "Animation skipped: missing data-graphic-animation.", {}, "warn");
    return;
  }
  const card = svg.querySelector('[id="main"]');
  const linear = svg.dataset.graphicLayout === "linear";
  const items = Array.from({ length: linear ? 4 : 11 }, (_, index) =>
    svg.querySelector(`[id="item ${String(index + 1).padStart(2, "0")}"]`));
  const lineNames = [
    "outgoing",
    ...Array.from({ length: items.length - 1 }, (_, index) => `${String(index + 1).padStart(2, "0")}-${String(index + 2).padStart(2, "0")}`),
    ...(!linear ? ["return"] : []),
  ];
  const lines = lineNames.map((name) => svg.querySelector(`[data-graphic-line="${name}"]`));
  // Leave other/incomplete or outdated SVGs visible and explain the missing targets.
  const missing = [
    ...(!card ? ["main"] : []),
    ...items.flatMap((item, index) => item ? [] : [`item ${String(index + 1).padStart(2, "0")}`]),
    ...lines.flatMap((line, index) => line ? [] : [`data-graphic-line="${lineNames[index]}"`]),
  ];
  if (missing.length) {
    report(root, "Animation skipped: required SVG groups were not found.", {
      missing,
      availableGroupIds: Array.from(svg.querySelectorAll("g[id]"), (group) => group.id),
    }, "warn");
    return;
  }
  report(root, "Animation targets found.", { layout: linear ? "linear mobile" : "circular desktop", card: card.id, items: items.map((item) => item.id) });

  let started = false;
  function start() {
    if (started) {
      report(root, "Animation setup skipped: already started.");
      return;
    }
    if (!root.isConnected || (root !== svg && !root.contains(svg))) {
      report(root, "Animation skipped: wrapper detached or SVG replaced.", {
        connected: root.isConnected, svgStillInWrapper: svg.parentElement === root,
      }, "warn");
      return;
    }
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    report(root, "Checking Webflow animation globals.", {
      gsapAvailable: Boolean(gsap), gsapVersion: gsap?.version,
      scrollTriggerAvailable: Boolean(ScrollTrigger), scrollTriggerVersion: ScrollTrigger?.version,
    });
    if (!gsap || !ScrollTrigger) {
      report(root, "Animation waiting: GSAP or ScrollTrigger is unavailable.", {}, "warn");
      return;
    }
    started = true;

    let media;
    let cleanupLines = () => {};
    try {
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia();
      let motionEnabled = false;
      report(root, "Checking motion preference.", {
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      });
      const viewportQuery = root.dataset.graphicMedia?.trim();
      const motionQuery = `(prefers-reduced-motion: no-preference)${viewportQuery ? ` and ${viewportQuery}` : ""}`;
      let registeringContext = true;
      media.add(motionQuery, () => {
        motionEnabled = true;
        // A breakpoint change may reveal a previously loaded static SVG. Avoid
        // making visible content disappear to replay its entrance.
        if ((fromBreakpoint || !registeringContext) && (isVisible(svg) || (registeringContext && wasVisible))) {
          report(root, "Animation skipped: visible graphic stays static after a breakpoint or motion-preference change.");
          return;
        }
        report(root, "Motion allowed: applying initial states and creating timeline.");
        const masks = createLineMasks(svg, lines);
        cleanupLines = masks.cleanup;
        gsap.set(card, { autoAlpha: 0, scale: 0.97, transformOrigin: "50% 50%" });
        gsap.set(items, { autoAlpha: 0, scale: 0.94, transformOrigin: "50% 50%" });
        gsap.set(masks.paths, { attr: { "stroke-dashoffset": 1 } });
        let lastProgressStep = -1;
        const timeline = gsap.timeline({
          defaults: { ease: "power2.out" },
          onStart: () => report(root, "Timed animation started."),
          onComplete: () => report(root, "Timed animation completed."),
          onUpdate: function () {
            const progress = this.progress();
            const step = Math.floor(progress * 4);
            if (step === lastProgressStep) return;
            lastProgressStep = step;
            report(root, "Animation progress changed.", { percent: Math.round(progress * 100) });
          },
          scrollTrigger: {
            trigger: root,
            start: "top 75%",
            once: true,
            toggleActions: "play none none none",
            onRefresh: (trigger) => report(root, "ScrollTrigger measurements refreshed.", {
              start: trigger.start, end: trigger.end, progress: trigger.progress,
            }),
            onToggle: (trigger) => report(root, "ScrollTrigger active state changed.", {
              active: trigger.isActive, direction: trigger.direction, progress: trigger.progress,
            }),
          },
        });
        const outgoingAt = timing.main + timing.mainHold;
        const firstAt = outgoingAt + timing.connector;
        const draw = (duration) => ({ attr: { "stroke-dashoffset": 0 }, duration, ease: "none" });
        timeline
          .to(card, { autoAlpha: 1, scale: 1, duration: timing.main }, 0)
          .to(masks.paths[0], draw(timing.connector), outgoingAt)
          .to(items[0], { autoAlpha: 1, scale: 1, duration: timing.importantItem }, firstAt);

        // Only visible connectors consume timeline time. Item size no longer
        // creates a delay while a single arc travels behind its background.
        let nextConnectorAt = firstAt + timing.importantItem;
        let lastItemEnd = nextConnectorAt;
        const steps = [];
        items.slice(1).forEach((item, index) => {
          const itemAt = nextConnectorAt + timing.connector;
          const duration = index === items.length - 2 ? timing.importantItem : timing.item;
          timeline
            .to(masks.paths[index + 1], draw(timing.connector), nextConnectorAt)
            .to(item, { autoAlpha: 1, scale: 1, duration }, itemAt);
          steps.push({ connector: lineNames[index + 1], connectorAt: nextConnectorAt, itemAt });
          lastItemEnd = itemAt + duration;
          nextConnectorAt = lastItemEnd - timing.itemOverlap;
        });
        const returnAt = linear ? null : lastItemEnd + timing.lastHold;
        if (!linear) {
          timeline
            .to(masks.paths.at(-1), draw(timing.connector), returnAt)
            .to(card, { scale: 1.025, duration: timing.pulse, repeat: 1, yoyo: true, ease: "power1.inOut" }, returnAt + timing.connector);
        }
        report(root, "Connector choreography prepared.", {
          outgoingAt, firstAt, returnAt, steps,
        });
        ScrollTrigger.refresh();
        const bounds = root.getBoundingClientRect();
        const style = getComputedStyle(root);
        report(root, "Animation timeline ready.", {
          duration: timeline.duration?.(),
          start: timeline.scrollTrigger?.start, end: timeline.scrollTrigger?.end,
          progress: timeline.scrollTrigger?.progress,
          scrollY: window.scrollY, viewportHeight: window.innerHeight,
          bounds: { top: bounds.top, width: bounds.width, height: bounds.height },
          display: style.display, visibility: style.visibility, opacity: style.opacity,
        });
        if (!bounds.width || !bounds.height) {
          report(root, "Wrapper has zero width or height; check its layout or hidden ancestors.", {}, "warn");
        }
        return () => {
          cleanupLines();
          report(root, "Motion context reverted (media preference changed).");
        };
      }, root);
      registeringContext = false;
      if (!motionEnabled) {
        report(root, "Animation inactive: viewport or motion-preference query did not match; graphic stays static.", { motionQuery });
      }
    } catch (error) {
      // Animation failure must not turn a successful SVG load into a retry.
      media?.revert();
      cleanupLines();
      report(root, "Animation setup failed.", { error }, "error");
    }
  }

  start();
  // If Webflow is still booting, retry only this successfully inserted graphic.
  if (!started) {
    report(root, "Queueing animation retry for Webflow ready.");
    (window.Webflow = window.Webflow || []).push(() => {
      report(root, "Webflow ready callback: retrying animation setup.");
      start();
    });
  }
}

function getAspectRatio(root) {
  const value = root.dataset.svgAspectRatio?.trim() || "";
  if (!/^\d*\.?\d+\s*(?:\/\s*\d*\.?\d+)?$/.test(value)) return "";
  return value.split("/").every((part) => Number.isFinite(Number(part)) && Number(part) > 0)
    ? value
    : "";
}

function imageSource(image) {
  return image.currentSrc || image.getAttribute("src")?.trim() || "";
}

function isVisible(element) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
}

function prepareImageReplacement(image, graphic) {
  const viewBox = graphic.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const candidates = [
    [image.naturalWidth, image.naturalHeight],
    [Number(image.getAttribute("width")), Number(image.getAttribute("height"))],
    viewBox?.slice(2),
    [Number(graphic.getAttribute("width")), Number(graphic.getAttribute("height"))],
  ];
  const dimensions = candidates.find((pair) => pair?.length === 2 && pair.every((n) => Number.isFinite(n) && n > 0));
  // Keep classes, authored inline sizing, ID, Webflow attributes and ARIA hooks.
  const imageOnly = new Set(["src", "srcset", "sizes", "alt", "loading", "decoding", "fetchpriority", "crossorigin", "referrerpolicy"]);
  for (const attribute of image.attributes) {
    if (!imageOnly.has(attribute.name)) graphic.setAttribute(attribute.name, attribute.value);
  }
  if (dimensions) graphic.style.aspectRatio = dimensions.join(" / ");
  graphic.setAttribute("focusable", "false");
  if (image.getAttribute("alt") === "" && !image.hasAttribute("aria-label") && !image.hasAttribute("aria-labelledby")) {
    graphic.setAttribute("aria-hidden", "true");
    graphic.setAttribute("role", "presentation");
  } else {
    graphic.setAttribute("role", image.getAttribute("role") || "img");
    if (image.alt && !image.hasAttribute("aria-label") && !image.hasAttribute("aria-labelledby")) {
      graphic.setAttribute("aria-label", image.alt);
    }
  }
  // Webflow's default img rules no longer match after replacement. Zero-specificity
  // defaults provide responsive SVG sizing while preserving authored class rules.
  if (!document.querySelector("style[data-external-graphic-styles]")) {
    const style = document.createElement("style");
    style.setAttribute("data-external-graphic-styles", "");
    style.textContent = ":where(svg[data-external-graphic-ready]) { max-width: 100%; height: auto; display: inline-block; vertical-align: middle; }";
    document.head.append(style);
  }
}

function setupGraphic(root, { fromBreakpoint = false } = {}) {
  if (loads.has(root)) {
    report(root, "Load skipped: already loading or loaded.");
    return loads.get(root);
  }

  const image = root.matches("img") ? root : root.querySelector("img");
  if (image && loads.has(image)) return loads.get(image);
  const ratio = image ? "" : getAspectRatio(root);
  if (ratio) root.style.aspectRatio = ratio;

  const source = image ? imageSource(image) : root.dataset.svgSrc?.trim();
  const originalImageSrc = image?.getAttribute("src");
  report(root, "Wrapper found.", {
    animationEnabled: root.hasAttribute("data-graphic-animation"),
    source, imageFallback: Boolean(image),
    requestedAspectRatio: root.dataset.svgAspectRatio, appliedAspectRatio: image ? "automatic from image/SVG" : ratio || "natural",
  });
  if (!source) {
    report(root, "Load skipped: no image source or legacy data-svg-src.", {}, "warn");
    return;
  }

  const load = (async () => {
    report(root, "Fetching SVG.");
    const response = await fetch(source);
    report(root, "SVG response received.", { status: response.status, ok: response.ok });
    if (!response.ok) throw new Error(`SVG request failed: ${response.status}`);

    const markup = await response.text();
    report(root, "Parsing SVG.", { characters: markup.length });
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    const svg = parsed.documentElement;
    if (parsed.querySelector("parsererror") || svg.localName !== "svg" ||
      svg.namespaceURI !== "http://www.w3.org/2000/svg") {
      throw new Error("The fetched file is not valid SVG.");
    }

    const graphic = document.importNode(svg, true);
    let target = root;
    let wasVisible = false;
    if (image) {
      if (!image.isConnected || image.getAttribute("src") !== originalImageSrc || imageSource(image) !== source) {
        loads.delete(root);
        loads.delete(image);
        report(root, "Conversion cancelled: image was removed or its source changed.");
        return;
      }
      prepareImageReplacement(image, graphic);
      wasVisible = isVisible(image);
      graphic.dataset.externalGraphicReady = "true";
      image.replaceWith(graphic);
      if (root === image) target = graphic;
      loads.set(graphic, load);
    } else {
      graphic.style.display = "block";
      graphic.style.width = "100%";
      graphic.style.height = ratio ? "100%" : "auto";
      root.replaceChildren(graphic);
    }
    target.dataset.externalGraphicReady = "true";
    target.dataset.svgSrc = source;
    report(target, "SVG inserted; checking animation setup.", { viewBox: graphic.getAttribute("viewBox"), aspectRatio: graphic.style.aspectRatio });
    setupAnimation(target, graphic, { fromBreakpoint, wasVisible });
    target.dispatchEvent(new CustomEvent("external-graphic:loaded", { bubbles: true }));
  })().catch((error) => {
    // Keep any fallback content and permit an explicit init call to retry.
    loads.delete(root);
    if (image) loads.delete(image);
    report(root, "SVG load failed; a later init call can retry.", { error }, "error");
  });

  loads.set(root, load);
  if (image) loads.set(image, load);
  return load;
}

export function initExternalGraphic(root = document) {
  const wrappers = qsa(root, "[data-external-graphic]");
  if (root.matches?.("[data-external-graphic]")) wrappers.unshift(root);
  console.log("[external-graphic] Module initialising.", { wrappers: wrappers.length, scope: root });
  return Promise.all(wrappers.map(setupResponsiveGraphic));
}

function setupResponsiveGraphic(root) {
  const query = root.dataset.graphicMedia?.trim();
  if (!query) return setupGraphic(root);
  const media = window.matchMedia(query);
  if (media.matches) {
    const fromBreakpoint = mediaWatches.has(root);
    mediaWatches.get(root)?.();
    return setupGraphic(root, { fromBreakpoint });
  }
  // An already converted SVG's GSAP media context manages its resize lifecycle.
  if (loads.has(root) || mediaWatches.has(root)) return;
  report(root, "Inline loading deferred until viewport matches.", { query });
  const stop = () => {
    media.removeEventListener("change", onChange);
    mediaWatches.delete(root);
  };
  const onChange = () => {
    if (!root.isConnected) { stop(); return; }
    if (!media.matches) return;
    stop();
    setupGraphic(root, { fromBreakpoint: true });
  };
  mediaWatches.set(root, stop);
  media.addEventListener("change", onChange);
}

export default { name: "externalGraphic", init: initExternalGraphic };
