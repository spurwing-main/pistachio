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

## Current JavaScript source and observed delivery

The released source is `8b905cf24cf09a26c6dd960478387bc5a5cec277`, pushed on
21 October 2026. It includes About row-copy stability, Footer keyboard access and
same-page Resource filters, SAT source changes, and Legal TOC reuse. The release
check passed 248 tests across 19 files and the bundle build. Its CDN loader and
bundle matched the released files.

The existing pinned Finsweet setup still loads List and TOC globally. Selective
loading was withdrawn. CSS files remain separate saved-Embed mirrors; committing
them does not load or publish them.

The build lead will update the existing Webflow loader to the pinned URL below,
keeping its existing attributes. That saved change has not been read back:

```text
https://cdn.jsdelivr.net/gh/spurwing-main/pistachio@8b905cf24cf09a26c6dd960478387bc5a5cec277/loader.js
```

No Webflow publication follows from this source release. The dated Legal audit
observed a06fee3 on staging; the earlier 19 October loader selection used 3379ecc.
Neither establishes delivery of the latest source. Current published checks,
loader review proposals and page acceptance stay in the private verification
record. Preserve the current loader source until its separate review is approved.

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
| Footer | Reveal pinned footer on focus entry; normal-flow fallback for short viewports, with module-owned keyboard override styles |
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
| Legal revisions | Opted-in CMS revision selector, targeted body/date switching and revision URL history |
| Legal TOC | Finsweet rebuilds after revision switching; manager readiness attribute for layout styling |
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

Legal TOC keeps an already complete Finsweet list. When imported headings are incomplete or the revision changes, it rebuilds from the template/body and sets `data-legal-toc-ready="true"` after valid links exist. The reuse change is in the latest source release; the earlier a06fee3 staging observation does not verify that later change.
