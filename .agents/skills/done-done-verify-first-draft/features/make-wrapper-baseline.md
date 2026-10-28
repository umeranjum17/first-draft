# The wrapper baseline: the default make is a plain call plus listed additions

Part of the first-draft verification map. Source: `docs/wrapper-allowlist.json`, `scripts/compare.mjs`, `src/draft.mjs` (`contractRules`, `systemPrompt`), `src/critic.mjs`, `src/cli.mjs`, `CONTRIBUTING.md`. The allow-list is reviewed manually; no automated test enforces prompt wording or call shape.

## How to get to it (user POV)

A contributor changes the prompt, the page contract, the guidance or the calls make runs. Manually update the allow-list with the paired, rendered comparison (same brief, same model, plain against with-addition). The retained `npm test` suite does not enforce the allow-list. A user sees default make drawing options two at a time, one critic review per option and no revision, and `made.timing` in the make JSON saying where the seconds went.

## Driving it

Harness: one no-model CLI integration in `tests/e2e/onboarding-flow.test.mjs` exercises multi-screen flow generation and review; it does not test the allow-list. For a prompt or contract change, run paired comparison (paid, on the user's model): `node scripts/compare.mjs "<brief>" --out <folder>` writes `plain.html`, `make.html`, four PNGs and `compare.html`. Without a model: `--pages plain=a.html make=b.html`. Live make on `byokit:claude` / `claude-sonnet-5-5`: read `made.timing` (`options.draw_s`, `options.repair_s`, `options.render_s`, `critic.plain_s`, `critic.review_s`) and each file's `critique`.
