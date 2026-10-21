# Play: click through the screens of an option

Part of the first-draft verification map. Source: `src/view.mjs`.

## How to get to it (user POV)

From the canvas, press the Play button, or open <url>#/o/1/play.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots.

1. Launch the app as SKILL.md says and wait until it is ready.
2. Browser: open <url>#/o/1/play, then click the screen chips and the Back button; the option is served from the frame origin with ?play.
3. Capture: screenshot the resulting page to $DONE_DONE_EVIDENCE_ROOT/play-click-through-the-screens-of-an-opt.png, as SKILL.md's Evidence section says.
4. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
