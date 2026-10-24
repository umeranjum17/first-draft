---
# Written for first-draft; no text is copied from any source.
schemaVersion: 1
name: logo-system
description: >
  How to draw a logo as clean SVG: one idea per mark, a construction grid,
  optical balance, letters drawn as paths, a mark that still reads at 16 px,
  an app icon inside its safe zone, and light and dark versions. Use when the
  brief asks for a logo, mark, wordmark, lockup or app icon.
aliases: [logo, brand-mark, wordmark, lockup, app-icon, identity]
dependencies: []
validationHints:
  - the mark is one idea, built from a few shapes on a grid
  - the icon still reads at 16 px and stays inside the central 80% circle
  - every letter is a path; no text element, image or filter
trigger:
  providers: ['*']
  scope: system
disable_model_invocation: false
user_invocable: true
---

## Start From One Idea

Before drawing, write down in one sentence what the mark says about the
brand, and one shape that says it (a leaf that is also a cup, a letter cut
from a circle). A mark carries one idea. If you need two, choose one. Never
redraw or echo a logo you know: learn how good marks are built, never what a
known mark looks like. A familiar idea is fine; a familiar silhouette is not.

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

- One brand colour and one neutral is enough; a second accent only if the
  idea needs it. Flat fills: no gradient, glow or shadow the mark depends on.
- Pick colours from the brief's mood (calm: muted greens, warm greys, clay;
  energetic: saturated, high contrast) and write their hex values in the sheet.
- The `-dark` files keep the geometry and swap the colours: the neutral ink
  becomes near-white and the brand colour is lightened until it reads on
  near-black at 3:1 or more.

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

The sheet presents the option to someone deciding. Lead with the idea in a
sentence, then the mark large on generous space, the wordmark, the lockups on
light and dark tiles, the icon at its real sizes and in context, and the
palette. Use the page's own type for labels only; the logo files are shown as
images. Keep the layout calm and fixed so comments land on clear parts.
