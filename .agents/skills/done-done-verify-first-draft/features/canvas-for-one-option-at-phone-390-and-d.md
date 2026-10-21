# Studio: one option on a phone 390 or desktop 1280 canvas, beside its brief column

Part of the first-draft verification map. Source: `src/view/app.js` (`canvas`, `brief`), `src/view/canvas.js` (`deviceFor`, `fitDevice`), `src/view/view.css` (Studio).

## How to get to it (user POV)

From the grid, click an option card, or open <url>#/o/1. The viewport switch opens <url>#/o/1/phone and <url>#/o/1/desktop.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots, with prefers-color-scheme set to light and to dark.

1. Launch the app as SKILL.md says, with a `<design>.comments.json` next to the design so the column lists comments, and wait until it is ready.
2. Browser at 1280 wide: open <url>#/o/1. Check the column on the left (design name, option list, the open option's comments, the Next brief composer) and the dotted canvas on the right showing one device, with the size and zoom above it.
3. Press Phone, then Desktop: only that device shows, the route changes to #/o/1/phone or #/o/1/desktop, and Play links to #/o/1/play/<device>.
4. Click a comment in the column: its numbered pin opens on the canvas. Click another option in the list: the canvas switches and keeps the device.
5. Type a change in Next brief and press Get command: the composer shows `first-draft-axi refine <option file> '<change>' --out <option>-refined.html` with Copy. The view itself calls no model.
6. Browser at 390 wide: open <url>#/o/1. The canvas comes first and shows the phone mock (never a desktop pane under it), the option picker is a select above the switch, the column follows below, and the brief is docked at the bottom of the screen.
7. Capture: screenshot each state at 390 and 1280, light and dark, to $DONE_DONE_EVIDENCE_ROOT/, as SKILL.md's Evidence section says.
8. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
