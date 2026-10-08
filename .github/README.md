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
- `assets/github-activity.svg`: dated snapshot of the public contribution calendar.
- `.github/scripts/update_activity.py`: optional refresh script using Python's standard library.
- Older images and music remain in the repository but are not loaded by this page.

No framework, JavaScript, package installation, or build step is required. The
page uses system fonts and makes no third-party font or analytics requests.

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
updates the SVG, total, accessible description, and visible snapshot date together.
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
Philipp approved mentioning the AI system he built for investment research.
Use https://tapestry.group/ and https://www.commonthread.capital/ for the inline
work links. Common Thread's public site is still being developed.
FundFunk is the first side project. Framewerk and Beaches of Mallorca are provisional
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
