# Driving first-draft from another agent: skill, init, redesign path, post

Part of the first-draft verification map. Source: `skills/first-draft-axi/SKILL.md` and `REFERENCE.md` (the packaged agent skill), `src/init.mjs` and `src/cli.mjs` (`init`, the `redesign` usage help), `src/post.mjs` (`post` from any repo, board from `--board` or `$FIRST_DRAFT_BOARD`, secrets masked), `test/init.test.mjs`, `test/post.test.mjs`.

## How to get to it (user POV)

An agent in any repo runs `first-draft-axi init`, reads the installed skill, runs `make` or `redesign`, `view`, then `post` to a sign-off board.

## Driving it

1. `first-draft-axi init` in a throwaway git repo with a throwaway HOME: it creates `.first-draft/` (`.gitignore` holding `*`, `designs/`) and copies the skill (`SKILL.md`, `REFERENCE.md`) to `.claude/skills/first-draft-axi/` and `.agents/skills/first-draft-axi/` (codex and pi share it). Nothing is written under HOME; a second run prints `nothing new` and every skill `already installed`; an older copy of the skill is `updated`, a different skill of that name is `kept`; `--harness claude` limits it; `--global` also links the skill from the home folder (the only write outside the repo). `init --agent byokit:<route> --model <model>` stays config-only. `test/init.test.mjs` proves all of it with the real CLI.
2. The skill names only real commands and flags and carries `--model claude-sonnet-5-5`, the BYOKit subscription route and the no-API-key rule: `test/init.test.mjs` checks every command and flag it shows against `--help`.
3. `first-draft-axi redesign https://example.com --out o` (no intent) fails with `USAGE` and help lines holding the one-command redesign example and the screenshot-only `make ... --ref shot.png` path. The redesign journey itself (`test/public-references.test.mjs`, a local site with provider stand-ins) is unchanged.
4. `post` from a folder with no `.sign-off/` above it, `FIRST_DRAFT_BOARD=<board.json or .sign-off folder>`: `test/post.test.mjs` posts with a stand-in `sign-off-axi`, checks the board comes from the variable (the `--board` flag wins), the card text names each option's canvas url, and a token in the board tool's output or error is printed as `[redacted]`. Live: `sign-off-axi serve` on a throwaway `SIGN_OFF_HOME` board shows the design card with each option's mock in the board's phone frame and an Open live link; the board's frame blocks nested frames, so a mock cannot show phone and desktop at once and the canvas and Play urls carry that.
5. Stop what you started.
