import { initSectionNav } from "./section-nav.js";

const records = new WeakMap();

export function initArticleContents(scope = document) {
  const article = scope.matches?.("#resource-article")
    ? scope
    : scope.querySelector("#resource-article");
  if (!article || records.has(article)) return () => {};

  const view = article.ownerDocument.defaultView;
  let active = true;
  const share = article.querySelector('.article-share a[aria-label="Share article"]');
  const canonical = article.ownerDocument.querySelector('link[rel="canonical"]')?.href;
  const shareUrl = new URL(canonical || view.location.href);
  shareUrl.hash = "";
  const fallback = new URL("https://www.linkedin.com/sharing/share-offsite/");
  fallback.searchParams.set("url", shareUrl.href);
  if (share) {
    share.href = fallback.href;
    share.target = "_blank";
    share.rel = "noopener noreferrer";
  }
  let sharing = false;
  const onShare = async (event) => {
    if (
      !view.navigator.share ||
      event.button > 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (sharing) return;
    sharing = true;
    try {
      await view.navigator.share({ title: article.ownerDocument.title, url: shareUrl.href });
    } catch (error) {
      // Cancelling the device sheet is a completed user choice. Other failures
      // retain the approved LinkedIn route; never claim a share was sent.
      if (error?.name !== "AbortError") view.location.assign(fallback.href);
    } finally {
      sharing = false;
    }
  };
  share?.addEventListener("click", onShare);
  const footnoteFocusTargets = new Set();
  const onFootnote = (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const link = event.target.closest(
      '.footnote-ref a[href^="#fn-"], .footnotes a.footnote[href^="#fnref-"]',
    );
    if (!link || !article.contains(link)) return;
    const target = article.ownerDocument.getElementById(link.hash.slice(1));
    if (
      !target?.matches(".is-article .footnotes li[id], .is-article sup.footnote-ref[id]") ||
      !article.contains(target)
    )
      return;
    event.preventDefault();
    // Webflow's document handler ignores the target's navigation scroll margin.
    event.stopPropagation();
    if (view.location.hash !== link.hash) view.history.pushState(null, "", link.hash);
    target.scrollIntoView({
      block: "start",
      behavior: view.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
      footnoteFocusTargets.add(target);
    }
    target.focus({ preventScroll: true });
  };
  article.addEventListener("click", onFootnote);
  let destroyNav = () => {};
  const ready = () => {
    if (!active) return;
    destroyNav();
    if (!article.querySelector('.page-contents_rows a[href^="#"]:not([href="#"])')) return;
    // Capture before the generated links' Finsweet click listeners.
    destroyNav = initSectionNav(article, { selector: ".page-contents_rows", capture: true });
    if (view.matchMedia("(prefers-reduced-motion: reduce)").matches && view.location.hash) {
      const link = [...article.querySelectorAll(".page-contents_rows a")].find(
        (link) => link.hash === view.location.hash,
      );
      if (link)
        article.ownerDocument
          .getElementById(decodeURIComponent(link.hash.slice(1)))
          .scrollIntoView({ block: "start", behavior: "instant" });
    }
  };
  view.FinsweetAttributes ||= [];
  view.FinsweetAttributes.push(["toc", ready]);
  const destroy = () => {
    active = false;
    destroyNav();
    share?.removeEventListener("click", onShare);
    article.removeEventListener("click", onFootnote);
    footnoteFocusTargets.forEach((target) => target.removeAttribute("tabindex"));
    records.delete(article);
  };
  records.set(article, destroy);
  return destroy;
}

export default { name: "article-contents", init: initArticleContents };
