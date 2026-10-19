# Pinned design engine

Source: https://github.com/OpenCoworkAI/open-codesign

Fixed source commit: `a63feb563da94090778fc5bee67e9672fccd26a1` (2026-10-18).
Required packages: `@open-codesign/core`, `@open-codesign/providers`, `@open-codesign/shared`.

`vendor/open-codesign` is a `git subtree` import of a filtered tree, retaining the
original `packages/core`, `packages/providers`, `packages/shared`, `LICENSE` and
`NOTICE` paths. Filter commit: `c838ca9`. Import commit: `56d3a2c`. All imported
file blobs match the fixed source; no `apps`, runtime/vendor, or other packages
are included. The next commit adds one optional `streamFn` injection (three
lines) in core; there are no other upstream edits.

`make` runs core's `generateViaAgent`, prompt composer, editor and static
`done` tools. Core uses providers' model/reasoning/error helpers and shared's
schemas, artifact and design validation. `scripts/build.mjs` bundles those three
packages with their upstream prompt sections; the package includes the bundle,
LICENSE and NOTICE. BYOKit, not the upstream provider transport, answers every
engine turn. No BYOKit fork or copied credential is used.

The first slice exports one script-free `index.html` from a bounded, in-memory
workspace. It explicitly overrides the engine's JSX output guidance, requires
successful static `done`, rejects script-bearing output, and retains the existing
CSP and 5 MB sign-off limit. An engine run may need multiple model turns; it
stops on its first boundary failure, with no retry or route fallback.

`doctor` loads the actual built engine and prompt sections, validates plan-key
model metadata, and checks the selected route locally. Installed-CLI readiness
uses BYOKit's native status probe, never a paid model request. It cannot promise
server-side model availability.

Not in this slice: JSX/runtime exports, external assets, image generation,
workspace persistence, live preview/revision, or new publication. The first PR
target remains **2026-10-20**; merge and publication require Main's approval.
