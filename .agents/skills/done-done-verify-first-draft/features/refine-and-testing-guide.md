# Refine a made option; the testing guide

`first-draft-axi refine <option.html> "<change>" --out <new.html>` must finish on the pages `make` really writes. A made page carries its web font as one 50 to 100 KB base64 line; refine shows the engine a short `FONT<n>` token for it and puts the font back in the page it writes, so a normal option takes the rewrite-in-one-create path instead of looping on an unshowable line to the 60-turn cap.

`docs/TESTING.md` is the tester's page: install from a clean clone, the commands in order with their timings, what a good run looks like, three checks, and what to collect when it breaks. Every command in it is run from a fresh clone of the branch with a task-owned `FIRST_DRAFT_HOME` and the person's own signed-in `claude` and `codex`.

Verify: `node --import ./test/fixtures/provider-hooks.mjs --test --test-name-pattern='self-contained mocks through the BYOKit Go' test/make.test.mjs` (the refine journey asserts the prompt carries `base64,FONT1` and no payload). Live: follow `docs/TESTING.md` to `refine notes-2.html "Warmer palette"` on a real three-option `make`; it writes `notes-warm.html`, leaves `notes-2.html` unchanged and keeps both embedded fonts. `scripts/compare.mjs` with a saved route that is signed out must print the one sign-in line and create nothing (`tests/e2e/wrapper-baseline.test.mjs`).
