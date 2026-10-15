import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initSectionNav } from './section-nav.js';

let cleanup;
let tops;
let scroll;
beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/faq');
  document.body.innerHTML = `<nav data-section-nav><a href="#onboarding">Onboarding</a><a href="#partners">Partners</a><a href="#pricing">Pricing</a></nav><a id="other-link" href="#pricing">Other link</a><section id="onboarding" style="scroll-margin-top:112px"></section><section id="partners" style="scroll-margin-top:112px"></section><section id="pricing" style="scroll-margin-top:112px"></section>`;
  tops = { onboarding: 100, partners: 220, pricing: 260 };
  document.querySelectorAll('section').forEach(target => {
    target.getBoundingClientRect = () => ({ top: tops[target.id], height: 20 });
    target.scrollIntoView = vi.fn();
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => window.setTimeout(fn, 0));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  cleanup = initSectionNav();
  scroll = () => { window.dispatchEvent(new Event('scroll')); vi.runAllTimers(); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const current = () => document.querySelector('[aria-current="location"]')?.textContent;

it('keeps a short or empty group current until the next group reaches the header offset', () => {
  expect(current()).toBe('Onboarding');
  tops = { onboarding: -300, partners: 70, pricing: 160 }; scroll();
  expect(current()).toBe('Partners');
  tops.pricing = 112; scroll(); expect(current()).toBe('Pricing');
});
it('clicks use the native target, offset-aware scrolling and the real fragment', () => {
  document.querySelector('a[href="#pricing"]').click();
  expect(current()).toBe('Pricing');
  expect(window.location.hash).toBe('#pricing');
  expect(document.querySelector('#pricing').scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
});
it('uses instant scrolling when reduced motion is requested', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  document.querySelector('a[href="#pricing"]').click();
  expect(document.querySelector('#pricing').scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
});
it('leaves modified clicks and links outside the opted-in nav untouched', () => {
  document.querySelector('a[href="#pricing"]').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
  document.querySelector('#other-link').click();
  expect(current()).toBe('Onboarding');
  expect(document.querySelector('#pricing').scrollIntoView).not.toHaveBeenCalled();
});
it('does not attach duplicate handlers and restores attributes on cleanup', () => {
  const second = initSectionNav();
  document.querySelector('a[href="#pricing"]').click();
  expect(document.querySelector('#pricing').scrollIntoView).toHaveBeenCalledTimes(1);
  second(); cleanup();
  expect(document.querySelector('[aria-current]')).toBeNull();
  tops.pricing = 0; scroll(); expect(document.querySelector('[aria-current]')).toBeNull();
  cleanup = initSectionNav(); expect(current()).toBe('Pricing');
});
