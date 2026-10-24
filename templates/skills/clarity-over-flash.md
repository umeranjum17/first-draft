---
# Written for first-draft; no text is copied from any source.
schemaVersion: 1
name: clarity-over-flash
description: >
  A company or product page that is clear, not flashy: it passes the
  5-second test (who it is for, what it does, why trust it, what to do
  next), says one thing per section, shows a real picture and puts proof
  near the top. Use for a landing page, home page, marketing or product
  page, or any page whose job is to make a visitor understand and act.
aliases: [clarity, clear-not-flashy, landing-clarity, marketing-page, five-second-test]
dependencies: []
validationHints:
  - from the first screen alone a visitor can say who it is for, what it does, why trust it and what to do next
  - the hero is one real picture, one plain headline, one support line, one primary and at most one secondary button
  - proof starts within the first two screens
trigger:
  providers: ['*']
  scope: system
disable_model_invocation: false
user_invocable: true
---

## The 5-Second Test

A visitor decides in about five seconds whether a page is for them. A clear
page wins that time; a flashy one spends it on effects. Before you style
anything, write four answers in one line each, in the visitor's words:

1. Who it is for.
2. What it does for them.
3. Why trust it (a number, a name, a result).
4. What to do next (one action).

Take a missing answer from the source, or the most plausible plain one. All
four go on the first screen.

## Rubric

- Hero, in this order: one real picture, a headline of at most 10 words, one
  support line of at most 30 words, then a filled primary button
  (`data-cta="primary"`) and at most one quiet secondary (`data-cta="secondary"`,
  tinted or outlined). Mark it `data-section="hero"`.
- The headline may mute one word, the one that carries the claim: a lighter
  tone of the text colour in a `<span>`, nothing else ("Built for teams,
  <span>proven</span> by results"). Never a gradient, outline or animation.
- Proof comes right after the hero (`data-section="proof"`): a short heading
  in the same voice, one line, then two to four cards, each a named customer
  or case with one concrete result.
- One message per section, at most about six sections, ending in one action.
- Whitespace does the work: 96px or more around the hero at 1280 (64px at
  390), text columns under about 720px, nothing beside the headline.
- Neutrals carry the page, warm or cool; one accent at most, mostly on the
  primary action. One type family, two or three sizes per screen.
- Motion is press and focus only (see `interaction-motion`): nothing loops,
  nothing moves on its own, no parallax.
- Pictures are a real photo or the product. With none available, leave a
  marked image slot (a `<figure>` at the picture's size, captioned with the
  photo it wants) or show the product typeset; never blobs, gradient orbs,
  3D shapes, glow or stock-style illustration in its place.
- Plain claims a customer would repeat; no "revolutionary", "seamless",
  "next-generation" or "unlock".

## When Flash Is Right

Only when the brief or the direction asks for it: a bold, playful,
experimental or loud look, or a named style that is loud by nature
(maximalism, y2k, vaporwave, memphis, cyberpunk, anti-design, neon and the
like). Then the surface may be loud, but the structure stays: the four
answers on the first screen, one message per section, proof near the top,
one primary action.

## Self-Check Before Done

Answer each yes or no. `[host]` lines are checks code runs on the drawn
page at 390x844 and 1280x800: `done` runs them for a company or product page
and names what to fix, so repair the page and call `done` again. `[model]`
lines need a reviewer to look at it. Checks 7, 8 and 12 are waived when flash
was asked for; the rest always apply.

1. `[host]` Exactly one `h1`, inside `[data-section="hero"]`, of at most 10
   words.
2. `[host]` The `h1` has at most one inner element whose colour differs from
   its own, and no gradient, outlined or clipped text.
3. `[host]` The hero has at most one paragraph of body text, of at most 30
   words.
4. `[host]` The hero has exactly one `[data-cta="primary"]`, at most one
   `[data-cta="secondary"]`, and no other `button` or link with a background
   or border.
5. `[host]` The hero contains an `img`, `picture`, `video` or `figure`.
6. `[host]` `[data-section="proof"]` starts within two viewport heights of
   the top (1600px at 1280x800, 1688px at 390x844).
7. `[host]` At most one accent hue across visible text, backgrounds and
   borders, images excluded (accent: OKLCH chroma above 0.06; hues within 30
   degrees count as one).
8. `[host]` Nothing moves on its own: no animation with an infinite
   iteration count, no autoplaying video other than a product recording the
   project supplied.
9. `[model]` From the first-screen capture alone, a reviewer can quote the
   page for each of the four answers.
10. `[model]` Each section's heading states one idea, and nothing in the
    section argues a second one.
11. `[model]` Every proof card names a customer or case and gives a concrete
    result (a number, a time, a before and after), not an adjective.
12. `[model]` The hero picture shows the product, its people or its result,
    or is a marked image slot; no decoration stands in for it.
