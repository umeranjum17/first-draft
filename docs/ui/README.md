# README capture provenance

These assets document the **tool**, not the quality of generated designs. The one generated-design picture is the reviewed hero pair in
`docs/media/`, inventoried by `scripts/check-samples.mjs`; everything here is a capture of the CLI's own output.

## The hero pair — `../media/reviewed-pair{,-phone}{,-dark}.gif`

Two real retained options inside the real Studio, three seconds each, unaltered: **Parley Books** (self-scored 8/10) and **Margin** (7/10).
Captions outside the product pixels name the run, model, date, scores and the review (Main, 2026-10-25). Sources, hashes and limits:
[quality provenance](../quality.md#the-readme-hero--24-october-2026). The design canvas is not redacted here; the GIF shows the genuine
retained output, which is why the pair is a reviewed sample pinned in the gate rather than a 9/10 pass.

## The CLI excerpt — `make-{light,dark}.webp`, `make-phone-{light,dark}.webp`

A formatted view of `first-draft-axi make`'s own JSON and critic scores at 880×360, and the same excerpt at 390×480. The mobile view
rearranges the board, not its values. It is **not** a screenshot of an interactive screen the tool ships. Model, date, source commit,
timing, score and limits: [the CLI excerpt](../quality.md#the-cli-excerpt--24-october-2026). Raw records and the capture recipe are kept
with the README rewrite review evidence. No model was run and no quota was spent to make these captures.

## `quality/` — the bake-off cells shown on the quality page

`quality/{landing,dashboard,onboarding,notes}-{plain,first-draft}.webp` and `quality/{landing,notes}-before-fixes.webp` are the retained 1280px
first screens of the bake-off cells shown as picture pairs on the quality page (`webp`, 320px wide); `quality/scores-{light,dark}.svg` is
the paired-bar chart of the same cell scores. Model, run, time, tokens and score for each row: [How good is it?](../quality.md). These
are scorer-labelled comparison captures, not samples: the only below-9 picture admitted as a sample is the reviewed hero pair above.
