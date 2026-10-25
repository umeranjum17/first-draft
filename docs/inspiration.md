# Free inspiration sources, checked 2026-10-25

Where `first-draft-axi` looks for real references when there is no budget for a reference library. Every entry is a free source, grouped by the product type it is actually good for, with what it is good for and a terms note that says whether an agent may capture it automatically or must link only.

**Terms were last checked on 2026-10-25** against each site's own `robots.txt` and terms page. The note quotes what was found, so you can judge it yourself and check it again. These notes are not legal advice.

Two facts decide the note:

- **Link only** means an automated capture is refused. The reasons are concrete: `robots.txt` disallows the path, the terms forbid scraping or reproduction, a Content-Signal says `ai-train=no`, or the site simply grants no permission to store its screenshots. The CLI keeps the link and a written description so you can open it yourself.
- **Capture allowed** means the site's own licence explicitly permits reuse, which is rare for a gallery: the screenshots on a gallery belong to the companies whose products they show.

## How the CLI uses these sources

```sh
# mobile brief: search the free web and the designer threads, capture only what is permitted, keep the rest as links
first-draft-axi make "A shift-swapping app for hospital nurses" --screens onboarding,rota --inspiration --out shift.html

# mobile brief with a real competitor app on an attached Android emulator (internal reference only)
first-draft-axi make "A shift-swapping app for hospital nurses" --inspiration --app ~/Downloads/rota-app.apk --device emulator-5554 --out shift.html

# then look at the options and the sources list beside them
first-draft-axi view shift.html
```

What a run does, in order:

