#!/usr/bin/env bash
# Journey: make a landing page on the real model route with this checkout (render check on) and with the commit before it
# ($FD_BASE, default origin/main: no render check), then capture both pages at 390 and 1280, in light and in dark.
# Needs MINIMAX_API_KEY in this command's environment (given by the caller, never printed here), Chrome or Chromium,
# and DONE_DONE_EVIDENCE_ROOT. The evidence folder gets only this page's 390 captures and their metrics; its other captures (1280,
# full page) go to $FD_EXTRA_OUT and the earlier commit's to $FD_BEFORE_OUT (defaults: temp folders removed at the end).
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=${DONE_DONE_EVIDENCE_ROOT:?run this through done-done}
d=$(mktemp -d)
before=${FD_BEFORE_OUT:-$d/before}
extra=${FD_EXTRA_OUT:-$d/extra}
mkdir -p "$before" "$extra"
export CHROME_DEVTOOLS_AXI_SESSION=fd-render-check-$$ CHROME_DEVTOOLS_AXI_USER_DATA_DIR=$d/browser
trap 'chrome-devtools-axi stop >/dev/null 2>&1 || true; rm -rf -- "$d"' EXIT

export FIRST_DRAFT_HOME=$d/home
node "$root/src/cli.mjs" init --agent byokit:minimax:key >/dev/null
prompt="Make a landing page for my tool first-draft-axi. Its README is below; use only it as the source.

$(cat "$root/README.md")"

node "$root/src/cli.mjs" make "$prompt" --out "$d/after.html" > "$extra/after-make.json" 2> "$d/after-make.stderr" & after=$!
mkdir "$d/base"
git -C "$root" archive "${FD_BASE:-origin/main}" | tar -x -C "$d/base"
ln -s "$root/node_modules" "$d/base/node_modules"
cp -r "$root/dist" "$d/base/dist"
node "$d/base/src/cli.mjs" make "$prompt" --out "$d/before.html" > "$before/make.json" 2> "$before/make.stderr" & release=$!
wait "$after"
wait "$release"
cp "$d/after.html" "$extra/after.html"
cp "$d/before.html" "$before/page.html"
grep -q 'src="data:image/' "$d/after.html" || { echo "the page embeds none of the project's screenshots" >&2; exit 1; }
cp "$d/after-make.stderr" "$extra/after-make.stderr"
grep -q '"render_check":"checked"' "$extra/after-make.json" || { echo "the render check did not run on this checkout's make" >&2; exit 1; }

chrome-devtools-axi open "file://$d/after.html" >/dev/null # emulation needs a page to act on

# One cell: the page at a width in a colour scheme, saved as a screenshot, with one line of the page's own metrics added to <dir>/metrics.
shot() { # <dir> <name> <page> <width> <height> <scheme> [--full-page]
  chrome-devtools-axi emulate --viewport "$4x$5x1" --color-scheme "$6" >/dev/null
  chrome-devtools-axi open "file://$3" >/dev/null
  chrome-devtools-axi open "file://$3" >/dev/null # the first open after a change of viewport still lays out at the old width
  if [ -z "${7:-}" ]; then # the full-page shot has the same metrics as its viewport shot
    echo "$2: $(chrome-devtools-axi eval '() => `viewport ${innerWidth}px, page scroll width ${document.documentElement.scrollWidth}px, dark colour scheme ${matchMedia("(prefers-color-scheme: dark)").matches}, background ${getComputedStyle(document.body).backgroundColor}, text ${getComputedStyle(document.body).color}`' | head -1)" >> "$1/metrics"
  fi
  chrome-devtools-axi screenshot "$1/$2.png" ${7:-} >/dev/null
}
for side in before after; do
  dir=$extra; page=$d/after.html
  [ "$side" = before ] && { dir=$before; page=$d/before.html; }
  for theme in light dark; do
    shot "$dir" "$side-390-$theme" "$page" 390 844 "$theme"
    shot "$dir" "$side-1280-$theme" "$page" 1280 900 "$theme"
    shot "$dir" "$side-390-$theme-full" "$page" 390 844 "$theme" --full-page
  done
done

# The pass conditions, read off the captures: this checkout's page fits 390 and its dark capture differs from its light one.
width=$(grep '^after-390-light:' "$extra/metrics" | grep -o 'scroll width [0-9]*' | grep -o '[0-9]*$')
[ "$width" -le 390 ] || { echo "the page is $width px wide at 390" >&2; exit 1; }
! cmp -s "$extra/after-390-light.png" "$extra/after-390-dark.png" || { echo "the page paints the same in light and dark" >&2; exit 1; }
# The sealed evidence is the phone captures and their metrics; the 1280, full-page and before captures stay beside it in $extra and $before.
cp "$extra/after-390-light.png" "$extra/after-390-dark.png" "$out/"
grep '^after-390-' "$extra/metrics" > "$out/after-metrics.txt"
cat > "$out/steps.json" <<JSON
{"target": {"version": "$(node -p "require('$root/package.json').version")"},
 "start": "a fresh FIRST_DRAFT_HOME set up with init --agent byokit:minimax:key, and a README to make a landing page from",
 "steps": ["run first-draft-axi make with a landing-page prompt that carries the README, on the real model route, with the render check on", "read the page make wrote and its JSON, which says render_check checked", "open the page at 390, in light and in dark, and save a screenshot and the scroll width of each"],
 "result": "the landing page make wrote fits a 390 px phone with no sideways scroll and paints differently in dark than in light"}
JSON
echo "after: scrollWidth $width at 390, dark differs from light"
echo "before: $(grep '^before-390-light:' "$before/metrics" | grep -o 'scroll width [0-9]*px') at 390, same dark: $(cmp -s "$before/before-390-light.png" "$before/before-390-dark.png" && echo yes || echo no)"
