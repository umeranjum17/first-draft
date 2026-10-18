# first-draft

Turn a prompt into design mocks: self-contained HTML pages that open anywhere with no network, ready to post for review. The model is your own choice, on the plan you already pay for; first-draft never picks one for you.

```sh
first-draft-axi init --agent byokit:codex --model openai-codex/gpt-6-luna           # example: your installed subscription CLI; your choice
first-draft-axi doctor                                                              # is that route ready? no paid call
first-draft-axi make "A sign-in page for a notes app" --out .sign-off/mocks/sign-in.html --count 3
sign-off-axi post --type design --title "Pick the sign-in layout" --option a=Calm --mock a=mocks/sign-in-1.html --option b=Bold --mock b=mocks/sign-in-2.html --option c=Dense --mock c=mocks/sign-in-3.html
```

Mock paths on the post are relative to the board file's folder (`.sign-off/`), so make into `.sign-off/mocks/`.

## Install

Node 22.18 or later. The npm package is `first-draft-axi`.

An agent skill that points at the CLI is in `skills/first-draft-axi/SKILL.md`.

## Commands

- `make "<prompt>" --out <file.html> [--count N]`: one upstream engine run per mock (possibly several model turns), then N HTML pages (`--count 3` with `--out mocks/x.html` writes `mocks/x-1.html` …; use `{i}` in `--out` to place the number yourself). Each page is script-free and carries its own content security policy, so it loads nothing from the network when viewed; if a design names a remote file, `make` lists it under `blocked_remote` and that part shows empty.
- `doctor`: loads the built engine and prompts, checks Node, config, model metadata and the selected route (installed CLI status or a plan key) without a paid call. Server-side model availability is not probed.
- `init --agent byokit:<route> --model <model>`: saves your agent and model. With no agent or model set, `make` stops and says to ask you.

## Config

`$FIRST_DRAFT_HOME/config.json` (default `~/.first-draft/config.json`):

```json
{ "agent": "byokit:<route>", "agent_config": { "byokit:<route>": { "model": "<model id>" } }, "agent_timeout": "10m" }
```

Use `byokit:codex` for your installed, already-signed-in subscription CLI: BYOKit invokes it with your normal HOME and never copies its login. Or choose a plan-key route BYOKit lists; the key comes from its named environment variable and is never saved. `init` with no flags lists the routes. Neither route falls back to another account or model.

## Develop

```sh
npm install
npm run build
npm test   # real upstream tool loop through local provider and native-CLI fixtures; no paid call
```

## Engine

See [ENGINE.md](ENGINE.md) for the fixed source commit, required packages, subtree provenance, BYOKit boundary and first-slice limitations.

## Credits

- [BYOKit](https://www.npmjs.com/package/@byokit/accounts): every model call, on your own plan.

## License

MIT. See `LICENSE`.
