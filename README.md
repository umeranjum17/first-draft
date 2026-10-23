# <img src="docs/logo.svg" width="32" height="32" alt=""> first-draft

**A CLI that turns one prompt into several HTML design options.**

For developers and coding agents: pick a design **before writing app code**.

[![First Draft's viewer showing one generated notes-app option at desktop width, with the Desktop and Phone switch, Fullscreen and Play](docs/media/hero.webp)](https://umeranjum17.github.io/first-draft/)

### Start in three steps

Node **22.18+** and your own model subscription or API key. Three steps:

1. `npm install -g first-draft-axi`
2. `first-draft-axi init --agent byokit:codex --model YOUR_MODEL`
3. `first-draft-axi make "A notes app" --out notes.html && first-draft-axi view notes.html`

Replace `YOUR_MODEL` with a model your installed, signed-in Codex CLI supports. [Other routes ↓](#models) · Open the URL that `view` prints. Stop it with Ctrl+C.

[Landing page](https://umeranjum17.github.io/first-draft/) · [Vision](VISION.md) · [Agent skill](skills/first-draft-axi/SKILL.md), to hand the CLI to your coding agent · [CLI reference ↓](#reference)

## Choose a direction, not just a screenshot

- **Make options.** Add `--count 3` to the `make` command to get three directions. Each is a self-contained HTML file, not app code, and with no `--direction` each takes a different named style (`first-draft-axi styles` lists them).
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
| Installed, signed-in Codex CLI | `byokit:codex` |
| A plan key, such as Z.ai | `byokit:zai:plan_key` |
| An API key, such as MiniMax | `byokit:minimax:key` |

Run `first-draft-axi init` with no flags to list ready routes. Set your route with `init --agent … --model …`, then run `first-draft-axi doctor` to check readiness **without a paid call**. MiniMax defaults to `MiniMax-M3.1-Flash-Preview` if `init` gets no `--model`.

Subscription calls use your CLI's normal login without copying it. Key routes read the environment variable named by `doctor`; keys are never saved in First Draft's config. Config lives at `$FIRST_DRAFT_HOME/config.json`, default `~/.first-draft/config.json`.

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

## Reference

Run `first-draft-axi --help` for all flags. [ENGINE.md](ENGINE.md) covers the pinned engine and model boundary.

<details>
<summary><strong>Files, refinement and viewer routes</strong></summary>

`make --count N` accepts 1–5 options. `--out notes.html --count 3` writes `notes-1.html` through `notes-3.html`. Pass the original `notes.html` path to `view`; it finds those numbered options. You can also pass a folder or individual HTML files.

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
