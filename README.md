# first-draft

Turn a prompt into design mocks: self-contained HTML pages that open anywhere with no network, ready to post for review. The model is your own choice, on the plan you already pay for; first-draft never picks one for you.

```sh
first-draft-axi init --agent byokit:opencode-go --model muse-spark-1.3-contributor  # your choice, saved once
first-draft-axi doctor                                                              # is that route ready? no paid call
first-draft-axi make "A sign-in page for a notes app" --out mocks/sign-in.html --count 3
sign-off-axi post --type design --title "Pick the sign-in layout" --option a=Calm --mock a=mocks/sign-in-1.html --option b=Bold --mock b=mocks/sign-in-2.html --option c=Dense --mock c=mocks/sign-in-3.html
```

## Install

Node 22.18 or later. The npm package is `first-draft-axi`.

An agent skill that points at the CLI is in `skills/first-draft-axi/SKILL.md`.

## Commands

- `make "<prompt>" --out <file.html> [--count N]`: one model call per mock, then N HTML pages (`--count 3` with `--out mocks/x.html` writes `mocks/x-1.html` …; use `{i}` in `--out` to place the number yourself). Each page carries its own content security policy, so it loads nothing from the network when viewed; if a design names a remote file, `make` lists it under `blocked_remote` and that part shows empty.
- `doctor`: checks Node, the config and the route (a sign-in's state, or whether a plan key is set) without a paid call.
- `init --agent byokit:<route> --model <model>`: saves your agent and model. With no agent or model set, `make` stops and says to ask you.

## Config

`$FIRST_DRAFT_HOME/config.json` (default `~/.first-draft/config.json`):

```json
{ "agent": "byokit:<route>", "agent_config": { "byokit:<route>": { "model": "<model id>" } }, "agent_timeout": "10m" }
```

An agent is a BYOKit plan key route BYOKit lists, such as `byokit:opencode-go`, whose key comes from the variable BYOKit names (`OPENCODE_API_KEY`) and is never saved. `init` with no flags lists the routes.

## Develop

```sh
npm test   # the whole make journey against a local stand-in provider (no paid call)
```

## Credits

- [BYOKit](https://www.npmjs.com/package/@byokit/accounts): every model call, on your own plan.

## License

MIT. See `LICENSE`.
