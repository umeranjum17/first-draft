# Contributing

`npm ci && npm test` runs everything that needs no model, key or network. CI runs the same.

## The wrapper must not lower the output bar

first-draft is a plain model call plus a few additions of ours: Anthropic's frontend-design guidance, a page contract, a facts rule, a host check that sends the model back once, and a critic. In October 2026 the wrapper scored 4 on a landing page where the plain model scored 6.5 (and 8 with the guidance alone), because restrictions went in without anyone comparing the result with the plain model. So:

> **A restriction or addition stays only with a paired, rendered comparison: the same brief, the same model version, the plain model against the plain model plus the addition, both drawn at 390 and 1280 and scored side by side.**

[`docs/wrapper-allowlist.json`](docs/wrapper-allowlist.json) lists additions with their evidence and verdict. `npm test` keeps one CLI integration for the multi-screen flow and its review; allow-list wording, calls, and paired-comparison evidence are reviewed manually, not enforced by an automated test.

### Adding or changing a rule

1. Write the change. Record the exact wording and its hash in the matching allow-list entry.
2. Run the paired comparison on at least two briefs (below). Same model for both sides: the list names it (`claude-sonnet-5-5`).
3. Score both renders yourself, side by side, at 390 and 1280. Put the numbers in `evidence`: `brief`, `model`, `plain_run`, `plain`, `with_run`, `with`, `scored_by`, `report` (where the renders are kept; never a path on your machine, never media in the repo).
4. `verdict: "accepted"` needs every pair up and none down. A tie or a fall, or a bundle you could not separate, is `provisional` at most, with `decided_by` and `needed` (the comparison still owed). Review provisional entries whenever the allow-list changes.
5. Delivery rules (what the host needs for the file to be a page) and policy rules (an owner decision such as the facts rule) carry a `reason` instead of scores. They may not restrict design.

### Running a paired comparison

```
first-draft-axi init --agent byokit:claude --model claude-sonnet-5-5   # once; a subscription CLI, no key
node scripts/compare.mjs "an analytics dashboard" --out /tmp/compare-dash
```

This asks the model for one plain page of the brief, runs this checkout's default make for one option, renders both at 1280 and 390 and writes `compare.html` beside them (`plain-1280.png`, `make-390.png` and so on). To compare two pages you already have (a branch against main, or one rule on against off), skip the model: `node scripts/compare.mjs "<brief>" --out <folder> --pages main=main.html branch=branch.html`. Open `compare.html`, score the columns, and repeat on a second brief.

Scores you give are yours. New critic results require an independent authenticated engine and model; historical generator self-scores remain labelled in the evidence list.

### Make timing

`made.timing` in the make output says where the seconds went: `options` (`draw_s`, `repair_s`, `render_s`, summed over the options) and `critic` (`plain_s`, `review_s`). Options run two at a time and the critic's plain page is written while they are drawn, so `seconds` is less than the sum.
