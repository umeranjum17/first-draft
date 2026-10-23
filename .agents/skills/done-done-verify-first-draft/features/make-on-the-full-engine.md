# Make on the full engine: App.jsx drawn into a static page

Part of the first-draft verification map. Source: `src/make.mjs`, `src/render-check.mjs` (`snapshot`), `src/fonts.mjs`, `scripts/build.mjs`, `ENGINE.md`.

## How to get to it (user POV)

Run `first-draft-axi make "<prompt>" --out <file.html>` on the real model route with Chrome or Chromium installed. The engine runs with every upstream tool (`set_todos`, `skill`, `scaffold`, the editor, `done`, `tweaks` ...), its templates tree (method skills including first-draft's `interaction-motion`, the 12 design starters under `skills/*.jsx`, scaffolds, frames, brand references) and writes its usual `App.jsx`; the host draws it once headless and writes the static, script-free page it drew. Google Fonts it names are embedded as `data:` fonts. When a run ends with no version passing `done`, make sends `done`'s errors back as the next message, at most three times. A run is bounded at 60 model turns.

## Driving it

Harness: a shell runs the CLI with a throwaway FIRST_DRAFT_HOME and the model key in that one command's environment by path (never printed); a browser tool opens the written page.

1. `first-draft-axi init --agent byokit:minimax:key`, then `first-draft-axi make "$(cat <prompt file>)" --out <tmp>/<name>.html` for each fixed prompt (landing, app screen, dashboard: `data/fd-design-quality/prompts/` in the supervising home).
2. The output JSON names, per file: `source` (`App.jsx` when drawn), `turns` (under 60) and `tools` (the engine's tool calls by name: `skill` and `scaffold` show when it used them). No `truncated` key means the brief ended complete, not cut at the bound.
3. The page has no `<script>`, no `on*=` handler and the policy meta; a page that names a web font holds `data:font/woff2`.
4. Capture: open each page at 390 and 1280, in light and in dark (full page), and save the shots. Compare against the same prompts on main and on the upstream engine path (default prompt and tools, JSX shown with its own runtime) side by side.
5. Count finished briefs: a brief is finished when make exits 0 with no `truncated` entry.
6. With `FIRST_DRAFT_CHROME` set to a path that does not exist, the engine is asked for script-free `index.html` instead and `source` is `index.html`.
7. Stop what you started.
