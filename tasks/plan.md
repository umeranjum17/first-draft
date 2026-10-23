# Per-screen redesign writer (instruction 014)

Tasks are tracked in harness todo #15, followed by safe delivery #12.

## Contract
- One small shared-design response (at most two plan attempts), then exactly one requested screen per response; the host assembles all sections with that one stylesheet. Instruction 015 allows 20000 shared CSS characters but keeps the URL/data-URI/import ban; use inline SVG markup for icons.
- Native output budget stays below 16000 (8192 per response), with a strict single-call response schema. No route, account or SDK-cap changes.
- Instruction 017: one fleet producer repair only; preserve desktop state cards/metadata, phone controls, alias composition and nav clearance. Account for the earlier attempt with used-screen/plan flags, leaving two screen responses and one plan response. Open a board-scoped PR regardless of fleet outcome; disclose fleet gaps and deferred signed capture. Board generation is retained; recapture it at final HEAD.
- Instruction 016: at most three writer attempts per screen. Every safe single-screen candidate gets layout and source-scoped/frozen-style semantic checks together; repair receives the union of all prior findings. Captions exist only where source-observed and mere label repetition is optional/not penalized. Provider failures stop, not retry blindly.
- Preserve observed controls, captions, progress and charts. No diagnostic notes in app UI; saved pixels remain refs only, not authenticated discovery proof.

## Ordered work
1. Reuse static-export and browser validation; implement shared plan + per-screen typed responses and host assembly. Retain bounded per-screen attempt diagnostics. Verify through existing native provider-edge fixtures, including a malformed/extra-screen refusal and persistent screen failure at attempt three (plan remains two).
2. Commit the producer path. Qualify board four screens first, then fleet three captured states, on the authorized Claude subscription / Opus 5.5 account. No live source probing. Stop with evidence if a screen still fails.
3. Capture whole historical-before/fresh-after pairs at an exact clean HEAD through default-home done-done; inspect every cell and run the visual reference assessment. Run the full deterministic suite, update feature docs and publish a safe-only PR/receipt if requirements pass.

## Boundaries
Signed-session work remains on its unsafe branch only. No output HTML is hand-edited. Per-screen tests prove the contract and transport, not visual-model accuracy. Final cross-screen failures refuse export rather than accepting a partially qualified app.
