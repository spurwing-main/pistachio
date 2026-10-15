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
