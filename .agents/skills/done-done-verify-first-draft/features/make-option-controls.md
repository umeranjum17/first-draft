# Make option count and brief controls

Drive the real installed CLI from an empty folder, with FIRST_DRAFT_HOME pointing to task-private config. Use the approved BYOKit route/model and its environment key, never copy credentials. Pack with `npm pack --pack-destination <scratch>` and install the tarball in an empty folder first.

1. Run `first-draft-axi init --agent byokit:opencode-go --model muse-spark-1.3-contributor`, then doctor (no paid call).
2. Write a brief for a notes app for Umer. Run `make --brief-file brief.md --options N --screens "Sign in,Notes" --style editorial --out-dir options-N` for N=1,3,5. Capture stdout/stderr and exit status, count the files, check each is self-contained HTML and visually inspect screen coverage. Model instructions are not deterministic guarantees.
3. Confirm default count is 3, legacy `--count`/`--direction` work, `--model` overrides this run only, and saved config is unchanged. Regression journey: `node --test test/make.test.mjs` (local provider, no paid call).
4. Try 0,6,fractional/non-numeric counts, conflicting aliases/output flags, blank strings, malformed screen lists, unreadable/empty/oversized/non-UTF-8 briefs and malformed model ids. Each must exit 1 with a clear JSON USAGE error before a model call or file write. Unknown provider model ids are rejected by the provider, not a local allowlist.
5. Open generated options with `view <folder> --host 127.0.0.1 --port <private-port>`. Capture grid showing option count and one option's Play screen; retain run JSON, file inventory and installed package version as primary CLI proof. No viewer redesign or viewport matrix is part of this change.

Record the live capture through done-done at a committed candidate. Keep evidence outside the checkout, stop only the processes this capture started, and inspect every screenshot before citing it.
