# first-draft

Turn a prompt into a design mock: one self-contained HTML page that opens anywhere with no network, ready to post for review. The model is your own choice, on the plan you already pay for; first-draft never picks one for you.

```sh
first-draft-axi init --agent byokit:<route> --model <model>   # your choice, saved once
first-draft-axi doctor                                        # is that route ready? no paid call
first-draft-axi make "A sign-in page for a notes app" --out mocks/sign-in.html
```

This first release makes one mock per prompt with one model call. Several options per prompt, comment-and-revise, and more agent kinds come later.

## Install

Node 22.18 or later. The npm package is `first-draft-axi`; until it is published, install from a checkout:

```sh
npm install && npm run build && npm link
```

An agent skill that points at the CLI is in `skills/first-draft-axi/SKILL.md`.

## Commands

- `make "<prompt>" --out <file.html>`: one model call, then one HTML page. The page carries its own content security policy, so it loads nothing from the network when viewed; if the design names a remote file, `make` lists it under `blocked_remote` and that part shows empty.
- `doctor`: checks Node, the config and the route (a sign-in's state, or whether a plan key is set) without a paid call.
- `init --agent byokit:<route> --model <model>`: saves your agent and model. With no agent or model set, `make` stops and says to ask you.

## Config

`$FIRST_DRAFT_HOME/config.yaml` (default `~/.first-draft/config.yaml`), with the same shape and key names as no-mistakes:

```yaml
agent: "byokit:<route>"
agent_config:
  "byokit:<route>":
    model: "<model id>"
agent_timeout: "10m"   # per make call; s, m or h
```

An agent is a BYOKit route: a sign-in plan (`byokit:claude`, `byokit:chatgpt`, signed in through BYOKit's machine store), or a plan key route BYOKit lists, such as `byokit:zai:plan_key` or `byokit:kimi-coding`, whose key comes from the variable BYOKit names (for example `ZAI_API_KEY`) and is never saved. `init` with no flags lists the routes.

## How it works

`make` sends Open CoDesign's own create-mode design prompt, plus a short section for a one-call run, through Open CoDesign's providers package. Every pi-ai import in the vendored code resolves at build time to `src/pi-ai.mjs`, which answers through BYOKit (`src/byokit.mjs`), so no vendored code reaches a provider by itself. The model's `App.jsx` goes through Open CoDesign's HTML export; `src/mock.mjs` then compiles the JSX at make time and drops in-page compilation and remote font links, so the page runs under a no-eval, no-network policy.

## Develop

```sh
npm test      # builds, then runs the whole make journey against a local stand-in provider (no paid call)
```

Open CoDesign's `packages/` live in `vendor/open-codesign` as a squashed git subtree at one fixed commit; its desktop app is not included. To move to a newer upstream commit, change `COMMIT` in `scripts/open-codesign.sh` and run `sh scripts/open-codesign.sh`.

## Credits

- [Open CoDesign](https://github.com/OpenCoworkAI/open-codesign) (MIT): the design prompt, providers, preview runtime and HTML export in `vendor/open-codesign`. See `NOTICE`.
- [BYOKit](https://www.npmjs.com/package/@byokit/accounts): every model call, on your own plan.
- [axi-sdk-js](https://www.npmjs.com/package/axi-sdk-js): the CLI's command and output shape.

## License

MIT. See `LICENSE` and `NOTICE`.
