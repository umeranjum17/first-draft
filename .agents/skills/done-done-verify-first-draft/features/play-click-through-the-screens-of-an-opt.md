# Play: click through the screens of an option

Part of the first-draft verification map. Source: `src/view.mjs`.

## How to get to it (user POV)

From the canvas, press the Play button, or open <url>#/o/1/play.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots.

1. Launch the app as SKILL.md says and wait until it is ready.
2. Browser: open `<url>?screen=<id>#/o/1/play/phone`, then the same URL ending `/desktop`: the chosen screen must be active on both devices. For manual use, the screens (a segmented control in the one Play bar, beside Back) and Back update the selected screen; its query is kept when switching device. The frame receives `?play&screen=<id>` and the host seeds the existing overlay's active-screen attribute. No new sandbox permission.
   The retained suite checks that option pages render from the sandboxed second origin (`test/view.test.mjs`) and that `post` returns Play links (`test/post.test.mjs`). Detailed device-route, query-escaping, and Evidence-card checks are not in the retained suite; use the live Studio journey for those.
3. Capture: screenshot the resulting page to $DONE_DONE_EVIDENCE_ROOT/play-click-through-the-screens-of-an-opt.png, as SKILL.md's Evidence section says.
4. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
