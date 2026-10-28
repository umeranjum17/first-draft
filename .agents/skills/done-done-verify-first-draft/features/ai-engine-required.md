# Authenticated engines are required; no degraded results

Sources: `src/byokit.mjs`, `src/benchmark.mjs`, `src/cli.mjs`, `src/judge.mjs`, `src/critic.mjs`, `src/draft.mjs`, `src/logo-concepts.mjs`, `src/redesign-check.mjs`, `src/redesign-writer.mjs`, `src/model-pool.mjs`, `test/engine-required.test.mjs`, `test/critic.test.mjs`, `test/inspiration-sources.test.mjs`.

## Offline CLI proof

Run `npm test` in the fully isolated HOME/XDG/TMPDIR described by the main skill.

- The engine-required journey launches its CLI children **without** the fixture loader or inherited credentials. Missing engines and configured-but-signed-out engines exit nonzero with exactly one provider/sign-in command and no output pages or baseline directory. OpenCode-only native storage reports that it is unusable by this build and gives a usable-provider sign-in step. One ready installed subscription is resolved and named by doctor, but cannot also judge its own output, even with a different model. `--no-critic` is refused.
- The retained critic integrations explicitly load test-only provider/CLI fixtures. They cover a make scored by an independent engine and a separate `judge` command on retained output; the former detailed capture, retry, and refusal matrix was removed.
- The optional account-pool journey in `test/model-pool.test.mjs` covers quota rotation and refuses a provider/model-changing account pick before model use or page write.
- Benchmark's real CLI journey in `test/inspiration-sources.test.mjs` scores retained/reference captures with independent engine provenance and refuses when discovery or an independent judge is unavailable. It also exercises no-result behavior on failed scoring and explicit test-only plumbing.
- Logo and redesign journeys use independent native-protocol judge fixtures, not the generator's self-assessment (`test/logo.test.mjs`, `test/public-references.test.mjs`).

The fixture preloader and fixture executables live under `test/fixtures/` and are not shipped. Production source does not recognize `FIRST_DRAFT_TEST_BYOKIT_BASE` or `FIRST_DRAFT_TEST_REF_ORIGIN`; setting those variables alone cannot activate an offline provider or loopback reference source. Fixture results prove protocol behaviour only, never live AI output or design quality.

## One real product run

With the installed, already signed-in CLIs and **normal HOME**, use a task-owned FIRST_DRAFT_HOME and output folder. Do not copy credentials. Run `node src/cli.mjs doctor`, then `node src/cli.mjs make "A small notes page for Umer. Two notes: Launch checklist and Release notes. One page, no marketing." --options 1 --first-view --out <owned-folder>/notes.html`. Do not load test preloads or fixture environment variables. Keep JSON/stdout, stderr, the model-written page and its baseline.

The run must name `made.agent`, `made.model`, `made.judge.agent`, and `made.judge.model`; generator and judge engines/models must differ. Every score comes from that judge, never an offline stand-in. A low real score remains flagged and is not a quality pass. A provider/authentication failure is a refusal, not permission to manufacture proof. For this CLI-only change, logs and real outputs suffice; no screenshot matrix is needed.
