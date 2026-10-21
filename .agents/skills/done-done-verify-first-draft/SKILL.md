---
name: "done-done-verify-first-draft"
description: "Drive the first-draft CLI (first-draft-axi) that starts a local web view server; the view is a browser UI for designs, options, canvas, Play and comment pins the way a user does and capture proof it works. Use when proving a first-draft change, capturing evidence, or keeping the feature map honest."
---

# done-done-verify-first-draft

Written by `done-done init` through claude from this repo's own files (surface: CLI (first-draft-axi) that starts a local web view server; the view is a browser UI for designs, options, canvas, Play and comment pins). The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.

## Launch

Not isolated: package.json's test script runs build and the whole node --test suite, which the README says runs the engine loop against local stand-ins with no paid call. I did not verify that the suite isolates its state (test/make.test.mjs and test/view.test.mjs were not readable here), so this is not marked safe. For a live view, start src/cli.mjs view on a design file you create in a temporary folder; that path would be safe with FIRST_DRAFT_VIEW_HOST=127.0.0.1 and a temporary FIRST_DRAFT_HOME, but no repo script runs it that way. The launch below is not shown to use a stub or demo engine with its own state, so it may use real accounts or the owner's own state. The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.

npm test

From `package.json`.

Ready: The view command prints one JSON line with viewing.url (its default port is 4430 or $FIRST_DRAFT_VIEW_PORT), and GET on that url returns 200 with the design JSON block. For the test path, the process exits 0. Tear down what you started; never kill by process name.
Isolation: Each run uses its own temporary folder holding a copy of the design HTML and any comments.json. It binds 127.0.0.1 with FIRST_DRAFT_VIEW_HOST and a unique FIRST_DRAFT_VIEW_PORT, so it does not share a port with the owner's view. FIRST_DRAFT_HOME points at a temporary folder so the owner's config.json is never read or written. Never run make or post here: those call a model or the sign-off board.
When the repo's .done-done.yaml has an instance block, done-done already runs the app at $DONE_DONE_BASE_URL (its own port and HOME): BASE is then that URL, never a hard-coded port.

## Drive

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots. Drive through the repo's real handles that each feature file names:

- [Grid of every option](features/grid-of-every-option.md): Open the view url at #/ (the root) (`src/view/app.js`)
- [Studio: one option on a phone 390 or desktop 1280 canvas, beside its brief column](features/canvas-for-one-option-at-phone-390-and-d.md): From the grid, click an option card, or open <url>#/o/1 (`src/view/app.js`)
- [Play: click through the screens of an option](features/play-click-through-the-screens-of-an-opt.md): From the canvas, press the Play button, or open <url>#/o/1/play (`src/view.mjs`)
- [Comment pins read from the design's comments file](features/comment-pins-read-from-the-design-s-comm.md): Put <design>.comments.json next to the design, then open the view for that design (`src/view.mjs`)
- [View startup output and error codes](features/view-startup-output-and-error-codes.md): Run the view command in a shell (`src/cli.mjs`)
- [Make a landing page from a README](features/make-a-landing-page.md): Run make with a prompt that asks for a landing page and carries the README (`src/make.mjs`)

## Evidence

What to capture: Stdout JSON from view (viewing.url, options), HTTP status of the url, screenshots of the grid, canvas and Play pages, and the exit code and tail of npm test output. Exercise the real user path, not internal setters; done-done's judge checks every capture in the run folder against the outcome, so save only captures of the resulting state there and keep any of earlier steps outside it; verify side effects alongside what is visible. Evidence goes to the run folder `done-done run` prints.

## Cleanup

Stop the instances this run started and remove scratch state. Evidence survives cleanup: never delete the run folder.
