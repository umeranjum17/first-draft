---
name: first-draft-axi
description: "Make design mocks from a prompt with the first-draft-axi CLI: several self-contained HTML options (no network when viewed), made by the model the user chose through BYOKit, shown on a phone + desktop canvas with Play. Use when the user asks for a mock-up, a first draft of a screen or page, or designs to compare or post for review."
---

# first-draft-axi

Run `first-draft-axi --help` for every command and flag. Each command prints JSON with a `help` list that says what to do next.

1. `first-draft-axi doctor` shows whether the user's model is ready, with no paid call.
2. No agent or model set: ask the user which BYOKit route and model to use. Never pick one for them.
   Then `first-draft-axi init --agent byokit:<route> --model <model>`. `init` with no flags lists the ready routes:
   `byokit:codex` (their installed, signed-in CLI) or a plan-key or api-key route. A key route reads its key from the environment variable `doctor` names; never save or print a key. `byokit:minimax:key` with no `--model` gets `MiniMax-M3.1-Flash-Preview`.
3. `first-draft-axi make "<prompt>" --out <file.html> --count 3` makes the options (`--count` is 1 to 5, default 1): `x.html` becomes `x-1.html` … `x-3.html`. Each option is one engine run, possibly several model turns. A failure is not retried; show the user the error.
   To change the option the user picked, run `first-draft-axi refine <option.html> "<their change>" --out <new.html>`: it starts from that option's HTML and writes a new option file (the original stays). Keep the change short; one engine run, not retried.
4. To show them, run `first-draft-axi view <the --out path>` in the background and give the user the printed url (default port 4430, on the tailnet address). It has a grid, a phone (390) + desktop (1280) canvas per option, Fullscreen, and Play, which clicks through the option's screens. `<url>#/o/<n>/play` opens one option in Play.
5. Comments from people show as read-only pins when `<design>.comments.json` sits next to the design: `[{"option": 1, "x": 0.4, "y": 0.2, "text": "..."}]`, `x` and `y` as fractions of the frame.
6. To get the user's pick on a sign-off board (optional, needs `sign-off-axi`):
   `first-draft-axi post <the --out path> --title "<question>" --recommend a --option a=<label> --option b=<label> ...`.
   It copies the options into the board's `mocks/`, starts the view if needed, and each option gets a tappable Open link to its Play url under its mock (needs `sign-off-axi` 0.5.0+; the same urls also ride in the card text as a fallback). Pick `--recommend` yourself; a key already on the board needs a new `--key`.
