# Screen benchmark (first slice)

## Existing flow and gap

`references` resolves one named brand; `--like` captures its public page. `make --inspiration` plans searches, runs `reference-search`, and sends results through `captureSources` → `captureReference` → robots/terms review and script-disabled capture. `refs pull/list` owns an explicitly licensed library. `--ref` validates local captures. The critic compares one option and a generated plain page, not our retained current screen plus every candidate. Search results are not automatically best-in-class or necessarily the requested screen.

## Interface

```
first-draft-axi benchmark --product "AI chat app" --screen "phone chat" \
  --input screens.json --width 390 --theme light --project ./project \
  --out ./benchmark.html
```

`--input` is optional for discovery alone. It is a JSON array of captures:

```
[{"role":"current","name":"Crewhouse chat","file":"current.png",
  "source":"Owner-supplied Crewhouse capture","permission":"Owner supplied for private comparison",
  "captured_at":"2026-10-27T00:00:00Z","theme":"light"},
 {"role":"reference","name":"Chat reference","file":"reference.jpg",
  "source":"Owner supplied; original URL unknown","permission":"Owner supplied for private comparison",
  "captured_at":"2026-10-27T00:00:00Z","theme":"light"}]
```

Paths resolve beside the manifest. Roles: `current`, `candidate`, `reference`, `counterexample`. Every local capture needs source, permission, capture time (or `null` when unknown) and theme; unknown provenance is stated, not invented. Counterexamples are negative evidence, never the quality bar. `--width` is 390 (default) or 1280; `--theme` is light (default) or dark. Supplied images retain their pixels/aspect ratio and are displayed at the same CSS width; this is not a claim they were originally captured at that viewport. Mismatched-theme positive references and targets are refused rather than recoloured; negative examples may have another theme and are labelled. Up to twelve local captures use existing image decoding and 5 MB/file limits, with a combined 10 MB normalized budget.

The product and screen form two explicit search queries (no extra planning model). Existing search, terms and capture modules do acquisition, including every refusal. This slice supports permission-checked public HTML captures in light theme, not app-store image extraction, press-image cropping or authenticated apps. For dark comparisons, discovered pages are recorded as unavailable without attempting a light capture, rather than mislabelled. Public page captures are candidates for references, not automatically proof of the requested app screen. The judge must establish applicable visible evidence or abstain.

The self-contained sheet and adjacent `.json` report contain current screens, all candidates, references, counterexamples and source/refusal metadata. Captures remain in `<project>/.first-draft/refs`; no media enters the package. `--no-discovery` compares supplied captures offline. `--no-judge` writes an unscored sheet without a model; neither flag silently fabricates results.

## Reference-aware round

Use the configured independent subscription judge (same default/configuration as the existing judge), with real normalized PNGs. Score each current/candidate separately against the same reference captures and optional negative examples. Each of the existing seven axes returns a 1–10 score, cited reference image IDs, what those pixels show, and where the target stands. Nonapplicable evidence must produce a null score and explanation. No reward for features absent from the cited references; no homepage-as-chat, imaginary interactions, prose-only calibration or counterexample-as-positive-reference. A model assessment is not a certification of fidelity or best-in-class coverage. Judge failure is explicit and preserves the unscored sheet.

## Proof and next slice

Offline integration exercises the real CLI, local search/robots/terms fixtures, native image decoding, sheet assembly and the actual subscription adapter with a deterministic CLI stand-in (no external network or model calls). The first-page proof uses the five read-only supplied captures plus one task-owned first-draft AI-chat candidate at 390/dark, explicitly not the live Crewhouse app. By firstmate's approved proof substitution, both `bad-*` images stay negative and are named exactly `current app not captured - counterexamples from the captain`. The live-current gap is not erased by scoring the prototype. Original source URLs/capture times remain unknown where not supplied. App-store/press screenshot extraction and desktop product proof are subsequent slices, not silently represented by marketing homepages.

### Fill the live-current gap (Crewhouse-owning lane)

Capture **your own task-owned Crewhouse instance** at 390/dark with its existing verify recipe, not the person's installed app. Add a row to the same manifest (keep the references, candidate and negative rows):

```
{"role":"current","name":"Crewhouse current chat","file":"current-chat-390-dark.png",
 "source":"Task-owned Crewhouse chat capture; name the tested commit",
 "permission":"Project-owned task capture","captured_at":null,"theme":"dark"}
```

Replace null with the actual capture time when known. Then run exactly:

```
first-draft-axi benchmark --product "AI chat app" --screen "phone chat" \
  --input crewhouse-chat-captures.json --width 390 --theme dark \
  --no-discovery --out crewhouse-chat-benchmark.html
```

This scores the newly added current row and every retained candidate against the same positive captures, without regenerating the design or making another public-discovery pass. The capture itself remains the owning lane's responsibility; this command does not access a running app.
