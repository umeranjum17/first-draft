---
name: "done-done-verify-first-draft"
description: "Drive the first-draft CLI (first-draft-axi) that starts a local web view server; the view is a browser UI for designs, options, canvas, Play and comment pins the way a user does and capture proof it works. Use when proving a first-draft change, capturing evidence, or keeping the feature map honest."
---

# done-done-verify-first-draft

Written by `done-done init` through claude from this repo's own files (surface: CLI (first-draft-axi) that starts a local web view server; the view is a browser UI for designs, options, canvas, Play and comment pins). The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.

## Launch

The suite builds and drives the real CLI/engine/native browser using local provider-edge stand-ins, with no paid model calls. Run npm ci and the launch below with caller-owned HOME/XDG and a short real TMPDIR (e.g. a mktemp root under `/var/tmp/fd.XXXXXX`) outside any existing sign-off board ancestor: a shared /tmp/.sign-off can invalidate the no-board test. Use real Node/npm executables from the Node 22.18+ toolchain, not a shim whose trust/config depends on the replaced HOME. Individual journeys create their own config/files and clean them up. For a live view use a task-owned draft and FIRST_DRAFT_HOME, 127.0.0.1 and a private port. Never read/copy owner credentials or touch an owner board.

npm test

From `package.json`.

Ready: The view command prints one JSON line with viewing.url (its default port is 4430 or $FIRST_DRAFT_VIEW_PORT), and GET on that url returns 200 with the design JSON block. For the test path, the process exits 0. Tear down what you started; never kill by process name.
Isolation: Each run uses its own temporary folder holding a copy of the design HTML and any comments.json. It binds 127.0.0.1 with FIRST_DRAFT_VIEW_HOST and a unique FIRST_DRAFT_VIEW_PORT, so it does not share a port with the owner's view. FIRST_DRAFT_HOME points at a temporary folder so the owner's config.json is never read or written. Never run post here (it uses the sign-off board). Live make/refine calls require the brief's spending approval. Claude models use only the installed signed-in Claude subscription through BYOKit with normal HOME and task-private FIRST_DRAFT_HOME, never key copies. Nonpaid view/render proof can use an unmodified retained draft; state explicitly that generation was not repeated.
When the repo's .done-done.yaml has an instance block, done-done already runs the app at $DONE_DONE_BASE_URL (its own port and HOME): BASE is then that URL, never a hard-coded port.

## Drive

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots. Drive through the repo's real handles that each feature file names:

- [Redesign linked HTML products](features/redesign.md): Drive bounded same-origin discovery or a local HTML export through the real CLI; inspect retained text/flow inventory and same-model semantic self-check reports; capture whole source/redesign pairs in an exact-head default-home run with `FD_REDESIGN_SOURCE=<output> done-done run redesign` (`src/redesign.mjs`, `src/redesign-writer.mjs`, `src/redesign-check.mjs`, `journeys/redesign.mjs`, `journeys/redesign-reference-check.mjs`, `test/public-references.test.mjs`). Authenticated sign-off/fleet and reference fidelity remain unproven; semantic checks are model assessments.
- [Generated assets the design agent chooses](features/generated-assets.md): Preview cost then, with explicit spending approval, run the paid `assets` journey with `FD_DESIGN_AGENT`/`FD_DESIGN_MODEL` set; the agent picks images and providers (`images` in make JSON); capture each image-bearing screen in the viewer at 390/1280 light/dark, nonpaid via `FD_ASSET_SOURCE=<output> done-done run assets-recapture` (`src/assets.mjs`, `src/make.mjs`, `journeys/assets.mjs`)
- [Grid of every option](features/grid-of-every-option.md): Open the view url at #/ (the root) (`src/view/app.js`)
- [Studio: one option with desktop 1280 and phone 390 side by side (or one device), beside its brief panel](features/canvas-for-one-option-at-phone-390-and-d.md): From the grid, click an option card, or open <url>#/o/1; whole-frame proof at 390/1280 light/dark via `done-done run studio`, on a real run's design with `FD_STUDIO_SOURCE=<folder>` (`src/view/app.js`, `src/view/view.css`, `journeys/studio.mjs`)
- [Play: screens on both devices](features/play-click-through-the-screens-of-an-opt.md): Open <url>?screen=<id>#/o/1/play/phone or /desktop; screen selection persists across device changes; post returns both links (`src/view.mjs`, `src/post.mjs`)
- [Comment pins: read from and added to the design's comments file](features/comment-pins-read-from-the-design-s-comm.md): Put <design>.comments.json next to the design and open the view, or press Comment on the canvas and tap a spot (`src/view.mjs`, `src/view/app.js`)
- [View startup output and error codes](features/view-startup-output-and-error-codes.md): Run the view command in a shell (`src/cli.mjs`)
- [Make a landing page from a README](features/make-a-landing-page.md): Run make with a prompt that asks for a landing page and carries the README (`src/make.mjs`)
- [Make option count and brief controls](features/make-option-controls.md): Run the installed CLI with `--options 1`, `3`, `5`, then default count; combine `--screens`, `--brief-file`, `--model`, `--style` and `--out-dir`; check files and errors (`src/cli.mjs`, `src/make.mjs`)
- [Make with a named design style](features/make-with-a-named-design-style.md): Run `first-draft-axi styles`, then make with `--direction <id>` (`src/styles.mjs`)
- [Every screen at phone 390 and desktop 1280, light/dark](features/make-render-check-390-and-dark.md): Drive the real CLI render/repair journey; each screen is checked independently in all four cells (`src/render-check.mjs`, `test/render-check.test.mjs`)
- [Named-reference capture and source-linked viewer](features/reference-discovery.md): Drive named-brand make through policy-checked phone/desktop capture, project cache, native image/visual brief input, refinement and viewer references; sealed whole-viewer proof at 390/1280 light/dark via `FD_REFERENCE_SOURCE=<real-output> done-done run references` (`src/reference-capture.mjs`, `test/public-references.test.mjs`, `journeys/references.mjs`)
- [Installed Claude subscription route](features/installed-claude.md): Run init/doctor/make/refine with `byokit:claude`; doctor spends nothing and API-key sign-ins are refused (`src/byokit.mjs`, `test/claude.test.mjs`)
- [Make on the full engine: App.jsx drawn into a static page](features/make-on-the-full-engine.md): Run `first-draft-axi make` with Chrome or Chromium installed; read each file's `source`, `turns` and `tools` (`src/make.mjs`)

## Evidence

What to capture: Stdout JSON from view (viewing.url, options), HTTP status of the url, screenshots of the grid, canvas and Play pages, and the exit code and tail of npm test output. Exercise the real user path, not internal setters; done-done's judge checks every capture in the run folder against the outcome, so save only captures of the resulting state there and keep any of earlier steps outside it; verify side effects alongside what is visible. Evidence goes to the run folder `done-done run` prints.

## Cleanup

Stop the instances this run started and remove scratch state. Evidence survives cleanup: never delete the run folder.
