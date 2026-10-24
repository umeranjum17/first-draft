# Make a landing page from a README

Part of the first-draft verification map. Source: `src/make.mjs`, `src/media.mjs` (the landing-page brief added when the prompt says "landing page", the project's screenshots offered as the hero visual).

## How to get to it (user POV)

Run make with a prompt that asks for a landing page and carries the product's README: `first-draft-axi make "Make a landing page for my tool <name>. Its README is below; use only it as the source.\n\n<README>" --out <tmp>/landing.html`.

## Driving it

Harness: A shell runs the CLI on the user's own BYOKit route (this calls a paid model: the one exception to SKILL.md's "never run make"). A browser tool opens the written page as a file for screenshots.

1. Point FIRST_DRAFT_HOME at a temporary folder, run `first-draft-axi init --agent byokit:minimax:key` (the CLI picks MiniMax-M3.1-Flash-Preview), and give make the provider key in that one command's environment only, read from its file; never print or save it.
2. Run make as above with a real README (done-done-axi's is the reference case). Ready when make exits 0 and prints the written path.
3. Capture: open file://<tmp>/landing.html at 390x844 (mobile) and 1280x800, light and dark, and save a full-page screenshot plus `document.documentElement.scrollHeight`, `scrollWidth`, the `[data-oc-screen]` count and the h1/h2 texts to $DONE_DONE_EVIDENCE_ROOT, with make's JSON output.
4. Pass: one screen (no data-oc-screen), about 6 sections in the order hero, value, how it works, proof, install, call to action, about 6,000 px tall or less at 390, and no doc paths, maintainer commands or release notes from the README on the page. Before this brief the same prompt made a 12,000 to 22,000 px docs site with stacked screens.
5. Pass, polish: the hero is one of the project's own screenshots from `docs/media` embedded as a `data:image/` src (a typeset visual only when the folder has none); the page is light at 390 and 1280 in light and dark at the same widths, and the two captures differ; every heading, the closing one included, has visible space above the text under it.
5. Own screenshots only for the project described: run, in the same folder, `first-draft-axi make "A landing page for Fieldnotes, an offline-first note-taking app for field biologists." --out <tmp>/other.html`. Pass: the page embeds no `data:image` from this folder (its hero is typeset or drawn in the page) and shows none of this tool's own screens (no "Option 1", "Play", "Fullscreen" chrome). A prompt that names this project or carries its README (step 2) still gets its screenshots.
6. Pass, clarity: the page answers the self-check in `templates/skills/clarity-over-flash.md` (lines marked `[host]` from the 390 and 1280 captures and the DOM, lines marked `[model]` by reading the first-screen capture). Until the host runs those checks, they are a model instruction, not a guarantee: report each line's result, do not count it as proven by make passing.
