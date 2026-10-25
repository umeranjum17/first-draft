# GitHub-rendered README

## Drive

Run `done-done run readme` from a clean candidate with normal HOME and DONE_DONE_HOME unset. Requires installed `gh-axi`, `chrome-devtools-axi` and network access to GitHub's Markdown API, the version-pinned github-markdown-css stylesheet and badge endpoints. No model call, sign-in flow or paid generation is made. `FD_README_BEFORE=/external/before.md` optionally adds historical frames.

The journey renders the real README with GitHub's API, resolves candidate images locally, opens a named isolated chrome-devtools-axi session, and captures the article at 390×844 and 1280×800 in light/dark. The local article layout uses github-markdown-css 5.8.1, not the full github.com navigation shell. The same article is used for before and after. State readbacks check image loading, page overflow, and after command-block overflow. It saves whole first-screen and full-article PNGs, GitHub HTML, the stylesheet, state JSON and `steps.json`; finally it stops its owned browser session. Use `magick before-390-light.png after-390-light.png +append comparison-390-light.png` (repeat each cell) outside the repo for Main's before | after review.

## Inspect

Look at every 390/1280 light/dark first screen and full article before requesting review. The name comes first, then the single outcome line, the real Studio capture with the **entire design canvas hidden**, links/badges and the three-command quick start. Device/theme-specific assets must load. No generated design is admitted by this feature: the separate sample-provenance gate remains unchanged. The critic illustration is explicitly a formatted excerpt of retained real output, not a shipped interactive critic screen, a new generation or independent review.

## Proof boundary

This proves the README presentation, not generation quality. For the tool itself, separately run the nonpaid `studio` journey on retained outputs (`FD_STUDIO_SOURCE=<two-option-folder> done-done run studio`) or the `landing` journey as the narrowed Checks claim requires. Keep all runtime captures outside the repo and cite only one or two whole run-id-prefixed frames with one narrowed outcome. Do not publish historical design canvases as approved output samples.
