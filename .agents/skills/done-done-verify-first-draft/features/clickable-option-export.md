# A clickable option stays clickable: its script exports, a real press is judged, and its source is readable beside it

Sources: `src/make.mjs` (`staticExport` with `script`, the live policy, `source_files`), `src/draft.mjs`, `src/render-check.mjs` (`clicks()`, `PRESS`), `src/judge.mjs` (`BEHAVIOUR_VERDICT`, `BEHAVIOUR_SIDE`), `src/critic.mjs` (the press, `critique.behaviour`, the pass bar), `src/source.mjs` (`<option>.source/`), `src/cli.mjs` (`make`, `judge`), `src/polish.mjs`, `src/view.mjs` (the frame origin Play opens), `journeys/click.mjs`.

## User outcome

An option made from a brief that asks for behaviour (a message row opening, a filter narrowing a list, a tab switching) is exported with its own inline script under a content security policy that adds `script-src 'unsafe-inline'` to `default-src 'none'`: the page really answers a click, loads nothing and sends nothing, and answers a click inside the sandboxed frame origin that Play and "Open live" open (`sandbox allow-scripts`, `connect-src 'none'`). Before the independent judge sees the option, the host presses the first control a person can press — a `button`, `[role=button]`, `[role=tab]`, `[role=menuitem]`, `input[type=submit|button]`, never a link — with a real mouse event (`Input.dispatchMouseEvent`) at 390 and at 1280, and keeps the page before and after it. The judge gets those frames and answers `critique.behaviour = { present, score, reason, defects, clicked, widths }`. `clicked` says whether a press changed the page; `widths` names each control it pressed (`label`, `tag`) and how many it found, with `after`, the text a person reads once the page has redrawn; `idle` says the page also changes on its own, so a change it shows is not credited to the press. A control that changes nothing is a defect and the option does not pass (the bar stays 9). A page drawn from `App.jsx` has no script left, so it is never asked about behaviour: only a live `index.html` option is. A drawn option's source is written readable beside the export in `<option>.source/` (`App.jsx` plus the files it imports); an `index.html` option is its own readable source, so it is not written twice, and the page's in-band `first-draft-source` comment still travels with it for `refine`.

## Handles it drives

- `first-draft-axi make "<brief asking for behaviour>" --out <file.html>`: the option html keeps its `<script>`; the make JSON has `files[].critique.behaviour` and the judge call carries `click-<width>-before` and `click-<width>-after` frames.
- `render-check` `clicks(html)`: `{ clicked, widths: [{ width, controls, idle, clicked: { label, tag, changed, after } | null }], frames }`.
- `first-draft-axi judge <option.html> "<brief>" --plain <baseline.html>`: the same verdict on a retained page. A page whose control is wired to nothing gets `clicked: false`, the control count and no frames, and `passed: false`.
- `make --engine`: a drawn `App.jsx` option writes `<option>.source/App.jsx`, and the make JSON's `files[].source_dir` names the folder; `critique.behaviour.present` is `false`.
- `first-draft-axi view <option.html>`: the frame origin (`/o/<n>`) serves the option script under `sandbox allow-scripts`; `#/o/<n>/play` is what Play and sign-off's "Open live" open.
- Nonpaid journey: `done-done run click` (`journeys/click.mjs`, local model and judge stand-ins).

## Evidence kind

The click log (`click-log.json`: the controls pressed per width, `clicked`, `idle`, and `critique.behaviour`) plus the JPEG frames `click-390-before`, `click-390-after`, `click-1280-before` and `click-1280-after` under `frames/`, the make JSON carrying `critique.behaviour`, the refused dead-control judge JSON, and the drawn option's `source_dir`. Live runs add browser screenshots of the framed page. Stand-in scores prove the protocol, not design quality.
