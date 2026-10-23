// Providers own detect/estimate/generate; credentials stay with installed CLIs (Codex via BYOKit).
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { doctor, installedCodex } from './byokit.mjs';
const exec = promisify(execFile);
const run = async (bin, args, options = {}) => {
  try { return (await exec(bin, args, { timeout: 600_000, maxBuffer: 8_000_000, ...options })).stdout; }
  catch (e) {
    const detail = e.code === 'ENOENT' ? `${bin} is not installed` : e.stderr?.trim() || e.message;
    throw new Error(`${detail}${/No version is set for shim/.test(detail) ? '; run with mise exec node@26.1.0 -- first-draft-axi ...' : ''}`);
  }
};
const hf = (args) => run('higgsfield', [...args, '--json']);
const hfArgs = (prompt) => ['z_image', '--prompt', prompt, '--aspect_ratio', '1:1'];

// Adapter contract: detect() throws a setup hint; estimate({prompt}) returns {amount,unit,detail};
// generate({prompt,dir}) returns a local raster path. No adapter may retry or change accounts.
export const assetProviders = {
  higgsfield: {
    async detect() { await hf(['account', 'status']); },
    async estimate({ prompt }) {
      const cost = JSON.parse(await hf(['generate', 'cost', ...hfArgs(prompt)]));
      if (!Number.isFinite(cost.credits) || cost.credits < 0) throw new Error('Higgsfield returned no valid credit estimate');
      return { amount: cost.credits, unit: 'credits', detail: 'Z Image, one square image, provider estimate' };
    },
    async generate({ prompt, dir }) {
      const jobs = JSON.parse(await hf(['generate', 'create', ...hfArgs(prompt), '--wait']));
      writeFileSync(join(dir, 'provider-result.json'), JSON.stringify(jobs));
      const url = jobs[0]?.result_url;
      if (!url || new URL(url).protocol !== 'https:') throw new Error('Higgsfield returned no HTTPS image result');
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Higgsfield image download: HTTP ${response.status}`);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > 20_000_000) throw new Error('Generated image exceeds 20 MB'); chunks.push(chunk); }
      const file = join(dir, 'raw.png'); writeFileSync(file, Buffer.concat(chunks)); return file;
    },
  },
  codex: {
    async detect() {
      const row = await doctor('codex', 'configured');
      if (row.status !== 'ok') throw new Error(`Codex needs its subscription login: codex login; ${row.detail}`);
    },
    async estimate() { return { amount: null, unit: 'subscription quota', detail: 'One image-generation request; Codex exposes no price estimate. Quota and any overage are account-dependent, not free.' }; },
    async generate({ prompt, dir }) {
      const { bin, account } = await installedCodex();
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !account.unset.includes(k) && !/KEY|TOKEN|SECRET|^NODE_OPTIONS$/i.test(k)));
      Object.assign(env, account.set);
      const events = await run(bin, ['exec', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--sandbox', 'workspace-write', '--cd', dir, '--enable', 'image_generation', '--json',
        '--model', 'gpt-6-luna', '-c', 'model_reasoning_effort="low"', '-c', 'mcp_servers={}', '-c', 'features.shell_tool=false', '-c', 'features.unified_exec=false', '-c', 'features.apps=false', '-c', 'features.plugins=false',
        `Use only the native image generation tool. Generate exactly ONE small square raster image, cheapest/lowest quality available, and save it as asset.png in the current directory. No shell commands, no SVG, no external services, no API keys, no retries. If image generation is unavailable, say so and stop. Image brief: ${prompt}`], { cwd: dir, env });
      writeFileSync(join(dir, 'codex-events.jsonl'), events);
      const images = readdirSync(dir, { recursive: true }).filter((p) => /\.(png|jpe?g|webp)$/i.test(p));
      if (images.length !== 1) throw new Error('Codex did not produce exactly one raster image; native image generation may be unavailable in codex exec');
      return join(dir, images[0]);
    },
  },
};
export const assetFlags = { assets: { type: 'string' }, 'no-assets': { type: 'boolean' }, 'allow-asset-spend': { type: 'boolean' } };
export const assetHelp = 'Assets (make only): --assets codex|higgsfield|auto previews one image per option and exits without model calls; --allow-asset-spend explicitly approves that previewed asset spend (Codex quota/overage unknown); --no-assets disables assets (default). Needs ImageMagick. `assets` lists detected providers without spending. Never runs paid asset calls in CI.';
export async function detectAssets() {
  return Promise.all(Object.entries(assetProviders).map(async ([provider, adapter]) => {
    try { await adapter.detect(); return { provider, ready: true }; } catch (e) { return { provider, ready: false, cause: e.message }; }
  }));
}
export async function prepareAssets(values, prompt, count) {
  if (values['no-assets'] && (values.assets || values['allow-asset-spend'])) throw new Error('--no-assets conflicts with asset generation flags');
  if (!values.assets) {
    if (values['allow-asset-spend']) throw new Error('--allow-asset-spend requires --assets <provider>');
    return null;
  }
  if (process.env.CI && values['allow-asset-spend']) throw new Error('Paid asset generation is disabled in CI');
  let provider = values.assets;
  if (provider === 'auto') {
    const ready = (await detectAssets()).filter((p) => p.ready);
    if (ready.length !== 1) throw new Error(`Detected ${ready.length} ready asset providers; select --assets codex or --assets higgsfield explicitly`);
    provider = ready[0].provider;
  }
  const adapter = assetProviders[provider];
  if (!adapter) throw new Error(`Unknown asset provider: ${provider}; choose codex or higgsfield`);
  await adapter.detect();
  await run('magick', ['-version']); // Refuse before spending if optimization is unavailable.
  const imagePrompt = `Design context only: ${prompt}\nGenerate ONLY the requested visual subject (picture, illustration, icon, texture or background). The design context is NOT the image to draw: omit all screens, phones, device mockups, interfaces, buttons, headings, labels and text. One standalone visual asset, not a screenshot or asset sheet.`;
  const quote = await adapter.estimate({ prompt: imagePrompt });
  const preview = { provider, images: count, ...quote, amount: quote.amount === null ? null : quote.amount * count, approved: Boolean(values['allow-asset-spend']) };
  let calls = 0;
  return { preview, async generate(out) {
    if (!values['allow-asset-spend'] || process.env.CI || ++calls > count) throw new Error('Asset spend is not approved or the image budget is exhausted');
    const parent = dirname(resolve(out)); mkdirSync(parent, { recursive: true });
    const dir = mkdtempSync(join(parent, `${basename(out, extname(out))}.assets-`));
    const raw = await adapter.generate({ prompt: imagePrompt, dir });
    const file = join(dir, 'image.webp');
    await run('magick', [raw, '-auto-orient', '-strip', '-resize', '1024x1024>', '-quality', '80', file]);
    if (!statSync(file).size || statSync(file).size > 800_000) throw new Error('Optimized asset must be between 1 byte and 800 KB');
    const dataUrl = `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
    if (raw !== file) unlinkSync(raw);
    return [{ path: file.split('\\').join('/'), mime: 'image/webp', dataUrl }];
  } };
}
