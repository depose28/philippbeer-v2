"""Refresh the static calendar from GitHub's unauthenticated public profile.

Run from any directory: python3 .github/scripts/update_activity.py
Includes anonymous private counts shared through GitHub's profile setting.
No token, private repository access, or browser-side API request is used.
"""

import re
from datetime import date, datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "https://github.com/users/depose28/contributions"
START = "    <!-- activity:start -->"
END = "    <!-- activity:end -->"
COLORS = ("#e7e8e1", "#ccd7bd", "#a4b78d", "#788f61", "#4f663e")
DARK_COLORS = ("#30362d", "#44523b", "#657853", "#90a779", "#bed2a8")


class CalendarParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.days = {}
        self.tips = {}
        self.tip_id = None
        self.text = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "data-date" in attrs and "data-level" in attrs:
            if not attrs.get("id"):
                raise ValueError("Contribution cell has no identifier")
            self.days[attrs["id"]] = (date.fromisoformat(attrs["data-date"]), int(attrs["data-level"]))
        if tag == "tool-tip":
            self.tip_id = attrs.get("for")
            self.text = ""

    def handle_data(self, text):
        if self.tip_id:
            self.text += text

    def handle_endtag(self, tag):
        if tag == "tool-tip" and self.tip_id:
            self.tips[self.tip_id] = self.text.strip()
            self.tip_id = None


def parse_calendar(html):
    parser = CalendarParser()
    parser.feed(html)
    days = []
    for key, (day, level) in parser.days.items():
        # Fail closed if GitHub changes its markup; retain the last good snapshot.
        tip = parser.tips.get(key, "")
        match = re.fullmatch(r"(No|[\d,]+) contributions? on .+\.", tip)
        if not match or level not in range(5):
            raise ValueError(f"Unrecognised contribution data for {day}")
        count = 0 if match[1] == "No" else int(match[1].replace(",", ""))
        days.append((day, count, level))
    days.sort()
    reported = re.search(r"([\d,]+)\s+contributions?\s+in the last year", html)
    if not reported or int(reported[1].replace(",", "")) != sum(count for _, count, _ in days):
        raise ValueError("Daily counts do not match GitHub's reported total")
    if not 365 <= len(days) <= 371:
        raise ValueError("GitHub did not return a full contribution calendar")
    for previous, current in zip(days, days[1:]):
        if (current[0] - previous[0]).days != 1:
            raise ValueError("Contribution dates are missing or duplicated")
    return days


def make_svg(days, fetched, dark=False):
    colors = DARK_COLORS if dark else COLORS
    total = sum(count for _, count, _ in days)
    origin = days[0][0]
    if origin.weekday() != 6:
        raise ValueError("Expected a Sunday-aligned calendar")
    columns = (days[-1][0] - origin).days // 7 + 1
    width = columns * 11 - 3
    months = {}
    for day, count, _ in days:
        if count:
            label = day.strftime("%B %Y")
            months[label] = months.get(label, 0) + count
    description = "; ".join(f"{label}: {count}" for label, count in months.items())
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 98" width="{width}" height="98" role="img" aria-labelledby="title description">',
        f'<title id="title">{total:,} contributions visible on depose28’s GitHub profile</title>',
        f'<desc id="description">{origin.isoformat()} to {days[-1][0].isoformat()}. {escape(description)}. Other months have no recorded contributions. Fetched {fetched}.</desc>',
        f'<g fill="{"#a4ac9e" if dark else "#696e63"}" font-family="ui-monospace, monospace" font-size="10">',
    ]
    last_label_x = -50
    for i in range(columns):
        day = days[min(i * 7, len(days) - 1)][0]
        previous = days[max(0, i * 7 - 7)][0]
        x = i * 11
        if (i == 0 or day.month != previous.month) and x - last_label_x >= 32 and x <= width - 24:
            svg.append(f'<text x="{x}" y="10">{day.strftime("%b")}</text>')
            last_label_x = x
    svg.append('</g>')
    for day, count, level in days:
        offset = (day - origin).days
        x, y = offset // 7 * 11, 22 + offset % 7 * 11
        label = f'{day.isoformat()}: {count} contribution' + ('' if count == 1 else 's')
        svg.append(f'<rect x="{x}" y="{y}" width="8" height="8" rx="1" fill="{colors[level]}"><title>{label}</title></rect>')
    svg.append('</svg>')
    return '\n'.join(svg) + '\n', width, total, description


def main():
    request = Request(SOURCE, headers={"User-Agent": "philippbeer.me-public-calendar", "Accept-Language": "en"})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8")
    days = parse_calendar(html)
    now = datetime.now(timezone.utc).date()
    if abs((now - days[-1][0]).days) > 2:
        raise ValueError("GitHub returned an unexpectedly stale calendar")
    svg, width, total, description = make_svg(days, now.isoformat())
    updated = f"{now.day} {now.strftime('%b %Y')}"
    legend = ''.join(f'<i style="--level: var(--activity-{level})"></i>' for level in range(len(COLORS)))
    block = f'''{START}
    <section class="activity" aria-labelledby="activity-heading">
      <div class="section-heading">
        <h2 id="activity-heading">On GitHub</h2>
        <a class="activity-profile" href="https://github.com/depose28">@depose28 <span aria-hidden="true">↗</span></a>
      </div>
      <div class="activity-scroll" tabindex="0" role="region" aria-label="GitHub contribution calendar; scroll horizontally to see the full year">
        <img src="assets/github-activity.svg" data-light-src="assets/github-activity.svg" data-dark-src="assets/github-activity-dark.svg" width="{width}" height="98" alt="{total:,} contributions visible on my GitHub profile over the past year. A snapshot from {updated}." loading="lazy" decoding="async" aria-describedby="activity-description">
      </div>
      <p id="activity-description" class="sr-only">{escape(description)}. Other months have no recorded contributions.</p>
      <div class="activity-meta">
        <p><strong>{total:,}</strong> contributions in the past year</p>
        <span class="activity-legend" aria-hidden="true">Less {legend} More</span>
      </div>
      <p class="activity-note">Includes anonymous private activity · updated <time datetime="{now.isoformat()}">{updated}</time></p>
    </section>
{END}'''
    page_path = ROOT / "index.html"
    page = page_path.read_text(encoding="utf-8")
    if page.count(START) != 1 or page.count(END) != 1:
        raise ValueError("Expected exactly one activity section")
    begin, finish = page.index(START), page.index(END) + len(END)
    (ROOT / "assets/github-activity.svg").write_text(svg, encoding="utf-8")
    dark_svg, _, _, _ = make_svg(days, now.isoformat(), dark=True)
    (ROOT / "assets/github-activity-dark.svg").write_text(dark_svg, encoding="utf-8")
    page_path.write_text(page[:begin] + block + page[finish:], encoding="utf-8")
    print(f"Updated public calendar: {total} contributions; {len(days)} days; fetched {now}.")


if __name__ == "__main__":
    main()
