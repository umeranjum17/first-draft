<p align="center">
  <img src="https://raw.githubusercontent.com/umeranjum17/first-draft/main/docs/logo.svg" width="72" height="72" alt="first-draft logo">
</p>

<h1 align="center">first-draft</h1>

<p align="center"><a href="https://umeranjum17.github.io/first-draft/">Visit the landing page</a></p>

<p align="center"><b>Write one prompt and get several first drafts of a screen.</b><br>Each option is a self-contained HTML page that opens with no network. Compare them at phone and desktop width, click through their screens, and read the comments people pinned on them.</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/umeranjum17/first-draft/main/docs/media/grid.webp" width="760" alt="The view: three options of a notes app sign-in page side by side">
</p>

## Install

Node 22.18 or later.

1. Install the command:

   ```sh
   npm install -g first-draft-axi
   ```

2. Pick the model, on a plan or key you already have, and check it with no paid call:

   ```sh
   first-draft-axi init --agent byokit:<route> --model <model>
   first-draft-axi doctor
   ```

3. Make three options and open them:

   ```sh
   first-draft-axi make "A sign-in page for a notes app" --out mocks/sign-in.html --count 3
   first-draft-axi view mocks/sign-in.html
   ```

   `view` prints the url to open. It keeps serving until you stop it.

Run `first-draft-axi --help` for every command and flag.

## What it does

The screenshots below show three options from one real `make --count 3` run on `MiniMax-M3.1-Flash-Preview`; the pin's comment was written by hand.

`make` turns the prompt into 1 to 5 options (`--count`). With `--count 3` and `--out mocks/sign-in.html` it writes `mocks/sign-in-1.html` to `mocks/sign-in-3.html`. Each page carries no scripts and its own content security policy, so it loads nothing from the network. If a design names a remote file, `make` lists it under `blocked_remote` and that part shows empty.

`refine` takes one option and a follow-up prompt, for example `first-draft-axi refine mocks/sign-in-2.html "warmer palette, add an empty state" --out mocks/sign-in-2-warm.html`, and writes the result as a new option; the original is untouched. It runs the same model as `make`; keep the change short.

`view` shows a design: the `--out` path given to `make`, a folder of options, or option files.

- **Grid**: every option side by side. Open one to see it on the canvas.
- **Canvas**: the option at phone width (390) and desktop width (1280) side by side, stacked on a narrow screen, with Fullscreen and Play.

  <img src="https://raw.githubusercontent.com/umeranjum17/first-draft/main/docs/media/canvas-1280.webp" width="760" alt="One option on the canvas: a phone frame at 390 and a desktop frame at 1280">

  <img src="https://raw.githubusercontent.com/umeranjum17/first-draft/main/docs/media/canvas-390.webp" width="260" alt="The canvas on a phone: the phone frame comes first, the desktop frame below it">

- **Play**: click through the option's screens like a prototype, with a Back button, a button per screen and a phone/desktop switch.

  <img src="https://raw.githubusercontent.com/umeranjum17/first-draft/main/docs/media/play.webp" width="760" alt="Play: the second option's signed-in screen, reached from its sign-in screen, with Back and the screen buttons">

- **Comment pins**: numbered pins over the canvas and Play, read-only. Click or tap one to read it.

  <img src="https://raw.githubusercontent.com/umeranjum17/first-draft/main/docs/media/pin.webp" width="760" alt="A comment pin opened on the phone and desktop frames">

Each option opens at `<url>#/o/<n>`; add `/full` for Fullscreen or `/play` for Play.

Pins come from `<design>.comments.json` next to the design (`mocks/sign-in.html` reads `mocks/sign-in.comments.json`): an array of `{"option": 1, "x": 0.4, "y": 0.2, "text": "..."}`, with `x` and `y` as fractions of the frame. No file, no pins; a file that is not valid is named in a notice.

`view` listens on this machine's tailnet address (from `tailscale ip -4`) on port 4430, so any of your devices can open it; `--host` and `--port` change that. Options render from the next port, a second origin, in a frame that may run scripts but loads and sends nothing over the network.

## Models

Every model call goes through [BYOKit](https://www.npmjs.com/package/@byokit/accounts), on the model you choose. first-draft never picks one, and no route falls back to another account or model. `first-draft-axi init` with no flags lists the routes that are ready.

- **Your subscription CLI**: `byokit:codex` runs your installed, signed-in CLI with your normal home folder, and never copies its login.
- **A plan key or an api key**: a plan-key route such as `byokit:zai:plan_key`, or an api-key route such as `byokit:minimax:key` (its model defaults to `MiniMax-M3.1-Flash-Preview` when `init` gets no `--model`). The key comes from the environment variable `doctor` names, goes only to BYOKit for the call, and is never saved.

The choice lives in `$FIRST_DRAFT_HOME/config.json` (default `~/.first-draft/config.json`):

```json
{ "agent": "byokit:<route>", "agent_config": { "byokit:<route>": { "model": "<model id>" } }, "agent_timeout": "10m" }
```

## With sign-off (optional)

first-draft works on its own. If you use [sign-off](https://github.com/umeranjum17/sign-off) to get answers from people, `post` puts a design on a sign-off board as a pick-one card:

```sh
first-draft-axi post mocks/sign-in.html --title "Pick the sign-in layout" --option a=Calm --option b=Bold --option c=Dense --recommend a
```

It copies the options into the board's `mocks/` (the nearest `.sign-off/`, or `--board`), starts `view` if it is not already serving them, and runs `sign-off-axi post`. Each option gets a tappable Open link under its mock, to its Play url; the same urls also end the card text as `Open in first-draft:`, for boards that do not draw the link. A link inside a mock does not work: the board shows mocks in a sandbox that blocks it. `post` needs `sign-off-axi` 0.5.0 or newer on the PATH.

first-draft needs nothing from Firstmate: inside it or outside it, it runs on its own config.

## Agent skill

`skills/first-draft-axi/SKILL.md` tells a coding agent how to drive the CLI.

## Develop

```sh
npm install
npm test   # builds, then runs the real engine loop against local stand-ins; no paid call
```

[ENGINE.md](ENGINE.md) has the pinned design engine, its source and the model boundary. A change to a command, a default or the view updates this README, the skill and the screenshots in the same PR.

## License

MIT. See `LICENSE`.
