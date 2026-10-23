# Comment pins: read from and added to the design's comments file

Part of the first-draft verification map. Source: `src/view.mjs` (`readPins`, `addComment`, the `/comments` route), `src/view/app.js` (`pinLayer`, `commentBox`, comment mode in `canvas`), `src/view/canvas.js` (`commentBubblePosition`).

## How to get to it (user POV)

Put <design>.comments.json next to the design, then open the view for that design. To add one: on the canvas press Comment (at 390: More, then Add comment) and tap the spot on a frame.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots.

1. Launch the app as SKILL.md says and wait until it is ready.
2. Write a temporary <tmp>/sign-in.comments.json with one entry {option:1,x:0.4,y:0.2,text:"..."}, run first-draft-axi view <tmp>/sign-in.html, then open <url>#/o/1 and click the numbered pin. Pins sit in the margin beside the frame (left or right, whichever is nearer), level with their point and joined to the frame's edge by a short line, so none covers the page text; a pin's comment opens in the half of the frame away from its point. Check it at 390 and 1280 with a comment on the headline.
3. Add a comment: press Comment (390: More > Add comment); a pill at the top of the canvas says to tap a spot (at 390 it takes its own row and the phone fits below it, never under the pill) and each frame's screen shows a dashed edge. Tap a point on the phone: a yellow mark shows the point and the comment box opens below it (above it near the bottom), never over it. Type and press Save (or Cmd/Ctrl+Enter; Escape or Cancel closes the box, Done or Escape leaves comment mode). The comment is appended to <tmp>/sign-in.comments.json as { option, device, x, y, text } (the file is made if missing; an invalid file is never rewritten and the box shows why), the new numbered pin opens in the margin beside that device's frame, and the column lists it with its device. On Both, a comment with a device shows on that frame only; one without a device shows on both. `node journeys/studio.mjs` drives this at 1280 and 390, light and dark (`add-comment-1280-{light,dark}.png`, `add-comment-390.png`).
4. Capture: screenshot the resulting page to $DONE_DONE_EVIDENCE_ROOT/comment-pins-read-from-the-design-s-comm.png, as SKILL.md's Evidence section says.
5. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
