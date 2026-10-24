---
# Written for first-draft; no text is copied from any source.
schemaVersion: 1
name: logo-system
description: >
  How to draw a logo as clean SVG: refine one concept, one idea per mark, a
  construction grid, optical balance, letters drawn as paths, a mark whose
  detail survives at 16 px, a small palette with a reason, an app icon inside
  its safe zone, and light and dark versions. Use when the brief asks for a
  logo, mark, wordmark, lockup or app icon.
aliases: [logo, brand-mark, wordmark, lockup, app-icon, identity]
dependencies: []
validationHints:
  - the mark is the one concept the brief names, built from a few shapes on a grid
  - it reads as its idea at 32 px, and as nothing else (no face, no stock image, no plain letter)
  - the icon still reads at 16 px and stays inside the central 80% circle
  - every letter is a path; no text element, image or filter
trigger:
  providers: ['*']
  scope: system
disable_model_invocation: false
user_invocable: true
---

## Start From The Concept

The host has already explored 6 to 8 rough concepts, had a critic look at
their sketches at 16 and 32 px, and handed you one: its idea in one line, how
it is built, what it must not read as, what the critic saw, and the rough
sketch it started as. Refine that concept; do not swap it for another. The
sketch is a starting point, not a drawing to keep: rebuild it on the grid.

A mark carries one idea. If you need two, choose one. Never redraw or echo a
logo you know: learn how good marks are built, never what a known mark looks
like. A familiar idea is fine; a familiar silhouette is not.

## Look At It Small, As A Stranger

After done passes, the same critic looks at the finished mark large and at
32 and 16 px, pixel by pixel, and the option is redone once or dropped if it
fails. So check these yourself while drawing:

- **Reads as its idea:** someone who has not read the idea names what they
  see in a few words, and it is the idea.
- **Reads as nothing else:** two dots over a curve, or a U over a bar, is a
  face. A cup with a leaf, a steaming cup or a lone leaf is the stock image
  for tea: only use it with a twist only this brand has.
- **More than a letter:** a lettermark that a typeface's letter would match
  is just the initial. Give it a cut, join or counter that carries the idea,
  big enough to see at 32 px.
- **Survives at 16 px:** the host measures the icon: every part, gap, cut and
  counter it has at 512 px must still be there at 16 px, and no slot, hairline
  or thin tongue may be narrower than one pixel there (6 units on a 96 grid).
  A detail that dies is refused; widen it or drop it from the icon.
- **References:** the person's own `--ref` images, when given, are taste and
  grammar only; a mark close to one of them fails.

## Build On A Grid

- Work in a square viewBox of 0 0 96 96 for the mark and the icon, and on a
  grid of 8 or 12 units. Snap points, radii and stroke widths to it.
- Use few parts: two or three primitives (circles, rounded rectangles,
  arcs) joined or cut, rather than freehand curves. Draw cuts with a mask or
  by building the outline as one path with `fill-rule="evenodd"`.
- One stroke width or one corner radius for the whole mark. Mixed weights
  read as accidents.
- Optical balance, not arithmetic: a circle or a point overshoots the grid
  line by about 2 to 3% to look the same size as a square; a shape that is
  heavy at the bottom sits a little above the true centre; a triangle needs
  more room than a square to look as large.

## Draw The Letters As Paths

The files carry no font, so every letter is drawn.

- Fix the type grid first: cap height, x-height, baseline, one stem width.
  For a calm geometric wordmark, a cap height of 40 units, an x-height of 30
  and a stem of 6 work well, with about 8 units of margin above and below.
- The simplest clean method is monoline letters: each letter is a path drawn
  with `fill="none" stroke="..." stroke-width="6" stroke-linecap="round"
  stroke-linejoin="round"`, built from straight lines and arcs (`A`
  commands) on the grid. Round letters (o, c, e, s) overshoot the baseline and
  x-height by about one unit.
- Space by eye: the gap between two straight stems is widest, a straight and
  a round letter a little less, two round letters least. Equal boxes look
  uneven.
- Lowercase reads friendlier and calmer, capitals more formal. Keep the name
  exactly as the brief spells it, apostrophes included (draw an apostrophe as
  a short stroke or a small teardrop).
- The wordmark and the mark share stroke width, corner style and colour, so
  the lockups look like one family.

## Colour

- A small palette in `logo/palette.json`: primary (the brand colour), accent
  (a second colour, used sparingly) and neutral (the ink for type and quiet
  parts, such as a warm charcoal), and their dark-mode counterparts. Flat
  fills: no gradient, glow or shadow the mark depends on.
- Give it one line of reason tied to the brief: what in the brief each colour
  answers (calm: a muted green and warm clay; modern: a crisp near-black ink,
  not a heritage brown). The host shows that line and each colour's measured
  contrast in the sheet.
- Each light colour reads on white at 3:1 or more; each dark colour on
  near-black at 3:1 or more. The `-dark` files keep the geometry and use the
  dark set: the neutral ink becomes near-white and the brand colour is
  lightened until it reads on near-black.
- Draw only with the palette: the light files use the light set, the `-dark`
  files the dark set, the icon either. Write every colour as `#rrggbb`.

## Lockups

- Horizontal: the mark at about the cap height plus a little, vertically
  centred on the letters' optical middle (not the box), with a gap of about
  half the mark's width.
- Stacked: the mark centred above the wordmark, a gap of about a third of the
  mark's height.
- Crop each viewBox tight to the artwork with an even margin, so the files
  drop into a page without hidden padding.

## The App Icon

- `icon.svg` is a square, full-bleed tile: a flat background `rect` over the
  whole viewBox with square corners (the platform rounds or masks it) and the
  mark centred inside the central circle whose diameter is 80% of the side. In
  a 0 0 96 96 viewBox keep every mark point within 38 units of the centre
  (48, 48); about 30 units is comfortable.
- It must read at 16 px: at that size one pixel is 6 units of a 96 grid, so
  no detail, gap or stroke under 6 to 8 units. Simplify the mark for the icon
  if you must (drop a thin detail, thicken strokes) rather than shrink it.
- Mark colour against the icon background at 3:1 or more, ideally 4.5:1.

## The Brand Sheet

The sheet presents the option to someone deciding. Its first screen leads
with the name, the empty idea element the host fills (`<p data-logo="idea">`),
and the mark large on generous space beside the empty palette element
(`<div data-logo="palette">`). Then the wordmark, the lockups on light and
dark tiles, and the icon at its real sizes and in context. Use the page's own
type for labels only; the logo files are shown as images. Keep the layout
calm and fixed so comments land on clear parts.
