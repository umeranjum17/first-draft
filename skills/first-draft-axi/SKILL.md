---
name: first-draft-axi
description: "Drive first-draft-axi to prototype and explore designs: several self-contained HTML options for a new screen, landing page or bigger redesign, a real redesign of an existing screen from a URL or a screenshot, a logo, shown on a phone + desktop canvas and posted to sign-off for a pick. Use for bigger redesigns, new screens, landing pages and design options to compare; small UI fixes do not need it."
---

# first-draft-axi

Use it by judgement: bigger redesigns, new screens, landing pages, or "show me 3 options to pick from". A small UI fix (a colour, a margin, a label) does not need it; edit the code.
Every command prints JSON; its `help` list says what to do next, and a failure is `{"error": {"code", "message"}, "help": [...]}`: read the message, do not retry blindly.

## The 5 commands

1. **init**, once per repo (safe to re-run; writes only inside the repo):
   `first-draft-axi init`
   Makes `.first-draft/` (ignored by git, so it never dirties the repo) and installs this skill for claude (`.claude/skills`), codex and pi (`.agents/skills`). `--harness claude` limits it; `--global` also links the skill from your home folder.
2. **make**, options for a new screen or page (one page per option from one model call plus one critic pass, a few minutes in all: start it in the background, then read its JSON):
   `first-draft-axi make "A settings page for a podcast app: profile, notifications, billing" --out .first-draft/designs/settings.html --options 3 --model claude-sonnet-5-5`
   Writes `settings-1.html` … `settings-3.html`. A flow brief (onboarding, sign-up, a wizard: it says "N screens") is drawn as one file of screens on one shell and one grid, scored for `flow.shell` and `flow.character` (one character in one style on every screen); with `--assets codex` the character's style sheet is drawn first and every scene is drawn from it, so pass the person's reference picture with `--ref`. Add `--direction editorial` (see `first-draft-axi styles`) or `--screens "Settings,Billing"`; `--options 1` for one. With several options and no `--direction`, the model plans a direction per option for the brief. `--no-critic` skips scoring; low scores stay flagged without revision. `refs pull` fills the local, explicitly licensed reference cache and enables the independent subscription judge (default Sol 6.1 on `byokit:codex`); missing references or judge readiness means labelled generator self-assessment. `judge option.html "<brief>" --plain baseline.html` scores retained pages without regeneration, `--engine` uses the older multi-turn engine loop.
3. **redesign**, an existing screen, from a URL or a screenshot:
   - URL (anonymous, scripts off; follows links to the same site, 6 pages by default): `first-draft-axi redesign https://example.com/pricing "Clearer plans, one obvious call to action" --out .first-draft/designs/pricing --model claude-sonnet-5-5` (add `--max-pages 1` for just that page, `--ref shot.png` to also show it a screenshot)
   - A folder of exported HTML: `first-draft-axi redesign ./site-export "<what to change>" --out .first-draft/designs/site`
   - Only a screenshot (a page you cannot reach, an app screen): `first-draft-axi make "Redesign this screen: <what to change>. Keep its content and actions." --ref shot.png --out .first-draft/designs/screen.html --model claude-sonnet-5-5` (`--ref` takes png, jpg or webp, up to 6, needs ImageMagick)
   `--out` is a folder for redesign: `option-1.html`, plus `sources/` with the captured original (`sources/sources.json`, screenshots) to compare against.
4. **view**, to look at them (run in the background; it serves until stopped):
   `first-draft-axi view .first-draft/designs/settings.html`
   Prints a url (the tailnet address, port 4430 or `$FIRST_DRAFT_VIEW_PORT`): a grid, a canvas per option with desktop 1280 and phone 390 side by side, and Play. Comments people leave are in `settings.comments.json` beside the design: read it before you change anything.
5. **post**, to get a decision from the user on a sign-off board (needs `sign-off-axi`; run it from any repo):
   `first-draft-axi post .first-draft/designs/settings.html --title "Which settings layout?" --recommend a --option a="Grouped list" --option b="Tabs" --option c="Single scroll"`
   Copies the options to the board's `mocks/`, starts the view, and each option card gets an Open link to its live Play page (desktop and phone urls are in the output). The board is the nearest `.sign-off/` above the folder, or `--board <board.json>`, or `$FIRST_DRAFT_BOARD`. You choose `--recommend` (the option you would pick); a second post on the same title needs `--key <new-key>`. Tests, journeys and demos ask nobody: `--evidence --media shot.png` instead of `--recommend`.
   On a machine without a tailnet address pass `--host <address>` (or `FIRST_DRAFT_VIEW_HOST`).

Also: `first-draft-axi doctor` (is the model ready, no paid call), `first-draft-axi refine <option.html> "<change>" --out <new.html>` (change the option the user picked), `first-draft-axi logo "<brief>" --out <file.html>`, `first-draft-axi --help`.

## Where outputs land

