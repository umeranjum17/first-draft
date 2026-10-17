#!/bin/sh
# Brings Open CoDesign's packages/ (MIT) in under vendor/open-codesign as one squashed git subtree at COMMIT,
# with its LICENSE and NOTICE beside them. The desktop app (apps/) is never brought in.
# First run adds the subtree; after bumping COMMIT, the same run pulls the new commit: sh scripts/open-codesign.sh
set -eu
UPSTREAM=https://github.com/OpenCoworkAI/open-codesign.git
COMMIT=466e64d199909f3d06e78860075d62febd24fc8a
PREFIX=vendor/open-codesign

cd "$(git rev-parse --show-toplevel)"
d=$(mktemp -d)
trap 'rm -rf -- "$d"' EXIT
git clone --quiet "$UPSTREAM" "$d"
git -C "$d" branch packages "$(git -C "$d" subtree split --quiet --prefix=packages "$COMMIT")"
if [ -d "$PREFIX" ]; then op=pull; else op=add; fi
git subtree "$op" --squash --prefix="$PREFIX" -m "chore(vendor): open-codesign packages at ${COMMIT}" "$d" packages
cp "$d/LICENSE" "$d/NOTICE" "$PREFIX/"
git add "$PREFIX/LICENSE" "$PREFIX/NOTICE"
git diff --cached --quiet || git commit --quiet -m "chore(vendor): open-codesign LICENSE and NOTICE at ${COMMIT}"
