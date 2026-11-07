// OpenDesign owns generation guidance; first-draft owns transport, export and acceptance.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { composeOdNextStrategyRequestPromptV2, OD_NEXT_PROMPT_STAGE_CONTRACT_V2 } from '../dist/opendesign.mjs';
const root = new URL('../dist/opendesign/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const source = JSON.parse(read('manifest.json'));
const path = 'plugins/_official/scenarios/od-next-strategy/';
const manifest = JSON.parse(read(`${path}open-design.json`));
const profile = manifest.od.strategy.assets.taskProfiles.find(p => p.taskType === 'prototype');
const digest = (text) => createHash('sha256').update(text).digest('hex');
const recipe = {
  recipe: manifest.od.strategy.promptRecipe, strategyId: manifest.od.strategy.id,
  strategyVersion: manifest.version, snapshotId: source.commit,
  packageHash: digest(JSON.stringify(source.files)), taskProfileDigest: source.files[`${path}assets/task-profiles/prototype.md`],
  taskProfileVersion: profile.version, taskType: 'prototype', executionProfile: 'text_artifact',
  coreStrategy: read(`${path}assets/core-system-prompt.md`), generalOrchestration: read(`${path}assets/general-orchestration.md`),
  taskSkill: read(`${path}assets/task-profiles/prototype.md`),
  activeStages: OD_NEXT_PROMPT_STAGE_CONTRACT_V2.map(({ id, atoms }) => ({ name: id, atoms: atoms.map(name => ({ name })) })),
};
export const ENGINE_COMMIT = source.commit;
// Open Design's own craft files, verbatim, joined as its loader joins them (apps/daemon/src/craft.ts). Each path names the files it takes, so
// craft can ship on one path and not another; CRAFT_HOST_LINE answers what the verbatim text says about Open Design's own tools and first-draft's taste.
export const CRAFT_SET = ['typography', 'typography-hierarchy'];
export const CRAFT_HOST_LINE = "The craft notes above are Open Design's. In this run no linter runs, `od.craft` settings do not apply, and no DESIGN.md exists unless one is supplied below. Token names in those notes are examples. Use all caps only where the brief or direction asks for it; when you do, track it as the notes say.";
const compose = (context) => composeOdNextStrategyRequestPromptV2(recipe, { locale: 'en', ...context });
// An empty context is the plain recipe, byte for byte. The composer's guard refuses text it reads as post-build work (it says itself that it is prone
// to false positives), and a refusal must not stop a draw: the craft is dropped, warn says why, and the prompt is the plain recipe.
export function designPrompt({ craft = [], warn } = {}) {
  if (!craft.length) return compose();
  const craftBody = craft.map((name) => `### ${name}\n\n${read(`craft/${name}.md`).trim()}`).join('\n\n---\n\n');
  try { return `${compose({ craftSections: craft, craftBody })}\n\n${CRAFT_HOST_LINE}`; }
  catch (e) { warn?.(`Open Design craft ${craft.join(', ')} dropped: ${e.message}`); return compose(); }
}
export const HOST_EXECUTION = `first-draft host execution contract: The user requests the completed editable design now, not a planning-only reply. Resolve reversible design decisions internally and produce the requested source in this call. This host uses BYOKit for model transport, not the OpenDesign daemon; no od CLI, workspace, production marker, external tool, paid media, or native agent child is available. Follow the output format and tools actually supplied by this host. first-draft explicitly requests its own bounded render/data/page checks, independent critic, reference review, scoring and repair after generation. The OpenDesign ship-on-write default governs the generator only: it never disables or replaces these host gates. The host's static-export and screen-link contract overrides interactive-script and device-shell defaults. first-draft's craft and method guidance below supplements the OpenDesign design strategy.
Static-host adaptation of the prototype profile: a behavior that would reveal content in an interactive OpenDesign app must have a visible static equivalent here. At 390, recompose product previews, navigation, tables and schedules instead of clipping their desktop structure or hiding meaningful fields; a scroll region needs a visible scroll cue. Give chart labels their own readable phone layout rather than shrinking desktop SVG text. Keep counts, progress and the displayed rows consistent. Honor explicit first-screen requirements with actual product data and the useful operational action, not just a tall heading above them. Use CSS prefers-color-scheme palettes for genuinely light and dark renderings of the same design, retaining its brand; an unchanged light surface in dark mode is not adaptation. These are generation obligations: they do not replace first-draft's existing checks, lower its bar or authorize another model/repair loop.`;