1. **Search first.** Two queries from the brief, run over the free open web (DuckDuckGo's HTML endpoint), Hacker News (its public Algolia API) and the three designer subreddits. Every query and where it was tried is recorded, including a refusal with its reason.
2. **Capture only what is permitted.** Each candidate goes through the same permission-checked capture as any other reference: `robots.txt` first, then the page's own terms reviewed for explicit permission, then two screenshots at 390 and 1280. A refusal keeps the URL, the description the search gave it and the reason it was refused. Nothing is drawn in its place and nothing is scraped.
3. **A mobile brief's competitor, from a real emulator.** `--app` installs an APK (or opens a package already on the device), launches it and captures its own screens, kept for internal reference only. Without an attached emulator the step refuses with its reason and the rest of the run carries on.
4. **The sources list** is written beside each option (`.sources.json`) and shown in the view above the design.

## Design galleries and curated lists

General product and marketing references. The best starting sweep for a marketing page, a portfolio or a first impression, and the weakest for real application UI (that is the next section).

| Source | URL | Good for | Terms note |
| --- | --- | --- | --- |
| Awwwards | https://www.awwwards.com/ | Site-of-the-day award winners across marketing, e-commerce and editorial: the bar for a landing page's opening move, and a tag index that reaches dashboards and developer tools. | **Link only.** `robots.txt` disallows `/gallery/`, `/tag/`, `/vote/`, `/submission/` and `/app.php/`, so the gallery itself cannot be captured. (checked 2026-10-25) |
| Godly | https://godly.website/ | The most modern marketing sites, curated: type, spacing and motion at the top of the craft. | **Link only.** `robots.txt` publishes `Content-Signal: search=yes,ai-train=no` and disallows `ClaudeBot`, `Claude-Web` and `anthropic-ai` by name. (checked 2026-10-25) |
| Siteinspire | https://www.siteinspire.com/ | Filter by style, subject and type; a reliable source of a clean, editorial marketing direction. | **Link only.** `robots.txt` allows generic crawling, but every work shown is another designer's site under its own rights and no terms permission covers storing its screenshots. (checked 2026-10-25) |
| Lapa Ninja | https://www.lapa.ninja/ | Free landing-page gallery with colour and category filters: how an app or developer tool sells itself above the fold. | **Link only.** `robots.txt` allows `/`, but the site states "All screenshots © of their respective owners." (checked 2026-10-25) |
| Land-book | https://land-book.com/ | A large landing-page library with industry filters: section order, pricing pages, feature pages. | **Link only.** `robots.txt` welcomes AI crawlers but each shot is another company's page and the site grants no permission to store its images. (checked 2026-10-25) |
| SaaSpo | https://saaspo.com/ | SaaS landing pages sliced by section: nav, hero, feature, pricing, testimonial. | **Link only.** `robots.txt` answers a Cloudflare challenge (HTTP 403), so no policy can be established and the capture path refuses. (checked 2026-10-25) |
| SaaSFrame | https://saasframe.io/ | Screens by section type (hero, pricing, testimonials, comparison) and by product category: the most useful source for a SaaS page's structure. | **Link only.** `robots.txt` publishes `Content-Signal: search=yes,ai-train=no`. (checked 2026-10-25) |
| SaaSUI.design | https://saasui.design/ | Real product UI (settings, onboarding, dashboards) rather than marketing pages: closer to the screens a brief actually asks for. | **Link only.** `robots.txt` allows `/`, but its terms say logos, screenshots and icons remain the property of their respective owners. (checked 2026-10-25) |
| Muzli | https://muz.li/ | A daily design feed with search across UI, branding and illustration: a fast first sweep of a product type. | **Link only.** Its terms state: "You must not: republish material from Muzli … reproduce, duplicate or copy material from Muzli." (checked 2026-10-25) |
| Details Matter | https://www.details-matter.com/ | Close-up craft: type scales, spacing and micro-interactions in shipped product UI. | **Link only.** `robots.txt` publishes `Content-Signal: search=yes,ai-train=no`. (checked 2026-10-25) |
| Mobbin (free tier) | https://mobbin.com/ | The largest library of real mobile and web app screens and flows; the free tier is enough to learn a flow's shape. | **Link only.** Its terms forbid accessing the service "through the use of any scraper, robot, bot, spider, crawler or any other automated device or means". (checked 2026-10-25) |
| Refero (free tier) | https://refero.design/ | Screens and flows from real apps, searchable by UI element and pattern. | **Link only.** `robots.txt` allows browsing (`User-agent: *` with an empty `Disallow`), but nothing grants permission to store its screenshots. (checked 2026-10-25) |
| Figma Community | https://www.figma.com/community | Free UI kits, flow files and design systems you can duplicate into your own draft: the one source here you may legitimately build from by hand, under each file's own licence. | **Link only** for automated capture; a file's own licence governs what you may reuse by hand. (checked 2026-10-25) |
| Dribbble | https://dribbble.com/ | Shot-level craft and concept work: icon, illustration and colour direction. | **Link only.** Its terms prohibit "copying, distributing, or disclosing any part of the Website". (checked 2026-10-25) |
| Behance | https://www.behance.net/ | Full case studies: brand systems and product work with the thinking shown, not only the pixels. | **Link only.** `robots.txt` is headed "Disallow AI bots" and lists `ClaudeBot`, `Claude-Web` and `anthropic-ai`. (checked 2026-10-25) |
| Pinterest | https://www.pinterest.com/ | Visual search and mood boards: colour, texture and photography direction, weak on real product UI. | **Link only.** Its terms forbid scraping or collecting content "in unauthorized ways". (checked 2026-10-25) |

## Developer tools, CLIs and dashboards

Real shipped products, not galleries: the honest reference for a dashboard, a CLI page, a settings screen or a developer marketing site. Open them, use them and study the screen you are designing. All of them are link only, because a live product's terms grant no permission to store its screenshots.

| Source | URL | Good for | Terms note |
| --- | --- | --- | --- |
| Grafana | https://grafana.com/ | Dense operator dashboards: panel layout, legend and axis grammar, a dark UI that stays readable. | **Link only.** Its terms forbid using "any means to scrape, index, data mine, or crawl any part of the Service". (checked 2026-10-25) |
| GitHub | https://github.com/ | Developer-product information architecture at scale: repositories, settings, diffs, empty states, and its own developer marketing. | **Link only.** `robots.txt` allows the marketing pages but its terms grant no permission to store screenshots. (checked 2026-10-25) |
| Plausible | https://plausible.io/ | A calm analytics dashboard: one headline number, one chart, dense tables underneath. | **Link only.** Its terms say you agree not to "reproduce, duplicate, copy, sell, resell or exploit any portion of the service". (checked 2026-10-25) |
| Linear | https://linear.app/ | The reference for keyboard-first density and restrained developer marketing. | **Link only.** `robots.txt` allows `/`; its terms grant no permission to capture. (checked 2026-10-25) |
| Vercel | https://vercel.com/ | Developer marketing with real product surfaces, and a docs and changelog system worth copying in structure. | **Link only.** `robots.txt` allows `/`; no capture grant. (checked 2026-10-25) |
| Warp | https://www.warp.dev/ | A terminal product's marketing and CLI illustrations: how a command-line tool presents itself. | **Link only.** `robots.txt` allows `/` except `/api`, `/studio`, `/library`, `/open`; no capture grant. (checked 2026-10-25) |
| Raycast | https://www.raycast.com/ | A command palette done well: keyboard-first patterns and extension listings. | **Link only.** Its terms forbid "data mining, robots, scraping or similar data gathering or extraction methods". (checked 2026-10-25) |

## The designer threads

Where practitioners argue about the screens above, and where the "best of" threads live. Reddit refuses automated access outright, so the CLI cannot read a thread itself: it finds thread links through the open web and through its own search attempt, and lists them with a description for you to open.

| Source | URL | Good for | Terms note |
| --- | --- | --- | --- |
| r/UI_Design | https://www.reddit.com/r/UI_Design/ | Critique threads with real screenshots, and recurring "best dashboards/apps" round-ups. | **Link only.** `reddit.com/robots.txt` is `User-agent: *` / `Disallow: /`, and the search JSON endpoint answers an agent with HTTP 403. The CLI records the refusal and keeps the link. (checked 2026-10-25) |
| r/UXDesign | https://www.reddit.com/r/UXDesign/ | Flows, patterns and "what would you do here" threads: the reasoning a gallery never shows. | **Link only**, same `Disallow: /` as above. (checked 2026-10-25) |
| r/web_design | https://www.reddit.com/r/web_design/ | Landing-page and layout critiques, including markup-level detail. | **Link only**, same `Disallow: /` as above. (checked 2026-10-25) |
| Hacker News | https://news.ycombinator.com/ | Launch threads and "how we built X" posts, and the taste of a technical audience. | **Search allowed, pages link only.** Its Algolia search API (`https://hn.algolia.com/api/v1/search`) is free and unauthenticated, so the CLI uses it to find story links; the story pages themselves are never captured. (checked 2026-10-25) |

## Where an automated capture is allowed today

Genuinely permitted sources are open-source documentation and design-system sites, where the site itself is published under a licence that permits reuse: `ui.shadcn.com` (MIT), `starlight.astro.build` (MIT) and `react.dev` (documentation under CC BY 4.0). `first-draft-axi refs pull` captures the first two into a local cache, and `make --inspiration` will capture any page whose own terms still say so when it runs.

Everything else above stays a link, on purpose. If a source is important enough to capture, the honest route is to ask its owner or to buy the licence: a paid library is exactly what the permission review is protecting you from stealing.
