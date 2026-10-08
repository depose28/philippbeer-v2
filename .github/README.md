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
- `assets/lakeside-computer.webp`: temporary illustration shown on the page.
- `assets/lakeside-computer.jpg`: the same illustration for social previews.
- `favicon.svg`: initials used as the browser icon.
- Older images and music remain in the repository but are not loaded by this page.

No framework, JavaScript, package installation, or build step is required. The
page uses system fonts and makes no third-party font or analytics requests.

## Design and content

Keep the page understated, personal, and accessible. Rahul Palamarthi and Nikhil
Rajpurohit are the main visual references. The narrow layout, readable copy,
monochrome contact icons, and single landscape are intentional.

W3 Liquid Crypto Fund is the primary professional commitment. Common Thread,
Homie Capital, Tapestry, and angel investing receive brief mentions. FundFunk is
the first side project. Framewerk and Beaches of Mallorca are provisional
selections for Philipp to review. Do not add client details, investment lists,
performance figures, or private projects without his direction.

The illustration is a replaceable, generated placeholder, not a real location
or a personal photograph. Its prompt and provenance are in `.github/image-provenance.md`.

## Local checks

Serve a copy of the public files with a static HTTP server. Preview servers
should expose only the HTML, CSS, favicon, and image assets, not this repository
or `.git`. Use `noindex` on a shared preview, not on the production page.

Check desktop and mobile layouts, narrow widths, keyboard focus, contact links,
project links, image loading, text contrast, and browser zoom. There is no
application test suite or typecheck. Run `git diff --check` before committing.

Before a push, obtain the cross-vendor review required by Philipp's agent rules.
Record the author model in any pull request. Never merge automatically.
