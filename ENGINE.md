# Pinned design engine

Source: https://github.com/OpenCoworkAI/open-codesign

Fixed source commit: `a63feb563da94090778fc5bee67e9672fccd26a1` (2026-10-18).
Required packages: `@open-codesign/core`, `@open-codesign/providers`, `@open-codesign/shared`,
`@open-codesign/runtime` (the view only).

`vendor/open-codesign` is a `git subtree` import of a filtered tree, retaining the
original `packages/core`, `packages/providers`, `packages/shared`, `LICENSE` and
`NOTICE` paths. Filter commit: `c838ca9`. Import commit: `56d3a2c`.
`packages/runtime` was added later by a plain copy from the same fixed commit,
every file except its `vendor/` folder (the React, ReactDOM and Babel UMD builds).
All imported file blobs match the fixed source (`git hash-object` against the
commit's tree); no `apps`, runtime/vendor, or other packages are included. The
vendored tree is unmodified: every import path and file matches the
fixed source, and no upstream edit follows. The model boundary lives in our glue,
which registers itself as the engine's model transport before the engine runs.

`make` runs core's `generateViaAgent`, prompt composer, editor and static
`done` tools. The composed prompt is passed through unchanged, and the host's
export contract closes it by naming the only two tools it registers and ruling
out every other tool call. Core uses providers'
model/reasoning/error helpers and shared's
schemas, artifact and design validation. `scripts/build.mjs` bundles those three
packages and the runtime's preview builder with their upstream prompt sections,
and the view page; the package includes the bundles, LICENSE and NOTICE. `src/make.mjs` registers BYOKit as the transport for the
engine's model api, so BYOKit, not the upstream provider transport, answers every
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

## View

`view` serves one design locally: the view page on one port (default 4430) and
each option on the next port, a second origin. The host is the tailnet address
from `tailscale ip -4` unless `--host` or `FIRST_DRAFT_VIEW_HOST` names one;
`127.0.0.1` is the fallback. One node process, no Electron.

Used from the runtime as-is: `buildPreviewDocument` (in `dist/engine.mjs`) builds
each option's page server side: it drops the mock's own CSP meta, adds the
preview viewport support and the overlay script, whose error reporting
(`IFRAME_ERROR`), Escape (`PREVIEW_ESCAPE`) and navigation guard run inside the
option. The view page imports `isIframeErrorMessage` from `iframe-errors.ts`.
The build resolves the runtime's `../vendor/*?raw` imports to empty strings,
since the UMD builds are not vendored, so JSX previews are not supported. The
view never sends `SET_MODE`, so the overlay's selection and comment modes stay
off, and the page acts only on `IFRAME_ERROR` and `PREVIEW_ESCAPE` from its own
iframes.

Each option is served with an HTTP policy that replaces the meta one:
`sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src
'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:;
connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors <view>`.
The iframe sandbox is `allow-scripts` only. Scripts therefore run only inside
that sandbox; `make` still exports script-free mocks. Options over 5 MB are refused.

Ported from `apps/desktop/src/renderer/src` (React/TSX with Electron IPC) as plain
code in `src/view/`, bundled by esbuild into `dist/view/`:

- `components/PreviewPane.tsx`: `ScaledPreviewFrame` as `scaled()`, unchanged
  math. `INTERACTIVE_PREVIEW_SANDBOX` (`allow-scripts allow-forms`) drops
  `allow-forms`. The desktop artboard is 1280x800, not 1440x900.
  `computeFitPreviewZoom` becomes `fitCanvas`, which fits the phone and desktop
  artboards on one row and stacks them, each fitted to the width, below 45%.
  Options load by URL from the second origin, not `srcdoc`. Tabs, comments,
  pins, source edit, tweaks and the store are not ported.
- `components/PhoneFrame.tsx`: `phoneFrame()` plus CSS, with the phone tokens
  from `packages/ui/src/tokens.css`. The screen is 390x844, not 375x812.
- `components/CanvasErrorBar.tsx`: `errorBar()`, without i18n or
  `humanizeError`; it shows the formatted error.
- `preview/helpers.ts`: `formatIframeError` and `isTrustedPreviewMessageSource`,
  unchanged.
- `preview/fullscreen.ts`: Escape, from the page or the option, leaves fullscreen.
  The canvas's Play link opens an option fullscreen.

`packages/core/src/frames` holds JSX device snippets for the agent; the view
renders HTML only and does not use them.

Not in this slice: JSX/runtime exports, external assets, image generation,
workspace persistence, revision, multi-screen flows, comments,
sign-off links, or new publication. The first PR
target remains **2026-10-20**; merge and publication require Main's approval.
