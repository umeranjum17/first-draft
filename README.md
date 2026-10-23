# <img src="docs/logo.svg" width="32" height="32" alt=""> first-draft

**A CLI that turns one prompt into several HTML design options.**

For developers and coding agents: pick a design **before writing app code**.

[![First Draft's viewer showing one generated notes-app option at desktop width, with the Desktop and Phone switch, Fullscreen and Play](docs/media/hero.webp)](https://umeranjum17.github.io/first-draft/)

### Start in three steps

Node **22.18+** and your own AI subscription. A subscription needs no API key. Three steps:

1. `npm install -g first-draft-axi`
2. `first-draft-axi init --agent byokit:claude --model <model>`
3. `first-draft-axi make "A notes app" --out notes.html && first-draft-axi view notes.html`

Step 2 uses your Claude subscription (Pro or Max) through your installed, signed-in Claude CLI. Replace `<model>` with a Claude model it supports. Open the URL that `view` prints. Stop it with Ctrl+C.

On a ChatGPT subscription, use your installed, signed-in Codex CLI instead: `first-draft-axi init --agent byokit:codex --model <model>`. Not sure which is ready? Run `first-draft-axi doctor`: it lists each ready subscription with its exact `init` line, with no paid call. [Other routes ↓](#models)

[Landing page](https://umeranjum17.github.io/first-draft/) · [Vision](VISION.md) · [Agent skill](skills/first-draft-axi/SKILL.md), to hand the CLI to your coding agent · [CLI reference ↓](#reference)

## Choose a direction, not just a screenshot

- **Make options.** `make` generates three directions by default; use `--options 1` for one or `--options 5` for five. Each is a self-contained HTML file, not app code, and with no `--direction` each takes a different named style (`first-draft-axi styles` lists them).
- **Open one on the canvas.** Studio shows one option at desktop (1280px) and phone (390px) side by side, each with its own Play, beside its options, comments and a brief for your next change. Desktop or Phone shows one device; a phone-width window shows the phone.
- **Comment on it.** Press Comment (in the ⋯ menu on a phone) and tap the spot you mean: your comment is saved next to the design and shows as a numbered pin beside the frame.
- **Look closer.** Fullscreen gives the option the whole window; Play is one tap away.
- **Refine the one you like.** A follow-up prompt writes a new option; your original stays untouched.

![First Draft's grid of three notes-app options from one prompt, each in a different style](docs/media/grid.webp)

<img src="docs/media/canvas-390.webp" width="200" alt="The viewer in a 390px-wide window: the option on a phone canvas">

The screenshots come from one real run of `first-draft-axi make "A notes app for Umer with a sign-in screen and a notes dashboard" --count 3` (first-draft-axi 0.2.4, no `--direction`, so each option took a different named style), with no editing. Options 2 and 3 hit the engine's turn cap, and `make` said so: they hold the screens written so far. The large screenshot at the top is option 1. Generating needs your chosen model; viewing does not call it. These are prototypes, not production apps.

## Works alone, or with sign-off

First Draft needs nothing else: `make`, `view` and `refine` work on their own, and comments from people show as read-only pins on the canvas ([comment pins ↓](#reference)).

To get someone's pick, hand the options to [sign-off](https://github.com/umeranjum17/sign-off), a sibling review board. The board shows the options side by side; each one links into first-draft for the detail:

```sh
first-draft-axi post notes.html \
  --title "Which notes app?" \
  --recommend a
```

`post` copies the options into the board, starts `view` if it is not running, and posts one card with an **Open** link under each option. The link opens that option in Play in the viewer, and the card text repeats each one as "Open in first-draft". It needs `sign-off-axi` 0.5.0+ and a `.sign-off/` board in this folder or above (or `--board`). Links point at the viewer on its tailnet address, or at `--host`. Name options with `--option a=<label>`; demos that ask for no pick use `--evidence --media <shot>` instead of `--recommend`.

## Models

Every generation goes through [BYOKit](https://www.npmjs.com/package/@byokit/accounts), using the route and model **you** choose. First Draft never silently changes accounts or models.

| Use what you have | Route for `init --agent` |
| --- | --- |
| Claude subscription (Pro or Max), in the installed, signed-in Claude CLI | `byokit:claude` |
| ChatGPT subscription, in the installed, signed-in Codex CLI | `byokit:codex` |
| A plan key, such as Z.ai | `byokit:zai:plan_key` |
| An API key, such as MiniMax | `byokit:minimax:key` |

Subscriptions come first. They need no key: calls use your CLI's normal login without copying it. Claude models run only through the Claude subscription; any other route refuses them and points you to `byokit:claude`. Plan key and API key routes are still there for other providers.

Run `first-draft-axi doctor` or `first-draft-axi init` with no flags to see your ready subscriptions, each with its exact `init` line. Set your route with `init --agent … --model …`, then run `first-draft-axi doctor` to check readiness **without a paid call**. MiniMax defaults to `MiniMax-M3.1-Flash-Preview` if `init` gets no `--model`.

Key routes read the environment variable named by `doctor`; keys are never saved in First Draft's config. Config lives at `$FIRST_DRAFT_HOME/config.json`, default `~/.first-draft/config.json`.

## Generated assets

Opt-in pictures, illustrations, icons, hero visuals and backgrounds are placed **inside the draft screens**, not on a separate asset sheet. One image per option is the current ceiling. No asset calls happen by default (`--no-assets` makes that explicit).

```sh
first-draft-axi assets  # detect installed, signed-in providers; no generation
first-draft-axi make "Umer's botanical shop with a leaf illustration" --out shop.html --assets higgsfield
# Read the cost preview, then explicitly approve asset spending:
first-draft-axi make "Umer's botanical shop with a leaf illustration" --out shop.html --assets higgsfield --allow-asset-spend
```

`--assets codex|higgsfield|auto` alone previews the total asset cost for `--count` and exits **before any design or image generation**. `auto` selects only when exactly one provider is ready; otherwise choose explicitly. With `--allow-asset-spend`, the preview is printed to stderr before generation. Design-model charges are separate and unchanged. Asset generation is refused in CI even with approval; tests use stand-ins only.

- **Codex:** installed CLI with `codex login` (ChatGPT subscription), launched with its BYOKit installed-account path, never copied credentials. Uses native `image_generation` through `codex exec`, GPT-6 Luna, low effort, one small square image requested at lowest quality; shell tools are disabled. CLI/image-tool availability depends on the installed version and account. When the native tool saves into its own image cache, the adapter imports only the single PNG under this invocation's thread ID; it never follows a model-suggested file path or reads login files. **Codex end-to-end image-screen proof is currently missing**: the live attempt reported generating into that cache but could not copy into its workspace; the import correction has stubbed CLI coverage, not a further paid live trial. Codex provides **no price API**: the preview says unknown subscription quota/overage, never “free”. Approval explicitly accepts that uncertainty; exact image dimensions/quality are controlled by Codex's native tool.
- **Higgsfield:** installed CLI with `higgsfield auth login`; uses Z Image, one square image, with the provider's live credit estimate. Your existing account pays; no keys are stored by First Draft. If a mise shim reports no runtime, run `mise exec node@26.1.0 -- first-draft-axi …` with your installed Node version.
- **Optimization:** requires ImageMagick 7 (`magick`) on PATH, checked before spending. Each image is stripped of metadata, resized to at most 1024×1024 and encoded as WebP at quality 80 (800 KB maximum). Files live beside the output in `<name>.assets-*/image.webp`; HTML embeds them as data URIs, so viewing, copying and posting remain offline. `refine` keeps embedded images but does not generate new ones.

The adapter contract is `detect()`, `estimate({prompt}) → {amount,unit,detail}`, and `generate({prompt,dir}) → local raster path` in `src/assets.mjs`. New providers use that same boundary; the host handles approval, image budget, optimization and embedding. No account switching or generation retries. A failed design can leave a paid asset on disk; the error is reported, not silently retried.

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

## Redesign an existing product (first slice)

```sh
first-draft-axi redesign https://example.com/ "Make the workflow clearer" \
  --ref inspiration.png --out redesigned --max-pages 6
first-draft-axi redesign ./html-export "Make the workflow clearer" --out redesigned
first-draft-axi view redesigned
```

Starts at the URL (or a folder's `index.html`), follows same-origin anchor links, and records visible text, mapped navigation, pending URLs and phone/desktop source captures under `redesigned/sources/`. One coherent option contains all discovered screens at 390 and 1280; `--options 1-5`, `--model`, `--ref` and `--like` reuse make's controls. `--screens` is not accepted: screens come from discovery. Output must be outside a source folder.

**Boundaries:** anonymous, script-disabled HTML only. Public URLs use the same DNS/robots/request/byte safety limits as reference capture, but no reference-licence model call is needed for the product itself. Default 6 pages, maximum 12; unvisited URLs are reported. Folder exports must use same-folder HTML links and supported CSS/image/font files. No credentials, query routes, signed-in session import, SPA navigation, clicks or form submissions in this slice. Source screenshots are light first-viewports, not full-page or dark captures. Source copy is deliberately supplied to the model as untrusted content; reference copy is not.

Redesign uses a structural writer contract: one small shared-style plan, then **one screen per response**, assembled by the tool into one script-free file. The shared stylesheet is frozen; screens cannot return another screen or a per-screen stylesheet. Native responses are capped at 8192 tokens, not an oversized whole-app reply. Each screen gets at most **two writer attempts**, with actual phone/desktop/light/dark rendering, exact screen count/IDs, mapped navigation, emoji, diagnostic-note and clipped-text checks. A fresh call to **the same configured route/model** checks metrics and tokens after each valid candidate. Feedback repairs only that screen. The final assembly is checked again across all screens; any remaining failure refuses export. Provider failures stop without blind retries. Attempt JSON under `writer-option-<n>/` is diagnostic, never an accepted design.

Redesign requires distinct light/dark themes even for a dark-first direction. Semantic reviews are bounded at 120 seconds / 8192 reasoning-and-output tokens, omit embedded asset bytes and reject source above 150 KB. This uses the selected model's normal quota, never another account or fallback model. JSON `self_check` reports per-screen attempts, the shared-plan count and response cap as well as the semantic review results.

Semantic checks are model assessments, not visual-reference fidelity certification; they can miss or misjudge defects. Authenticated capture is deferred. Offline sign-off/fleet comparisons may use retained diagnostic pixels only as local `--ref` inputs alongside the four owner quality references; they are not read-only acceptance proof. Rejected hand-built prototypes are not quality targets. A separate visual comparison recipe is documented in the verification feature; its model verdict is not human sign-off.

Deterministic coverage: `node --test test/public-references.test.mjs` (native provider stand-in, real CLI/writer/browser). Nonpaid whole-output recapture: `FD_REDESIGN_SOURCE=<output-folder> done-done run redesign` with default `DONE_DONE_HOME` unset. For explicitly historical diagnostic before frames, set `FD_REDESIGN_BEFORE=<manifest>` as described in the verification feature. The committed journey freshly drives the real viewer, follows declared navigation, saves whole generated viewports next to unchanged retained source viewports, and records exact-head steps/provenance. This does not repeat generation or claim visual acceptance. Cite only captures from that run as `<run-id>/<file>`; keep tests and live-generation commands in the proof line.

## Reference

Run `first-draft-axi --help` for all flags. [ENGINE.md](ENGINE.md) covers the pinned engine and model boundary.

### Make flags

| Flag | Behavior / default |
| --- | --- |
| `--options <n>` / `--count <n>` | Integer 1–5; default 3. Do not combine aliases. |
| `--direction <look>` / `--style <look>` | Named style or free-text direction for every option. Default: different styles for multiple options. Do not combine aliases. |
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

MIT · [License](LICENSE) · [Notice](NOTICE): the design engine is [Open CoDesign](https://github.com/OpenCoworkAI/open-codesign), MIT
