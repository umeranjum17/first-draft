# Logo mode: brand sheets with checked SVG files and the app icon set

Entry: `src/cli.mjs logo` (also `styles --logo`, and `refine` / the Studio brief on a logo option), `src/logo.mjs`, `src/make.mjs` (logo export contract and `done` checks), `src/render-check.mjs` (`evaluate`), `templates/skills/logo-system.md`; deterministic journey `test/logo.test.mjs`; nonpaid recapture `journeys/logo.mjs`.

## Drive

1. Deterministic, no model or key: `node --test test/logo.test.mjs` (part of `npm test`; needs Chrome or Chromium, else the journey skips after the refusal checks). A native stand-in writes logo files the allow-list refuses (`<text>`, `<image>` with an outside `href`, a non-square icon viewBox); `done` returns each finding by file, the stand-in writes clean files, and each option gets `tea-N.html` plus `tea-N.logo/` (9 SVGs, `icon-16.png` … `icon-1024.png` at the size each name says, `favicon.ico` holding the 16/32/48 PNGs, `logo.json` with palette and checks). It also proves `logo` refuses to start without a browser and with `--ref`, `--assets` or `--options 6`, that options take different logo directions, and that CLI `refine` and the Studio's `POST /refine` start from the option's logo files and write a new `.logo/` folder.
2. Live generation (needs approval to spend; Claude only through the installed, signed-in subscription with a task-private `FIRST_DRAFT_HOME`): `init --agent byokit:claude --model claude-opus-5-5`, `doctor`, then `node src/cli.mjs logo "Umer's tea shop, calm and modern" --options 3 --out <data>/tea.html` through the memory gate. Save stdout (each file's `logo_dir`, `palette`, `checks`), stderr and the exit code. Three options are three engine runs; on a Claude limit, report it and stop.
3. Nonpaid whole-product capture of that retained output at the exact head: `FD_LOGO_SOURCE=<data>/tea.html done-done run logo-recapture` with done-done's default home. It never regenerates.

## Assert and capture

`journeys/logo.mjs` checks each option's folder (SVG roots, PNG sizes from the IHDR, favicon entries equal the PNGs, `logo.json` full-bleed) and then captures, with an owned chrome-devtools-axi browser per width and theme: `picker-<390|1280>-<light|dark>.png` (every option in the picker) and `studio-<n>-<390|1280>-<light|dark>.png` (each option's brand sheet in the Studio), and per option `icons-<n>.png` (every icon PNG at its real size) and `svgs-<n>.png` (each SVG alone on the tile it is for: light files on white, `-dark` files on near-black, the icon on both), plus `steps.json`. Hashes, the evidence pages and measurements go to the sibling `-support` folder. Open every capture: the marks read, the -dark files read on the dark tiles, the 16 px icon is not a blob, nothing overlaps or is cut off. Mark quality is a judgement the checks do not make: write it down honestly.

## Boundaries

The checks are structural: an allow-list, viewBox, size, full-bleed, a safe-zone and 16 px ink/contrast measure, and 3:1 on light and dark tiles. They do not judge whether a mark is good or original and are not trademark clearance. No font outlining, inspiration (`--ref` / `--like`), look-alike check or raster exploration in this slice; the reference policy is unchanged.
