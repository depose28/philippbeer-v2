# Philipp Beer

Personal website at https://philippbeer.me/.

## Source and publishing

- Canonical repository: `depose28/philippbeer-v2`.
- GitHub Pages publishes the root of `main`; `CNAME` holds the custom domain.
- `depose28/philippbeer.me` is the previous site, not the production source.
- Work on a branch. Philipp approves and merges production changes.

## Structure

- `index.html`: page copy, links, accessibility labels, and social metadata.
- `styles.css`: responsive layout and appearance.
- `assets/lake-720.webp` and `assets/lake-1440.webp`: responsive lake illustration.
- `assets/lake-ripple.js`: interactive lake and computer screen component.
- `assets/share-lake-v1.jpg`: optimized 1200 × 600 JPEG for link previews.
- `favicon.svg`: classic Georgia PB initials on warm white.
- `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`: compatible raster icon exports.
- `assets/github-activity.svg` and `assets/github-activity-dark.svg`: matching light/dark snapshots of the public contribution calendar.
- `assets/theme.js`: theme preference, accessible toggle, and optional pixel reveal.
- `assets/fonts/geist-variable.woff2`: self-hosted Geist body font; license in the same directory.
- `.github/scripts/update_activity.py`: optional refresh script using Python's standard library.
- Older images and music remain in the repository but are not loaded by this page.

No framework, package installation, or build step is required. The
page uses self-hosted Geist for body text and the name, and system
monospace for contact labels and activity details. It makes no third-party font
or analytics requests. Font source and checksum are in `.github/font-provenance.md`.

## Theme and typography

The name uses regular-weight Geist at 22px with slight negative letter spacing.
Body text is 15px on desktop and 16px at widths up to 480px. The theme toggle
uses a 44px button beside the name, with an 18px sun/moon icon. Its accessible
name is "Dark mode" and its pressed state reflects the selected theme.

An early inline script sets the saved `philipp-theme` preference before painting;
otherwise it follows the system preference. `assets/theme.js` handles changes,
cross-tab synchronization, and storage failures. With JavaScript disabled, the
complete page remains readable in light mode and the toggle stays hidden.

The 620ms pixel reveal uses native View Transitions and one generated SVG mask.
It does not clone the page, scramble text, run a canvas loop, or load a library.
Reduced motion, hidden pages, unsupported browsers, and animation failures switch immediately.
Only explicit clicks animate. Both calendar SVGs are regenerated together from
the same data; the theme script selects the correct asset and updates browser
chrome colour. A tall viewport can briefly show the light calendar before the
deferred script selects the dark asset. The illustration uses a modest CSS brightness adjustment in dark mode.

## Icons and sharing

The favicon restores the earlier initials design: regular Georgia PB initials on
warm white with slightly rounded corners. The original Georgia initials are
converted to SVG paths, so they render consistently without any font dependency.
SVG is the editable source; ICO contains 16px,
32px, and 48px DIB images for older readers. PNG and an opaque 180px Apple touch
icon are supplied. The `?v=3` icon URLs distinguish this design from the geometric
PB favicon.

Open Graph metadata is static HTML: title, description, site name, locale, canonical
HTTPS URL, and one JPEG with explicit MIME type, dimensions, and alt text. X/Twitter
large-image metadata is also explicit. The share image uses the complete lake
composition without text, allowing the card's title and description to identify
the page. `share-lake-v1.jpg` is a versioned, baseline JPEG under 200 KiB; this is
our transfer-size target, not a claimed universal WhatsApp file-size limit.

Regenerate the raster exports with `.github/scripts/generate_brand_assets.cjs`.
Its header describes installing the development-only `@resvg/resvg-js` and `sharp`
rendering tools outside this repo. They are never requested by visitors. The
original image assets remain intact. Change the share image filename when replacing
it, since sharing clients may cache URLs.

