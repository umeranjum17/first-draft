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
export function designPrompt() {
  return composeOdNextStrategyRequestPromptV2(recipe, { locale: 'en' });
}
export const HOST_EXECUTION = `first-draft host execution contract: The user requests the completed editable design now, not a planning-only reply. Resolve reversible design decisions internally and produce the requested source in this call. This host uses BYOKit for model transport, not the OpenDesign daemon; no od CLI, workspace, production marker, external tool, paid media, or native agent child is available. Follow the output format and tools actually supplied by this host. first-draft explicitly requests its own bounded render/data/page checks, independent critic, reference review, scoring and repair after generation. The OpenDesign ship-on-write default governs the generator only: it never disables or replaces these host gates. The host's static-export and screen-link contract overrides interactive-script and device-shell defaults. first-draft's craft and method guidance below supplements the OpenDesign design strategy.
Static-host adaptation of the prototype profile: a behavior that would reveal content in an interactive OpenDesign app must have a visible static equivalent here. At 390, recompose product previews, navigation, tables and schedules instead of clipping their desktop structure or hiding meaningful fields; a scroll region needs a visible scroll cue. Give chart labels their own readable phone layout rather than shrinking desktop SVG text. Keep counts, progress and the displayed rows consistent. Honor explicit first-screen requirements with actual product data and the useful operational action, not just a tall heading above them. Use CSS prefers-color-scheme palettes for genuinely light and dark renderings of the same design, retaining its brand; an unchanged light surface in dark mode is not adaptation. These are generation obligations: they do not replace first-draft's existing checks, lower its bar or authorize another model/repair loop.`;
