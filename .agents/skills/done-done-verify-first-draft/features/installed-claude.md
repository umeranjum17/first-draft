# Installed Claude subscription route

Source: `src/byokit.mjs`, `src/cli.mjs`; deterministic CLI integration journey: `test/claude.test.mjs`.

## Drive

1. Run `node --test test/claude.test.mjs`. It uses a private native CLI fixture and isolated HOME/XDG/TMPDIR: init, no-paid doctor, make, refine, missing executable and signed-out/API-key/other billing refusals. It exercises the published BYOKit adapters, not a replacement adapter. No paid calls in tests.
2. For an explicitly authorized live proof, use a task-owned `FIRST_DRAFT_HOME`, but retain the normal HOME and the installed, already signed-in Claude binary. Never read, copy or override its login files, account pins, or keys. Run `node src/cli.mjs init --agent byokit:claude --model claude-opus-5-5` then `node src/cli.mjs doctor`. Save JSON: ready true, installed CLI, model availability not probed. Doctor only asks the native CLI for sign-in metadata; it does not call a model.
3. Run one bounded `node src/cli.mjs make "<small brief>" --out <evidence>/notes.html`. Save stdout/stderr and exit code. Success requires the chosen model in stdout, a verified exported file and no truncation. Do not enable extra credits. On a Claude limit, report it and stop, not a fallback key or another provider.
4. If capturing the result, start `node src/cli.mjs view <evidence>/notes.html --host 127.0.0.1 --port <private-port>`. Drive the printed URL using chrome-devtools-axi in a task-named session. Inspect the exported page at 390x844 and 1280x800, in light/dark; open and inspect every retained screenshot. Stop the view and browser you started.

## Boundaries

The route uses BYOKit's Claude account launch and `claudeCode` structured generation adapter. API keys are filtered by name before reading environment values. The adapter disables tools, MCP, hooks and session persistence, and independently verifies subscription authentication before generation. Model IDs pass through unchanged. Images are supported by that published adapter; this route-only slice does not yet expose `make/refine --ref` or strengthen desktop render checks.
