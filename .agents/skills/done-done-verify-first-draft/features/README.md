# first-draft features

The repo's maintained verification map; a proof that drives one entry point is incomplete when this lists others.

- [Generated assets inside a draft screen](generated-assets.md): Preview cost, explicitly approve one image, generate and capture real Codex/Higgsfield outputs with `journeys/assets.mjs`
- [The running version](running-version.md): Run `first-draft-axi --version` or `--help`; the Studio's panel foot and More menu, the picker and the landing footer name it
- [Grid of every option](grid-of-every-option.md): Open the view url at #/ (the root)
- [Studio: one option on a phone 390 or desktop 1280 canvas, beside its brief column](canvas-for-one-option-at-phone-390-and-d.md): From the grid, click an option card, or open <url>#/o/1 (#/o/1/phone, #/o/1/desktop)
- [Play: click through the screens of an option](play-click-through-the-screens-of-an-opt.md): From the canvas, press the Play button, or open <url>#/o/1/play
- [Comment pins read from the design's comments file](comment-pins-read-from-the-design-s-comm.md): Put <design>.comments.json next to the design, then open the view for that design
- [View startup output and error codes](view-startup-output-and-error-codes.md): Run the view command in a shell
- [Make a landing page from a README](make-a-landing-page.md): Run make with a prompt that asks for a landing page and carries the README
- [Make option count and brief controls](make-option-controls.md): Installed CLI, live 1/3/5 options, screen coverage, brief input, style, model override and output directory (`journeys/cli-controls.mjs`)
- [Make with a named design style](make-with-a-named-design-style.md): Run `first-draft-axi styles`, then make with `--direction <id>`
- [Make render check at 390 and in dark](make-render-check-390-and-dark.md): Run `first-draft-axi make` with Chrome or Chromium installed
- [Design samples on the README and landing page](sample-provenance.md): `node scripts/check-samples.mjs`; each picture names its run, model, critic score and reviewer, at most 30 days old
- [Authenticated engines are required](ai-engine-required.md): Missing/unauthenticated engines and non-independent judges refuse with one sign-in step, with normal-CLI offline proof and a real model-backed run
- [The critic: every make option scored against real products and a plain page](make-critic.md): Run make with Chrome and an image-capable model, read each file's `critique`; nonpaid `node --test test/critic.test.mjs`
- [Make on the full engine: App.jsx drawn into a static page](make-on-the-full-engine.md): Run `first-draft-axi make` with Chrome or Chromium installed; the output names each file's source, turns and tools
- [Logo mode: concepts with their own palettes, image-first exploration, parallel drawing, a second round from the critic's advice, self-critique, brand sheets and the app icon set](logo-mode.md): Run `first-draft-axi logo "<brief>" --out tea.html`; `test/logo.test.mjs`; `FD_LOGO_SOURCE=<out path> done-done run logo-recapture` (`journeys/logo.mjs`)
