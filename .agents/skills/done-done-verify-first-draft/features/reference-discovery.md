# Named-reference discovery (slice 1, no fetch)

Sources: `src/reference-discovery.mjs`, `src/cli.mjs`. This is a nonvisual CLI feature, not the automatic-reference or viewer feature.

## Drive

1. Run `node --test test/reference-discovery.test.mjs`. The public CLI calls a local provider fixture in isolated HOME/XDG/TMPDIR, using synthetic credentials and no installed subscription tools. The named-brand regression prompt is `make it like Vercel`; exercise explicit brand override, direct URL without model/config, no named brand, unknown homepage, invalid model output and provider failure. No brand-site or paid calls in CI.
2. For an authorized real-model proof, retain normal HOME and installed, signed-in Claude; set only `FIRST_DRAFT_HOME` to a task-owned directory. Never copy login files or enable extra credits. Run `node src/cli.mjs init --agent byokit:claude --model claude-opus-5-5`, then `node src/cli.mjs references "make it like Vercel"`. Save stdout/stderr/exit status. Require candidate name Vercel, an HTTPS candidate URL or honest null homepage, chosen model/agent, and `fetched:false`. Repeat with `--like Linear` to check override, or a generic style to check no-brand behavior. Stop on subscription limits; no key/gateway fallback.
3. With an empty task-owned FIRST_DRAFT_HOME, run `node src/cli.mjs references --like https://vercel.com/`. Require the URL in JSON and zero model tokens, no configured agent needed.
4. Inspect every result's notice: discovery only, URL unverified, no robots/terms check or screenshots, no design changed. Do not open candidates as part of this proof: the implementation does not fetch them and they are not site-access permission. There is no changed screen or motion to capture.

## Boundaries

Discovery does not claim a URL exists, identify licence permissions, cache a page, or feed generation. It is an explicit planning command, not automatic extraction in make/refine. Semantic recognition depends on the configured model; deterministic fixture responses test transport/validation, not model accuracy. Fetch controls, project cache, visual extraction and viewer integration require later slices and their own local brand-site fixture journey. An explicit URL is accepted as an unverified HTTPS candidate, not validated as publicly routable; any future fetcher must validate destination/redirect/DNS boundaries before network access.
