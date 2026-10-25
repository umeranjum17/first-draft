// Providers own detect/estimate/generate; credentials stay with installed CLIs (Codex via BYOKit).
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { doctor, installedCodex } from './byokit.mjs';
const exec = promisify(execFile);
const run = async (bin, args, options = {}) => {
  try {
    const call = exec(bin, args, { signal: AbortSignal.timeout(600_000), maxBuffer: 8_000_000, ...options });
    call.child.stdin.end(); // Codex appends piped stdin even with an argv prompt; it must receive EOF.
    return (await call).stdout;
  }
  catch (e) {
    const detail = e.code === 'ENOENT' ? `${bin} is not installed` : e.stderr?.trim() || e.message;
    throw new Error(`${detail}${/No version is set for shim/.test(detail) ? '; run with mise exec node@26.1.0 -- first-draft-axi ...' : ''}`);
  }
};
const hf = (args) => run('higgsfield', [...args, '--json']);
const hfArgs = (prompt, aspectRatio = '1:1') => ['z_image', '--prompt', prompt, '--aspect_ratio', aspectRatio];
const ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4']; // the engine tool's own aspect ratios
export const IMAGES_PER_OPTION = 3; // the design agent decides how many; this bounds the spend the preview names (a flow's set grows with its screens)

// Adapter contract: detect() throws a setup hint; estimate() returns {amount,unit,detail} for one image;
// generate({prompt,aspectRatio,dir,sheet}) returns a local raster path; use tells the design agent what the provider is good at.
// styleReference says the provider draws from an attached picture: the first image of a set becomes the style sheet for the rest.
// No adapter may retry or change accounts.
export const assetProviders = {
  higgsfield: {
    model: 'z_image',
    use: 'Higgsfield Z Image: photorealistic pictures, product shots, people, places and hero photography.',
    async detect() { await hf(['account', 'status']); },
    async estimate() {
      const cost = JSON.parse(await hf(['generate', 'cost', ...hfArgs('one image')]));
      if (!Number.isFinite(cost.credits) || cost.credits < 0) throw new Error('Higgsfield returned no valid credit estimate');
      return { amount: cost.credits, unit: 'credits', detail: 'Z Image, one image, provider estimate' };
    },
    async generate({ prompt, aspectRatio, dir }) {
      const jobs = JSON.parse(await hf(['generate', 'create', ...hfArgs(prompt, aspectRatio), '--wait']));
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
    model: 'gpt-6-luna native image generation',
    styleReference: true,
    use: 'ChatGPT image generation through the signed-in Codex CLI: illustrations, icons, logos, painterly or flat artwork and precise compositions.',
    async detect() {
      const row = await doctor('codex', 'configured');
      if (row.status !== 'ok') throw new Error(`Codex needs its subscription login: codex login; ${row.detail}`);
    },
    async estimate() { return { amount: null, unit: 'subscription quota', detail: 'One image-generation request; Codex exposes no price estimate. Quota and any overage are account-dependent, not free.' }; },
    async generate({ prompt, aspectRatio, dir, sheet }) {
      const { bin, account } = await installedCodex();
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !account.unset.includes(k) && !/KEY|TOKEN|SECRET|^NODE_OPTIONS$/i.test(k)));
      Object.assign(env, account.set);
      const events = await run(bin, ['exec', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--sandbox', 'workspace-write', '--cd', dir, '--enable', 'image_generation', '--json',
        '--model', 'gpt-6-luna', '-c', 'model_reasoning_effort="low"', '-c', 'mcp_servers={}', '-c', 'features.shell_tool=false', '-c', 'features.unified_exec=false', '-c', 'features.apps=false', '-c', 'features.plugins=false',
        // A style sheet of the same character is attached as a native image input, so every scene of a set is drawn from the first.
        ...(sheet ? ['-i', sheet] : []),
        // The native tool keeps its image in Codex's own cache and cannot save elsewhere: asking it to save made the model call the tool a second time.
        `Call the native image generation tool exactly once, then stop. One raster image, aspect ratio ${aspectRatio}, lowest quality and smallest size available. The host collects the image from the tool itself: do not save, copy or rename it. No shell commands, no SVG, no external services, no API keys. If image generation is unavailable, say so and stop. Image brief: ${sheet ? `The attached image is this set's character style sheet: draw the same character in exactly the same drawing style, with the same line weight and palette, in the new pose and scene the brief describes. ` : ''}${prompt}`], { cwd: dir, env });
      writeFileSync(join(dir, 'codex-events.jsonl'), events);
      const thread = events.split('\n').filter(Boolean).map((line) => JSON.parse(line)).find((e) => e.type === 'thread.started')?.thread_id;
      // Only this native run's image folder: never follow model-suggested paths or read login files.
      if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(thread ?? '')) {
        const native = join(env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images', thread);
        const files = existsSync(native) ? readdirSync(native, { withFileTypes: true }).filter((e) => e.isFile() && /^exec-[0-9a-f-]{36}\.png$/i.test(e.name)).map((e) => join(native, e.name)) : [];
        // The newest image is the one the run ended with; the original stays in Codex's cache.
        if (files.length) { const file = join(dir, 'raw.png'); copyFileSync(files.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs).at(-1), file); return file; }
      }
      throw new Error('Codex produced no image; native image generation may be unavailable in codex exec');
    },
  },
};
export const assetFlags = { assets: { type: 'string' }, 'no-assets': { type: 'boolean' }, 'allow-asset-spend': { type: 'boolean' } };
export const assetHelp = `Assets (make only): --assets codex|higgsfield|codex,higgsfield|auto lets the design agent generate pictures with those providers where it decides they help, at most ${IMAGES_PER_OPTION} per option; alone it previews the per-image cost and exits without model calls. auto offers every ready provider. --allow-asset-spend explicitly approves that previewed asset spend (Codex quota/overage unknown); --no-assets disables assets (default). Needs ImageMagick. \`assets\` lists detected providers without spending. Never runs paid asset calls in CI.`;
export async function detectAssets() {
  return Promise.all(Object.entries(assetProviders).map(async ([provider, adapter]) => {
    try { await adapter.detect(); return { provider, ready: true }; } catch (e) { return { provider, ready: false, cause: e.message }; }
  }));
}
// The approved providers and a generate(request, out) the design agent's generate_image_asset tool calls; null without --assets.
// perOption bounds this option's images: a flow needs one style sheet and one picture per screen.
export async function prepareAssets(values, count, perOption = IMAGES_PER_OPTION) {
  if (values['no-assets'] && (values.assets || values['allow-asset-spend'])) throw new Error('--no-assets conflicts with asset generation flags');
  if (!values.assets) {
    if (values['allow-asset-spend']) throw new Error('--allow-asset-spend requires --assets <provider>');
    return null;
  }
  if (process.env.CI && values['allow-asset-spend']) throw new Error('Paid asset generation is disabled in CI');
  let providers = [...new Set(values.assets.split(',').map((p) => p.trim()))];
  if (providers.includes('auto')) {
    if (providers.length > 1) throw new Error('--assets auto cannot be combined with named providers');
    providers = (await detectAssets()).filter((p) => p.ready).map((p) => p.provider);
    if (!providers.length) throw new Error('No asset provider is ready; run first-draft-axi assets for the setup each one needs');
  }
  for (const provider of providers) {
    if (!assetProviders[provider]) throw new Error(`Unknown asset provider: ${provider}; choose codex, higgsfield or codex,higgsfield`);
    await assetProviders[provider].detect();
  }
  await run('magick', ['-version']); // Refuse before spending if optimization is unavailable.
  const limit = Math.max(IMAGES_PER_OPTION, Math.min(13, perOption));
  const max = limit * count;
  const quotes = await Promise.all(providers.map(async (provider) => ({ provider, ...await assetProviders[provider].estimate() })));
  const preview = { providers: quotes, max_images: max, per_option: limit, approved: Boolean(values['allow-asset-spend']) };
  const spent = new Map(), sheets = new Map(); // images per option output, and the style sheet the rest of that option's set is drawn from
  return { preview, providers: providers.map((provider) => ({ provider, use: assetProviders[provider].use, style_reference: Boolean(assetProviders[provider].styleReference) })), perOption: limit, async generate({ provider, prompt, aspectRatio = '1:1', name }, out) {
    const calls = (spent.get(out) ?? 0) + 1;
    if (!values['allow-asset-spend'] || process.env.CI || calls > limit) throw new Error(`Asset spend is not approved or this option's ${limit}-image budget is spent`);
    if (!providers.includes(provider)) throw new Error(`provider must be one of: ${providers.join(', ')}`);
    if (!ASPECTS.includes(aspectRatio)) throw new Error(`aspectRatio must be one of: ${ASPECTS.join(', ')}`);
    spent.set(out, calls);
    const parent = dirname(resolve(out)); mkdirSync(parent, { recursive: true });
    const dir = mkdtempSync(join(parent, `${basename(out, extname(out))}.assets-`));
    const adapter = assetProviders[provider], sheet = sheets.get(out);
    const chained = Boolean(sheet && sheet.provider === provider && adapter.styleReference);
    // The first picture of a set is its style sheet: every later one of the same provider is drawn from it, never from a fresh idea.
    const drawn = await adapter.generate({ prompt, aspectRatio, dir, ...(chained && { sheet: sheet.file }) });
    if (!sheet && adapter.styleReference) sheets.set(out, { provider, file: drawn, prompt });
    const isSheet = drawn === sheets.get(out)?.file;
    const file = join(dir, 'image.webp');
    await run('magick', [drawn, '-auto-orient', '-strip', '-resize', '1024x1024>', '-quality', '80', file]);
    if (!statSync(file).size || statSync(file).size > 800_000) throw new Error('Optimized asset must be between 1 byte and 800 KB');
    if (drawn !== file && !isSheet) unlinkSync(drawn); // the sheet stays on disk: the rest of the set is drawn from it
    const slug = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
    return { path: `assets/${slug}-${calls}.webp`, file, provider, model: assetProviders[provider].model, mime: 'image/webp', dataUrl: `data:image/webp;base64,${readFileSync(file).toString('base64')}`, ...(isSheet && { sheet: true }), ...(chained && { style_sheet: true }) };
  } };
}
