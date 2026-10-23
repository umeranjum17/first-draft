# Every screen at phone and desktop sizes, light and dark

Source: `src/render-check.mjs`, `src/make.mjs`; integration journey: `test/render-check.test.mjs`.

## Drive

1. Run `node --test test/render-check.test.mjs` with Chrome/Chromium installed. The actual CLI, engine, local model-edge stand-in and native browser prove rejection/repair of phone overflow, desktop-dark-only overflow, a screen hidden on desktop, a single screen without both themes, and a fixed phone-width desktop screen. The repaired file keeps both screens. No model call in tests.
2. For an authorized real make/refine, use `--options 1` on make to bound proof spending (the normal default is three options), and use the owner's selected BYOKit route with task-private FIRST_DRAFT_HOME; Claude models use only byokit:claude. Never read/copy credentials. The prompt contract requires one responsive file, full-width sibling screen sections and desktop columns inside each screen.
3. `done` renders the complete exported file and each data-oc-screen section independently at 390x844 and 1280x800, in light and dark. Every state must fit; each selected screen must have visible layout; desktop screen containers must exceed phone width. This last structural check is not a visual-quality guarantee. Errors name screen, viewport and theme and return to the model for repair.
4. `render_check: "checked"` means the native browser check ran. No browser remains an explicit `skipped` result and warning, never a claimed pass. A named dark-first style remains dark in both themes; otherwise each screen needs genuinely different light/dark rendering, excluding hidden screens from the paint signature.
5. Capture the real view/Play for each screen with `<view>?screen=<id>#/o/1/both` or `#/o/1/play/phone` / `#/o/1/play/desktop`. Use fresh task-owned chrome-devtools-axi pages, observed page IDs, explicit viewport after theme emulation, and inspect every whole capture. Preserve actual dimensions and step records. Stop all owned browsers/views.
6. Keep claims literal to the visible capture. CLI/render logs prove validation behavior, not screenshot pixels. A prior generated page may be a retained input, not a newly generated design. Paid generation needs the brief's approval and budget; no paid calls in CI.
