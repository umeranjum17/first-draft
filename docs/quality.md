# How good is it?

**On Claude Sonnet 5.5, on the same brief, First Draft scores 8, 8, 7 and 7.5 out of 10 against 6.5, 6, 6.5 and 3 for the plain prompt — better on all four, none at our 9/10 bar.**

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/ui/quality/scores-phone-dark.svg">
  <source media="(max-width: 600px)" srcset="docs/ui/quality/scores-phone-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="docs/ui/quality/scores-dark.svg">
  <img src="docs/ui/quality/scores-light.svg" width="600" alt="Bar chart out of 10, First Draft against the plain prompt: landing 8 versus 6.5, dashboard 8 versus 6, onboarding 7 versus 6.5, notes 7.5 versus 3.">
</picture>

### SaaS landing — First Draft wins, 8 to 6.5

| Plain prompt | First Draft ✅ |
| --- | --- |
| <img src="docs/ui/quality/landing-plain.webp" width="420" alt="Plain prompt: Ledgely, a stock green SaaS landing page"><h2>6.5 <sub>/ 10</sub></h2> | <img src="docs/ui/quality/landing-first-draft.webp" width="420" alt="First Draft: Parley Books, a ledger-led accounting landing page"><h2>8 <sub>/ 10</sub></h2> |

First Draft makes the page about the product — a real ledger entry off by 62.50 with the team's thread on it, one blue accent. Plain is the stock SaaS kit: identical cards and a green button.

### Analytics dashboard — First Draft wins, 8 to 6

| Plain prompt | First Draft ✅ |
| --- | --- |
| <img src="docs/ui/quality/dashboard-plain.webp" width="420" alt="Plain prompt: a library circulation report with an unlabeled bar chart"><h2>6 <sub>/ 10</sub></h2> | <img src="docs/ui/quality/dashboard-first-draft.webp" width="420" alt="First Draft: Larder Bakery trading dashboard with KPIs and a sales-by-hour chart"><h2>8 <sub>/ 10</sub></h2> |

First Draft states the finding in the headline and backs it with plain KPIs and an hourly chart anyone can read. Plain is one decorative chart of unlabeled bars, with no axis and no legend.

### Mobile onboarding flow — First Draft wins, 7 to 6.5

| Plain prompt | First Draft ✅ |
| --- | --- |
| <img src="docs/ui/quality/onboarding-plain.webp" width="420" alt="Plain prompt: a ferry app onboarding screen, dark with a yellow button"><h2>6.5 <sub>/ 10</sub></h2> | <img src="docs/ui/quality/onboarding-first-draft.webp" width="420" alt="First Draft: four-step sourdough starter setup with real choices"><h2>7 <sub>/ 10</sub></h2> |

A close one. First Draft asks five questions whose answers change the schedule it shows; plain's first step is distinctive but script-driven, so only step one could be judged at all.

### Notes app — First Draft wins, 7.5 to 3

| Plain prompt | First Draft ✅ |
| --- | --- |
| <img src="docs/ui/quality/notes-plain.webp" width="420" alt="Plain prompt: a browser-default notes app with an emoji logo"><h2>3 <sub>/ 10</sub></h2> | <img src="docs/ui/quality/notes-first-draft.webp" width="420" alt="First Draft: Margin, a three-pane notes app with a note and a checklist"><h2>7.5 <sub>/ 10</sub></h2> |

First Draft draws a working three-pane notes app with a real note and a checklist. Plain is a browser-default page: one welcome note, an empty right half, an emoji logo.

