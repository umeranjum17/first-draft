# Per-screen redesign writer (instruction 014)

Tasks are tracked in harness todo #15, followed by safe delivery #12.

## Contract
- One small shared-design response (at most two plan attempts), then exactly one requested screen per response; the host assembles all sections with that one stylesheet. Instruction 015 allows 20000 shared CSS characters but keeps the URL/data-URI/import ban; use inline SVG markup for icons.
- Native output budget stays below 16000 (8192 per response), with a strict single-call response schema. No route, account or SDK-cap changes.
- At most two writer attempts per screen. Keep native deterministic phone/desktop/light/dark, navigation, text, emoji and semantic checks. Provider failures stop, not retry blindly.
- Preserve observed controls, captions, progress and charts. No diagnostic notes in app UI; saved pixels remain refs only, not authenticated discovery proof.

## Ordered work
1. Reuse static-export and browser validation; implement shared plan + per-screen typed responses and host assembly. Retain bounded per-screen attempt diagnostics. Verify through existing native provider-edge fixtures, including a malformed/extra-screen refusal and persistent failure at attempt two.
2. Commit the producer path. Qualify board four screens first, then fleet three captured states, on the authorized Claude subscription / Opus 5.5 account. No live source probing. Stop with evidence if a screen still fails.
3. Capture whole historical-before/fresh-after pairs at an exact clean HEAD through default-home done-done; inspect every cell and run the visual reference assessment. Run the full deterministic suite, update feature docs and publish a safe-only PR/receipt if requirements pass.

## Boundaries
Signed-session work remains on its unsafe branch only. No output HTML is hand-edited. Per-screen tests prove the contract and transport, not visual-model accuracy. Final cross-screen failures refuse export rather than accepting a partially qualified app.