Under `.first-draft/designs/` when you use the paths above (git ignores it: `git add -f` a design the user wants kept; never commit by default). Each option is one self-contained HTML file that loads nothing from the network. The CLI prints no paths you have to guess: `made.files[].file` lists every option, `redesign.sources` the captured original.

## Read the result

- `made.files[]`: one per option (`file`, `source`, `turns`); `made.render_check` is `checked` when every page was rendered at 390px in light and dark and fits, `skipped` without Chrome or Chromium.
- `made.model`, `made.seconds`: report them next to what you show.
- The critic (on by default; options are drawn two at a time and `made.timing` says where the seconds went; needs Chrome or Chromium and a model that takes images): the generator writes one plain page for the brief in one prompt (`<out>.critic/plain.html`); the critic sees it and each option at 1280 and 390, and scores both 1 to 10 against the best real products of the kind (Linear, Stripe, Vercel, Notion, Raycast class). An option passes at 9 or more and no lower than the plain page; a low score stays flagged, without another design revision. Each file's `critique` has `score`, `passed`, `plain_score`, `scores` (one review), `gaps` and `fix`; for a landing, home, marketing or company page also `ai_side` (`reads_as_ai`, the `tells`) and `hero` (`met` of 9 with a reason for each point), and a page that reads as the AI side does not pass. Report every option's score and gaps to the user, and show the plain page beside the options. An option with `passed: false` is a draft, never a finished design: say so. Wherever an option is shown as an example of first-draft's work (a README, a post, a demo), name its model and its score, and show only one that passed. Read `critique.judge`: with local references and a ready judge route it is an independent model; otherwise it is explicitly labelled generator self-assessment; `--no-critic` only when the user asks (the JSON then says no option was scored).
- `redesign.screens` lists the pages redesigned, `redesign.pending` the linked pages not done (raise `--max-pages`), `redesign.limitations` what could not be captured.
- `help` repeats the next commands with your paths filled in. `truncated` means an option ran out of engine turns: say so.
- The designs are model-made: look at them (open the `view` url, or screenshot it) before you call one good.

## The model, and no tokens

- Pass the model per run: `--model claude-sonnet-5-5` (the fleet engine model for now). It runs on the BYOKit Claude subscription route, through the installed, signed-in `claude` CLI: nothing to paste, no API key.
- Not set up yet (`doctor` says no agent): in the fleet run `first-draft-axi init --agent byokit:claude --model claude-sonnet-5-5` (saves to `~/.first-draft/config.json`). Anyone else: ask the user which route and model to use; never pick one for them.
- Never use, ask for, print, save or paste an API key or token, and never copy login files. `post` prints none; if a command shows you one, do not repeat it.
- Never start a generation in CI or a test: `make`, `redesign`, `refine` and `logo` spend the user's model quota. `doctor`, `styles`, `view`, `post` and `init` spend none. Image assets cost money and stay off unless the user approves (REFERENCE.md).

## Clarity over flash

For a landing, home, marketing or product page, a clear page beats a flashy one. The engine's `clarity-over-flash` skill holds the rubric and a 12-line self-check. For a landing, home, marketing or company page the engine gets the rubric in its prompt and `make` runs the eight code-checkable lines (one hero h1, one primary button, a picture, proof within two screens, one accent hue, nothing moving on its own) and repairs the page; apply the same bar when you brief, refine and recommend.
- The 5-second test must pass on the first screen: who it is for, what it does, why trust it, what to do next. Put any of the four the user gave you into the prompt in their words.
- The shape: one real picture, one headline of at most 10 words (one word may be muted, as in "Built for teams, proven by results"), one support line, one primary and at most one secondary button, generous whitespace, then proof (named customers or cases with concrete results) right after the hero. One message per section.
- Restraint: neutrals with one accent at most, no motion that runs on its own, a real photo or the product over decoration. For real photos offer `--assets` (with the cost preview and approval above) or the project's own screenshots; adding `--hero-video` (or naming Higgsfield) makes the approved run also turn the hero still into one short looping hero video, so never add an autoplaying video yourself; without pictures the hero keeps a marked image slot.
- Human side, not AI side (the one-call `make`'s own guidance, `src/taste/human-side.md`): one bold brand colour and one accent in big colour blocks, an editorial headline at scale, the real product shown as data, sections that change rhythm, and no run of more than two card grids; the AI side is soft pastel, 3D props and equal cards. The hero has the nine points: a clickable logo bigger than the nav, a nav marking the current page, a smaller secondary button of the same family, a pill above the title, a centred 5 to 8 word specific title, subtext naming features and audience, one primary button whose label names the first step, a logo strip only with real client names, and a real product screen. Put the audience, the real client names and the real numbers in the prompt; without them the page labels logos and quotes as samples.
- Flash only when the brief asks for it: do not add a loud `--direction` (maximalism, y2k, neon …) yourself. With several options and no direction, some options get loud styles; the structure above still applies to them.
- When you pick `--recommend` or explain options, lead with the one that passes the 5-second test, and name what each other option misses.

More (every flag, references, assets, logos, errors): REFERENCE.md beside this file.
