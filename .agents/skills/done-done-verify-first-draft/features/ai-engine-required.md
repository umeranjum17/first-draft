# Authenticated engines are required; no degraded results

Sources: `src/byokit.mjs`, `src/cli.mjs`, `src/judge.mjs`, `src/critic.mjs`, `src/draft.mjs`, `src/logo-concepts.mjs`, `src/redesign-check.mjs`, `src/redesign-writer.mjs`, `src/model-pool.mjs`, `test/engine-required.test.mjs`, `test/critic.test.mjs`, `test/model-pool.test.mjs`.

## Offline CLI proof

Run `node --import ./test/fixtures/provider-hooks.mjs --test test/engine-required.test.mjs test/critic.test.mjs test/model-pool.test.mjs` in the caller-owned HOME/XDG/TMPDIR described by the main skill.

- The engine-required journey launches its CLI children **without** the fixture loader or inherited credentials. Missing engines and configured-but-signed-out engines exit nonzero with exactly one provider/sign-in command and no output pages or baseline directory. OpenCode-only native storage reports that it is unusable by this build and gives a usable-provider sign-in step. One ready installed subscription is resolved and named by doctor, but cannot also judge its own output, even with a different model. `--no-critic` is refused.
- The critic journey explicitly loads test-only provider/CLI fixtures. It proves independent judging with and without reference-cache images, native attachments covering both themes and widths, failed/missing/signed-out/malformed/same-model judge refusal, corrupt-cache refusal, no generator self-assessment, and unchanged retained input pages. No browser means refusal before generation (`test/render-check.test.mjs`). A failed repair produces no unrepaired page (`test/make.test.mjs`).
- The pool journey drives public BYOKit-backed page/engine calls through actual native subprocess adapters. Same-engine account rotation remains available, but a provider/model-changing pick errors before any model call or page write.
- Logo and redesign journeys use independent native-protocol judge fixtures, not the generator's self-assessment (`test/logo.test.mjs`, `test/public-references.test.mjs`).

The fixture preloader and fixture executables live under `test/fixtures/` and are not shipped. Production source does not recognize `FIRST_DRAFT_TEST_BYOKIT_BASE` or `FIRST_DRAFT_TEST_REF_ORIGIN`; setting those variables alone cannot activate an offline provider or loopback reference source. Fixture results prove protocol behaviour only, never live AI output or design quality.

## One real product run

With the installed, already signed-in CLIs and **normal HOME**, use a task-owned FIRST_DRAFT_HOME and output folder. Do not copy credentials. Run `node src/cli.mjs doctor`, then `node src/cli.mjs make "A small notes page for Umer. Two notes: Launch checklist and Release notes. One page, no marketing." --options 1 --first-view --out <owned-folder>/notes.html`. Do not load test preloads or fixture environment variables. Keep JSON/stdout, stderr, the model-written page and its baseline.

The run must name `made.agent`, `made.model`, `made.judge.agent`, and `made.judge.model`; generator and judge engines/models must differ. Every score comes from that judge, never an offline stand-in. A low real score remains flagged and is not a quality pass. A provider/authentication failure is a refusal, not permission to manufacture proof. For this CLI-only change, logs and real outputs suffice; no screenshot matrix is needed.
