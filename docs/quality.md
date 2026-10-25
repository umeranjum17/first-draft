# What we have measured

[Back to the README](../README.md#proof-not-a-promise-of-perfect-design)

## Same-model bake-off — 24 October 2026

Model: **Claude Sonnet 5.5** (`claude-sonnet-5-5`, `byokit:claude`), through the installed signed-in Claude CLI. One run per cell, not a statistical benchmark. Scores below are the worker's visual assessments at 1280 and 390 pixels, not customer ratings or an independent blinded evaluation.

| Brief | Plain | Plain + frontend-design | First Draft before fixes |
| --- | --- | --- | --- |
| a landing page for a small accounting software company for teams | 6.5; 46 s; 7.9k output tokens | 8; 139 s; 19.9k tokens | 4; 101 s; 13.3k tokens |
| A notes app | 3; 23 s; 4.0k tokens | 5.5; 55 s; 7.7k tokens | 4; 94 s; 13.7k tokens |

Source: the retained `fd-quality-bakeoff/report.md`, section 2, dated 2026-10-24. The report and raw run artifacts are retained with the README rewrite review evidence, not bundled into the npm package. These numbers describe historical versions, not today's wrapper. The comparison exposed forced novelty styles, a marketing brief imposed on unrelated pages, small output budgets and a missing visual critique path. See [the wrapper allowlist](wrapper-allowlist.json) for the current status of additions and their evidence; provisional does not mean proven.

## The CLI excerpt — 24 October 2026

The README's formatted critic board comes from the retained `g2-fd-landing/make.json` and `run.json`: source head `cd49ea3`, exit 0, `made.at` 2026-10-24T17:51:06.295Z, model `claude-sonnet-5-5`, route `byokit:claude`, **304 seconds**. It was one landing option, not three.

Its critic scored that option **8/10**, the plain page **5/10**, and returned `passed: false`. This was the **generator judging its own output**, with three reviews, not an independent assessment. `render_check: checked` is layout validation, not a visual-quality certificate. The image selects the model, elapsed time, render status and first option's critique fields from real output, reformats them for readability and repeats those scores as a board. No design pixels are shown. It is not a screenshot of an interactive critic UI, a fresh generation, or evidence that the current one-pass critic improves quality.

## Rerun a comparison

Requires a chosen, signed-in subscription model. **This spends your model quota**; it is not part of CI or README rendering.

```sh
first-draft-axi init --agent byokit:codex --model gpt-6.1-sol
node scripts/compare.mjs "A notes app" --out /var/tmp/notes-comparison
```

Run the same brief/model for both sides, inspect every render, and label the date, version, scorer and method. See [CONTRIBUTING.md](../CONTRIBUTING.md). A different model/date is a new comparison; do not reuse the Sonnet figures for it.

No design output is published as a sample until it scores at least 9/10, meets its plain-model baseline, and receives human review. See [the sample gate](../.agents/skills/done-done-verify-first-draft/features/sample-provenance.md).
