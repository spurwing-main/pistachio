import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initArticleContents } from './article-contents.js';

let cleanup;
beforeEach(() => {
  window.history.replaceState({}, '', '/blog/article');
  window.FinsweetAttributes = [];
  document.body.innerHTML = `<main id="resource-article"><nav class="page-contents_rows"><a href="#short">Short</a><a href="#next">Next</a></nav><div id="short" style="scroll-margin-top:112px"></div><div id="next" style="scroll-margin-top:112px"></div></main>`;
  document.querySelector('#short').getBoundingClientRect = () => ({ top: 112 });
  document.querySelector('#next').getBoundingClientRect = () => ({ top: 200 });
  document.querySelectorAll('#short,#next').forEach(e => { e.scrollIntoView = vi.fn(); });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  cleanup = initArticleContents();
});
afterEach(() => { cleanup(); delete window.FinsweetAttributes; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('waits for generated links then owns click before the library handler', () => {
  const libraryClick = vi.fn(event => event.stopPropagation());
  const link = document.querySelector('a');
  link.addEventListener('click', libraryClick);
  expect(link.hasAttribute('aria-current')).toBe(false);
  window.FinsweetAttributes[0][1]();
  link.click();
  expect(libraryClick).not.toHaveBeenCalled();
  expect(link.getAttribute('aria-current')).toBe('location');
  expect(document.querySelector('#short').scrollIntoView).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe('#short');
});
it('does not duplicate setup and cleanup removes the capture listener', () => {
  const second = initArticleContents();
  expect(window.FinsweetAttributes).toHaveLength(1);
  window.FinsweetAttributes[0][1]();
  window.FinsweetAttributes[0][1]();
  document.querySelector('a').click();
  expect(document.querySelector('#short').scrollIntoView).toHaveBeenCalledTimes(1);
  second(); cleanup();
  expect(document.querySelector('[aria-current]')).toBeNull();
  document.querySelector('a').click();
  expect(document.querySelector('#short').scrollIntoView).toHaveBeenCalledTimes(1);
});
it('cancels the library initial hash scroll when reduced motion is selected', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  window.history.replaceState({}, '', '#next');
  window.FinsweetAttributes[0][1]();
  expect(document.querySelector('#next').scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
});
it('leaves an empty contents template alone and cancels a pending callback on cleanup', () => {
  document.querySelector('.page-contents_rows').innerHTML = '<a href="#">Read more</a>';
  window.FinsweetAttributes[0][1]();
  expect(document.querySelector('[aria-current]')).toBeNull();
  cleanup();
  document.querySelector('.page-contents_rows').innerHTML = '<a href="#short">Short</a>';
  window.FinsweetAttributes[0][1]();
  expect(document.querySelector('[aria-current]')).toBeNull();
});

function addFootnotes() {
  document.querySelector('#resource-article').insertAdjacentHTML('beforeend', `<div class="is-article"><sup class="footnote-ref" id="fnref-1"><a href="#fn-1">1</a></sup><div class="footnotes"><ol><li id="fn-1"><a class="footnote" href="#fnref-1">↩</a></li></ol></div></div>`);
  document.querySelectorAll('#fn-1,#fnref-1').forEach(target => { target.scrollIntoView = vi.fn(); });
}

it('owns real footnote and return jumps before Webflow while preserving history and target focus', () => {
  addFootnotes();
  const webflowScroll = vi.fn();
  document.addEventListener('click', webflowScroll);
  try {
    document.querySelector('.footnote-ref a').click();
    expect(window.location.hash).toBe('#fn-1');
    expect(document.querySelector('#fn-1').scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(document.activeElement.id).toBe('fn-1');
    expect(document.querySelector('#fn-1').getAttribute('tabindex')).toBe('-1');
    document.querySelector('.footnotes a').click();
    expect(window.location.hash).toBe('#fnref-1');
    expect(document.querySelector('#fnref-1').scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(webflowScroll).not.toHaveBeenCalled();
    cleanup();
    expect(document.querySelector('#fn-1').hasAttribute('tabindex')).toBe(false);
  } finally { document.removeEventListener('click', webflowScroll); }
});

it('uses instant footnote scrolling for reduced motion and preserves existing tabindex', () => {
  addFootnotes();
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  document.querySelector('#fn-1').setAttribute('tabindex', '0');
  document.querySelector('.footnote-ref a').click();
  expect(document.querySelector('#fn-1').scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  expect(document.querySelector('#fn-1').getAttribute('tabindex')).toBe('0');
});

it('leaves modified, unrelated and missing-target links native and removes footnote handling on cleanup', () => {
  addFootnotes();
  const link = document.querySelector('.footnote-ref a');
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...options });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  link.href = '#fn-missing';
  const missing = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(missing);
  expect(missing.defaultPrevented).toBe(false);
  link.href = '#short';
  const unrelated = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(unrelated);
  expect(unrelated.defaultPrevented).toBe(false);
  link.href = '#fn-1';
  cleanup();
  const afterCleanup = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(afterCleanup);
  expect(afterCleanup.defaultPrevented).toBe(false);
  expect(document.querySelector('#fn-1').scrollIntoView).not.toHaveBeenCalled();
});

it('offers the approved LinkedIn route even without device sharing', () => {
  cleanup();
  document.querySelector('#resource-article').insertAdjacentHTML('beforeend', '<div class="article-share"><a aria-label="Share article" href="#">Share</a></div>');
  cleanup = initArticleContents();
  const link = document.querySelector('.article-share a');
  expect(new URL(link.href).searchParams.get('url')).toBe('https://example.webflow.io/blog/article');
  expect(link.target).toBe('_blank');
  expect(link.rel).toBe('noopener noreferrer');
});

it('uses device sharing and does not open LinkedIn when the user cancels', async () => {
  cleanup();
  document.querySelector('#resource-article').insertAdjacentHTML('beforeend', '<div class="article-share"><a aria-label="Share article" href="#">Share</a></div>');
  const share = vi.fn().mockRejectedValue(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: share });
  const open = vi.spyOn(window, 'open').mockImplementation(() => {});
  cleanup = initArticleContents();
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  document.querySelector('.article-share a').dispatchEvent(event);
  await Promise.resolve();
  expect(event.defaultPrevented).toBe(true);
  expect(share).toHaveBeenCalledWith({ title: document.title, url: 'https://example.webflow.io/blog/article' });
  expect(open).not.toHaveBeenCalled();
  delete window.navigator.share;
});

it('uses the canonical article URL for both share routes', async () => {
  cleanup();
  document.head.insertAdjacentHTML('beforeend', '<link rel="canonical" href="https://pistachioapp.com/blog/article">');
  document.querySelector('#resource-article').insertAdjacentHTML('beforeend', '<div class="article-share"><a aria-label="Share article" href="#">Share</a></div>');
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
  const open = vi.spyOn(window, 'open').mockImplementation(() => {});
  cleanup = initArticleContents();
  document.querySelector('.article-share a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  expect(window.navigator.share).toHaveBeenCalledWith({ title: document.title, url: 'https://pistachioapp.com/blog/article' });
  expect(new URL(document.querySelector('.article-share a').href).searchParams.get('url')).toBe('https://pistachioapp.com/blog/article');
  expect(open).not.toHaveBeenCalled();
  document.querySelector('link[rel="canonical"]').remove();
  delete window.navigator.share;
});
