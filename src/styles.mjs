// Named design styles a person can pick with `make --direction <id>`: each is one committed look with its own tokens, so options differ in kind and a design is not a mix of two looks. Our own written reference, kept as plain data; a direction that is not an id is used as the person wrote it.
export const STYLES = [
 {
  "id": "functional-minimalism",
  "name": "Functional Product Minimalism",
  "family": "Minimal & Functional",
  "vibe": "Precise, infrastructural, rationed",
  "line": "The engineering-precision SaaS aesthetic that makes a product feel like serious infrastructure — high contrast, monochrome base, one rationed accent, obsessive whitespace, and microstates that prove the product works. (Linear 2020 → Vercel → Stripe → Mercury.)",
  "tokens": [
   "Ground: near-white `#fafafa` or near-black `#0a0a0a` — never pure `#fff`/`#000`.",
   "Surface: `#fff` / `#111`–`#1a1a1a` cards; elevation via **hairline borders only** (`1px` at 8–12% opacity), never warmth.",
   "Radius: 4–6px (8px max). NOT `rounded-xl` — that reads consumer.",
   "Shadow: `0 1px 2px rgba(0,0,0,0.05)` ceiling. Structure carries elevation, not shadow.",
   "Color: monochrome + exactly ONE brand accent on the primary CTA only (Linear `#5E6AD2`, Vercel `#0070F3`, Mercury `#5266eb`, Raycast `#FF6363`, Supabase `#3ECF8E`). Accent never in body, nav, or decoration.",
   "Type: Geist / Inter Variable / Söhne. Display 500–600, body 400. Optional Blueprint dot grid at 5–10% opacity.",
   "Motion: ease-out 120–200ms; motion serves state change only, no decorative scroll animation."
  ]
 },
 {
  "id": "japanese-minimalism",
  "name": "Japanese / Dieter-Rams Minimalism",
  "family": "Minimal & Functional",
  "vibe": "Still, premium, charged",
  "line": "Restraint so severe it becomes a statement — nothing removed by accident, nothing kept without reason. Whitespace (*ma* 間) is the active ingredient, not a void. (\"Less, but better\" + *wabi-sabi*/*kanso*/*ma*.)",
  "tokens": [
   "Ground: warm white `#f7f5f2` or cold `#f8f9fa` (never pure white); dark variant warm near-black `#1a1714`.",
   "Surface: same ground or 2–3% tonal step. NO card elevation — sections defined by spacing only.",
   "Border: one hairline rule to divide, not frame (`1px #e0dbd4`). Cards have none.",
   "Radius: 0–2px max. Rounded = friendly = wrong here.",
   "Shadow: **none, zero.** Hierarchy via spacing, scale, silence.",
   "Color: near-monochrome — ground + ink black + ONE muted accent maximum (indigo/terracotta/moss, never neon/gradient). Many implementations use zero accent.",
   "Type: Garamond / DM Serif Display / Helvetica Neue at Light 300 display + 400 body. NEVER bold headers — **size creates hierarchy, not weight.** Display 72–120px Light; body 16px; display:body gap ≥ 5×.",
   "Motion: long, slow, ease-in-out 400–600ms, fade-in only."
  ]
 },
 {
  "id": "material",
  "name": "Flat 2.0 / Material",
  "family": "Minimal & Functional",
  "vibe": "Friendly, systematic, responsive",
  "line": "Flat design grown up — just enough shadow, depth, and color structure to communicate affordance without returning to skeuomorphism. Meaning lives in color, not ornament. (Material 2014 → Material 3 / Material You 2021–present.)",
  "tokens": [
   "Ground: light `#FFFBFE` / dark `#1C1B1F` (slightly tinted, not pure).",
   "Surface: Material's **tonal-elevation** ladder — Surface → Container → Container High → Highest, each +~5% primary-color overlay. Cards live at Container High.",
   "Border: 1px `rgba(0,0,0,0.12)` on outlined components only; many surfaces need none (tint does the work).",
   "Radius: **semantic shape scale** — XS 4 / S 8 / M 12 / L 16 / XL 28 / Full 9999. Never one universal radius.",
   "Shadow: `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)` at elevation 1 — short, near, soft. Tonal color does more than the shadow.",
   "Color: Primary / Secondary / Tertiary / Error roles, each with Container variant; each color has ONE semantic meaning. Saturated primaries (Indigo 600, Teal 700), not muted grays.",
   "Type: DM Sans / Google Sans / Roboto Flex; M3 type-scale roles. Body 16 / 1.5; Display 57 Bold.",
   "Motion: Material 3 Expressive spring physics; 200/300/400ms by complexity; spring reserved for primary action."
  ]
 },
 {
  "id": "swiss",
  "name": "Swiss / International Typographic",
  "family": "Swiss & Editorial",
  "vibe": "Rational, gridded, credible",
  "line": "Rational, grid-locked, sans-serif-only design born at Zurich/Basel (1950s–60s) — the ancestor of every clean SaaS UI. (Müller-Brockmann, Vignelli.)",
  "tokens": [
   "Ground: pure white `#fff` or off-white `#fafaf9`. Never dark by default.",
   "Surface: flat — no glass, blur, or gradient. Border `1px #e5e7eb` for dividers only.",
   "Radius: 0–4px (prefer 0 for containers).",
   "Shadow: **none.** Hierarchy by size, weight, position. (Exception: hairline table-row rule.)",
   "Color: three-swatch max — black + white + ONE accent (Helvetica red `#dd0000`, or modern amber/deep blue). Accent once per screen. Gray `#6b7280` for secondary.",
   "Type: ONE family (Helvetica Now / Neue Haas Grotesk / Inter / Akzidenz). One weight pair (Regular+Bold). Body 16–18 / 1.5 / max 75ch, **flush-left ragged-right** (never justified/centered). Display 48–96 / 1.05–1.1.",
   "**Grid (non-negotiable):** 12-col desktop, 64px outer margins, 24px gutters, all vertical spacing ×8. Reflow 4-col tablet, 2-col mobile.",
   "Motion: restrained 200–300ms ease-out; no scroll reveals, no parallax."
  ]
 },
 {
  "id": "editorial",
  "name": "Editorial / Magazine Layout",
  "family": "Swiss & Editorial",
  "vibe": "Story-led, crafted, warm",
  "line": "Multi-column, serif-led, typographically rich layout descended from print magazines — content IS the product; the drop cap, pull quote, and standfirst are reading aids, not decoration.",
  "tokens": [
   "Ground: warm white `#faf9f7` or cream `#f5f0e8` (a strong black ground for fashion register). Not pure white (reads SaaS).",
   "Surface: paper + occasional full-bleed image panels; sections alternate ground ±5% L.",
   "Border: hairline `1px #d1cdc5` structural rules (column separators, pull-quote flanking, header underlines).",
   "Radius: 0 (print-descended).",
   "Shadow: none on layout; very light only on magazine-cover grid cards.",
   "Color: cream ground + black/dark-brown text + ONE accent for kickers/labels (warm red `#c0392b`, deep teal `#1a6b7a`). ≤2 real colors.",
   "Type: high-contrast display serif (Canela / Tiempos Headline / Editorial New / Freight Display) 48–120 / 1.0–1.15 + matching text serif or humanist sans body 17–20 / 1.65–1.75 / 65–70ch. Optional mono/condensed kicker.",
   "**Editorial details that separate it from \"serif web\":** standfirst (bold lead), ONE drop cap (`initial-letter: 3`), pull quote 24–32px with flanking rules, kicker small-caps +0.1em, dinkus `* * *` for breaks.",
   "Motion: slow page-weight fades 400–600ms; max 20% hero parallax; reading-progress bar."
  ]
 },
 {
  "id": "big-type",
  "name": "Typographic / Big-Type Hero",
  "family": "Swiss & Editorial",
  "vibe": "Bold, declarative, kinetic",
  "line": "The hero IS the headline — oversized expressive letterforms fill the viewport as the primary visual; color, spacing, and weight do the work photography would. (Swiss poster → variable fonts + kinetic web type, 2018–present.)",
  "tokens": [
   "Ground: high-commitment single value — pure black `#0a0a0a`, pure white `#fff`, or one saturated hue. No gradient — the ground is a stage.",
   "Surface: flat; type IS the texture. No cards.",
   "Radius: 0 always. Shadow: none on text (optional 0-offset `text-shadow` glow for neon registers).",
   "Color: ground + text + ONE temperature-shifted accent that pops a single word. Monochrome B/W is valid and powerful.",
   "Type: ONE expressive, character-rich display face (Graphik Wide / ABC Diatype Expanded / Druk Wide / Editorial New / Anton / a variable font at extreme axes) at **80–200px**. NOT a generic grotesque scaled up. Secondary: one small-caps/mono at 11–14px for nav/metadata only. **No \"body\" size in between.**",
   "Layout: hero 100vh type-only; below fold ≤2 sentences + one CTA + grid.",
   "Motion (the style lives or dies here): pick ONE — (a) variable-font axis morph on scroll/hover, (b) kinetic marquee, (c) char-by-char stagger reveal (30–60ms), (d) hover distortion. Never combine. ≤400ms for load reveals."
  ]
 },
 {
  "id": "bento",
  "name": "Bento Grid",
  "family": "Structured & Luxury",
  "vibe": "Modular, ranked, scannable",
  "line": "A layout discipline (not a visual skin) organizing features into size-ranked self-contained tiles — one idea per tile, size communicates importance. (Apple iPhone 14 Pro / Vision Pro 2022–23 → default SaaS feature section.)",
  "tokens": [
   "Ground: white `#fff` / near-white `#F5F5F7` / dark `#09090B`. Never mid-gray.",
   "Tile surface: 1–2 steps off ground (`#F7F7F8` / `#111113`), or one accent-colored tile per grid max.",
   "Border: `1px rgba(0,0,0,0.06)` sparingly; tile/ground contrast can replace it.",
   "Radius: tile outer **16–24px**; inner elements (buttons/chips) **8–10px** — inner ≤ 50% of tile radius.",
   "Shadow: `0 2px 12px rgba(0,0,0,0.05)` ceiling. Separation from tile-bg contrast, not shadow.",
   "Color: monochrome ground + ONE accent on the anchor/CTA. Max 3 colors in the full grid.",
   "Type: Inter/Geist/DM Sans — anchor headline 28–36 / 700, supporting 18–22 / 600, caption 13–15 / 400. Never a display serif. UI fragments/diagrams in tiles, not photography.",
   "Motion: tiles stagger-reveal 80–120ms; hover `translateY(-2px)` + small shadow bump."
  ]
 },
 {
  "id": "art-deco",
  "name": "Art Deco / Luxury Editorial",
  "family": "Structured & Luxury",
  "vibe": "Opulent, geometric, restrained",
  "line": "Geometric opulence on screen — symmetry, precious-metal hairlines, oversized display serifs, and painful color restraint. (Paris 1920s–30s → Cartier/Vogue/luxury hospitality.)",
  "tokens": [
   "Ground: cream `#FAF7F2`/`#FEFCF8` OR deep near-black `#080806`. **Never mid-tone** — kills the expensive contrast.",
   "Surface: content floats; minimal cards (hairline border only, no fill).",
   "Border: `1px #C9A84C` gold hairline for ornamental rules/dividers — full-width or short segments, never box outlines.",
   "Radius: 0–2px exclusively. Rounded = categorical violation.",
   "Shadow: none to near-none. Depth from type contrast + negative space.",
   "Color: **3 colors max** — ground + inverted text + ONE precious accent (gold `#C9A84C`–`#D4AF37`, or jewel emerald/sapphire). Gold and jewel never together. ONE gold hex throughout.",
   "Type: Playfair / Cormorant / Canela / Didot-style at **72–160px**, weight 300–400, leading 0.88–0.95. Body: Futura PT Light / Söhne Light at 12–15px, letter-spacing **0.12–0.20em** (the wide-tracked light sans is THE luxury signal). Never the display serif at body size.",
   "Motion: slow/deliberate — parallax 0.2–0.4×, scroll-reveal 600–900ms, letter-spacing unfurl 0.4em→0.15em. No spring/bounce."
  ]
 },
 {
  "id": "tactile",
  "name": "Modern Skeuomorphism / Tactile",
  "family": "Structured & Luxury",
  "vibe": "Tactile, warm, rewarding",
  "line": "Interfaces that feel physically touchable — material depth, dual-shadow light simulation, ONE real-world metaphor — flat structure for clarity, material depth for tactility. (Pre-iOS 7 → neo-skeuomorphism 2020–present, iOS 26.)",
  "tokens": [
   "Ground: **single flat hue, no gradient/image/pattern** (the dual-shadow system only works on uniform ground). Light `#F0F0F3`/`#EBEBEF`; dark `#1C1C1E`.",
   "Surface: raised tiles lighter than ground with dual outer shadow; inset tiles same hue with inverted inner shadow. No borders — shadow defines the edge.",
   "Shadow (core token): raised `4px 4px 10px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.75)`; pressed/inset `inset 3px 3px 6px rgba(0,0,0,0.10), inset -3px -3px 6px rgba(255,255,255,0.65)`. **Dark-shadow opacity ≤10%** or it collapses into an old drop-shadow.",
   "Radius: 12–20px (max 24) — molded/physical feel.",
   "Color: near-monochrome base + ONE warm accent (amber `#F59E0B`, terracotta `#DC6B3F`, forest `#2D6A4F`). Avoid cool/bright hues — they break the material warmth.",
   "Type: humanist sans at weight **500** (Inter/DM Sans/Nunito). Thin weights read cold/digital.",
   "Texture: SVG `feTurbulence` noise at 2–4% opacity (realism signal; >5% = dirty).",
   "Motion: button press `scale(0.97)` + shadow inverts raised→inset, spring release ~150ms. No linear easing."
  ]
 },
 {
  "id": "neobrutalism",
  "name": "Neobrutalism",
  "family": "Brutalist",
  "vibe": "Bold, indie, no-nonsense",
  "line": "A polished, deliberate subversion of corporate minimalism — thick ink borders, hard-offset black shadows (zero blur), flat bold fills, one punchy accent. Highly intentional, NOT unstyled. (Indie/maker scene 2020–21 → Gumroad/shadcn.)",
  "tokens": [
   "Ground: off-white `#FFFDF5` or white. Never dark.",
   "Surface: flat solid fill (bold pastel/primary: yellow `#FFD23F`, coral `#FF6B6B`, mint `#88D498`, sky `#74B9FF`); zero gradients/shadows on the fill.",
   "Border: `2–4px solid #000` on all interactive cards/buttons/inputs — consistency is non-negotiable.",
   "Radius: 0px canonical, 4px max. Any softer → collapses to modern-minimal.",
   "Shadow: hard offset zero blur single color — `4px 4px 0 0 #000` (small) / `6px 6px` (card) / `8px 8px` (modal). **`#000` at 100%, never gray/80%/soft.**",
   "Color: 2–3 max — black (borders/shadow/text) + ONE accent fill + off-white. Second accent only for status states.",
   "Type: Syne ExtraBold / Space Grotesk 700 / Archivo Black, oversized 48–96 tight; Inter/DM Sans 400 body; Space Mono labels.",
   "Motion: hover `translate(-2px,-2px)` + shadow grows; press `translate(4px,4px)` + shadow collapses. ease-in-out 120ms."
  ]
 },
 {
  "id": "raw-brutalism",
  "name": "Raw Brutalism",
  "family": "Brutalist",
  "vibe": "Honest, fast, stripped",
  "line": "Design stripped to its honest skeleton — system fonts, zero decoration, visible HTML structure, content first. Actually unstyled-on-purpose, NOT styled-to-look-raw. (1990s web + the 2017 \"Brutalist Web Design\" manifesto.)",
  "tokens": [
   "Ground: system white `#fff` / light gray `#f5f5f5`; near-black `#111` for high-contrast editorial.",
   "Surface: none. No cards. Dividers via `<hr>`/border-top. Blocks separated by whitespace.",
   "Border: `1–2px solid #000` only where structural; never decorative. Radius 0 always. Shadow: none.",
   "Color: monochrome, or max 2 — hyperlink blue `#0000EE`/`#551A8B` visited, red for errors.",
   "Type: system stack (`system-ui, -apple-system`, or Georgia/Times for editorial); Courier mono. Body 16, h1 24–32. **No Google Fonts.**",
   "Iconography: Unicode (→ ↗ ★ ●) or text labels.",
   "Motion: none, or `:hover { text-decoration: underline }`. Sub-100ms load IS the motion signature."
  ]
 },
 {
  "id": "anti-design",
  "name": "Anti-Design",
  "family": "Brutalist",
  "vibe": "Insubordinate, loud, curated",
  "line": "Graphic insubordination as expression — clashing typefaces, violated margins, chaotic asymmetry, intentionally \"wrong\" composition. A brand/campaign tool, NOT a product UI system. (1960s Italian anti-design → Carson/Ray Gun → \"Brat\" 2024.)",
  "tokens": [
   "Ground: aggressively single saturated color (acid green `#8CC84B`, hot pink, lime, stark white/black). The ground IS the statement.",
   "Surface: collage logic — overlapping/clipped/misregistered layers; elements break containers.",
   "Border/radius/shadow: not systematic — used as violation devices (\"wrong\" direction) or absent.",
   "Color: 3–5 intentional collisions at ~100% saturation — chosen to feel \"wrong\" to a designer, \"alive\" to a human. Chartreuse + red + black is classic.",
   "Type: multiple typefaces on one page (the defining rule-break); distorted/stretched/blurred/rotated/cropped; blurry Arial set \"wrong\" (the Brat move).",
   "Texture: high — scanned grain, deliberate JPEG artifacts, pixelation.",
   "Motion: glitch loop, marquee at odd speed, drift out of sync — OR zero motion letting static chaos work."
  ]
 },
 {
  "id": "oled-neon",
  "name": "OLED Dark + Neon",
  "family": "Dark & Techno",
  "vibe": "Electric, quiet, serious",
  "line": "True-black canvas with a single rationed electric accent — the native dialect of dev-tool and AI-SaaS dark-firsts. (Linear/Raycast/Vercel Geist, 2022–25.)",
  "tokens": [
   "Ground: `#000`/`#080808` true OLED black (never dark gray masquerading as black).",
   "Surfaces: `#0F0F0F` → `#161616` → `#1E1E1E` — perceptible 6–8% luminance step each.",
   "Border: `1px rgba(255,255,255,0.07)` hairline only.",
   "Radius: 8px / 12px large / 6px inline.",
   "Shadow: **none on black** (shadows disappear). Luminance stepping for elevation.",
   "Accent: ONE electric color (lime `#39FF14`, cyan `#00F5FF`, neon-red `#FF3C3C`, acid-yellow `#E5FF00`, violet `#818CF8`). Only on primary CTA, current-route icon, active underline, focus ring. Never two.",
   "Text: `#F0F0F0` primary (not pure white — halation), `#888`, `#555`.",
   "Type: Inter/Geist 700–800 + JetBrains/Geist Mono labels. Subtle 2–4% noise.",
   "Motion: fade-up 300ms ease-out; border-light on hover. No particle systems (reserve for cyberpunk)."
  ]
 },
 {
  "id": "cyberpunk",
  "name": "Cyberpunk / Techno-HUD",
  "family": "Dark & Techno",
  "vibe": "Angular, machine, alert",
  "line": "Dystopian OS / game-interface aesthetic — hue-cast dark ground, monospace, HUD chrome brackets, scanlines, two neon channels. (Cyberpunk 2077 2020 → security/dev-culture dashboards.)",
  "tokens": [
   "Ground: NOT pure black — charcoal-purple `#0A0A14` / gunmetal `#0D0F0F` / teal-black `#060C0C`. The hue-cast is the identity.",
   "Surface: `#111120`/`#111614` stepped in the same hue.",
   "Border: `1px` neon at 0.3–0.5 opacity (`rgba(0,255,200,0.3)`).",
   "Radius: 0–2px only — **angular**. Use `clip-path` corner-cuts. Rounded cards break it entirely.",
   "Shadow → GLOW: `0 0 16px rgba(0,255,200,0.25), inset 0 0 8px rgba(0,255,200,0.05)`.",
   "Accents: primary cyan/green `#00FFC8`; secondary magenta/amber `#FF0080`/`#FFB000` **only for error/alert/scanline**, never a competing CTA.",
   "Scanline: `repeating-linear-gradient` at opacity ≤0.12; SVG noise 0.04–0.06.",
   "Type: Share Tech Mono / Orbitron / IBM Plex Mono; ALL-CAPS labels 0.08–0.12em. No humanist sans. HUD chrome: 6–8px L-brackets, `[SECTOR 04]` / `> STATUS:` labels.",
   "Motion: glitch flicker on hover (display text only, ≤2px), typewriter readouts, 60s CRT scanline sweep."
  ]
 },
 {
  "id": "dark-glass",
  "name": "Dark Glass / Cinematic Editorial",
  "family": "Dark & Techno",
  "vibe": "Cinematic, luxe, slow",
  "line": "High-fashion editorial dark luxury — warm-dark (not black) grounds, frosted-glass panels over ambient light-bleed gradients, oversized editorial serif italic, film imagery, slow cinematic motion. (The Apple/A24 register, 2023–26.)",
  "tokens": [
   "Ground: NOT pure black (reads void) — warm editorial dark `#0D0B0A`/`#0F0E0C`/`#0B0C0D`. The warmth is the soul.",
   "Ambient: 2–3 desaturated gradient orbs (`radial-gradient(...rgba(60,20,80,0.4)...)` + amber/teal), opacity ≤0.40. NOT neon, NOT cyan.",
   "Glass: `rgba(255,255,255,0.04)` + `backdrop-filter: blur(16–20px) saturate(140%)`; directional rgba border (lighter top/left); inset top-edge highlight.",
   "Radius: 16–24px panels / 8–12px inline.",
   "Shadow: deep cinematic `0 32px 64px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.3)`.",
   "Type: editorial display (PP Editorial New Italic / Canela / Freight Display Italic / DM Serif Display) 72–120px italic, leading 0.9–1.0 + precise sans body. **The italic serif at display scale IS the signature.**",
   "Grain: 0.06–0.10 (film-stock). Imagery: desaturated-moody grade (~70%), edge-bleed.",
   "Motion: slow parallax (0.5×), fade-up `cubic-bezier(0.16,1,0.3,1)` 600–900ms. No glitch/scanline/particle."
  ]
 },
 {
  "id": "glassmorphism",
  "name": "Glassmorphism",
  "family": "Glass & Soft-Depth",
  "vibe": "Frosted, layered, ambient",
  "line": "Depth-through-transparency — UI panels simulate frosted glass (blurred, semi-opaque, hairline white stroke), layering without heavy shadow. (macOS Big Sur / Fluent Acrylic 2020 → Apple Liquid Glass 2025.)",
  "tokens": [
   "Ground: vivid multi-stop gradient (135deg), blurred photo, or mesh — **designed FIRST** (a plain white ground produces zero effect). Dark `#0d0d0d→#1a1a2e` is the most common successful substrate.",
   "Surface: `background: rgba(255,255,255,0.08)` (light) / 0.20–0.35 (dark) + `backdrop-filter: blur(12px)` (optimal 8–16px; >20px = oppressive).",
   "Border: `1px solid rgba(255,255,255,0.18)` — the hairline stroke is load-bearing; without it the panel dissolves.",
   "Radius: 16px base / 24px hero / 8px chips.",
   "Shadow: `0 4px 30px rgba(0,0,0,0.10)` soft, single (don't stack).",
   "**Scrim:** `rgba(0,0,0,0.25–0.35)` between background and panel — non-negotiable for text contrast on dynamic grounds.",
   "Color: 2 surface tones max; the background gradient supplies the palette; one accent for CTAs/icons.",
   "Type: geometric sans (Inter/Geist/DM Sans), ≥15px body, no thin/decorative on glass.",
   "Motion: enter `opacity 0→1` + `blur(20px)→blur(0)` 200ms; never animate backdrop-filter on >2 panels."
  ]
 },
 {
  "id": "neumorphism",
  "name": "Neumorphism / Soft UI",
  "family": "Glass & Soft-Depth",
  "vibe": "Soft, monolithic, calm",
  "line": "Fake-extrusion from the background — elements push out of / press into a flat monochrome surface via a precisely paired dual box-shadow (one light highlight, one dark shadow, both derived from the bg color). Niche-but-stable; very few shipped products (accessibility floor).",
  "tokens": [
   "Ground: flat solid mid-value gray/desaturated pastel, exact hex required (`#e0e5ec` / `#f0f0f3` / dark `#1e2a3a`). No gradients/images/texture — the illusion collapses otherwise.",
   "Surface: elements share the EXACT page bg color; illusion is shadow-only.",
   "Shadow (raised): `8px 8px 16px #b8bec7, -8px -8px 16px #ffffff`; (pressed/inset): `inset 4px 4px 8px #b8bec7, inset -4px -4px 8px #ffffff`. Dark shadow = base hue L −12–15%; light = white or L +6%.",
   "Border: none (barely-perceptible in dark mode only).",
   "Radius: 12–20px cards; 50% icon buttons/toggles (the round pill is the iconic shape).",
   "Color: monochromatic + ONE accent (coral/sage/amber) for focus/active/progress — the only way to get hierarchy without breaking the monolith.",
   "Type: SF Pro / Nunito / Poppins / DM Sans; weights 400 body, 600 label, 700 active. No sharp geometric sans, no italic.",
   "Motion: toggle raised↔inset via box-shadow transition 150ms; micro-gestural press, soft pulse loading (no spinner)."
  ]
 },
 {
  "id": "claymorphism",
  "name": "Claymorphism",
  "family": "Glass & Soft-Depth",
  "vibe": "Puffy, playful, tactile",
  "line": "Inflated plasticity — elements sculpted from soft clay (puffy, rounded, dimensionally thick) via a signature triple-shadow on high-saturation pastel fills. (Malewicz 2021 → Duolingo/Reddit Snoo/Android Bugdroid 3D.)",
  "tokens": [
   "Ground: vivid pastel fill, part of the palette — lavender `hsl(270,60%,88%)` / mint / peach. Light enough for the outer drop-shadow; pure black breaks inner-shadow visibility.",
   "Surface: saturated-not-neon pastel; color does NOT match the background (unlike neumorphism).",
   "Triple-shadow (defining token): `8px 8px 16px rgba(0,0,0,0.25), inset -8px -8px 12px rgba(0,0,0,0.25), inset 8px 8px 12px rgba(255,255,255,0.4)`. Scale px proportional to element size; drop inner shadows below 48px height.",
   "Border: none (triple shadow makes the edge). Radius: 32px buttons / 40–48px cards / 50% blobs. Low-radius clay looks like a flat rectangle with heavy shadows.",
   "Color: 3 hues max — bg hue + 1–2 fills + white inner highlight; coordinated scheme, CTA most saturated.",
   "Type: Nunito / Fredoka / Plus Jakarta Sans / Baloo 2; headlines 700–800, body 500. Never thin/serif.",
   "Motion: SQUISH on press `scale(0.94)` + shadow compress 100ms; hover lift; spring overshoot entrance `cubic-bezier(0.34,1.56,0.64,1)`."
  ]
 },
 {
  "id": "aurora",
  "name": "Aurora / Gradient-Mesh",
  "family": "Gradient & Organic",
  "vibe": "Luminous, premium, calm",
  "line": "Soft luminous color fields from blended radial gradients (or WebGL mesh) through heavy blur — northern-lights. (Stripe's WebGL hero 2021–23 → default \"premium SaaS\" dark landing.)",
  "tokens": [
   "Ground: near-black `#0a0a0f→#0d1117` or deep navy (never pure white in full aurora). Cream works for a \"light aurora\" variant.",
   "Surface: absolute radial blobs `40–70vw/vh`, `filter: blur(80–160px)`, opacity 0.35–0.6, `mix-blend-mode: screen` on dark.",
   "Border: `1px rgba(255,255,255,0.08)` glass edge. Radius 16–24 cards.",
   "Shadow: `0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)`.",
   "Color: 2–3 hues, analogous/split-complementary (violet+cyan+rose; teal+amber). Blob saturation 60–80%; **UI text/controls ≤20% saturation** so blobs breathe.",
   "Type: Inter Tight / Geist / Cal Sans 600–800, tight tracking −0.03 to −0.05em, 56–96px; body Inter/DM Sans `#94a3b8`. No serif. Optional noise 0.04–0.08.",
   "Motion: blobs breathe (slow translate+scale on independent 18/22/27s timers); never bounce/rotate-fast; `prefers-reduced-motion` → freeze."
  ]
 },
 {
  "id": "organic",
  "name": "Organic / Blobby / Hand-Drawn",
  "family": "Gradient & Organic",
  "vibe": "Warm, approachable, human",
  "line": "Irregular biomorphic shapes, hand-drawn illustration, doodle iconography on warm approachable web — the antithesis of cold geometric minimalism. (Mailchimp era 2019–22 → the go-to warm-consumer/wellness/indie register.)",
  "tokens": [
   "Ground: warm cream `#FDFAF4`/`#FBF7EE`, soft sage `#F2F5EE`, or blush `#FDF2F0`. **Never cold white** (kills the warmth). Dark is an anti-pattern.",
   "Surface: SVG blob shapes as dividers/masks/accents, fill brand color at opacity 0.15–0.40. Wobble optional.",
   "Border: soft 1–2px `rgba(0,0,0,0.08)`/brand tint; wavy on section breaks. Radius extreme 24–40px; blob `border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%`.",
   "Shadow: `0 4px 16px rgba(0,0,0,0.06)` soft. Warmth > depth.",
   "Color: warm earthy — ochre/terracotta/sage/dusty-rose + cream; 1 accent + 1 neutral. Avoid cool blue/gray and neon.",
   "Type: Recoleta / DM Serif Display / Playfair 500–700 rounded serif headlines + DM Sans / Plus Jakarta body 16 / 1.7. Doodle font (Caveat/Pacifico) for ≤5-word callouts only.",
   "Texture: paper overlay 0.06–0.12; brush-stroke dividers. Hand-drawn/imperfect icons (Phosphor duotone) — never mix with geometric sets.",
   "Motion: blob wobble (morph border-radius 6–10s), gentle float, subtle card lift. Nothing mechanical."
  ]
 },
 {
  "id": "spatial",
  "name": "Spatial / 3D Depth",
  "family": "Gradient & Organic",
  "vibe": "Dimensional, tactile, modern",
  "line": "Real or rendered 3D objects, depth layers, and inflated surfaces making the screen feel like a physical space or a shelf of touchable objects. (Apple skeuomorphism 2007–13 → claymorphic-3D + Vision Pro spatial 2024.) *(For pure flat-clay UI material, see Claymorphism #18 — this style is about rendered 3D objects + spatial depth layering.)*",
  "tokens": [
   "Ground: light pastel/soft-colored (`#F4F0FF` lavender / `#EFF8F0` mint / `#FFF5F0` peach) so inflated elements cast visible outer shadows. Dark-mode is harder.",
   "Surface: primary components get extreme radius + soft gradient fill (top +10% lighter, bottom −5%) + inset pair + outer drop-shadow.",
   "Clay/depth recipe: `0 8px 24px rgba(0,0,0,0.12), inset 0 -3px 6px rgba(0,0,0,0.08), inset 0 3px 6px rgba(255,255,255,0.60)`; outer shadow `0 12px 40px` tinted to element hue at 0.30.",
   "Border: `1.5–2px rgba(255,255,255,0.6)` highlight edge. Radius: **proportional** — 999px pills/buttons, 24–32px cards, 16–20px large panels (never one value for both).",
   "Color: soft pastels \"candy tray\" + 1 bold accent (Duo green `#58CC02`) for CTAs; neutral cream ground so shadows read.",
   "Type: Nunito / Fredoka / Poppins 600–700; **weight ≥600 on inflated surfaces** (thin disappears).",
   "Motion: squish press `scale(0.96)` + deepen inset 80ms; float hover; jelly spring `cubic-bezier(0.34,1.56,0.64,1)`; Lottie/Rive 3D idle for mascots."
  ]
 },
 {
  "id": "maximalism",
  "name": "Maximalism",
  "family": "Maximal & Retro",
  "vibe": "Dense, clashing, alive",
  "line": "Deliberate excess — dense layering, clashing hues, expressive typography, zero negative-space orthodoxy. The anti-minimal backlash. (Luxury/editorial 2010s → web/product branding 2022–24.)",
  "tokens": [
   "Ground: richly saturated or printed/patterned (inky black `#0a0a0a`, deep burgundy); no bare white unless immediately attacked with floating elements.",
   "Surface: layered — pattern beneath, image over, type on top, illustration breaking the frame. 3–4 visible z-layers.",
   "Border: 2–4px contrasting/same-family, sometimes absent. Radius mixed intentionally.",
   "Shadow: absent (flat color stacking = depth) OR exaggerated drop-shadow in a saturated complementary hue (not gray).",
   "Color: 4–6 hues, none neutral; anchor 2 primaries + 2 clashes + dark + near-white; hero saturation 70–100%; muted only in body zones.",
   "Type: display slab/fat-italic 80–120px (Domaine/Abril/Playfair Black) fighting a condensed grotesque (Bebas/Barlow Condensed XBold); body workhorse grotesque 14–16 / 1.7. **Never two personality faces at body size.**",
   "Texture: film grain 8–15%, riso halftone 20%, moire dividers.",
   "Motion: independent parallax stagger; char-by-char reveal; foreground faster than background. No uniform fade."
  ]
 },
 {
  "id": "y2k",
  "name": "Y2K / Chrome-Gloss",
  "family": "Maximal & Retro",
  "vibe": "Glossy, futuristic, candy",
  "line": "1998–2004 retro-futurism — chrome surfaces, glossy plastic UI, iridescent gradients, bubble/bitmap fonts, neon candy. (Revived 2022–25 by Gen Z.)",
  "tokens": [
   "Ground: jet black `#050505–#111` OR cool mid-tone (`#1a1a2e` / navy `#0a0f2e`) so chrome/glow pop.",
   "Surface: metallic `linear-gradient(135deg, #e8e8e8, #f5f5f5, #c0c0c0)` + a bright specular radial spot; glossy `inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.4)`.",
   "Border: gradient silver→white→silver, or glow border `0 0 0 1px #7af, 0 0 12px #4af`.",
   "Radius: 12–24px cards, pill buttons, circular badges. No sharp corners.",
   "Shadow: glow-based; neon outer glow `0 0 20px currentColor`; layered 1px+8px+20px.",
   "Color: (a) candy-bright aqua/bubblegum/lime/silver on dark, or (b) monochrome chrome + 1 neon accent. Chrome/silver is the base, ≤2 saturated accents.",
   "Type: pixelated/metallic display (Press Start 2P / VT323 / Audiowide / Orbitron) ≥28px display only + clean grotesque body 14–15px.",
   "Texture: subtle noise 3–5% on chrome, scanline 8%. Y2K reads polished, not grungy.",
   "Motion: metallic shimmer sweep on hover; glide-up entrance 300ms; optional RGB-split glitch on logo hover only."
  ]
 },
 {
  "id": "frutiger-aero",
  "name": "Frutiger Aero",
  "family": "Maximal & Retro",
  "vibe": "Clean, optimistic, nature-tech",
  "line": "2006–2012 corporate optimism in glass, gradient, and nature motifs — aqua blues, leafy greens, glossy 3D icons, bokeh skies. Lives in the light. (Revived 2023–25 as \"hopeful tech.\")",
  "tokens": [
   "Ground: LIGHT to MID, never dark — sky blue `#d0eaf5→#a8d4ee`, aqua-white `#e8f7f0`, pale grass, or bokeh nature photo.",
   "Surface: glass `backdrop-filter: blur(12px); background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.4)`; skeuomorphic 3D icon tiles with bevel + candy-gloss top highlight.",
   "Border: light edge top/left + faint blue shadow edge bottom/right; glow active state.",
   "Radius: 16–24 cards / 12 chips / pill buttons. No sharp corners (radius ≥8 everywhere).",
   "Shadow: soft environment `0 8px 32px rgba(0,100,160,0.15)` — **blue/green-tinted, not gray/black.**",
   "Color: aqua-sky `#5bbfe8` + leaf-green `#78c96a` dominant; lime/warm-white accent; deepest value navy `#1a3a5c` (no pure black).",
   "Type: Frutiger / Nunito / Varela Round / Poppins humanist round; body 15–16 / 1.65, navy color. No serif/condensed/slab.",
   "Texture: bokeh, lens flare, water-ripple SVG. **Zero film grain** — clinically clean.",
   "Motion: gentle 3D-icon float (translateY −4px, 3s), water ripple on hover, bubble rise. ≤6s ease-in-out sine, nothing sudden."
  ]
 },
 {
  "id": "vaporwave",
  "name": "Vaporwave",
  "family": "Maximal & Retro",
  "vibe": "Nostalgic, ironic, neon",
  "line": "Ironic retro-futurist nostalgia — 1980s Japanese mall imagery, Greek statues, Windows 95 chrome, neon Miami-sunset grids. Use seriously only when the concept earns the irony. (2010–14 music microgenre.)",
  "tokens": [
   "Ground: dark purple `#1a0533`/`#250a42` or deep navy `#0a0a2e`; often a retrowave perspective grid.",
   "Surface: layered collage — floating 3D objects (busts, palms, CRTs), gradient mesh behind type; dark translucent cards with 1px neon border. No opaque white.",
   "Border: 1–2px neon (magenta `#ff2d95` / cyan `#00e5ff`), glow `0 0 8px`. Radius low-to-zero (sharp CRT/window references); 4–6px on interactive only.",
   "Shadow: none or neon glow (no neutral drop shadows).",
   "Color: 5-strict palette — magenta `#ff2d95`, cyan `#00e5ff`, violet `#6e00ff`, sunset orange `#ff6e00`, mid-purple ground. Sunset gradient violet→magenta→orange. (Pastel \"lighter vaporwave\" variant on white exists but loses the atmosphere.)",
   "Type: VT323 / Press Start 2P / Audiowide / Orbitron 48–80px; decorative katakana (transliterated brand words, never random); mono body 13–14 if at all.",
   "Texture: scanlines 8–12%, CRT phosphor bloom, VHS static on transitions.",
   "Motion: perspective grid scrolling toward camera; text glitch on hover (RGB split 80ms); slow 3D rotation. Three motion types max."
  ]
 },
 {
  "id": "memphis",
  "name": "Memphis / Neo-Postmodern",
  "family": "Maximal & Retro",
  "vibe": "Joyful, geometric, rebellious",
  "line": "Sottsass's 1981 radical movement — primary-color collisions, squiggle-and-dot patterns, geometric primitive stacking. Joyful geometric rebellion, now in a refined neo-Memphis phase. (2022–25.)",
  "tokens": [
   "Ground: off-white `#fafaf5` / cream `#fdf8ef` / pastel base. **Primary grounds are LIGHT** — patterns/shapes supply the weight.",
   "Surface: flat solid color blocks (rectangles/circles/triangles z-stacked over the ground), no shadows/gradients on shapes; pattern fills (polka/zigzag/hatch) in secondary shapes.",
   "Border: 2–4px solid black `#111` (neo precision) or color-on-color borderless; never gradient.",
   "Radius: 0 orthodox (neo allows 4–8px max).",
   "Shadow: none, or the brutal hard-offset (4–6px solid black, no blur) — **never soft/Gaussian.**",
   "Color: primaries at FULL saturation — fire red `#e8170e`, cobalt `#2b4ae2`, school-yellow `#f5c800`, black `#111`; secondaries hot pink/electric green/violet; neutrals white/off-white, no grays.",
   "Type: geometric slab / display grotesque (Roc Grotesk XBold / Druk Wide / PP Neue Montreal Bold) 64–100px + clean humanist sans body 15–16; or full-period bold rounded (Cooper Hewitt / Nunito Black).",
   "Texture: none in pure form (neo allows riso 8%). Iconography: classic Memphis squiggle/half-circle/zigzag/dot/starburst (shape elements, not icon systems).",
   "Motion: shapes enter from off-screen with slight overshoot spring; staggered 50ms; type color-fill wipe."
  ]
 }
];

export const styleIds = () => STYLES.map((s) => s.id);

// The direction text the engine is given: a style's full grammar when the id names one, else the person's own words.
export const directionText = (direction) => {
  const s = STYLES.find((x) => x.id === direction.trim().toLowerCase());
  return s ? `${s.name} (${s.family}; ${s.vibe}). ${s.line} Commit to this one style across the whole page, in every section and state, with no tokens borrowed from another style. Tokens: ${s.tokens.join(' ')}` : direction;
};
