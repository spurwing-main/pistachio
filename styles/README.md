# Webflow CSS

20 October local update: `rich-text.css` replaces the obsolete legal-body table
selector with the Legal body attribute. It adds modest padding, a shared minimum cell
width and scroll-area presentation, paired with `src/modules/legal-tables.js`.
The updated CSS has not been saved to Webflow; the earlier saved-source match
does not apply to this local change. Use the existing rich-text custom-code field
when releasing it, and deliver the matching JS bundle. The CSS-only fallback keeps
wide tables scrollable, while the module supplies the keyboard region. Sam will apply the CSS to Webflow.

Readable CSS source for selectors/behaviour the Designer cannot express.
Ordinary editable layout, typography, colours and component controls remain in
Webflow. Native scoped Rich Text styling is supported; existing custom styles
remain unchanged until their affected use and approved scope are established.

These files are not bundled or loaded automatically from GitHub. Webflow remains
the source of truth; refresh these records after editing an Embed. Fresh 18 October saved-source check: global `custom-code` contains 40 CSS
concerns plus one pinned Finsweet setup. All 40 CSS bodies match the local files
listed below. Twenty current Designer snapshots contain one global component
each, including 404; other utility paths and runtime startup are not covered.
The earlier 41-CSS record is historical, before About information-only removal.
This is saved-source/snapshot agreement, not publication or served-code proof.
Refresh affected contents/order/reach before any later approved code move.

## Trust ownership — 18 October 2026

Trust's ordinary Hero/card/table/pill typography, dimensions and native tab Current
colours stay in Webflow. The existing global fields retain only the relationships
not supplied by those native owners:

- `hero-heading`: Hero Trust's paragraph-sibling gap and natural title wrapping
  against the shared balanced-heading rule; other heading variants stay unchanged.
- `hero-media`: collapse forwarded highlight wrappers only when present and all
  empty. `:empty` preserves direct text and populated slots; whitespace is not trimmed.
- `trust-details`: existing section-navigation Current styling, the actual footer
  mailto link's colour/weight and the fixed-colour shield following parent hover/focus.
  The duplicate product-tab Current rule is removed; native tabs own that state.

Scoped saved static images cover five Trust widths, with selected tab/FAQ/link
states checked separately. Frozen captures do not establish animation timing,
all motion/Footer states or published delivery. These are existing concern owners;
no CSS loader, repo release or publication follows from their local records.

