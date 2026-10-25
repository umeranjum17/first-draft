# A multi-screen flow: one shell, one grid, one character

Entry: `src/flow.mjs`, `src/draft.mjs`, `src/make.mjs`, `src/assets.mjs`, `src/critic.mjs`, `src/judge.mjs`, `src/reference-library.mjs`, `journeys/onboarding-flow.mjs`.

A flow brief (onboarding, sign-up, wizard, checkout: `flowOf` reads the brief's words and its `N screens`, three or more) is drawn as a
journey, not as N pages. Every screen keeps one shell and one grid — a header row at the same height with a back control and Skip, the title
at the same position, size and measure, the progress dots, and the round next button in the same corner on every screen but the last, whose
closing filled button is its one action — so only the content changes. Each screen's small label above the title names that screen's own
step, and each screen's illustration belongs to that screen's surface: it runs to the screen's left and right edges on its ground, or its
edge fades into that ground with a mask, never in a border, outline, frame, mat, drop shadow, oval or rounded clip, and never shrunk to a
thumbnail beside the other screens' scenes; each screen fits one screen, nothing in it running past the bottom, so the progress dots and
the round next button stay visible and no option card is cut in half; and the flow ends on one action, its closing button rather than that
button beside the round next button. `done` refuses all four (below); the sentence is `flowRule()` in the page contract.

## Drive

`first-draft-axi make "<a mobile onboarding flow, 6 screens, ...>" --out flow.html --options 1` and read the file: one complete HTML
document whose screens are `data-oc-screen` sections in order, linked with in-page hash links. The flow contract sentence is in the system
prompt (`systemPrompt(..., flow)`); a brief without flow words and fewer than three screens is unchanged.

With `--assets codex` the design agent draws the character's style sheet first (`generate_image_asset`, purpose "illustration", filenameHint "character-style-sheet") and
every later image of that option is drawn from it: the host keeps the first image and attaches it to each later request as a native image
input (`codex exec -i <sheet>`), so the character, line weight and palette stay the same. The preview's per-option ceiling for a flow is one
style sheet plus one picture per screen (never more than 13); the make JSON marks the set's first image `sheet: true` and each chained one
`style_sheet: true`.

The critic receives every flow screen at both widths, labelled in image order, and scores `flow.shell` and `flow.character` in its one review (no extra call), and an option whose shell or character is under 9 does
not pass however good its design score. An onboarding flow is its own reference kind (`pageKind` → `onboarding`): there is no licensed public
capture of one, so the owner's own reference image is passed to make as `--ref` and the judge scores the flow beside it (the library entry
`mellow-onboarding` is a `local` note saying so).

## Assert and capture

Deterministic (`test/`, no model, no key, no network): `tests/e2e/wrapper-baseline.test.mjs` draws a flow brief through the real CLI against a
local provider stand-in and asserts the one-shell sentence reaches the model, the review asks for the flow scores, a flow that keeps them
passes and one whose screens or character change does not. `test/flow-scene.test.mjs` runs the real browser check (`flowScene` in
`src/render-check.mjs`, enabled by `renderCheck(..., { flow: true })` for a flow brief): fixture flow screens whose scene fades into the
ground or runs to both screen edges pass, and each of an oval/rounded clip, a plain inset cut edge on the ground, a border, a drop shadow,
a clip-path, a mat or framed box behind it, and a thumbnail scene on one screen fails with its own finding. The same check (`flowShell`,
also from that one `renderCheck` call) refuses one step label repeated on every screen, two actions on the last screen, and a screen
taller than the screen it is shown on (the option screens that ran 80-110px past 390, so the dots and the next button fell below the fold),
and passes screens that label their own step, end on one action and fit their own screen. To see the findings on a real flow, run the check over a retained flow's HTML
(`renderCheck(() => {}, { flow: true }).verify(html)`).

Live benchmark, the mellow onboarding reference: `node journeys/onboarding-flow.mjs` with `DONE_DONE_EVIDENCE_ROOT`,
`FD_DESIGN_AGENT`/`FD_DESIGN_MODEL`, `FD_ONBOARDING_REF=<the owner's reference image>` and spending approval. It previews the flow's image
budget, makes one option, asserts six screens and that the sheet was drawn first and chained, then captures every screen in the real viewer
(`first-draft-axi view`, `?screen=<id>#/o/1`) at 390 and 1280, each in light and dark, and writes `report.html` (the six screens beside the
reference, the critic's score under each board, model and seconds under it) and `steps.json`, whose `proves` lines and `result` say what
the captures show in the words of the claim (scene ending in the screen's own ground, no inset edge or thumbnail, every screen fitting one
390 screen with the dots and the round next button visible and no option card cut, its own step label, the last screen's one filled
button), so a merge card can read the captures against the run that made them. The nonpaid recapture,
`FD_FLOW_SOURCE=<the run's support folder> FD_ONBOARDING_REF=... done-done run onboarding-flow-capture`, renders the same captures and report
from the retained output and never generates.

## Cleanup

The journey stops only its own view process and named browser session and removes its own temporary config and profile. The flow HTML,
captures and report stay in the evidence folders. No generated sample goes to a README, the landing page or the docs.
