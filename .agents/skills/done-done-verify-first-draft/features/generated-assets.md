# Generated assets inside a draft screen

Entry: `src/cli.mjs make`, `src/assets.mjs`, `src/make.mjs`, `src/media.mjs`.

## Drive

`first-draft-axi assets` checks the existing providers without spending. `make "<brief>" --out screen.html --assets codex|higgsfield|auto` prints a cost preview and exits without a model call. Default/no-assets must generate no pictures; conflicting flags fail. `auto` requires exactly one ready provider. Never read or copy credentials. Codex is BYOKit's installed CLI account, Higgsfield uses its normal login. Missing tools or login must show the actual setup cause. A mise shim without a runtime needs `mise exec node@26.1.0 -- first-draft-axi …` using the installed Node version.

With explicit spending approval only, use the paid journey `assets-higgsfield` or `assets-codex` with `FD_DESIGN_MODEL` set to the approved BYOKit Codex design model. `journeys/assets.mjs` uses fresh First Draft config, previews cost, generates exactly one image and one compact shop screen, and captures 390/1280 light/dark with an isolated chrome-devtools-axi browser. Higgsfield: Z Image square, live credit quote. Codex: native image generation via exec, GPT-6 Luna, low effort, lowest-quality small square requested; quota/overage estimate unknown, dimensions/quality controlled by the native tool. No retry. If Codex cannot produce a raster image, retain the error and report that provider's proof missing; never substitute SVG or a remote service.

## Assert and capture

The real output folder contains optimized WebP (metadata stripped, max 1024×1024, quality 80, max 800 KB). Generated HTML contains a loaded, visible embedded data:image/webp image **inside its screen**, not a separate asset sheet. Viewing needs no network or sidecar file. The journey records cost preview, make JSON (render_check checked), HTML, four screenshots, decode/scroll metrics and steps.json. Open every screenshot and check image placement, unclipped copy and no overlap. No motion changed, so no recording required. `refine` preserves the embedded image without generating another. CI must refuse asset spending even with the approval flag. Stubbed-provider CLI coverage is in `test/make.test.mjs`.

## Cleanup

The journey stops only its own named browser and removes its own temporary config/profile. Generated HTML, WebP and captures remain in the sealed evidence folder. One image per option is the current ceiling; a failed design can leave its paid image on disk and must not trigger a generation retry.
