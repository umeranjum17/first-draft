---
# Written for first-draft from a study of public examples on motionsites.ai (2026-10-24); no text, code, media or pixels are copied.
schemaVersion: 1
name: motion-sites
description: >
  A page whose motion is part of the message: an animated hero, a moving
  product, a scroll story. One subject moves, the words stay still, the
  first frame is the finished design and motion stops under reduced motion.
  Use only when the brief asks for motion, animation, a 3D or scroll-driven
  hero, or a motion style, or when one movement explains the product better
  than a still; otherwise keep to interaction-motion.
aliases: [motion-site, animated-hero, scroll-story, scroll-driven, motion-hero, motionsites]
dependencies: [interaction-motion]
validationHints:
  - the brief asked for motion, or the one moving subject explains something a still cannot
  - exactly one thing moves on its own per screen, and no text moves after its entrance
  - with no animation run, and under prefers-reduced-motion, the page is the complete design
trigger:
  providers: ['*']
  scope: system
disable_model_invocation: false
user_invocable: true
---

## Decide First

Motion earns its place only when the brief asks for it (motion, animated,
3D, scroll story, cinematic, a motion style) or when it shows something a
still cannot: how the product moves, what changes over time, the order of a
journey. Write one line before you build: "The motion shows ___." If the
blank is "that the page is modern", do not animate: use `interaction-motion`
for press and focus and stop there. A clear page with no motion beats a
moving page that says less.

## What The Strong Examples Share

- One subject moves: the product, its people or its world. Everything else
  is still.
- The words never move after they arrive. Copy sits on calm ground beside or
  over the subject, and the subject's motion is slow enough to read past.
- The entrance runs once, in reading order, then the page is static.
- A scroll story has one direction and one ending, and hands over to a
  plain reading section.
- Every moving thing has a still: the first frame is a finished picture.

## Hero Structure

- Nav, then at most a small eyebrow, a headline of 2 to 4 short lines with
  deliberate breaks, one support line, one primary action (and at most one
  quiet secondary).
- The moving subject takes its own region: the half beside the copy, a band
  under it, or the full background behind a tint. Never under body text that
  is still being read.
- On a phone the copy comes first and the subject follows in its own band;
  never shrink the desktop composition to fit.

## Timing And Easing

- Interface motion (press, hover, focus, menus) keeps `interaction-motion`'s
  150 to 250ms.
- Hero entrance: each piece 450 to 650ms, ease-out
  `cubic-bezier(0.16, 1, 0.3, 1)`; headline lines 80 to 120ms apart, then
  the support line, then the action. Total under 1s; no delay over 500ms.
- Entrances move little: rise 12 to 24px, or a line rising out of its own
  clip (`overflow: hidden` on the line box). Start at `opacity: 0`, never at
  `scale(0)`; no blur-in on text people must read.
- A looping subject is slow and small: a period of 6s or more, ease-in-out,
  at most 8px of drift, 2 degrees of turn or 3% of scale, and the end matches
  the start so it never jumps.
- Scroll-linked motion follows the scroll exactly and reverses when it does.

## What May Move

- May: the hero subject (product shot, device, scene), light and shadow on
  it, a scroll-linked reveal of a section's picture, the entrance of the
  hero's own elements, press and hover states.
- May not: body text, headings once in place, prices, form fields, numbers
  people compare, navigation, the logo, background gradients or orbs with
  nothing to show, more than one looping thing on a screen.

## A Page Shown Without Script

The exported page is static HTML with no script and no remote media, so all
motion is CSS:

- The default styles are the final state. Put every animation inside
  `@media (prefers-reduced-motion: no-preference) { ... }`, so a capture, a
  printer or a reduced-motion reader sees the finished design.
- Entrances: keyframes with `animation-fill-mode: both`, `transform` and
  `opacity` only.
- Scroll stories: `animation-timeline: view()` or `scroll()` inside
  `@supports (animation-timeline: view())`; without support the sections
  simply stack. Pin a scene (`position: sticky`) for at most two viewport
  heights, and keep each text block fully opaque across the middle of the
  viewport (`animation-range: entry 0% entry 40%` to fade it in, nothing to
  fade it out while it is read).
- Video only when the project supplied one; otherwise the subject is a still
  (a real photo, the product, or a marked image slot) with CSS motion.
- Text over a moving picture keeps 4.5:1 contrast on its brightest frame: a
  2 to 12% tint over the picture, or a solid backing; never rely on a
  text-shadow alone.

## Type And Layout

- One display face for the headline and one plain face for everything else.
  Display at 56 to 104px on desktop, 34 to 56px on a phone, tracking -0.02 to
  -0.035em, line-height about 1.05.
- Pick one extreme for the display (very bold or very light), not a middle
  weight.
- Lay the desktop hero out on the 1280x800 frame with whitespace around the
  copy; the subject may bleed to the edges, the copy never does.

## Reduced Motion

Under `prefers-reduced-motion: reduce`: no entrance, no loop, no scroll-linked
movement, no parallax; the page shows its final still. State changes may
keep a fade of 150ms or less.

## When Not To Animate

- The brief did not ask and nothing needs explaining: a company or product
  page stays clear first (press and focus motion only).
- Dashboards, forms, settings, docs, tables, checkout, anything people use
  every day.
- When there is no real subject: never animate a placeholder, decoration or
  an empty slot to fill space.
- Logos, headings people are reading, numbers people compare.
- A page that already has one moving thing on the screen.

## Self-Check Before Done

1. The "motion shows ___" line is filled with something the page is about.
2. With animations off, every screen is complete and nothing is hidden.
3. At most one element per screen has an infinite animation.
4. No text element has an animation that runs after its entrance.
5. Every animation sits inside `prefers-reduced-motion: no-preference`.
6. Animations name `transform`, `opacity` (or the scroll timeline); no
   `transition: all`, no animated width, height, top or left.
7. Headline contrast holds over the brightest frame of the moving subject.

## Reference Set (text only; borrow the idea, never pixels, code or copy)

- Freight Scroll Hero, https://motionsites.ai/?prompt=freight-scroll-hero :
  one camera move tied to scroll that ends by handing over to a plain text
  section.
- Reelmark, https://motionsites.ai/?prompt=reelmark-v2 : the motion is the
  product itself, a slow row of its clips under a still, centred headline.
- Strata AI, https://motionsites.ai/?prompt=strata-ai : motion kept to one
  masked artwork region; the copy column enters line by line, then holds.
- Halora, https://motionsites.ai/?prompt=halora : a calm loop of light and
  shadow behind still copy; the loop never jumps.
- The motionsites.ai gallery, https://motionsites.ai/ : cards lift 4px over
  300ms on hover; and a warning, since dozens of autoplaying previews on one
  screen compete for the eye.
