# The wrapper baseline: the default make is a plain call plus listed additions

Part of the first-draft verification map. Source: `docs/wrapper-allowlist.json`, `tests/e2e/wrapper-baseline.test.mjs`, `scripts/compare.mjs`, `src/draft.mjs` (`contractRules`, `systemPrompt`), `src/critic.mjs`, `src/cli.mjs`, `CONTRIBUTING.md`.

## How to get to it (user POV)

A contributor changes the prompt, the page contract, the guidance or the calls make runs. `node --test tests/e2e/wrapper-baseline.test.mjs` fails with the entry to add until the change is on the allow-list with its paired, rendered comparison (same brief, same model, plain against with-addition). A user sees it as the default make drawing options two at a time, one critic review per option and no revision, and `made.timing` in the make JSON saying where the seconds went.

## Driving it

Harness: a shell; no model, key or network (a local stand-in for the provider, the machine's Chrome).

1. `node --test tests/e2e/wrapper-baseline.test.mjs`: the test lists accepted and provisional additions, and the default make's calls (draw, critic plain page, one review; a repair when the host measures a defect; a direction plan for several options).
2. Add a sentence to a rule in `contractRules`, or a rule: the test fails naming it and printing the entry (with its hash) to fill in.
3. Paired comparison (paid, on the user's model): `node scripts/compare.mjs "<brief>" --out <folder>` writes `plain.html`, `make.html`, four PNGs and `compare.html`. Without a model: `--pages plain=a.html make=b.html`.
4. Live make on `byokit:claude` / `claude-sonnet-5-5`: read `made.timing` (`options.draw_s`, `options.repair_s`, `options.render_s`, `critic.plain_s`, `critic.review_s`) and each file's `critique`.
