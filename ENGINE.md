# Pinned design engine

Source: https://github.com/OpenCoworkAI/open-codesign

Fixed source commit: `a63feb563da94090778fc5bee67e9672fccd26a1` (2026-10-18).
Required packages: `@open-codesign/core`, `@open-codesign/providers`, `@open-codesign/shared`,
`@open-codesign/runtime` (the view only).

`vendor/open-codesign` is a `git subtree` import of a filtered tree, retaining the
original `packages/core`, `packages/providers`, `packages/shared`, `LICENSE` and
`NOTICE` paths. Filter commit: `c838ca9`. Import commit: `56d3a2c`.
`packages/runtime` was added later by a plain copy from the same fixed commit, and
its `vendor/` folder (the React, ReactDOM and Babel builds and the device-frame JSX)
after that, also by a plain copy, as was `apps/desktop/resources/templates` (the
templates tree: method skills, design starters, scaffolds, frames, brand
references). All imported file blobs match the fixed source (`git hash-object`
against the commit's tree); no other `apps` file or package is included. The
vendored tree is unmodified: every import path and file matches the
fixed source, and no upstream edit follows. The model boundary lives in our glue,
which registers itself as the engine's model transport before the engine runs.

`make` runs core's `generateViaAgent` the way upstream's desktop host does
(`apps/desktop/src/main/ipc/generate.ts`): the engine's own prompt for the mode,
the resource manifest from the templates tree, and every default tool (`set_title`,
`set_todos`, `skill`, `scaffold`, the editor, `done` with its DESIGN.md
requirement, `tweaks` and the UI-kit tools, and with `--assets` `generate_image_asset`, whose
missing provider field our glue offers to the model at the transport boundary). The workspace is in memory and is seeded
with `frames/*.jsx` and `skills/*.jsx` (the design starters) as upstream's
`runtime-fs.ts` seeds it; `scaffold` copies into a temporary folder and the file
joins the workspace through `onScaffolded`. Two method skills are first-draft's own:
`templates/skills/interaction-motion.md` (press, hover, focus and entrance motion in
CSS, reduced motion and worst-case data), written from the ideas in Emil Kowalski's
MIT skills (https://github.com/emilkowalski/skills) with no text copied, and
`templates/skills/logo-system.md` (refine the given concept, one idea per mark, a grid,
optical balance, letters drawn as paths, detail that survives at 16 px, a palette with
a reason, the icon's safe zone), written for first-draft; the build adds them to the
engine's `skills/`, so the same `skill` tool loads them. `logo` runs the same engine with
a logo export contract: the engine writes `logo/*.svg`, `logo/palette.json` and a brand
sheet `index.html`, and `done`'s runtime check (`src/logo.mjs`) parses each SVG against
an allow-list, checks the palette and draws the icon in the same headless browser,
measuring its detail at 16 px, before the sheet's usual render check. Around the engine
runs, `src/logo-concepts.mjs` makes two bounded calls of its own on the same route and
model, as the redesign review does: one that proposes 6 to 8 rough concepts and one that
critiques marks drawn at 16 and 32 px (for the sketches, then for each finished option). The host's export contract, added after
the engine's prompt, keeps only what the board needs (see below). Core uses
providers' model/reasoning/error helpers and shared's schemas, artifact and design
validation. `scripts/build.mjs` bundles those packages and the runtime (its `?raw`
imports load the vendored files' text), copies the templates tree to
`dist/templates` and the upstream prompt sections, and builds the view page; the
package includes the bundles, LICENSE and NOTICE. `src/make.mjs` registers BYOKit as
the transport for the engine's model api, so BYOKit, not the upstream provider
transport, answers every engine turn. No BYOKit fork or copied credential is used.

The board takes one script-free page under the CSP below, at most 5 MB. With Chrome
or Chromium on the machine the engine writes its usual source (`App.jsx`), and `done`'s
runtime check, like upstream's `done-verify.ts`, draws it: the runtime's
`buildStandaloneDocument` (React and Babel inline) is loaded headless at 1280px under
a policy that allows inline script, Babel's eval and cdnjs scripts only, and the page
it drew is kept as static HTML: scripts, handlers, `javascript:` URLs, `base` and
policy tags removed, form values and canvases kept as markup. Its errors go back to
the model. The Google Fonts stylesheets the page links or imports are fetched by the
host and their latin faces embedded as `data:` URIs (`src/fonts.mjs`); images are
inline SVG, CSS or `data:` URIs. That static page is what the board sees. The host
checks the complete file and every screen independently at 390x844 and 1280x800,
in light and dark, for overflow, visibility and themes. Desktop screen containers
must exceed phone width; this structural check is not a visual-quality guarantee. With no browser the contract asks the engine for
script-free `index.html` instead, and a page with script is refused. The engine ends
a run when the model stops or after three failed `done` rounds, even when no version
has passed `done`; upstream's app then waits for the user. make instead sends `done`'s
errors back as the next message, at most three times, so a brief ends with a version
that passed. An engine run may need many model turns; a bound of 60 turns stops a run
that never ends (the last version that passed `done` is kept), and a failed boundary
call is retried only when it timed out or its connection dropped.

first-draft's `templates/skills/motion-sites.md` joins its method skills the same way: taste
rules for a page whose motion is part of the message (one moving subject, still words, a
one-time entrance, CSS-only motion whose first frame is the finished design, a
reduced-motion still, and when not to animate), with a text-only reference set, written
for first-draft from a study of public motionsites.ai examples with no text, code, media
or pixels copied. Its description asks the engine to load it only when a brief asks for
motion; that is a model instruction, not a host check.

`doctor` loads the actual built engine and prompt sections, validates plan-key
and api-key model metadata, and checks the selected route locally. Installed-CLI readiness
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
Options are static HTML (see above), so the
view never needs the JSX runtime. The view never sends `SET_MODE`, so the overlay's selection and comment modes stay
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
  pins (see Comment pins), source edit, tweaks and the store are not ported.
- `components/PhoneFrame.tsx`: `phoneFrame()` plus CSS, with the phone tokens
  from `packages/ui/src/tokens.css`. The screen is 390x844, not 375x812.
- `components/CanvasErrorBar.tsx`: `errorBar()`, without i18n or
  `humanizeError`; it shows the formatted error.
- `preview/helpers.ts`: `formatIframeError` and `isTrustedPreviewMessageSource`,
  unchanged.
- `preview/fullscreen.ts`: Escape, from the page or the option, leaves fullscreen.

### Play

`#/o/<n>/play[/phone|/desktop]` opens one option as a clickable prototype on one device.
Screens are the runtime overlay's own mechanism, used unchanged: sections marked
`data-oc-screen` with an `id`, switched by in-page hash links (`showScreen`), the first
shown first; the overlay already blocks every other navigation. Options without
`data-oc-screen` are single-screen Play. Form states (empty, filled, submitted) are screens
the option links between. `PLAY_BRIDGE` in `src/view.mjs` is the only addition: a small
script appended to an option served as `/o/<n>?play` (never to thumbnails or the canvas) that
reports the active screen, with the screen list, to the view page and, on its request, goes
to a screen or back by clicking an in-page hash link, so the overlay does the switch. The
view page keeps no history; the bridge keeps the screens visited. Messages are
`{__firstDraft: true, type: 'SCREEN' | 'GO' | 'BACK'}`; the sandbox, CSP and 5 MB cap are
unchanged, and the view posts with target `*` because the sandboxed option has no origin.
`make`'s export contract asks for this screen-link contract (`data-oc-screen`
sections, hash links, no script), with responsive columns inside each full-width
screen rather than different screens used as desktop columns. Output stays script-free.
A view URL's `?screen=<id>` (before the hash) selects that screen in Studio or Play;
the host validates/escapes it and seeds the existing overlay's active-screen attribute.
Play reflects the current screen in this query, so phone/desktop links keep it.
`post` returns both device URLs and includes them in its fallback text.

### Comment pins

Read-only, from `components/comment/PinOverlay.tsx` as plain code in `src/view/app.js` (`pinLayer`) and
`view.css`: a layer of numbered round note pins (the `note` variant's warning-soft fill and border) over the
preview, `pointer-events` off on the layer and on for each pin, the pin's text shown on click or tap. Changed:
a pin sits at a fraction of the frame (`x`, `y`) instead of an element rect plus zoom, 28px for a thumb, and the
layer is a sibling of the scaled frame, so pin size does not scale. Not ported: `CommentBubble`, `CommentsPanel`,
`InlineCommentComposer`, the comments store slice, live rects, edit and applied variants. Comments come from
`<design>.comments.json` beside the design (`src/view.mjs` `readPins`), read on each page load; no file, no pins.
Pins are drawn by the view page above the iframe, never inside the sandboxed option, which gains no permission.

`packages/core/src/frames` and the templates' `frames/` hold JSX device snippets
for the agent; the view renders HTML only and does not use them.

Not in this slice: the `preview` tool (upstream's is Electron's), image generation,
web research, the `ask` tool, workspace persistence (the `App.jsx` source is not
kept beside the option), editing comments,
sign-off links, or new publication. The first PR
target remains **2026-10-20**; merge and publication require Main's approval.
