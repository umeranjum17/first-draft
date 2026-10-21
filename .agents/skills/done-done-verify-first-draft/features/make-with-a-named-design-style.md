# Make with a named design style

Part of the first-draft verification map. Source: `src/styles.mjs` (the 26 named styles) and `src/cli.mjs` (`--direction`, `styles`).

## How to get to it (user POV)

Run `first-draft-axi styles` to list the named styles, then `first-draft-axi make "<prompt>" --out <tmp>/a.html --direction editorial`, or `--direction "<own words>"`, or `--count 3` with no direction.

## Driving it

Harness: A shell runs the CLI. `styles` is free (no model call). `make` on the real route calls a paid model: the same exception to SKILL.md's "never run make" as the landing page feature. A browser tool opens the written pages as files for screenshots.

1. Point FIRST_DRAFT_HOME at a temporary folder and run `first-draft-axi init --agent byokit:minimax:key`; give make the provider key in that one command's environment only, read from its file; never print or save it.
2. `first-draft-axi styles` prints 26 ids with name, family and vibe as JSON. Ready when `editorial`, `oled-neon` and `bento` are in it.
3. `make "<prompt>" --out <tmp>/a.html --direction editorial` writes one page; `make ... --count 3` (no direction) writes three pages. Capture each at 1280 and 390.
4. Pass: the single-style page shows that style's grammar (editorial: display serif, kicker, one accent, cream ground), and the three options of `--count 3` differ in kind (typeface, ground, layout), not only in layout. The prompt sent for an option carries `Design direction:` and nothing else about a house style.
