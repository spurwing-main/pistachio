import { beforeEach, expect, it, vi } from 'vitest';
import { initAboutTeam } from './about-team.js';
let reduce;
beforeEach(() => {
 reduce = { matches: false, addEventListener: (_, fn) => { reduce.change = fn; } };
 vi.stubGlobal('matchMedia', () => reduce);
 vi.stubGlobal('ResizeObserver', class { observe() {} });
 vi.stubGlobal('IntersectionObserver', class { constructor(fn) { this.fn = fn; } observe() { this.fn([{ isIntersecting: true }]); } });
 document.body.innerHTML = `<section data-about-team><div data-about-team-row><div data-about-team-track><div><a href="/person" id="person">Person</a></div></div></div></section>`;
 Object.defineProperty(document.querySelector('[data-about-team-row]'), 'clientWidth', { value: 390 });
 document.querySelector('[data-about-team-track] > div').getBoundingClientRect = () => ({ width: 200 });
});
it('starts automatic rows once without a manual control and excludes copies from keyboard navigation', () => {
 initAboutTeam(); initAboutTeam();
 const row = document.querySelector('[data-about-team-row]');
 expect(row.style.getPropertyValue('--about-team-duration')).toBe('20s');
 expect(row.querySelectorAll('[data-about-team-clone]')).toHaveLength(2);
 expect(row.querySelector('[data-about-team-clone] a').getAttribute('tabindex')).toBe('-1');
 expect(row.querySelector('[data-about-team-clone] a').hasAttribute('id')).toBe(false);
 expect(row.hasAttribute('data-about-team-ready')).toBe(true);
});
it('responds to reduced motion without leaving copies', () => {
 initAboutTeam(); reduce.matches = true; reduce.change();
 expect(document.querySelectorAll('[data-about-team-clone]')).toHaveLength(0);
 reduce.matches = false; reduce.change();
 expect(document.querySelectorAll('[data-about-team-clone]')).toHaveLength(2);
});
it('initialises two independent component instances without a manual control', () => {
 const section = document.querySelector('section'), second = section.cloneNode(true); section.after(second);
 section.querySelector('[data-about-team-row]').id = 'original-row';
 second.querySelector('[data-about-team-row]').id = 'second-row';
 Object.defineProperty(second.querySelector('[data-about-team-row]'), 'clientWidth', { value: 390 });
 second.querySelector('[data-about-team-track] > div').getBoundingClientRect = () => ({ width: 200 });
 initAboutTeam(); const rows = [...document.querySelectorAll('[data-about-team-row]')];
 expect(rows.map(row => row.id)).toEqual(['original-row', 'second-row']);
 expect(rows.map(row => row.style.getPropertyValue('--about-team-duration'))).toEqual(['20s', '20s']);
 expect(rows.map(row => row.querySelectorAll('[data-about-team-clone]').length)).toEqual([2, 2]);
});
