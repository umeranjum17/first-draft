// Image-first logo exploration: each concept is first shown to an image model through the asset providers (assets.mjs: Codex image
// generation on the signed-in subscription, or Higgsfield; credentials stay with those CLIs, no key is read or sent anywhere new). The
// raster comes back as a PNG reference for the engine, which redraws its strongest idea as clean SVG. It is the default path whenever a
// provider is ready; with none (or in CI, or --explore none) the logo is drawn from the idea alone, as before.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareAssets } from './assets.mjs';
import { references } from './references.mjs';

export const exploreHelp = '--explore auto|none|codex|higgsfield|codex,higgsfield (default auto): before the engine draws a concept, an image model shows its idea as a raster that the engine takes as a reference and redraws as clean SVG; one image per concept tried, on Codex (subscription quota) when it is ready, else Higgsfield (credits). auto uses a ready provider and otherwise draws from the idea alone; none never makes an image; CI never does. Needs ImageMagick.';

// { off } with the reason when no image is made, else { provider, preview, picture(concept) } for a directory the generated files are kept in.
export async function exploreImages({ spec = 'auto', count, brief, dir }) {
  if (spec === 'none') return { off: 'switched off with --explore none' };
  if (process.env.CI) return { off: 'CI never generates images' };
  let session;
  try { session = await prepareAssets({ assets: spec, 'allow-asset-spend': true }, count); } catch (e) {
    if (spec !== 'auto') throw e; // a provider the person named must work
    return { off: `no image provider is ready: ${e.message}` };
  }
  const provider = (session.providers.find((p) => p.provider === 'codex') ?? session.providers[0]).provider;
  return { provider, preview: session.preview, async picture(concept) {
    const started = Date.now();
    const prompt = `A logo mark exploration for ${brief}. Concept "${concept.name}": ${concept.idea} Built as: ${concept.shape} It must not read as: ${concept.avoid}. One flat mark, centred with generous space, on a plain white background, in flat solid colours (${concept.palette.light.primary} and ${concept.palette.light.accent}); no text or lettering, no mockup, no shadow, no gradient, no photograph.`;
    try {
      const image = await session.generate({ provider, prompt, aspectRatio: '1:1', name: concept.name }, join(dir, `concept-${concept.id}.html`));
      const [ref] = await references([image.file]);
      return { provider, prompt, webp: readFileSync(image.file), ref: { ...ref, id: `exploration-${concept.id}` }, seconds: Math.round((Date.now() - started) / 1000) };
    } catch (e) {
      process.stderr.write(`first-draft-axi: the ${provider} image for ${concept.name} failed, so it is drawn from the idea alone: ${e.message}\n`);
      return { provider, prompt, error: e.message, seconds: Math.round((Date.now() - started) / 1000) };
    }
  } };
}
