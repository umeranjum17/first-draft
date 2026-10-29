# Retired engine

Generation moved to our OpenDesign fork at
`3805d0303285d019185cde25b110e5bba4f21140`; see [ENGINE.md](../../ENGINE.md)
for the upstream mapping, imported paths and sync procedure.

The old OpenCoworkAI/open-codesign core/providers/prompts/templates at
`a63feb563da94090778fc5bee67e9672fccd26a1` were removed only after the bounded,
blinded same-brief Opus comparison cleared both old-engine scores. They are
not part of the installed package.

Studio's non-generating sandbox/JSX compatibility runtime remains separately
at `vendor/studio-runtime`, with its original MIT LICENSE and NOTICE. It cannot
call a model or generate a design. first-draft's CLI, craft/method guidance,
critic/fallback, reference and render/data/page gates remain first-draft code.
