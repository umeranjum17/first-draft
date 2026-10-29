# First Draft guide

[Quick start](../README.md#quick-start) · [CLI help](#reference)

## Choose a direction, not just a screenshot

- **Make options.** `make` generates three directions by default; use `--options 1` for one or `--options 5` for five. Each is a self-contained HTML file, not app code, written in one model call from Anthropic's frontend-design guidance (vendored in `src/taste/`, Apache-2.0) plus a short page contract: design what the brief names, one accent colour used on one thing per screen, faint grids, real-looking data and no invented testimonials or logos. Chrome then draws the page and the host measures what it can (overflow at 390px, text under a fixed bar, clipped text, text that cannot be read against its own background, a close button with nothing to close, a background grid that competes with the content, more than three hues); the model gets one call to fix exactly those. Options are drawn two at a time, and `made.timing` in the output says where the seconds went. A landing, home, marketing or company page also gets first-draft's own human-side guidance (`src/taste/human-side.md`: one bold brand colour and one accent in big colour blocks, an editorial headline, the real product shown as data, sections that change rhythm, and a nine-point hero), and the host adds its measurable lines (two hues at most, one filled primary button, a pill above a 5 to 8 word centred title, a hero picture or product screen, at most two card-grid sections in a row, one full-width colour or dark band). One critic pass then scores it 1 to 10 beside a plain one-prompt page. After `first-draft-axi refs pull`, a different model (default: Sol 6.1 through your installed ChatGPT subscription, `byokit:codex`) compares it with locally captured references of the same page kind, with scores and reasons for hierarchy, type, colour, spacing, imagery, proof/clarity and AI-side tells. The independent judge is required even without a reference cache: it then compares the model-generated baseline and supplied images. Missing judge authentication, a failed judgement or a corrupt reference cache stops the run; there is no generator self-assessment. An option under 9 (or under the plain page) stays flagged, without another design revision (scoring cannot be disabled). With several options and no `--direction`, the model plans one direction per option for your brief (`first-draft-axi styles` lists the named styles you can pick instead). `--engine` uses the older multi-turn engine loop.
- **Open one on the canvas.** Studio shows one option beside its options, comments and a brief for your next change, as large as the window allows. On a laptop it opens on Desktop (1280px); where there is room it opens on Both, the desktop and the phone (390px) side by side, each with its own Play. Both, Desktop and Phone are one click away and your pick is remembered; a phone-width window shows the phone.
- **Comment on it.** Press Comment (in the ⋯ menu on a phone) and tap the spot you mean: your comment is saved next to the design and shows as a numbered pin beside the frame.
- **Look closer.** Fullscreen gives the option the whole window; Play is one tap away.
- **Refine the one you like.** A follow-up prompt writes a new option; your original stays untouched.

Generating needs your chosen model; viewing does not call it. Options are prototypes, not production apps.

## Works alone, or with sign-off

First Draft needs nothing else: `make`, `view` and `refine` work on their own, and comments from people show as read-only pins on the canvas ([comment pins ↓](#reference)).

To get someone's pick, hand the options to [sign-off](https://github.com/umeranjum17/sign-off), a sibling review board. The board shows the options side by side; each one links into first-draft for the detail:

```sh
first-draft-axi post notes.html \
  --title "Which notes app?" \
  --recommend a
```

`post` copies the options into the board, starts `view` if it is not running, and posts one card with an **Open** link under each option. The link opens that option in Play in the viewer, and the card text names each option's canvas link, which shows phone and desktop side by side. It needs `sign-off-axi` 0.5.0+ and a `.sign-off/` board in this folder or above, or `--board <board.json>`, or `$FIRST_DRAFT_BOARD`, so it runs from any repo. Links point at the viewer on its tailnet address, or at `--host`. Name options with `--option a=<label>`; demos that ask for no pick use `--evidence --media <shot>` instead of `--recommend`.

## Models

Every generation goes through [BYOKit](https://www.npmjs.com/package/@byokit/accounts). First Draft tries your authenticated saved preference, then resolves another ready installed Claude/Codex login or supported BYOKit key account. The run JSON names its generator and independent judge. If none is usable it exits with one provider-specific sign-in command before making any page. Native OpenCode login storage is detected but cannot yet be executed by this BYOKit build; supported OpenCode key accounts remain usable.

| Use what you have | Route for `init --agent` |
| --- | --- |
| Claude subscription (Pro or Max), in the installed, signed-in Claude CLI | `byokit:claude` |
| ChatGPT subscription, in the installed, signed-in Codex CLI | `byokit:codex` |
| A plan key, such as Z.ai | `byokit:zai:plan_key` |
| An API key, such as MiniMax | `byokit:minimax:key` |

Subscriptions come first. They need no key: calls use your CLI's normal login without copying it. Claude models run only through the Claude subscription; any other route refuses them and points you to `byokit:claude`. Plan key and API key routes are still there for other providers.

Run `first-draft-axi doctor` to see your ready subscriptions, each with its exact `init` line. Set your route with `init --agent … --model …`, then run `first-draft-axi doctor` to check readiness **without a paid call**. MiniMax defaults to `MiniMax-M3.1-Flash-Preview` if `init` gets no `--model`.

Key routes read the environment variable named by `doctor`; keys are never saved in First Draft's config. Config lives at `$FIRST_DRAFT_HOME/config.json`, default `~/.first-draft/config.json`.

### Optional: spread calls across your accounts

If you keep several Claude or Codex logins, the model pool helper from [Firstmate's account-pool add-on](https://github.com/umeranjum17/firstmate-addons/tree/main/account-pool) can start each call on the account with the most room and move on when one runs out. It is optional: with neither variable set, every call keeps its plain BYOKit route.

```sh
# the helper: a name on PATH, or an absolute path to it
export FIRST_DRAFT_MODEL_POOL=fm-model-pool
# its pool config file, an absolute path (the file the helper documents)
export FIRST_DRAFT_ACCOUNT_POOL="$HOME/.config/model-pool/account-pool"
```

The helper answers with an account folder — a path, never a credential — and First Draft runs the call on that folder. A limit may select another account on the same resolved engine/model. Any provider/model-changing pick is refused before execution: it could otherwise silently turn the generator into its judge. `doctor` resolves an authenticated supported engine and can probe a pooled account through BYOKit when the default login is signed out. A pool failure never permits an AI-free result.

## Generated assets

Opt-in pictures, illustrations, icons, hero visuals and backgrounds are placed **inside the draft screens**, not on a separate asset sheet. With `--assets`, the design agent gets the engine's own `generate_image_asset` tool and decides which pictures the design needs and which approved provider makes each one, at most 3 per option (a multi-screen flow: one character style sheet plus one picture per screen), and (when the loop is asked for, with Higgsfield) makes one short looping hero video from the still it puts in the hero. No asset calls happen by default (`--no-assets` makes that explicit).
```sh
first-draft-axi assets  # detect installed, signed-in providers; no generation
first-draft-axi make "Umer's plant shop with a photo of the shop window and a leaf illustration" --out shop.html --assets codex,higgsfield
# Read the cost preview, then explicitly approve asset spending:
first-draft-axi make "Umer's plant shop with a photo of the shop window and a leaf illustration" --out shop.html --assets codex,higgsfield --allow-asset-spend
```

`--assets codex|higgsfield|codex,higgsfield|auto` alone previews each provider's per-image cost, the image ceiling and — when the loop is asked for (`--hero-video`, or Higgsfield among the approved providers) — the per-video cost and the video ceiling, then exits **before any design or image generation**. `auto` offers every ready provider. With `--allow-asset-spend`, the preview is printed to stderr before generation. The make JSON lists each option's `images` (the provider, purpose and prompt the agent chose) and its `videos`. Design-model charges are separate and unchanged. Asset generation is refused in CI even with approval; tests use stand-ins only. `redesign` does not generate images.

- **Codex:** installed CLI with `codex login` (ChatGPT subscription), launched with its BYOKit installed-account path, never copied credentials. Uses native `image_generation` through `codex exec`, GPT-6 Luna, low effort, one image per call at the lowest quality; shell tools are disabled. The native tool keeps its image in Codex's own image cache, so the adapter imports the newest PNG under this invocation's thread ID only; it never follows a model-suggested file path or reads login files. Codex provides **no price API**: the preview says unknown subscription quota/overage, never “free”. Approval explicitly accepts that uncertainty; exact image dimensions/quality are controlled by Codex's native tool.
- **Higgsfield:** installed CLI with `higgsfield auth login`; uses Z Image at the aspect ratio the agent asks for, with the provider's live credit estimate. Your existing account pays; no keys are stored by First Draft. If a mise shim reports no runtime, run `mise exec node@26.1.0 -- first-draft-axi …` with your installed Node version.
- **Optimization:** requires ImageMagick 7 (`magick`) on PATH, checked before spending. Each image is stripped of metadata, resized to at most 1024×1024 and encoded as WebP at quality 80 (800 KB maximum). Files live beside the output in `<name>.assets-*/image.webp`; HTML embeds them as data URIs, so viewing, copying and posting remain offline. `done` fails while a generated image is not shown in the design. `refine` keeps embedded images but does not generate new ones.

The adapter contract is `detect()`, `estimate() → {amount,unit,detail}` for one image, `use` (what the provider is good at, shown to the agent) and `generate({prompt,aspectRatio,dir}) → local raster path` in `src/assets.mjs`. New providers use that same boundary; the host handles approval, image budget, optimization and embedding. No account switching or host retries; the agent may ask again within the budget. A failed design can leave a paid asset on disk; the error is reported, not silently retried.

### Hero video

With Higgsfield approved, the still the design put in its hero also becomes a **short silent loop** — the pattern real product pages use: a generated hero image, a few seconds of motion from it, the page built around the file. One video per option, under the same `--allow-asset-spend` approval, the same preview and the same CI refusal; the still is only read, never regenerated.

```sh
first-draft-axi make "Umer's plant shop with a photo of the shop window at golden hour" --out shop.html --assets codex,higgsfield            # preview: image and video cost
first-draft-axi make "Umer's plant shop with a photo of the shop window at golden hour" --out shop.html --assets codex,higgsfield --allow-asset-spend
first-draft-axi make "Umer's plant shop …" --out shop.html --assets codex --hero-video --allow-asset-spend   # free still, one paid loop
```

`--hero-video` asks for the loop on its own, beside a picture provider that costs no credits: the stills stay on `--assets codex` and Higgsfield is used only for the video, never offered for a picture.

- **Model and price:** Seedance 2.0 Mini, 5 s, 720p, no audio — the cheapest start-image model on the account's estimate (5 credits for one loop at the time of writing; the preview prints the live figure). Short and silent keeps the page fast and the loop small.
- **Seamless by construction:** the still is passed as both the start and the end image, and the prompt asks for motion that returns to the opening frame, so the loop does not cut. The prompt keeps the still's own subject line; the provider's style line is dropped.
- **Where it lands:** `<name>.assets-*/hero-loop.mp4` beside the still, encoded with FFmpeg (device width at most 1280, no audio, faststart) and embedded in the HTML as a `data:video/mp4` URI, so the page still loads nothing from the network. FFmpeg is checked before the paid call.
- **How the page uses it:** the host replaces that one hero `<img>` with `<video autoplay muted loop playsinline poster="…">` plus the still beside it, and adds a `prefers-reduced-motion` rule that hides the video and shows the still. A reader with reduced motion sees the picture; everyone else sees the loop.
- **What the checks allow:** `done`'s clarity rule still fails a video that autoplays on its own, except the hero loop first-draft made and a recording the project supplied. The host generates the loop after the design passes, so the design agent never handles video files.

## Logos

```sh
first-draft-axi logo "Umer's tea shop, calm and modern" --out tea.html --options 3
first-draft-axi view tea.html
```

A logo starts as concepts, not as a drawing. The model first explores nine rough concepts in three territories at the same time: wordmark-led (the name in letters of its own, one detail of which becomes the mark), abstract, and a symbol. Each concept takes its metaphor from the brief or the product's story, never from the name's initials (`from` in the JSON says where), and has a base shape of its own, one line of idea, a palette that follows that idea (a reason and measured contrast, not one palette for the brief) and a rough SVG sketch. A concept built on a letter the brief does not ask for is sent back. Chrome draws every sketch; the host measures whether its detail survives at 16 px, and an independent authenticated engine, as critic, looks at each territory's sketches on one board, large and at 32 and 16 px pixel by pixel. It names what a stranger sees, the base shape it sees, what else the mark could be taken for (a smiley first of all), the stock image it repeats (a cup with a leaf, for tea), whether a lettermark is just its letter, whether an initial is dressed as an object, and a score out of 10. Only a serious flaw overrides a keep: a plausible misreading, a cliche, a plain letter, a likeness to one of your references, or detail the host measured dying at 16 px; a mark with none of those is a keep only at 9 or 10 out of 10, the owner's bar: the critic scores each mark side by side with the marks of the best products of its class (Linear, Stripe, Vercel, Notion, Raycast) and, for a finished mark, with the baseline (the plain output of the same model on the same brief, drawn meanwhile, kept in `tea.baseline/`), with its reasons (`compared`); under 9 it goes back for another round (a redo, or the second round), within the caps below. An initial joined to, carved into or shaped as an object (a U as a cup, a leaf with a U cut in it) is dropped unless the brief asks for a letter. The strongest concepts become the options: with two or more options, a wordmark-led and an abstract one among them, and never two of one base shape (as the critic saw it); the sheet labels each option's kind over its idea. `--direction` keeps every concept in one direction (`first-draft-axi styles --logo` lists them, or use your own words).

Each option is drawn by its own engine run from its concept, three options at a time (`timing` in `logo.json` and the command's JSON says where the seconds went). When an image provider is ready, the default `--explore auto` first has it make a raster of the concept (one image per concept tried, Codex image generation on your subscription when it is ready, else Higgsfield credits; no key is read or sent anywhere new), and the engine redraws its strongest idea as clean SVG with the image as a reference; the image is kept as `exploration.webp`. With no provider ready, in CI or with `--explore none`, the logo is drawn from the idea alone and `exploration` says why. The finished mark and icon are critiqued again at 16 and 32 px: at most two engine runs an option: a redo goes back to the engine once with the critique, a mark whose idea the critic drops gives way to a reserve concept of its kind (never of a base shape another option holds), drawn once, and one that still fails stays as the option, flagged (another idea is the second round's job). When the critic drops every drawn mark, one second round explores new concepts seeded by its own reasons and advice (and the ideas already tried) and draws them once each; the options are then picked again from both rounds, passed first, with the same kinds and distinct base shapes (`rounds` and `second_round` in the JSON). An option is never lost to the critique: when no concept passes, the best-scored attempt is the option, marked `passed: false`, with the critic's reading and flaws under its idea in the sheet, in `logo.json` and in the command's JSON. Every attempt that did not become the option stays beside it for review, in `tea-1.dropped/` (the view does not list it as an option); `dropped` in the JSON says why each was dropped. This review requires a different authenticated engine and model; a missing or failed reviewer stops the run instead of using generator self-assessment.

The critic's only references are the principles and the images you pass with `--ref` (up to 6, your own files). `logo` never fetches or captures an inspiration site: logosystem.co, logofolio.com, branition.com, logoinspo.com, logotouse.com, iconly.design, fontinlogo.com and logobook.com are a shelf to browse by hand, because none of them clearly permits automated capture (see Real visual references).

Each option is a brand sheet, `tea-1.html`, and a folder beside it, `tea-1.logo/`, with clean SVG files: `mark.svg`, `wordmark.svg`, `lockup-horizontal.svg` and `lockup-stacked.svg`, each with a `-dark` twin, and `icon.svg`, the app icon. `palette.json` is the concept's own palette, written by the host: primary, accent and neutral ink with their dark counterparts, and one line on why they follow that idea. The folder also holds the icon as PNG at 16, 32, 48, 180, 192, 512 and 1024 px, `favicon.ico` (16, 32 and 48 px), `concepts.png` and `critique.png` (the boards the critic saw) and `logo.json` (brief, model, the concept and its idea, every explored concept with its verdict, the critique, the palette with contrast, files and check results). The sheet opens with the name, the concept's one-line idea and the mark beside its palette, the reason and each colour's measured contrast, all written in by the host; then the wordmark, both lockups on light and dark tiles, and the icon at its real sizes and in context. The logo files are embedded in it, so it opens offline like any option, in the Studio, with comments, `refine` and `post`.

The host checks the files, not the model's word. Every SVG must have a viewBox (square for the mark and the icon), be 20 KB or less, use only plain shapes: no `<text>` (letters are drawn as paths, so the logo carries no font), `<image>`, `foreignObject`, script, filter, event handler, or link or `url()` outside the file, and draw only with the palette's colours. Each palette colour must reach 3:1 on white (light) or near-black (dark). Chrome, the one already on the machine, then draws `icon.svg` at every size. It refuses an icon that is not full-bleed, paints outside the maskable safe zone (the central circle, 80% of the side), is almost blank or under 3:1 contrast at 16 px, or loses its detail at 16 px: fewer distinct parts (shapes and counters) in the 16 px render or in a 16 px box-downsample of the 512 px render than at 512 px, or a slot, hairline or thin tongue narrower than one 16 px pixel. A light or dark file must reach 3:1 on a white or near-black tile. Each finding goes back to the model to fix; nothing is silently fixed. `logo` needs Chrome or Chromium and a model that takes images, and refuses to start without them.

`refine tea-1.html "<change>" --out tea-round.html`, or the brief in the Studio, starts from the option's logo files and writes a new sheet with its own `.logo/` folder; the original stays (a refine is not critiqued again). There is no font list yet. Marks are model-drawn: judge them, and check any name you adopt for trademark conflicts yourself.

## Real visual references

```sh
first-draft-axi make "A notes dashboard, make it like Vercel" --out notes.html
first-draft-axi make "A mobile notes app" --like Linear --out notes.html
first-draft-axi references --like https://example.com/ --capture
```

Named comparisons (`like Vercel`, `Apple-like`, `style of Linear`, `inspired by …`, `similar to …`) ask **your configured model**, not a built-in brand list, to identify one reference and a candidate homepage. `--like <brand-or-https-url>` makes the choice explicit and overrides the prompt; URLs skip discovery, not policy checks. Plain `references "<prompt>"` only discovers an unverified candidate without visiting it; `--capture` checks policy and gathers it. These work for mobile apps, websites, dashboards and CLI/PWA designs: the requested output surface does not change the reference boundary.

Before screenshots, First Draft checks robots.txt and asks your model to review the same site's linked public terms/licence. **Unclear or restrictive permission refuses capture**; public access and robots allowance are not a licence. A successful review retains its source and an exact permission quote, explicitly as a model assessment, not legal advice. Some brands cannot be captured under this conservative policy: use a different permitted public source or local `--ref` images you may use, never log in or bypass a restriction.

Chrome/Chromium captures the first viewport at **390×844 and 1280×800**. Fetches are anonymous HTTPS GETs: public DNS addresses are checked and pinned, redirects rechecked, no cookies, credentials, query strings, custom ports, logins or challenges. Limits: 32 requests, 2 MB per resource (64 KB robots), 8 MB total, 10 seconds per request, 60 seconds per capture. A polite user agent and robots crawl-delay apply. Scripts, frames and cross-origin resources are disabled, so dynamic sites or external fonts/assets may differ; the brief records omissions and CSS motion declarations, not observed interaction motion. Terms-review model calls consume your normal quota; no paid reference API or separate account is used.

References are cached for 24 hours in the current project's `.first-draft/refs/<host-and-url-hash>/`, with immutable phone/desktop images and `sources.json` recording source URLs, fetch times, permission note, hashes and observed visual language (type, spacing, colour, layout, CSS motion). `--project <folder>` changes the cache's project root. The images reuse the existing native `--ref` input path; neither screenshot pixels nor source assets/text are copied into the generated HTML. Two source captures share the six-image / 10 MB model-input budget with local `--ref` images.

The viewer shows the captures, Source/Permission links and visual-language notes **beside each option**. A portable `<option>.html.refs.json` sidecar keeps references available offline and through refinement/posting; keep it beside its HTML file. `--no-references` disables automatic online gathering without disabling local `--ref <local.png|jpg|webp>`. Generic follow-up changes keep the option's captured references. A failure is reported, never silently replaced with an invented brand style.

### What the market does (competitors)

```sh
first-draft-axi make "A shift-scheduling app for small restaurants" --competitors --options 3 --out shifts.html
```

`--competitors` needs **no brand in the brief**. Your configured model names **3 to 5 real products of the same kind** (the same job, audience and surface), each with its own live public URL; then every candidate's page goes through the **same robots/terms review and capture** as a named reference, and never through a new scraper or a logged-in session. A candidate whose robots or terms refuse capture, that redirects off its own site or into a login/challenge page, or that fails to capture is **refused and reported as refused**, with its reason: it is never shown as a drawn substitute, and no competitor name or URL is invented. If the model cannot name three real products with public URLs, the run stops before fetching anything. `--competitors` is refused together with `--no-references` and with `--like` (that compares with one named product instead). Discovery and terms-review calls consume your normal model quota; only public marketing pages are read.

The viewer shows the captured competitors **beside each option** under **What the market does**, each with its own source URL, permission note and phone/desktop capture, and every refusal under **Not captured** with the reason for it. They are kept in a portable `<option>.html.competitors.json` beside the option (12 MB budget), survive `refine` and the Studio brief, and are **not** sent to the model: they are how the person picking a direction sees what the real world already does.

### Free inspiration sources, and the sources list

```sh
first-draft-axi make "A shift-swapping app for hospital nurses" --screens onboarding,rota --inspiration --out shift.html
first-draft-axi make "A shift-swapping app for hospital nurses" --inspiration --app ~/Downloads/rota-app.apk --device emulator-5554 --out shift.html
```

`--inspiration` needs no brand and no paid library. It **searches first**: two queries planned from the brief run over the free open web, Hacker News' public search API and the designer subreddits (`r/UI_Design`, `r/UXDesign`, `r/web_design`), and every query, where it was tried and how it went is recorded, a refusal included. Each candidate then goes through the **same robots/terms review and capture** as any reference: the pages whose own terms explicitly permit it are captured at 390 and 1280, and every other candidate is kept as **a link with the one-line description the search gave it and the reason it was refused** — never scraped, never replaced by something drawn or invented. At most six pages are captured per run; the rest stay links. Search, discovery and terms-review calls consume your normal model quota; no paid search or reference API is used.

`--app <apk-or-package>` (with `--inspiration`) is for mobile briefs: on one attached **Android emulator** it installs that APK (or opens a package already installed), launches it and captures its own two screens as **internal mobile reference only** — never embedded in the output. It needs `adb` on `PATH` and an emulator; `--device <serial>` picks which one when more than one is attached. With no emulator, no `adb`, an APK that installs nothing, or a package with no launchable activity, the step **refuses with that reason** and the rest of the run continues. It never starts an emulator, never touches a serial it was not given, and runs one adb call at a time with a deadline. `--app` without `--inspiration` is refused, as are `--inspiration` and `--no-references` together.

The viewer shows the **sources list** beside each option: the search date, the product type and how many searches ran, every captured page with its own source, permission note and screenshots, every **Link only** page with its description and refusal reason, and every **search that refused**. It is kept in a portable `<option>.html.sources.json` beside the option (12 MB budget) and survives `refine`. The curated, dated list of free sources per product type, with a terms note on every entry, is **[docs/inspiration.md](inspiration.md)**.

## Multi-screen flows

A brief that asks for a flow of three or more screens (onboarding, sign-up, a wizard, a checkout: it names the screens, or says "N screens") is drawn as **one journey, not N pages**. Every screen keeps one shell and one grid — a header row at the same height with a back control and Skip, the title at the same position, size and measure, the progress dots, and the round next button in the same corner on every screen but the last, whose closing filled button is its one action — so only the content between them changes; each screen's small label above the title names that screen's own step, each screen fits one screen (nothing runs past its bottom, so the progress dots and the round next button stay visible and no option card is cut in half), each screen carries one idea and one decision, and the flow is one file whose screens are `data-oc-screen` sections in order. Each screen's illustration belongs to that screen's own surface: it runs to the screen's edges on the screen's own ground or fades into it with a mask, never in a rimmed, oval or framed shape and never shrunk to a thumbnail, and `done` refuses one that is, along with one step label repeated on every screen, a second action beside the last screen's closing button, and a screen that outgrows the screen it is shown on (`src/render-check.mjs`). The sentence is part of the page contract, so it is held to the same bar as every other wrapper addition (`docs/wrapper-allowlist.json`).

```sh
first-draft-axi make "mobile onboarding flow, 6 screens, mindfulness app called mellow" --out flow.html --options 1 --ref /path/to/reference.jpg
first-draft-axi make "…" --out flow.html --assets codex   # preview, then --allow-asset-spend
```

The critic scores `flow.shell` (one shell and one grid across the screens) and `flow.character` (one character, in one drawing style, on every screen) in its single review, and either under 9 fails the option however good its design score. An onboarding flow is its own reference kind (`onboarding`); there is no licensed public capture of one, so the reference is your own image (`--ref`), and the judge scores the flow beside it. With `--assets codex`, the design agent draws the character's **style sheet first** and every later picture of that option is drawn from it: the host attaches the first image to each later request (`codex exec -i`), so the face, line weight and palette stay the same. The make JSON marks it (`sheet: true`, then `style_sheet: true`).

`journeys/onboarding-flow.mjs` is the benchmark for that brief: one live run of the mellow onboarding flow beside the owner's reference, with the six screens captured in the Studio at phone width and a report of the scores.

## Redesign an existing product (first slice)

```sh
first-draft-axi redesign https://example.com/ "Make the workflow clearer" \
  --ref inspiration.png --out redesigned --max-pages 6
first-draft-axi redesign ./html-export "Make the workflow clearer" --out redesigned
first-draft-axi view redesigned
# your own running app (a script-rendered board on this machine), opt-in:
first-draft-axi redesign http://127.0.0.1:4410/ "Calmer triage" --live --out redesigned --max-pages 3
```

Starts at the URL (or a folder's `index.html`), follows same-origin anchor links, and records visible text, mapped navigation, pending URLs and phone/desktop source captures under `redesigned/sources/`. One coherent option contains all discovered screens at 390 and 1280; `--options 1-5`, `--model`, `--ref` and `--like` reuse make's controls. `--screens` is not accepted: screens come from discovery. Output must be outside a source folder.

**Your own running app (`--live`).** For a script-rendered app you run yourself, such as a sign-off board on `127.0.0.1`, add `--live`. Only loopback is accepted, or a private-network address you name with `--allow-host <host>` (10/8, 172.16/12, 192.168/16, 100.64/10, fc00::/7); a public host is refused even when named. The URL may not carry credentials or a query string, so a board's access token is never read: serve it on loopback, where it needs none. Its scripts run in a fresh browser profile with no cookies or sign-in; only same-origin GET requests reach the app (writes and every other origin are blocked). Each hash route (`#waiting`, `#tickets`) is its own screen, opened fresh at its URL once the visible text stops changing; dialogs and states behind buttons are not discovered. Every source navigation entry stays on every redesigned screen, including entries whose screen was not discovered.

Each screen's own phone and desktop source captures are sent to its writer and its reviewer after your `--ref` images (the plan sees every screen's), so content, icons and navigation come from the source pixels, not only its text.

**Boundaries:** without `--live`, anonymous, script-disabled HTML only. Public URLs use the same DNS/robots/request/byte safety limits as reference capture, but no reference-licence model call is needed for the product itself. Default 6 pages, maximum 12; unvisited URLs are reported. Folder exports must use same-folder HTML links and supported CSS/image/font files. No credentials, query routes, signed-in session import, SPA navigation, clicks or form submissions in this slice. Source screenshots are light first-viewports, not full-page or dark captures. Source copy is deliberately supplied to the model as untrusted content; reference copy is not.

Redesign uses a structural writer contract: one small shared-style plan (at most two attempts; CSS up to 20,000 characters, no URLs including data URIs), then **one screen per response**, assembled by the tool into one script-free file. The shared stylesheet is frozen; screens cannot return another screen or a per-screen stylesheet. Native responses are capped at 8192 tokens, not an oversized whole-app reply. Each screen gets at most **three writer attempts**, with actual phone/desktop/light/dark rendering, exact screen count/IDs, mapped navigation, emoji, diagnostic-note and clipped-text checks. For every safe single-screen candidate, a fresh call to **the resolved independent engine/model** also checks that screen against its own source and the frozen shared style, even when layout has findings. The next attempt receives all prior layout/semantic findings together; the third retains both earlier failures. Source-observed secondary captions are not defects merely for repeating their label. The reviewer may not demand other screens or restyle shared CSS. All accepted screen reviews must pass; their results are aggregated, and the final assembly is independently rendered across every screen. Any remaining failure refuses export. For a bounded repair, `--used-screen-attempts 1 --used-plan-attempts 1` leaves only two screen responses and one plan response; these flags cannot raise the caps. Later screens receive the first accepted component example. A discovered page whose title, text and links equal an earlier accepted page is the same state reached twice: the tool reuses that accepted markup under the new screen ID, renders it again and makes no writer response for it, so equivalent entries cannot drift. Source content and controls must be preserved separately on desktop and phone, not reduced to a selected mobile subset; both are served from one compact markup tree (CSS-only viewport differences, icons drawn once as SVG symbols) so a dense screen fits the 8192-token reply cap; a dense screen may arrive in two capped responses (each part at most 9,000 characters, the whole still at most 18,000). Each writer response has a 420-second wall-clock deadline (`RESPONSE_DEADLINE_MS`, a wrapper bound for loaded hosts, reported as `response_deadline_ms`), separate from the token cap. Per-screen reviews add a `content` check for that desktop/phone preservation, and the render check refuses text covered by fixed or sticky navigation in the first viewport. Provider failures stop without blind retries. Attempt JSON under `writer-option-<n>/` is diagnostic, never an accepted design.

Redesign requires distinct light/dark themes even for a dark-first direction. Semantic reviews are bounded at 120 seconds / 8192 reasoning-and-output tokens, omit embedded asset bytes and reject source above 150 KB. This uses the selected model's normal quota, never another account or fallback model. JSON `self_check` reports per-screen attempts, the shared-plan count and response cap as well as the semantic review results.

Semantic checks are model assessments, not visual-reference fidelity certification; they can miss or misjudge defects. Authenticated capture is deferred. Offline sign-off/fleet comparisons may use retained diagnostic pixels only as local `--ref` inputs alongside the four owner quality references; they are not read-only acceptance proof. Rejected hand-built prototypes are not quality targets. A separate visual comparison recipe is documented in the verification feature; its model verdict is not human sign-off.

Deterministic coverage: `node --test test/public-references.test.mjs` (native provider stand-in, real CLI/writer/browser). Nonpaid whole-output recapture: `FD_REDESIGN_SOURCE=<output-folder> done-done run redesign` with default `DONE_DONE_HOME` unset. For explicitly historical diagnostic before frames, set `FD_REDESIGN_BEFORE=<manifest>` as described in the verification feature. The committed journey freshly drives the real viewer, follows declared navigation, saves whole generated viewports next to unchanged retained source viewports, and records exact-head steps/provenance. This does not repeat generation or claim visual acceptance. Cite only captures from that run as `<run-id>/<file>`; keep tests and live-generation commands in the proof line.

## Independent judge and reference cache

```sh
first-draft-axi refs list
first-draft-axi refs pull
# Optional: select a different subscription judge, never an API-key route.
first-draft-axi init --agent byokit:claude --model claude-sonnet-5-5 --judge byokit:codex --judge-model gpt-6.1-sol
# Judge retained output and its retained baseline, without regenerating either:
first-draft-axi judge option.html "A SaaS landing page" --plain option.critic/plain.html
```

`make` keeps each run's plain-prompt baseline in `<name>.critic/plain.html`, named after the `--out` file without the option number: for `notes-1.html` made with `--out notes.html` it is `notes.critic/plain.html`.

**What a judgement covers.** The judge sees each page, the option and its plain-prompt baseline, whole: the full page height at 1280 and 390 px wide in light and dark, in one call. A page taller than 1500 px is cut into tiles of at most 1500 px (so each image is read at full size), at most three tiles per view, so a view is never more than three images and a typical judgement is a few dozen at most; a page taller than about 7500 px is shrunk to 60% and then cut, and the prompt says which tiles were scaled or cut. The prompt labels every image (option or baseline, width, theme, tile and page rows), the review must say per view what it judged (`critique.views`), and its fix can name the Board, the charts, the dark theme or the phone layout. Scores keep the same 1-10 scale and the same plain-prompt control. The capture set that was shown is recorded in the JSON, `critique.capture` (`mode`, `images` and one entry per image), so a score can be audited. `--first-view` (on `make` and `judge`) is the cheap run: light only, the top 800 px at 1280 and 390, four images. A flow brief is still judged on its first screens in light. Capture is local and deterministic: no network.

`refs pull` uses anonymous, robots-respecting GETs with scripts/cookies/interaction disabled. It verifies each admitted source's explicit licence quote and stores PNGs, capture dates, source URLs, hashes and licence basis under `$FIRST_DRAFT_HOME/refs-library` (default `~/.first-draft/refs-library`). The package ships the manifest and judge, **not third-party pixels**. `--kind landing|app|dashboard|notes|docs` restricts a pull; `--library file.json` supplies your own explicitly permitted sources in the shipped manifest's format.

Linear, Stripe, Vercel, Raycast, Arc, Notion, Bear, Things and Craft remain text notes and source links: no explicit capture permission has been established. Supabase is also notes-only because its hosted-site permission is unclear despite the source repository's Apache licence. Licensed landing/docs references and a light dashboard are available; the public login reference is refused by the anonymous capture policy, and notes have no admitted pixels, so app/notes scoring uses the independent judge beside the model-generated baseline and any supplied images, not generator self-assessment. Scripted chart content and interactions are not evidence. The judge uses up to two same-kind references, one complete phone/desktop pair per product (light where available), and reports those sources. A first-viewport model score is not proof of accessibility, factual claims, interactions, or permission to publish a sample.

## Reference

Run `first-draft-axi --help` for all flags. [ENGINE.md](../ENGINE.md) covers the pinned engine and model boundary.

### Make flags

| Flag | Behavior / default |
| --- | --- |
| `--options <n>` / `--count <n>` | Integer 1–5; default 3. Do not combine aliases. |
| `--direction <look>` / `--style <look>` | Named style or free-text direction for every option. Default: different styles for multiple options. Do not combine aliases. |
| Required independent critic | Each option is scored by a different authenticated engine and model beside a plain page; low scores stay flagged without revision. No skip flag or self-assessment fallback. |
| `--first-view` | The critic sees only the top 800 px in light at 1280 and 390 (four images). Default: the whole page in light and dark at both widths, tiled when tall; the capture set is recorded in `critique.capture`. Also on `judge`. |
| `--engine` | Make each option with the multi-turn engine tool loop instead of one page from one call (`--assets` always does). |
| `--hero-video` | With `--assets`, also make one short looping hero video from the still the design puts in its hero (Higgsfield; quoted in the preview, needs `--allow-asset-spend`). Use it beside a free picture provider, e.g. `--assets codex --hero-video`, so the still spends no Higgsfield credits. |
| `--competitors` | Find 3–5 real competitors of the brief (no brand needed) and capture their public pages through the same robots/terms review; the view shows them beside the options with sources, and each refusal with its reason. Refused with `--no-references` and `--like`. Off by default. |
| `--screens <names>` | 1–12 comma-separated screen/page names, each 1–100 characters; asks the model to include each with ids and navigation. Default: infer from brief. |
| `--brief-file <file>` | Append nonempty UTF-8 text, at most 100 KB; positional prompt becomes optional. No URLs or images are fetched. |
| `--model <id>` | This run's model on the configured BYOKit route; does not change saved config. Provider validates availability. |
| `--out <file.html>` | Output file; multiple options add `-1`, `-2`, etc. Every `{i}` is replaced by the option number. |
| `--out-dir <folder>` | Alternative to `--out`; writes `option-1.html`, etc. One output flag is required. |

Empty values, invalid counts, conflicting aliases, and unreadable briefs fail before generation. Screen coverage and style are model instructions, not deterministic guarantees. Output stays responsive at 390px/1280px with light/dark themes (dark-first styles stay dark); no theme, size, numeric seed or variation-strength switches are exposed.

```sh
first-draft-axi make --brief-file brief.md --options 5 \
  --screens "Sign in,Notes" --style editorial --out-dir drafts
```

<details>
<summary><strong>Files, refinement and viewer routes</strong></summary>

`make --options N` accepts 1–5 options (default **3**); `--count` remains an alias. `--out notes.html --options 3` writes `notes-1.html` through `notes-3.html`; `--options 1` writes `notes.html`. Pass the original `notes.html` path to `view`; it finds those numbered options. You can also pass a folder or individual HTML files.

```sh
first-draft-axi refine \
  notes-2.html \
  "Warmer palette" \
  --out notes-warm.html
first-draft-axi view \
  notes-2.html notes-warm.html
```

`refine` uses the configured model and writes a new file. Keep the change short.

With Chrome or Chromium installed, `make` also renders each page at 390px, in light and in dark, and does not accept it until it fits with no sideways scroll and paints differently in dark (a dark-first style such as `oled-neon` must instead paint a dark page in both). `render_check` in the output says `checked` or `skipped`.

The viewer's grid links to each canvas at `#/o/<n>`; add `/both`, `/phone` or `/desktop` to pick the device, `/full` for Fullscreen or `/play` for Play.

</details>

<details>
<summary><strong>Networking, sandboxing and comment pins</strong></summary>

`view` defaults to the machine's tailnet address (`tailscale ip -4`), port 4430. Use `--host` and `--port` to change it; `--host 127.0.0.1` keeps the viewer on this machine. Option frames use the next port, a separate origin.

Generated files carry no scripts and their own content security policy. The viewer adds a sandboxed runtime for screen navigation, but options load and send nothing over the network. Remote assets named by a design are listed as `blocked_remote` and show empty.

Comments live in `notes.comments.json` next to `notes.html`, an array such as `[{"option":1,"device":"phone","x":0.4,"y":0.2,"text":"More space here"}]`. Coordinates are fractions of the frame; `device` (`phone` or `desktop`) is optional, and a comment without it shows on both frames. Comments added in the viewer are appended to this file, which is created if missing; the viewer never rewrites an invalid file, it shows a notice instead. Tap a numbered pin to read it.

</details>

## Develop

```sh
npm install
npm test
```

Tests build and exercise the engine loop against local stand-ins, with no paid model call. A command, default or viewer change updates this README, the agent skill and the screenshots together.

MIT · [License](../LICENSE) · [Notice](../NOTICE): the design engine is [Open CoDesign](https://github.com/OpenCoworkAI/open-codesign), MIT