The search and social title is `Philipp Beer | Investor & Builder`. The description
summarizes investing, applied AI, and curiosity projects. The visible name and page
copy remain short. A single static `WebSite` JSON-LD block declares `Philipp Beer`
as the preferred site name and uses the canonical HTTPS homepage URL. It contains
no additional personal details. Google controls the final title, snippet, and site
name displayed. Request a fresh crawl through Search Console after publication;
site-name markup is validated against https://developers.google.com/search/docs/appearance/site-names.

Reference: https://ogp.me/. WhatsApp controls its own card layout and client cache;
metadata validation does not establish an end-to-end WhatsApp rendering test.
Production sharing must be checked after Philipp publishes the design branch.
The shared development preview uses noindex headers and rewritten image URLs.

## Search Console verification

`google9f4acb829614bc2d.html` is Google's unmodified HTML ownership-verification file
for the URL-prefix property `https://philippbeer.me/`. It belongs to Philipp's
Google account used in Search Console. Keep the file at the website root; Google
periodically checks it to retain verified ownership. It is a public verification
proof, not an API credential. Do not replace it with another account's file.
This method covers the HTTPS URL prefix, not every subdomain or protocol.

## Interactive lake

The component was integrated from the uncommitted `design/lake-ripple` worktree,
based on `5dc451e`. Philipp chose to retain this branch's 600px column, Geist name,
small body text, labelled contact links, copy, and light/dark theme. The other
worktree's page restyling and additional fonts were intentionally not imported.

Click/tap the water for a soft drop; flick/swipe to skip a stone. Philipp chose to
keep gentle hover drizzle, with reduced amplitude and frequency. Clicks and manual
stone skips also use smaller ripples and less spray.

Automatic motion is a small surface ripple, never a thrown stone or spray. After
an initial 4–7 second delay, it checks every 10–16 seconds and makes one ripple only
when the lake is calm and the visitor is not interacting. Its origin stays inside
an inset of the water. Interaction defers the next ripple by 8–11 seconds; a
return from an offscreen or hidden page starts a fresh delay rather than catching
up. The visible Pause ripples / Resume ripples button controls automatic motion
for the current page session. Pausing stops new automatic ripples; existing waves
finish naturally. Manual interactions remain available while paused.
`auto="false"` disables automatic ripples; `drizzle="false"` disables hover drizzle.

The pixel renderer uses an exact shoreline mask with an inward fade, and rejects
refraction samples from land. Glyphs and spray have a separate inset canvas clip.
Keep the clip inset: clipping on the boundary can still paint outside it through
anti-aliasing. Browser pixel checks should cover the banks at narrow widths and
both pixel densities. The computer screen effect is rendered outside this clip.

Clicking the computer runs a 0.95-second CRT switch-on. `screen="iridescent"`
adds a restrained cyan/lilac/rose sheen over the green phosphor. The original
`screen="holo"` variant remains available but is not used. The effect is masked
to the screen glass, with the bezel and surrounding illustration unchanged.

The canvas retains the image's accessible description. Native buttons provide
keyboard alternatives for a drop, a skipped stone, and the computer. They become
visible on keyboard focus. The caption reserves two lines before initialization.
Its short interaction hint is hidden until ready and fades after interaction; its seen state is stored
locally when storage is available. With JavaScript disabled or initialization
failure, the image remains visible and the hint stays hidden.

Reduced motion disables all lake animation and hides hints and controls, including
the automatic-ripple button. Live preference changes apply immediately. Offscreen or hidden pages suspend frames.
Window resize and ResizeObserver share a 100ms debounce. Slow-render detection
defers its resolution downgrade until motion settles, preserving active ripples. The solver uses bounded
60Hz steps, stronger damping, and a 0.006 sleep threshold. Deterministic tests
verify single drops settle within eight seconds at 272px, 342px, and 600px widths,
ambient timing and safe origins, pause/resume, and offscreen suspension;
this is a simulation check, not a physical-device performance measurement.

