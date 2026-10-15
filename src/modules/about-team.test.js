import { beforeEach, expect, it, vi } from 'vitest';
import { initAboutTeam } from './about-team.js';
let reduce;
beforeEach(() => {
 reduce = { matches: false, addEventListener: (_, fn) => { reduce.change = fn; } };
 vi.stubGlobal('matchMedia', () => reduce);
 vi.stubGlobal('ResizeObserver', class { observe() {} });
 vi.stubGlobal('IntersectionObserver', class { constructor(fn) { this.fn = fn; } observe() { this.fn([{ isIntersecting: true }]); } });
 document.body.innerHTML = `<section data-about-team><div data-about-team-row><div data-about-team-track><div><a href="/person" id="person">Person</a></div></div></div><a href="#" data-about-team-pause data-about-team-play-text="Play" data-about-team-pause-text="Pause"><span data-about-team-pause-label>Pause</span></a></section>`;
 Object.defineProperty(document.querySelector('[data-about-team-row]'), 'clientWidth', { value: 390 });
 document.querySelector('[data-about-team-track] > div').getBoundingClientRect = () => ({ width: 200 });
});
it('starts once, copies accessible cards, and pauses once per activation', () => {
 initAboutTeam(); initAboutTeam();
 const row = document.querySelector('[data-about-team-row]');
 expect(row.style.getPropertyValue('--about-team-duration')).toBe('20s');
 expect(row.querySelectorAll('[data-about-team-clone]')).toHaveLength(2);
 expect(row.querySelector('[data-about-team-clone] a').getAttribute('tabindex')).toBe('-1');
 expect(row.querySelector('[data-about-team-clone] a').hasAttribute('id')).toBe(false);
 const pause = document.querySelector('[data-about-team-pause]');
 pause.click(); expect(row.dataset.aboutTeamPaused).toBe('true'); expect(pause.textContent).toBe('Play');
 pause.click(); expect(row.dataset.aboutTeamPaused).toBe('false');
});
it('responds to reduced motion without leaving copies', () => {
 initAboutTeam(); reduce.matches = true; reduce.change();
 expect(document.querySelectorAll('[data-about-team-clone]')).toHaveLength(0);
 reduce.matches = false; reduce.change();
 expect(document.querySelectorAll('[data-about-team-clone]')).toHaveLength(2);
});
it('keeps two component controls connected to different rows', () => {
 const section = document.querySelector('section'), second = section.cloneNode(true); section.after(second);
 Object.defineProperty(second.querySelector('[data-about-team-row]'), 'clientWidth', { value: 390 });
 second.querySelector('[data-about-team-track] > div').getBoundingClientRect = () => ({ width: 200 });
 initAboutTeam(); const rows = [...document.querySelectorAll('[data-about-team-row]')];
 expect(rows[0].id).not.toBe(rows[1].id);
 second.querySelector('[data-about-team-pause]').click();
 expect(rows[0].dataset.aboutTeamPaused).toBeUndefined(); expect(rows[1].dataset.aboutTeamPaused).toBe('true');
});
