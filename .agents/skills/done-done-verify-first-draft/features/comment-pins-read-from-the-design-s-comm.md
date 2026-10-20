# Comment pins read from the design's comments file

Part of the first-draft verification map. Source: `src/view.mjs`.

## How to get to it (user POV)

Put <design>.comments.json next to the design, then open the view for that design.

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots.

1. Launch the app as SKILL.md says and wait until it is ready.
2. Write a temporary <tmp>/sign-in.comments.json with one entry {option:1,x:0.4,y:0.2,text:"..."}, run first-draft-axi view <tmp>/sign-in.html, then open <url>#/o/1 and click the numbered pin.
3. Capture: screenshot the resulting page to $DONE_DONE_EVIDENCE_ROOT/comment-pins-read-from-the-design-s-comm.png, as SKILL.md's Evidence section says.
4. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
