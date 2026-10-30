# Pinned design engine

first-draft uses **OpenDesign**, from our maintained fork:
https://github.com/umeranjum17/open-design.

- Fork commit: `3805d0303285d019185cde25b110e5bba4f21140`.
- Upstream: https://github.com/nexu-io/open-design.
- Corresponding upstream commit: `3805d0303285d019185cde25b110e5bba4f21140`
  (the fork and upstream match at this pin).
- Add-on branch: **none**. Upstream source files are unmodified; the adapter is
  first-draft code, not a patch to OpenDesign.
- License: Apache-2.0, retained verbatim at `vendor/open-design/LICENSE` and
  `dist/opendesign/LICENSE` in the installed package. Individual skill notices
  and licenses take precedence for their material; see [NOTICE](NOTICE).

## Generation boundary

This is an embedded **design-generation slice**, not a bundled OpenDesign
application or daemon. OpenDesign's canonical
`packages/contracts/src/prompts/od-next-strategy.ts` composes the OD Next
`od-next-plan-build-v2` recipe in `text_artifact` execution mode from its
unmodified core, orchestration and prototype task-profile assets. Their
versions, source hashes and exact commit identity accompany each recipe.
`src/design-engine.mjs` supplies the host execution contract; it does not
rewrite the upstream design instructions.

The normal one-page path (`src/draft.mjs`) uses this recipe, followed by
first-draft's existing frontend-design guidance, human-side guidance and page
contract. Its bounded host repair and independent critic remain first-draft's.
The per-screen redesign writer (`src/redesign-writer.mjs`) uses the same recipe
before its unchanged shared-plan, content-preservation and screen output contract.
`--engine`, refine, logo and generated-assets runs use the OpenDesign
recipe through `src/engine-host.mjs`'s incremental workspace tools. That small
host loop implements the editor, method-skill/scaffold loading, planning,
image-provider bridge and `done` submission. It is not an alternate design
brain. The established CLI commands and flags are unchanged.

**Every model call still goes through first-draft's BYOKit adapter.** Claude
uses only the signed-in Claude subscription. No OpenDesign agent launcher,
provider configuration, credential reader, daemon, native child agent or paid
route is imported. The host contract explicitly requests first-draft's gates;
OpenDesign's generator-only ship-on-write default cannot turn them off.

## Vendored paths and sync

`vendor/open-design/manifest.json` records SHA-256 for every imported file.
The imported slice is:

- `packages/contracts/src/prompts/od-next-strategy.ts` and the exact local
  source dependencies its build resolves (listed in the manifest).
- `plugins/_official/scenarios/od-next-strategy/`: `open-design.json`,
  `SKILL.md`, core and orchestration assets, and the prototype task profile.
- `skills/frontend-design`, `skills/animate`, `skills/gsap-core`, including
  every bundled `LICENSE`, `LICENSE.txt` and `SOURCES.md`.
- `craft/` and the root Apache-2.0 `LICENSE`.

To sync, use a clean checkout of our fork at the chosen full SHA, with the
`upstream` remote fetched. From first-draft's root:

```sh
node scripts/sync-opendesign.mjs /path/to/clean/open-design <40-character-sha>
npm run build
npm test
```

The script verifies the clone's HEAD/clean tracked source, resolves the
composer's dependency graph, and reads exact blobs from Git, not working-file
copies. Review the new manifest, update both pins above (the upstream mapping
is the merge base with `upstream/main`), repeat the same-brief blinded old/new/
plain rendered comparison, and retain every imported skill's legal files.
Any change needed in the fork belongs in a thin add-on on its own branch;
record that branch and the resulting exact fork/upstream commits here.

The build removes stale `dist` output before bundling. It copies the imported
slice to `dist/opendesign`, its skills/craft into `dist/templates`, and overlays
first-draft's own `templates/`. No old-engine prompts or providers are packed.

## first-draft still owns acceptance

The critic and independent authenticated judge fallback, reference capture and
reference check, scoring and below-bar flags, render/data/page checks, redesign
checks, and the facts rule stay in first-draft. There is no scoring-off flag.
Method skills `interaction-motion`, `motion-sites`, `logo-system` and
`clarity-over-flash`, plus the frontend-design and human-side craft guidance,
remain first-draft inputs. Model scores are assessments, not a design-match
or functional certification.

The host still draws every exported screen at 390x844 and 1280x800 in light
and dark. The whole design is a self-contained HTML page under the existing
CSP, at most 5 MB. Fonts and permitted media are embedded; remote files do not
load. JSX is drawn once by the compatibility renderer and snapshotted without
script. An HTML page whose script is all inline keeps it, so the motion a brief
asks for plays; its CSP adds `script-src 'unsafe-inline'` and nothing else, so
it still loads and sends nothing. A `<script src>` is refused, or drawn once
and dropped when a browser is present. `done`
submits source to these same gates, and a failed submission returns the exact
findings. Turn limits, bounded retries and the last verified version remain
host-owned. Logo SVG/palette/icon validation and independent logo review stay
in first-draft too.

## Studio and the retired engine

The old generation engine was OpenCoworkAI/open-codesign at
`a63feb563da94090778fc5bee67e9672fccd26a1`. Its core, providers, generation
prompts and templates are retired after the migration comparison passes;
`vendor/open-codesign/README.md` records the move.

Studio is first-draft's existing plain-code UI in `src/view/`, originally
ported from that commit. Its **non-generating sandbox/JSX runtime** and the
few shared HTML/editmode helpers it needs remain unmodified at
`vendor/studio-runtime`, with the original MIT LICENSE and NOTICE. This is
solely the established preview/export compatibility layer: it cannot call a
model, compose a design prompt, choose a provider or generate a design.
Its React/ReactDOM/Babel/device-frame vendored files remain with that runtime.
The retained compatibility `templates/scaffolds/design-systems/DESIGN.md`
is an MIT-attributed starter, not a live design engine.

`view` still serves the UI and options on separate origins, with sandbox
`allow-scripts` only, no network, no forms and the existing 5 MB cap. The
unchanged overlay switches `data-oc-screen` sections via hash links for Play,
reports iframe errors and handles Escape. Studio's grid, canvas, phone and
desktop artboards, source/refine controls and comment pins keep their current
behavior; the engine swap grants the sandbox no new permission.

`doctor` loads the real OpenDesign composer/skills and the preview runtime,
then probes the selected installed CLI's local authentication via BYOKit.
It makes no model request and cannot promise server-side model availability.
