# Play: click through the screens of an option

Part of the first-draft verification map. Source: `src/view.mjs`.

## How to get to it (user POV)

From the canvas, press the Play button, or open <url>#/o/1/play.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots.

1. Launch the app as SKILL.md says and wait until it is ready.
2. Browser: open `<url>?screen=<id>#/o/1/play/phone`, then the same URL ending `/desktop`: the chosen screen must be active on both devices. For manual use, the screen chips and Back update the selected screen; its query is kept when switching device. The frame receives `?play&screen=<id>` and the host seeds the existing overlay's active-screen attribute. No new sandbox permission.
   Deterministic coverage: `node --test test/view.test.mjs` drives the actual view in Chrome, including both device routes and escaped/invalid screen query handling. `node --test test/post.test.mjs` drives the real post/view bridge with a private board and native sign-off edge fixture: both Desktop/Phone URLs must appear in returned options and fallback text, including Evidence cards; no owner board touched.
3. Capture: screenshot the resulting page to $DONE_DONE_EVIDENCE_ROOT/play-click-through-the-screens-of-an-opt.png, as SKILL.md's Evidence section says.
4. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
