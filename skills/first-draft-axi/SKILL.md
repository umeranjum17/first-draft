---
name: first-draft-axi
description: "Make a design mock from a prompt with the first-draft-axi CLI: one self-contained HTML page (no network when viewed), made by the model the user chose through BYOKit. Use when the user asks for a mock-up, a first draft of a screen or page, or a design to post for review."
---

# first-draft-axi

Run `first-draft-axi --help` for the commands; the CLI's own output says what to do next.

1. `first-draft-axi doctor` shows whether the user's agent is ready, with no paid call.
2. No agent or model set: ask the user which BYOKit route and model to use. Never pick one for them.
   Then `first-draft-axi init --agent byokit:<route> --model <model>`.
3. `first-draft-axi make "<prompt>" --out <file.html>` makes the mock: one model call on the user's plan.
4. To get the user's pick, post it to a sign-off board:
   `sign-off-axi post --type design --title "<question>" --option a=<label> --mock a=<board-relative path> --recommend a`.
