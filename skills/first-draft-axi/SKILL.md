---
name: first-draft-axi
description: "Make design mocks from a prompt with the first-draft-axi CLI: self-contained HTML pages (no network when viewed), made by the model the user chose through BYOKit. Use when the user asks for a mock-up, a first draft of a screen or page, or designs to post for review."
---

# first-draft-axi

Run `first-draft-axi --help` for the commands; the CLI's own output says what to do next.

1. `first-draft-axi doctor` shows whether the user's agent is ready, with no paid call.
2. No agent or model set: ask the user which BYOKit route and model to use. Never pick one for them.
   Then `first-draft-axi init --agent byokit:<route> --model <model>`.
3. `first-draft-axi make "<prompt>" --out <file.html> [--count N]` makes the mocks: one upstream engine run each on the user's plan, potentially several model turns. Every model turn goes through BYOKit; failures are not retried.
4. To get the user's pick, post them to a sign-off board:
   `sign-off-axi post --type design --title "<question>" --option a=<label> --mock a=<board-relative path> ...`.
