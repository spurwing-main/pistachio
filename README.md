# Pistachio site code

Webflow owns page structure, editable content and ordinary styles. This repo
holds JavaScript, readable custom CSS and the generated bundle.

```text
src/              module source and tests
styles/           custom CSS source
loader.js         pinned source selection and development panel
dist/bundle.js    generated production bundle
dev.mjs           local bundle server
tag.mjs           commit-pinned script tag
```

## Current JavaScript release

20 October 2026: added the Legal revisions module and matching generated bundle.
All 222 tests across 16 files pass. It supports sibling document/history CMS
lists, revision/date/body switching, dotted revision URLs and browser history.
The native CMS setup and page acceptance checks remain in the private Legal
page records. This source release alone does not publish Webflow.

### Previous release

The JavaScript source, tests and matching bundle were committed and pushed as
3379ecc1e2a109a3ed31025f1c4a57e99bdc8b58 on 19 October 2026. This includes
Article Device Share/LinkedIn and footnote focus, hidden-menu focus handling,
and About Team’s automatic rows without a manual control. All 212 tests across
15 files passed and the bundle built before the push. The commit-pinned CDN
loader and bundle returned 200 and matched the local files byte for byte.

The saved Webflow loader was changed from 57dce345 to 3379ecc and read back after
a settings reload. A separate staging publication was observed during that work;
the staging HTML now references 3379ecc. No Publish action was run as part of
this release. Runtime/page acceptance remains separate from source/CDN proof.

Custom CSS, schema and other local changes were not included in this commit.

Ordinary layout, type and supported Current/focus styles stay native; necessary scoped state/relationship exceptions keep their existing CSS owner. The dated saved-source comparison is recorded in [styles/README.md](styles/README.md), including Article relationships, Legal table containment, Pricing visibility across slots/markers and Stories filter states. Pricing Current colours are native. Page plans, QA and client decisions stay in sibling private/.

Commit/push, loader selection and Webflow publication need separate approval. After release, check the actual bundle, global CSS and affected controls. Local tests and saved page checks do not prove published delivery.

## Work locally

Run npm install, then npm run dev. Copy the site’s real module hooks and preserve
existing classes, variables and startup order. Register modules in
src/modules/index.js. Returned startup promises settle before the module-ready
marker; one module fault does not stop other modules starting.

Production ignores development overrides and uses the tag’s revision or its
configured default. URL ?commit= values never select code on any host. Release
with a commit-pinned tag. Local is selected deliberately with ?env=local, the
panel/session choice or trusted default on a development host. Auto and Live use
the CDN without probing the visitor’s local network. A tunnel
must be configured through loader.js DEFAULTS.localBase or data-local-base on
the trusted loader tag; URL parameters cannot select an arbitrary outside host.
The panel reports the selected source, including fallback to the CDN.

## JavaScript owners

`src/index.js` starts the site. `src/boot.js` starts registered modules concurrently and reports failures without hiding the page. `src/modules/index.js` owns registration; it is not a sequence of dependent startup steps. Each feature stays in its own module, with its tests beside it. Shared DOM helpers stay in `src/utils/`.

| Module | Owns |
|---|---|
| Nav | Header scroll state, dropdowns, mobile menu and focus |
| Marquee | Repeated logo/testimonial rows and their motion state |
| About Team | About’s measured moving team rows |
| Rotate | Demo quote timing and progress |
| Video | Video dialog and playback journey |
| Reveal | Opted-in entrance motion |
| External graphic | Trusted SVG loading and its animation setup |
| Stat progress | Independent decorative progress bars |
| Risk stack | Stack eligibility, scaling and keyboard opt-out |
| Section navigation | Opted-in section links and current location |
| Article contents | Article contents and footnote reference/return behaviour, using section navigation |
| Legal revisions | Opted-in CMS revision selector, body/date switching and revision URL history |
| Accordions | Shared FAQ open/close and question interactions |

CSS owns appearance and transitions; modules own the required state and interactions. Keep page-specific code out of another feature’s module. Existing native Webflow/Finsweet features retain their own behaviour; do not add a second handler for them.

## Check and release

Run npm test and npm run build. Commit source and its matching generated bundle;
never edit dist/bundle.js by hand. npm run tag prints the loader tag pinned to
the current commit. The trusted loader tag must run once in the site-wide head,
without async/defer, before content it gates can paint. An existing tag move needs
approval; these code changes do not move it. Publish only to the agreed destination. A Git push does not update Webflow.

The loader’s timeout keeps content visible if startup stalls or fails. A ready
class is not proof all modules succeeded; check the page and its controls.
Compare custom CSS with the actual saved code before an approved change, then
check the served version. Keep planning in sibling private/ and raw work in sibling local/, outside
both Git repos.
