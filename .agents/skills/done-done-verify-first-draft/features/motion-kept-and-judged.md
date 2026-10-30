# Motion kept and judged: an animated option keeps its code, plays, and is scored on its frames

Sources: `src/make.mjs` (`staticExport` with `script`, the live policy, the DRAWN/STATIC contracts), `src/draft.mjs` (`script-kept-inline`, `script-inline-only`, `motion-for-real`), `src/render-check.mjs` (`motion()`, `MOTION_AT`), `src/motion.mjs`, `src/critic.mjs` (`MOTION_VERDICT`, `MOTION_SIDE`), `src/polish.mjs`, `src/cli.mjs` (`make`, `judge`, `polish`), `src/view.mjs` (`/motion/<n>/<frame>`), `src/view/app.js` (the Studio Motion panel), `journeys/motion.mjs`.

## User outcome

An option made from a brief that asks for motion (a typing terminal, a pulse, a marquee) keeps its inline script and CSS animation, and plays in the Studio and in Play inside the option's sandboxed frame origin (`sandbox allow-scripts`, `connect-src 'none'`), loading nothing from the network. Its motion is captured as a frame series, 4 frames at 390 and 4 at 1280 (0.4, 1.4, 2.6 and 4.2 s after load, around the first moving element), and the independent judge returns a motion verdict `critique.motion = { present, score, reason, defects }` from those frames. A page that does not move gets `score: null` (with a defect when the brief asked for motion); a decorative loop is a defect. `polish` keeps the motion: each round has its own frames, and a round that stops moving is not accepted. A script loaded from a URL is still refused, or drawn once and dropped.

## Handles it drives

- `first-draft-axi make "<brief asking for motion>" --out <file.html>`: the option html keeps its `<script>` under a CSP with `script-src 'unsafe-inline'` and `default-src 'none'`; the make JSON has `files[].motion` (`moves`, `frames`, `dir`) and `files[].critique.motion`.
- `render-check` `motion(html)`: the frame series and what moved (`widths[].animations`, `scripted`, `infinite`, `looping`).
- `first-draft-axi judge <option.html> "<brief>" --plain <baseline.html>`: the same verdict on a retained page, frames written beside it.
- `first-draft-axi polish <option.html> "<brief>" --out-dir <dir> --feedback "<one sentence>"`: `round-N.motion/` per round, `critique.motion` in each `round-N.json`.
- The Studio Motion panel (`first-draft-axi view <option.html>`, `#/o/<n>`): the verdict, its defects and both frame rows, under the canvas at phone width.
- Nonpaid journey: `done-done run motion` (`journeys/motion.mjs`, local model and judge stand-ins).

## Evidence kind

`motion.json` plus the JPEG frame series `motion-<width>-<n>.jpg` under `<option>.motion/` (and `round-N.motion/` for polish), with the make, judge or polish JSON that carries `critique.motion`. Live runs add browser screenshots of the Studio while the option plays. Stand-in scores prove the protocol, not design quality.
