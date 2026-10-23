# Vision

## Who it is for

People who want to see a design and pick one before anyone writes app code: on their own, or by handing the CLI to their coding agent.

## The problem

You want to choose a direction before writing app code, not just look at one screenshot. And designs that come out of a model are often mid: no skill, no direction, nothing exciting.

## Top goal

Redesign a real product well, without spoon-feeding. Point first-draft at the live product (a URL or screens), add a few reference images and one line of intent. first-draft finds every screen itself, keeps the flows, applies the reference look at phone and desktop size, and uses the product's real data. It checks its own work before it hands it over: no emoji filler, metrics you read at a glance, the same tokens everywhere. On a strong model the result is really good, not mid. Working first; rough edges are fine.

## Where we are going

One prompt makes several self-contained HTML mock-up options. A person compares them, plays through them, comments, refines the one they like, and picks.

first-draft becomes a complete design tool, not only layouts: the options look as good as the design engine it is built on can make them, finish the whole brief, and carry their own pictures, icons and hero images. The person running it is in control of each run (how many options and the other settings), not handed a fixed recipe.

It is its own product, with its own CLI and agent skill, installable alone from npm. It works alone, and it works with [sign-off](https://github.com/umeranjum17/sign-off): sign-off uses it, and its cards link into first-draft to see things in detail.

## Principles

- **Taste is built in.** Someone who installs it from npm in an empty folder gets the same design defaults we use. Nothing lives in a private setup.
- **Works alone and together.** first-draft needs nothing else. The link to sign-off stays thin.
- **Your models, your accounts.** Every model call goes through [BYOKit](https://www.npmjs.com/package/@byokit/accounts), with the route and model you choose. first-draft keeps no model list of its own, never asks you to sign in again, and never reads, prints or copies your keys.
- **No unwanted constraints.** When designs come out mid, find the rule that holds the model back and remove it.
- **Real output, not fixtures.** Screenshots and proofs come from real runs on a real model, unedited.
- **Working first.** Ship what a person can use, end to end, before polishing it. Working with slight rough edges beats never shipped.

## Quality bar

- Each option is self-contained HTML that opens anywhere.
- It fits a 390px phone with no sideways scroll, and has a real light and dark theme. The tool checks both before a run ends.
- A run does not lose options to the engine's turn cap or a slow provider.
- Refining an option writes a new one; the original stays untouched.
- The README, skill and screenshots match what the tool does today.

## What it is not

- Not a feature of sign-off. It is a standalone tool.
- Not app code. Options are prototypes, not production apps.
- Not a model provider. It never ships its own model list, logins or provider SDKs.

## Next milestones

Each lands as a release of [`first-draft-axi`](https://www.npmjs.com/package/first-draft-axi?activeTab=versions).

1. **0.2.6: design as strong as the engine.** Give the design engine back its design starters and tools, embedded fonts and images, and JSX rendered to static HTML, and finish whole briefs at the turn cap. Ships with phone and desktop side by side on the canvas, and adding a comment with a tap.
2. **Real CLI controls.** Not hard-wired to 3 options: `--options <n>` plus other flags, each validated and documented in `--help`, the README and the skill.
3. **Asset generation.** Pictures, illustrations, icons, hero images and backgrounds, made through pluggable providers you already have and placed into the draft screens. Bring your own accounts, see the expected cost first, and never spend without your explicit flag.
