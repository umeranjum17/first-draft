# README capture provenance

These assets document the **tool**, not the quality of generated designs. They are deliberately kept separately from `docs/media/`, the generated-design sample inventory checked by `scripts/check-samples.mjs`. No design sample is exempted or admitted here.

- `studio-{light,dark}.webp`: real first-draft Studio served by the source CLI at 0.2.11-dev, captured with chrome-devtools-axi at 880×430 on 25 October 2026.
- `studio-phone-{light,dark}.webp`: the same Studio at 390×340. **Every design iframe is hidden**, leaving a neutral canvas and an explicit label. This is a capture-only redaction, not a shipped blank state. No product control was fabricated or changed.
- `make-{light,dark}.webp`: a formatted view of real retained CLI JSON/critic scores at 880×360.
- `make-phone-{light,dark}.webp`: the same excerpt at 390×480. The mobile view rearranges the board, not its values.

The critic board is a presentation of output, **not a screenshot of a critic screen shipped by the tool**. See [quality provenance](../quality.md#the-cli-excerpt--24-october-2026) for model, date, source commit, timing, score and limits. Raw records and the capture recipe are retained with the rewrite review evidence. No model was run and no quota was spent to make these captures.
