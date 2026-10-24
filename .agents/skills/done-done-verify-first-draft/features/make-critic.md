# The critic: every make option scored against real products and a plain page

Part of the first-draft verification map. Source: `src/critic.mjs`, `src/cli.mjs` (make), `src/render-check.mjs` (`shoot`), `test/critic.test.mjs`.

## How to get to it (user POV)

Run `first-draft-axi make "<prompt>" --out <file.html>` with Chrome or Chromium installed and a model that takes images. The JSON's `made.critic` names the plain page (`<file>.critic/plain.html`) and the pass mark (9); each file's `critique` has `score`, `passed`, `plain_score`, `rounds`, `scores`, `against`, `gaps` and `fix`. An option under 9, or under the plain page, was sent back to the engine with the critic's gaps and fixes, at most twice, and the best-scored version is the file. `--no-critic`, no browser or a model without images: `made.critic.off` says why and a help line says no option was scored.

## Driving it

Harness: a shell runs the CLI with a throwaway FIRST_DRAFT_HOME; a browser opens the option and the plain page.

1. Nonpaid: `node --test test/critic.test.mjs` drives the real CLI and Chrome against a stand-in model: a 6 goes back and its revision scores 9; a run that never reaches 9 keeps its best version, flagged below the bar; `--no-critic` makes no plain page and no review.
2. Paid, on the user's model (`byokit:claude`, `claude-sonnet-5-5`): make one option of a fixed brief. Pass: `critique.score` and `plain_score` are set, `scores` lists every round, and when `passed` is false a help line names the file and its score.
3. Capture the option and `<file>.critic/plain.html` side by side at 390 and 1280, light, with the score, the plain page's score, the model and `made.seconds` under each. A design is shown as finished only when `passed` is true.
4. Stop what you started.


Before the critic, the default make measures the drawn page itself (`src/restraint.mjs` on its source; `src/render-check.mjs` in Chrome: overflow, text under a fixed bar, clipped text, unreadable text, a close control on screen with nothing open) and sends the model back once with those findings; `repaired` in each file's JSON lists them (`unrepaired` and `repair_failed` when the fix call fails). Deterministic proof: `node --test --test-name-pattern="strong grid" test/make.test.mjs`.
