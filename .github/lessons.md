# Rendering lessons

## Explicit calendar palettes

In the tested Safari preview, changing the parent page's `color-scheme` did not
update `prefers-color-scheme` styling inside the external calendar SVG. The page
became dark while the chart retained pale empty cells. Use two SVG assets generated
from identical data and select the appropriate source when the theme changes.
Verify the chart itself after toggling, rather than inferring its palette from
the surrounding page.

## Background animation checks

Native Safari UI automation can change controls while the document remains
hidden. View Transition snapshots may then remain paused even though the DOM
already reflects the new theme. Check `document.visibilityState` before treating
a stale screenshot as a theme-state failure. The toggle skips animation while
hidden and cancels its active transition if the user leaves the page.

## Verify encoded image formats

Sharp's `mozjpeg: true` preset enables progressive JPEG even when combined with
`progressive: false`. For the sharing image, use individual compression options
and verify the exported file itself reports baseline/SOF0. Do not infer the output
encoding from one option. Keep favicon PNG/ICO corners transparent; only the Apple
touch icon should receive an opaque background.