<sub>One run per cell, 24 October 2026, scored by the review worker beside real reference products — not customers, not a blinded or independent judge (the tool's own critic scored the landing 7, 8, 8 over its three rounds). The dashboard and onboarding baselines are plain Sonnet with Anthropic's frontend-design guidance; the landing and notes ones a bare prompt. First Draft runs: landing 176 s and 25.2k tokens, dashboard 170 s and 23.4k, onboarding 135 s and 18.8k, notes 277 s and 39.3k. Pictures are each cell's light-theme 1280px first screen.</sub>

## History: what we fixed

Before those fixes, on that same model, First Draft scored **4** on both briefs — below a bare prompt.

### SaaS landing — plain 6.5, First Draft before fixes 4

| Plain prompt | First Draft, before fixes ❌ |
| --- | --- |
| <img src="docs/ui/quality/landing-plain.webp" width="420" alt="Plain prompt: Ledgely, a stock green SaaS landing page"><h2>6.5 <sub>/ 10</sub></h2> | <img src="docs/ui/quality/landing-before-fixes.webp" width="420" alt="First Draft before fixes: Tallyfold, with an install command in the hero"><h2>4 <sub>/ 10</sub></h2> |

The hero sold a command (`$ npx tallyfold start`), not the product: our landing brief was written for README pages. Plain scored higher.

### Notes app — plain 3, First Draft before fixes 4

| Plain prompt | First Draft, before fixes ❌ |
| --- | --- |
| <img src="docs/ui/quality/notes-plain.webp" width="420" alt="Plain prompt: a browser-default notes app with an emoji logo"><h2>3 <sub>/ 10</sub></h2> | <img src="docs/ui/quality/notes-before-fixes.webp" width="420" alt="First Draft before fixes: Margin, a generic three-column notes page"><h2>4 <sub>/ 10</sub></h2> |

Every cause was in our wrapper: a cheap flash-tier default (MiniMax M3.1), options forced into fixed novelty styles, a "label sample content, write no scripts" rule that pushed invented placeholders into the design, and small caps (12 turns, 6,000-token slices, 16k output) that stopped the run at the first slice that passed. It never looked at its own render.

What changed: one call that plans the page from the brief, the facts rule, "design what the brief names", a critique pass that receives screenshots at 1280 and 390, and host checks that send a page back once for overflow, covered text and clipped or unreadable text. Re-run with those checks, the same briefs read 8 (landing), 7 (dashboard) and 7.5 (onboarding) in 304–412 s and 48–69k tokens each. [The wrapper allowlist](wrapper-allowlist.json) tracks every addition and its evidence; provisional does not mean proven.

## The CLI excerpt — 24 October 2026

The README's formatted critic board is real CLI output, reformatted: one landing option from `g2-fd-landing`, source head `cd49ea3`, exit 0, `claude-sonnet-5-5` on `byokit:claude`, **304 seconds**. Its critic scored that option **8/10** and the plain page **5/10**, and returned `passed: false`. That is the generator judging its own output over three reviews, not an independent assessment, and `render_check: checked` is layout validation, not a quality certificate. It is one option, not three, and the image shows no design pixels.

## The README hero — 24 October 2026

The README hero animates two options from the stripped-engine bake-off, unaltered inside the real Studio chrome:

| Option | Run | Seconds | Exit | Source head | Retained page SHA256 | Critic self-score | Plain-prompt baseline |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| Parley Books (landing) | `strip-landing` | 176 | 0 | `b36f4d3` | `0d426a17…a970c56` | 8/10 (7 then 8) | none recorded |
| Margin (notes) | `strip2-notes` | 278 | 0 | `85f773f` | `20eb800a…56cf36e` | 7/10 (7 then 7) | none recorded |

Both: `claude-sonnet-5-5` through `byokit:claude`, one option each, four turns, render check enabled. Neither run recorded `made.at`, so the date is the date of the run's files and of the bake-off report, and no numeric plain-prompt baseline was scored for either cell, so none is claimed. The scores are the generator judging its own output, and both are **below the 9/10 bar**. Main reviewed exactly these two on 2026-10-25 and shows them as they are — a **reviewed sample** (reviewer Main, Sonnet 5.5, 24 Oct 2026, score 8/10, Margin 7/10), because they are the product's real output. `scripts/check-samples.mjs` pins their hashes, runs, models, scores, reviewer, review date and note, so editing `docs/media/samples.json` alone cannot admit a picture, and **every other** below-9 sample still fails CI. Capture recipe and frames: the README rewrite review evidence.

## Rerun a comparison

Requires a chosen, signed-in subscription model. **This spends your model quota**; it is not part of CI or README rendering.

```sh
first-draft-axi init --agent byokit:codex --model gpt-6.1-sol
node scripts/compare.mjs "A notes app" --out /var/tmp/notes-comparison
```

Run the same brief and model for both sides, inspect every render, and label the date, version, scorer and method ([CONTRIBUTING.md](../CONTRIBUTING.md)). A different model or date is a new comparison; do not reuse the Sonnet figures for it.

Every other design output stays unpublished until it scores at least 9/10, meets its plain-model baseline and receives human review: the two options above are the single reviewed pair shown below that bar. See [the sample gate](../.agents/skills/done-done-verify-first-draft/features/sample-provenance.md).
