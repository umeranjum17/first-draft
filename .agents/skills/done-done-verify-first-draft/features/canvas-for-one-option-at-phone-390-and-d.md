# Studio: one option on a phone 390 or desktop 1280 canvas, beside its brief column

Part of the first-draft verification map. Source: `src/view/app.js` (`canvas`, `brief`, `send`), `src/view.mjs` (the `/refine` route), `src/cli.mjs` (`refineHtml`), `src/view/canvas.js` (`deviceFor`, `fitDevice`), `src/view/view.css` (Studio).

## How to get to it (user POV)

From the grid, click an option card, or open <url>#/o/1. The viewport switch opens <url>#/o/1/phone and <url>#/o/1/desktop.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots, with prefers-color-scheme set to light and to dark.

1. Launch the app as SKILL.md says, with a `<design>.comments.json` next to the design so the column lists comments, and wait until it is ready.
2. Browser at 1280 wide: open <url>#/o/1. Check the column on the left (design name, option list, the open option's comments, the Next brief composer) and the dotted canvas on the right showing one device, with the size and zoom above it. Press Hide brief in the top bar: the column and the composer fold away, the canvas takes the full width and the button reads Show brief; the column stays folded across Phone/Desktop until Show brief brings it back. Under 860px there is no Hide brief button.
3. Press Phone, then Desktop: only that device shows, the route changes to #/o/1/phone or #/o/1/desktop, and Play links to #/o/1/play/<device>.
4. Click a comment in the column: its numbered pin opens on the canvas. Click another option in the list: the canvas switches and keeps the device.
5. Next brief, send: with an agent set (`init --agent byokit:<route> --model <model>`; the proof's agent is a provider stand-in at the model edge via `FIRST_DRAFT_TEST_BYOKIT_BASE`, so no paid call), type a change and press Send. The box shows a spinner and "Making a new option from Option 1" with the seconds so far, Send reads "Working…"; when it ends the new option (`<option>-refined.html`, beside the original) is in the Options list and the picker, and the canvas switches to it with "Option 2 is Option 1 with this change: ..." in the box. With no agent set, Send shows the set-up hint (`first-draft-axi init --agent byokit:<route> ...`) in red in the box and makes no model call. "Copy terminal command" stays a small link under the text: it shows the `first-draft-axi refine ...` command with Copy.
6. Browser at 390 wide: open <url>#/o/1. The canvas comes first and shows the phone mock (never a desktop pane under it), the option picker is a select above the switch, the column follows below, and the brief is docked at the bottom of the screen.
7. Scripted: `node journeys/studio.mjs <evidence folder>` (or `done-done run` with the `studio` journey in `.done-done.yaml`) runs steps 2-6 on a two-option design made from `journeys/fixtures/notes.html` at 1280 and 390, light and dark, in headless Chromium with no agent set and no model call, and saves one capture per claim and theme to the evidence folder: `hide-brief-1280-{light,dark}.png` (the 1280 Studio before and after Hide brief, side by side) and `studio-390-{light,dark}.png` (the design preview in a phone frame and Send on screen), plus `studio-states.json` (each state's measured width, theme, column and composer); the single 1280 states, Send and Play captures go to `$FD_EXTRA_OUT` when set. It ends with `PASS:` or fails on the first broken step.
8. Capture: screenshot each state at 390 and 1280, light and dark, to $DONE_DONE_EVIDENCE_ROOT/, as SKILL.md's Evidence section says.
9. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
