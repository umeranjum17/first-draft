---
# Written for first-draft from the ideas in Emil Kowalski's skills (MIT, https://github.com/emilkowalski/skills); no text is copied.
schemaVersion: 1
name: interaction-motion
description: >
  Press, hover, focus and entrance motion in CSS that makes an interface feel
  made with care: timing, easing, press states, staggered entrances, reduced
  motion and worst-case content. Use when a design has controls people press,
  content that enters, or lists and cards that real data will stretch.
aliases: [motion, micro-interactions, animation, press-states, emil-kowalski]
dependencies: []
validationHints:
  - every pressable control has a press state and a visible focus ring
  - content is fully visible without any animation having run
  - motion stops or fades only under prefers-reduced-motion
trigger:
  providers: ['*']
  scope: system
disable_model_invocation: false
user_invocable: true
---

## Decide Whether It Moves

Motion explains a change: where a thing came from, that a press landed, what
is new. An action people repeat all day (typing, moving through a list,
switching tabs) gets none or almost none. A rare moment (a first screen, a
finished task) may get a little more. If you cannot say what a motion
explains, leave it out.

## Timing And Easing

- Interface motion runs 150 to 250ms; an entrance up to 300ms. Nothing the
  user waits on takes longer.
- Things that enter or leave ease out: `cubic-bezier(0.23, 1, 0.32, 1)`.
  Things that move from one place to another on screen ease in and out:
  `cubic-bezier(0.77, 0, 0.175, 1)`. Never ease-in for interface motion: it
  feels late. Linear is for progress and loops only.
- Name the properties: `transition: transform 160ms var(--ease-out),
  opacity 160ms var(--ease-out)`, never `transition: all`. Move with
  `transform` and `opacity`; do not animate width, height, top or left.

## Press, Hover, Focus

- Every pressable thing answers the press:
  `:active { transform: scale(0.97); }` with a 120ms ease-out transition.
- Hover only where a pointer hovers:
  `@media (hover: hover) and (pointer: fine) { .card:hover { ... } }`, so a
  phone never keeps a stuck hover state.
- A clear `:focus-visible` ring on every control, in the accent colour, with
  an offset so it does not sit on the text.

## Entrances

- Never grow from nothing: start at `scale(0.96)` and `opacity: 0`, not
  `scale(0)`. Use `@starting-style` for elements that appear, or a keyframe
  with `animation-fill-mode: both`.
- Stagger a list or a grid by 30 to 60ms per item with `animation-delay`,
  and keep the whole sequence under about 400ms.
- A menu or popover grows from its trigger (`transform-origin` at the
  trigger); a dialog from the centre.

## Respect The Person

- `@media (prefers-reduced-motion: reduce)`: remove movement and scale, keep
  short opacity fades.
- Hit targets of 44px or more on touch, inputs with a 16px font so a phone
  does not zoom, and `100dvh` instead of `100vh` for full-height screens,
  with room for the safe areas.

## A Page Shown Without Script

When the host shows the page as static HTML, all of this is CSS and the
first frame is the design: content must be fully visible without any
animation finishing, and no entrance may leave something hidden.

## Design For The Worst Data

Try the layout with a very long name, a number six digits wide, an empty
list and a list of one. Long text wraps or truncates with an ellipsis
(`min-width: 0` on flex and grid children), an empty list says what goes
there and how to add the first item, and nothing overlaps.
