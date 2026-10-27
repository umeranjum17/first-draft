# Testing first-draft (about 30 minutes, one sitting)

Every line below was run from a fresh clone of `main` plus this change, with a throwaway `FIRST_DRAFT_HOME`, on Linux with Node 26.7, Chromium, `claude` 2.1 and `codex` 0.159. Times are what that run took; yours will vary with the models' load. Nothing here was run on macOS or Windows.

## Before you start (your own sign-in)

- Node **22.18+** and Chrome or Chromium on `PATH` (or `FIRST_DRAFT_CHROME=/path/to/it`).
- **Both** the `claude` and `codex` CLIs signed in: one makes the pages, the other must judge them. One engine alone is refused. Sign in with `claude auth login` and `codex login`.
- Optional, only for the `post` step: `sign-off-axi` 0.5.0+. `view` works without Tailscale; it falls back to `127.0.0.1` and says so.

## Run it

```sh
git clone https://github.com/umeranjum17/first-draft && cd first-draft
npm ci && npm pack && npm install -g ./first-draft-axi-*.tgz   # npm's published 0.3.0 predates the refine fix
export FIRST_DRAFT_HOME=$(mktemp -d)                            # throwaway config, nothing of yours is touched
mkdir ~/fd-test && cd ~/fd-test

first-draft-axi init --agent byokit:codex --model gpt-6.1-sol    # ~1 s
first-draft-axi doctor                                           # 4–20 s, no model call, "ready": true
first-draft-axi make "A notes app" --out notes.html              # 9–10 min, three options
first-draft-axi view notes.html --host 127.0.0.1                 # prints a URL within ~15 s; open it; Ctrl+C stops it
first-draft-axi judge notes-1.html "A notes app" --plain notes.critic/plain.html   # 25–45 s
first-draft-axi refine notes-2.html "Warmer palette" --out notes-warm.html         # 2–6 min
echo '{"notes":{"total":2}}' > data.json
first-draft-axi check notes-1.html --data data.json              # <1 s, {"note":"checked","mismatches":[]}
```

Benchmark (about 1.5 minutes; it needs screenshots, so make two and borrow two licensed references from `refs pull`):

```sh
first-draft-axi refs pull                                        # ~40 s, public MIT/OGL references into $FIRST_DRAFT_HOME
CH=${FIRST_DRAFT_CHROME:-chromium}
for n in 1 2; do $CH --headless=new --hide-scrollbars --window-size=390,844 --screenshot=$PWD/shot-$n.png file://$PWD/notes-$n.html; done
R=$FIRST_DRAFT_HOME/refs-library
cp $R/shadcn-dashboard/phone-light.png ref1.png; cp $R/starlight-docs/phone-light.png ref2.png
cat > screens.json <<'EOF'
[{"role":"current","name":"Notes option 2","file":"shot-2.png","source":"first-draft make output","permission":"Own generated page","captured_at":null,"theme":"light"},
 {"role":"candidate","name":"Notes option 1","file":"shot-1.png","source":"first-draft make output","permission":"Own generated page","captured_at":null,"theme":"light"},
 {"role":"reference","name":"shadcn dashboard phone","file":"ref1.png","source":"https://ui.shadcn.com/view/new-york-v4/dashboard-01","permission":"MIT, refs pull cache","captured_at":null,"theme":"light"},
 {"role":"reference","name":"Starlight docs phone","file":"ref2.png","source":"https://starlight.astro.build/getting-started/","permission":"MIT, refs pull cache","captured_at":null,"theme":"light"}]
EOF
first-draft-axi benchmark --product "notes app" --screen "phone note list" --input screens.json --width 390 --theme light --out benchmark.html
```

Posting needs a sign-off board. Use a throwaway one so your real board is never touched: `mkdir -p ~/fd-board/home && cd ~/fd-board && export SIGN_OFF_HOME=$PWD/home && sign-off-axi init`, then from that folder `first-draft-axi post ~/fd-test/notes.html --title "Which notes app?" --recommend a --host 127.0.0.1` (~2 s, one card with a link per option). If no `view` was already running for that design, `post` starts one, prints its `pid` and leaves it serving; `kill` that pid when you are done. `unset SIGN_OFF_HOME` afterwards.

## What a good run looks like

| Step | Files / lines you should see |
| --- | --- |
| `make` | `notes-1.html`, `notes-2.html`, `notes-3.html` (70–180 KB each) and `notes.critic/plain.html`; JSON with `"render_check":"checked"`, `critic.judge.agent` = the *other* engine (`byokit:claude` when you made with codex), a `critique.score` and `plain_score` per option. Last run: scores 7, 7, 7 against plain 4, 3, 3 and `"passed":false`, because the bar is 9. A low score is reported, not hidden. |
| `judge` | `critique.score`, four `views` (1280 and 390, light and dark), `capture.images: 8` |
| `refine` | `{"refined":{...}}` and a new `notes-warm.html`; `notes-2.html` is byte-for-byte unchanged |
| `benchmark` | `benchmark.html` plus `benchmark.html.json`; `judge` reads `independent: byokit:claude / claude-sonnet-5-5`; one score row per `current`/`candidate`; some `refused` entries (Reddit's robots.txt, for one) are normal |

Cost is your subscription quota, not money: the generator reported about 68k tokens in and 37k out for the three options. The judge's tokens are not reported by the CLI routes, so there is no total to quote.

## Three checks to eyeball (under a minute)

1. **Independence.** In the `make` JSON, `agent`/`model` (maker) and `critic.judge.agent`/`model` (judge) must be different engines. If they match, stop and report it.
2. **The pages.** In `view`, open an option at Phone (390) and Desktop (1280): no sideways scroll, readable text, and the dark theme actually looks different from light. A page that looks like a stock template with a "Notes" heading is a bad run even if it scored 7.
3. **Honest refusal.** Hide your sign-ins and run any command: `env -i HOME=$(mktemp -d) PATH="$(dirname "$(node -p process.execPath)"):$(dirname "$(command -v first-draft-axi)"):/usr/bin:/bin" first-draft-axi make "A notes app" --out x.html; echo "exit $?"`. You must get exactly one line, `No usable AI engine. Sign in to Claude: claude auth login`, exit code 1, and no `x*.html`. The other entry points (`judge`, `refine`, `benchmark`, `logo`, `redesign`) give the same line.

## If it breaks

Collect this and send it (it holds no credentials):

```sh
{ date -u; first-draft-axi --version; node -v; claude --version; codex --version; chromium --version
  first-draft-axi doctor; cat "$FIRST_DRAFT_HOME/config.json"; ls -la; } > evidence.txt 2>&1
# then the failing command again, keeping its output and exit code:
first-draft-axi <the command> 2>&1 | tee -a evidence.txt; echo "exit ${PIPESTATUS[0]}" >> evidence.txt
```

- `NO_ENGINE`: sign in as the line says, then rerun. Nothing was written.
- `JUDGE_FAILED … not valid JSON`: the judging model garbled its answer. It is asked three times; if it still fails, rerun. Across the runs behind this guide `make` died this way 3 times in 7 (after 6–7 minutes each, no pages kept), twice in a row in the last re-walk, so expect to rerun once and send `evidence.txt` if it fails twice.
- `MAKE_FAILED … did not refine the design`: send `evidence.txt`; a refine on a normal `make` output should finish in minutes, not 14.
- Stuck for more than 20 minutes with no output: Ctrl+C, then send `evidence.txt`.

Not run for this guide: `logo`, `redesign`, `--competitors`, `--inspiration`, `--assets` (paid image providers), the Studio comment pins, macOS and Windows.
