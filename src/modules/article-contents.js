import { initSectionNav } from './section-nav.js';

const records = new WeakMap();

export function initArticleContents(scope = document) {
  const article = scope.matches?.('#resource-article') ? scope : scope.querySelector('#resource-article');
  if (!article || records.has(article)) return () => {};

  const view = article.ownerDocument.defaultView;
  let active = true;
  let destroyNav = () => {};
  const ready = () => {
    if (!active) return;
    destroyNav();
    if (!article.querySelector('.page-contents_rows a[href^="#"]:not([href="#"])')) return;
    // Capture before the generated links' Finsweet click listeners.
    destroyNav = initSectionNav(article, { selector: '.page-contents_rows', capture: true });
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches && view.location.hash) {
      const link = [...article.querySelectorAll('.page-contents_rows a')].find(link => link.hash === view.location.hash);
      if (link) article.ownerDocument.getElementById(decodeURIComponent(link.hash.slice(1))).scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };
  view.FinsweetAttributes ||= [];
  view.FinsweetAttributes.push(['toc', ready]);
  const destroy = () => {
    active = false;
    destroyNav();
    records.delete(article);
  };
  records.set(article, destroy);
  return destroy;
}

export default { name: 'article-contents', init: initArticleContents };