| File | Location | Code field | Position |
|---|---|---|---|
| [about-cv.css](about-cv.css) | global `custom-code` / `css` | about-cv | Matches the saved embed, 18 October 2026 |
| [about-team.css](about-team.css) | global `custom-code` / `css` | about-team | Matches the saved embed, 18 October 2026 |
| [arrow.css](arrow.css) | global `custom-code` / `css` | arrow | Matches the saved embed, 18 October 2026 |
| [article-contents.css](article-contents.css) | global `custom-code` / `css` | article-contents | Matches the saved embed, 18 October 2026 |
| [article-template.css](article-template.css) | global `custom-code` / `css` | article-template | Matches the saved embed, 18 October 2026 |
| [blog-listing.css](blog-listing.css) | global `custom-code` / `css` | blog-filters | Matches the saved embed, 18 October 2026 |
| [button.css](button.css) | global `custom-code` / `css` | button | Matches the saved embed, 18 October 2026 |
| [case-study.css](case-study.css) | global `custom-code` / `css` | case-study | Matches the saved embed, 18 October 2026 |
| [contact-form.css](contact-form.css) | global `custom-code` / `css` | contact-form-state | Matches the saved embed, 18 October 2026 |
| [designer.css](designer.css) | global `custom-code` / `css` | designer | Matches the saved embed, 18 October 2026 |
| [faq-page-state.css](faq-page-state.css) | global `custom-code` / `css` | faq-state | Matches the saved embed, 18 October 2026 |
| [feature-row.css](feature-row.css) | global `custom-code` / `css` | feature-row | Matches the saved embed, 18 October 2026 |
| [fluid.css](fluid.css) | global `custom-code` / `css` | fluid | Matches the saved embed, 18 October 2026 |
| [footer.css](footer.css) | global `custom-code` / `css` | footer | Matches the saved embed, 18 October 2026 |
| [form.css](form.css) | global `custom-code` / `css` | form | Matches the saved embed, 18 October 2026 |
| [hero-heading.css](hero-heading.css) | global `custom-code` / `css` | hero-heading | Matches the saved embed, 18 October 2026 |
| [hero-media.css](hero-media.css) | global `custom-code` / `css` | hero-media | Matches the saved embed, 18 October 2026 |
| [home-hero-heading.css](home-hero-heading.css) | global `custom-code` / `css` | home-hero-heading | Matches the saved embed, 18 October 2026 |
| [icons.css](icons.css) | global `custom-code` / `css` | icons | Matches the saved embed, 18 October 2026 |
| [insider-intro.css](insider-intro.css) | global `custom-code` / `css` | insider-intro | Matches the saved embed, 18 October 2026 |
| [marquee.css](marquee.css) | global `custom-code` / `css` | marquee | Matches the saved embed, 18 October 2026 |
| [misc.css](misc.css) | global `custom-code` / `css` | misc | Matches the saved embed, 18 October 2026 |
| [motion.css](motion.css) | global `custom-code` / `css` | motion | Matches the saved embed, 18 October 2026 |
| [nav.css](nav.css) | global `custom-code` / `css` | nav | Matches the saved embed, 18 October 2026 |
| [pricing.css](pricing.css) | global `custom-code` / `css` | pricing-visibility | Matches the saved embed, 18 October 2026 |
| [reset.css](reset.css) | global `custom-code` / `css` | reset | Matches the saved embed, 18 October 2026 |
| [resource-card.css](resource-card.css) | global `custom-code` / `css` | resource-card | Matches the saved embed, 18 October 2026 |
| [rich-text.css](rich-text.css) | global `custom-code` / `css` | rich-text | Matches the saved embed, 18 October 2026 |
| [risk-stack.css](risk-stack.css) | global `custom-code` / `css` | risk-stack | Matches the saved embed, 18 October 2026 |
| [rotate.css](rotate.css) | global `custom-code` / `css` | rotate | Matches the saved embed, 18 October 2026 |
| [sat.css](sat.css) | global `custom-code` / `css` | sat | Matches the saved embed, 18 October 2026 |
| [stat-card.css](stat-card.css) | global `custom-code` / `css` | stat-card | Matches the saved embed, 18 October 2026 |
| [stat.css](stat.css) | global `custom-code` / `css` | stat | Matches the saved embed, 18 October 2026 |
| [stories-filter.css](stories-filter.css) | global `custom-code` / `css` | stories-filter | Matches the saved embed, 18 October 2026 |
| [tag.css](tag.css) | global `custom-code` / `css` | tag | Matches the saved embed, 18 October 2026 |
| [text-link.css](text-link.css) | global `custom-code` / `css` | text-link | Matches the saved embed, 18 October 2026 |
| [trust-details.css](trust-details.css) | global `custom-code` / `css` | trust-details | Matches the saved embed, 18 October 2026 |
| [type.css](type.css) | global `custom-code` / `css` | type | Matches the saved embed, 18 October 2026 |
| [utils.css](utils.css) | global `custom-code` / `css` | utils | Matches the saved embed, 18 October 2026 |
| [video.css](video.css) | global `custom-code` / `css` | video | Matches the saved embed, 18 October 2026 |

Article body long-link wrapping is native on `text-rich-text is-article`. The article-template embed owns only the generated footnotes list indentation needed to keep two-digit outside reference numbers visible: `.text-rich-text.is-article .footnotes ol` uses `padding-inline-start: 2.5em`. It does not change ordinary article lists or source reference text, IDs and return links.

The uninstalled page-contents.css proposal was removed from active source on 16 October; its recovery copy is outside Git. Article delivery uses article-contents.css. That earlier cleanup removed no saved embed. On 16 October, the separate Customer Stories page embed and customer-stories.css mirror were removed after a fresh saved-page check: both selectors matched zero elements, and no inline script or repo runtime referenced the old class. The saved removal was read back; publication remains separate.

The table accounts for every active local CSS file. Do not invent a code-field match
from a similar filename. Check dependencies, loading order, once-per-page reach,
headerless pages and affected existing variants/placements before an approved
move; repeat those checks after old delivery is removed. Keep native/generated
runtime styling separate from authored code.

Shared selectors, variable values and existing variants retain their approval
boundaries. The private page/component records own decisions and readable QA;
the global Nav/Footer record owns the project’s move plan. A saved source or
passing local test is not proof of saved Designer or served page state.

The cleanup moved `text-wrap: balance` to native `hero_heading`, transform origin
to `risk-panel_surface`, and grab/grabbing cursors to `u-grabbable`. The redundant
Hero Embed was removed. CSS page IDs were replaced by existing component classes,
plus the Blog wrapper’s `is-blog-page` modifier; anchor IDs remain. Targeted saved
measurements on HRM, Blog, Article and About were unchanged. These checks do not
establish a whole-page mobile or Figma pass.

Two Password page snippets are generated form/runtime code and retain their page
context. They are not authored global styling or application JS to relocate.

The 16 October structure cleanup retired the hidden About media card in favour
of the already-bound shared Resource card. The later photo-only Team cleanup removed the remaining information rules and
its `about-cards` Embed; the local CSS file is absent. The earlier 41-file match
precedes that removal and is not the current file count. Refresh saved-source
agreement before release; this document correction changes no CSS, loader or site.