The water outline (`WT`, `WB`), simulation band (`T`, `B`), computer hit area,
and glass seed/bounds are tuned to this exact image. Replacing the image requires
retuning them. Responsive source changes rebuild pixels and the glass mask.
All fonts and assets stay on the same origin; the lake uses the existing system
monospace stack and needs no additional downloaded font.

## GitHub activity trial

The graph is a static snapshot from GitHub's unauthenticated contribution page.
It includes only information already visible on the public profile. Do not use
authenticated private-repository data or change profile privacy settings without
Philipp's direction. A contribution is not necessarily a commit or a working day.

Philipp authorized showing anonymous private contribution counts on 8 October
2026. The GitHub profile's Private contributions setting is enabled. The same
unauthenticated source now includes these counts without repository names or
code. Keep that boundary: do not fetch private repository details for the site.
Committed snapshots remain in git history if that profile setting later changes.
An empty public calendar does not establish inactivity; check visibility and
attribution before using the calendar as evidence of someone's work.

Refresh manually with `python3 .github/scripts/update_activity.py`. The script
updates both SVGs, total, accessible description, and visible snapshot date together.
It validates the calendar before overwriting the last snapshot. There is no
scheduled refresh or visitor-side API request. If the experiment is kept, decide
the refresh method before production publication.

During design review, the separate local preview server supports `?activity=off`
to compare the same page without the calendar. This is a preview-only route, not
a feature of GitHub Pages or the shipped HTML. Removing the section between the
`activity:start` and `activity:end` comments removes the experiment from the site.

The `.github` directory holds repository notes and helper scripts. The existing
GitHub Pages Jekyll build excludes dot-directories from the website output.

## Design and content

Keep the page understated, personal, and accessible. Rahul Palamarthi and Nikhil
Rajpurohit are the main visual references. The narrow layout, readable copy,
monochrome contact icons, and single landscape are intentional.

w3 Liquid Crypto Fund is the primary professional commitment. Use that exact
capitalization. The two venture funds are Common Thread I & II, using Roman
numerals. Tapestry and angel investing receive brief mentions. Describe Tapestry
as putting AI to work for businesses, without adding an engineering title.
Use https://w3.fund/liquid, https://tapestry.group/, and
https://www.commonthread.capital/ for the inline work links. Keep these links
underlined at normal text weight. Common Thread's public site is still being developed.
FundFunk, Framewerk, and Beaches of Mallorca are the selected public projects, in
that order. The same section includes a compact private-work block below the
linked rows. Philipp approved broad descriptions of fund research and operations,
a brand-research tool for consultants, and collaborative investment-data work
with Tapestry. Omit the former "Side projects" label because the section now
includes private work. Use ordinary, unlinked list text for this block, with no project-row
hover treatment or arrows. It stays visible on mobile. The fund-research detail
lives here rather than repeating in "These days."
Keep private client names, investment lists, performance figures, and private
repository links out of the public copy. Additional private projects need his direction.

The illustration is a replaceable, generated placeholder, not a real location
or a personal photograph. Its prompt and provenance are in `.github/image-provenance.md`.

## Local checks

Serve a copy of the public files with a static HTTP server. Preview servers
should expose only the HTML, CSS, JavaScript, fonts, favicon, and image assets, not this repository
or `.git`. Use `noindex` on a shared preview, not on the production page.

Check desktop and mobile layouts, narrow widths, keyboard focus, contact links,
project links, image loading, text contrast, and browser zoom. There is no
framework build or typecheck. Run `node --check assets/theme.js`,
`node .github/scripts/test_theme.cjs`, `node --check assets/lake-ripple.js`,
`node .github/scripts/test_lake.cjs`, and `git diff --check` before committing.
The theme tests cover preference handling, blocked storage, reduced motion,
missing animation support, repeated clicks, scroll/resize/motion interruptions,
error recovery, and cleanup.

Before a push, obtain the cross-vendor review required by Philipp's agent rules.
Record the author model in any pull request. Never merge automatically.
