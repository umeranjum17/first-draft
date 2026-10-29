# Make on OpenDesign: incremental generation, first-draft gates

Source: `src/design-engine.mjs`, `src/engine-host.mjs`, `src/make.mjs`,
`src/draft.mjs`, `src/redesign-writer.mjs`, `src/render-check.mjs`,
`scripts/build.mjs`, `scripts/sync-opendesign.mjs`, `ENGINE.md`.

## User path

Default `make` is one page call plus first-draft's bounded repair and independent
critic. `--engine` uses incremental workspace tools; refine, logo and generated
assets use that host loop too. The per-screen redesign writer keeps its shared
plan, content locks and screen budget. All use the same pinned OpenDesign OD
Next design recipe; first-draft still owns transport and every acceptance gate.
The non-generating Studio/JSX runtime is retained separately for compatibility.

## Drive

1. `npm test` runs the unmodified public CLI integration journeys plus
   `test/opendesign.test.mjs`: exact vendored-byte/license checks and a real
   in-memory tool-loop submission that fails the host verifier, repairs, and
   passes. The path traversal attempt must fail. Native CLI tests use
   `--import ./test/fixtures/provider-hooks.mjs` when run individually.
2. Use an explicitly authorized task-owned FIRST_DRAFT_HOME and a short real
   TMPDIR for Chrome. Keep normal HOME and the signed-in subscription; never
   copy credentials. Initialize `byokit:claude` / `claude-opus-5-5` and an
   independent `byokit:codex` / `gpt-6.1-sol` judge. `doctor` must name the exact
   OpenDesign pin and make no model request.
3. Run `first-draft-axi make "<brief>" --options 1 --engine --out <file.html>`.
   Read `source`, `turns`, `tools`, `truncated`, render status and the independent
   critic. The source may be HTML or JSX. A successful `done` is followed by the
   final assistant turn; subsequent edits invalidate that verified version.
   The host checks source/export at 390/1280 in light/dark and sends findings
   back, bounded by the existing retries and 60-turn cap.
4. The exported page has its CSP, no scripts/handlers and embedded fonts/media.
   Open it and Studio with chrome-devtools-axi in a task-owned session, at 390
   and 1280, light/dark, full page. Record horizontal overflow and vertical
   scroll-container counts; scroll inner app containers to capture their tails
   rather than calling a first viewport the whole app. Inspect the PNGs.
5. With a nonexistent FIRST_DRAFT_CHROME, generation must deliver script-free
   HTML. Independent scoring still requires a real browser; no skipped render
   or unavailable judge is a passing score.
6. For an engine release, freeze the old packed CLI and compare its real default
   make, the new default make, and plain same-model output on both required
   briefs. Record blinding before judging. Show every score, including values
   below nine. This is comparative evidence, not an approved-layout match.
7. Pack, install in a clean folder and run the installed binary's `--version`
   and `doctor`. Verify the OpenDesign license/skill sources, first-draft method
   skills and preview-runtime attribution are present in the packed build.
8. Stop only the browser and view processes this proof started.
