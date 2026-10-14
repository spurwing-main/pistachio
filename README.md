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
