# Design samples on the README and landing page: run, model, critic score and review

Part of the first-draft verification map. Source: `scripts/check-samples.mjs` (CI and the Pages deploy run it), `docs/media/samples.json`, `test/samples.test.mjs`.

## Why

A sample is a promise about what first-draft makes. In October 2026 a four-day-old refine proof (one small option on MiniMax-M3.1-Flash-Preview, briefed to keep the page short) became every README and landing picture, with no model named and no taste check (PR #61; taken down by PR #70). Each pipeline proof passed: the pictures loaded, fit 390 and matched the theme. None asked whether the design inside was good.

## The rule

Every picture under `docs/media/` that `README.md` or `docs/index.html` shows has an entry in `docs/media/samples.json`, keyed by its name without `-dark` and the extension:

```json
{ "studio": { "command": "make", "agent": "byokit:claude", "model": "claude-sonnet-5-5", "made_at": "<the run's made.at>",
  "option": "<the option file>", "critique": { "score": 9, "passed": true, "plain_score": 7 }, "reviewed_by": "<who reviewed it>" } }
```

- `command`, `agent`, `model` and `made_at` come from the make or redesign run's JSON (`made.command`, `made.agent`, `made.model`, `made.at`). A refine proof, a retained draft, a fixture or a hand-made page is never a sample.
- `critique` is that option's critic result: `passed`, 9 or more and no lower than the plain page of the same brief.
- `reviewed_by` names the person who looked at it beside its plain page and real products of its kind before it went up.
- The run is at most 30 days old: a sample is judged again on the current engine at least monthly.
- Each page that shows it names its model.

## The one approved exception

On 2026-10-25 the owner approved exactly two retained stripped-engine options (self-scored 8 and 7) as the README hero. Their source
hashes, runs, models, scores, reviewer and reason are pinned in `scripts/check-samples.mjs`, and `docs/media/samples.json` must repeat them
exactly; `test/samples.test.mjs` proves that a third source, a changed hash/run/score, an invented plain baseline, a fake reviewer or
relabelled reason, a copied exception label on an ordinary 8, and a stale approved pair are all refused. The general 9/10 rule is unchanged
for everything else, and the exception may only cover the composite keys `reviewed-pair` and `reviewed-pair-phone`.

## Driving it

1. `node scripts/check-samples.mjs`: exit 0 with the count of samples shown, or each problem with its picture and page.
2. `node --test test/samples.test.mjs`: the shipped Fieldnotes picture is refused with every reason, a fresh critic-passed reviewed sample passes, a 40-day-old one is refused, pages with no picture pass, and the approved hero pair passes while every altered or extra identity is refused.
3. To add or replace a sample: make it on the current engine with the critic on, capture the option in the view (`done-done run studio` with `FD_STUDIO_SOURCE`), add its entry, name its model on the page, and show the option, its plain page and its score in the PR.
