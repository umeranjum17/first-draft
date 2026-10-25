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
// The hero loop: one short silent video made from the still the design put in its hero. Seedance 2.0 Mini at 5s is 2.5 credits at
// 480p and 5 at 720p, the cheapest estimate of the models that take a start image; a start and an end image that are the same still
// is what makes the loop return to its first frame instead of cutting.
const VIDEO = { model: 'seedance_2_0_mini', duration: 5, resolution: '720p', aspectRatio: '16:9', perOption: 1, maxBytes: 1_200_000 };
const videoPrompt = (prompt) => `A seamless looping hero shot of: ${String(prompt).split('\n')[0].trim().replace(/[.\s]+$/, '')}. Gentle continuous motion that starts and ends on exactly this still, so the loop has no visible cut: camera and subject return to the opening frame. No new objects, no text, no scene change.`;
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
        '--', // End variadic image arguments before the positional prompt.
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
export const assetHelp = `Assets (make only): --assets codex|higgsfield|codex,higgsfield|auto lets the design agent generate pictures with those providers where it decides they help, at most ${IMAGES_PER_OPTION} per option, and with higgsfield one short looping hero video made from its hero image at most per option; alone it previews the per-image and per-video cost and exits without model calls. auto offers every ready provider. --allow-asset-spend explicitly approves that previewed asset spend (Codex quota/overage unknown); --no-assets disables assets (default). Needs ImageMagick, and FFmpeg for the hero loop. \`assets\` lists detected providers without spending. Never runs paid asset calls in CI.`;
// The video estimate needs no image: Higgsfield prices it per second and resolution. No job, no upload, no credits.
const videoEstimate = async () => {
  const cost = JSON.parse(await hf(['generate', 'cost', VIDEO.model, '--prompt', 'a seamless looping hero shot', '--aspect_ratio', VIDEO.aspectRatio, '--duration', String(VIDEO.duration), '--resolution', VIDEO.resolution]));
  if (!Number.isFinite(cost.credits) || cost.credits < 0) throw new Error('Higgsfield returned no valid video credit estimate');
  return { amount: cost.credits, unit: 'credits', detail: `Seedance 2.0 Mini, one ${VIDEO.duration}s ${VIDEO.resolution} muted loop from the hero image, provider estimate` };
};
export async function detectAssets() {
  return Promise.all(Object.entries(assetProviders).map(async ([provider, adapter]) => {
    try { await adapter.detect(); return { provider, ready: true }; } catch (e) { return { provider, ready: false, cause: e.message }; }
  }));
}
// The approved providers and a generate(request, out) the design agent's generate_image_asset tool calls; null without --assets.
// perOption bounds this option's images: a flow needs one style sheet and one picture per screen.
export async function prepareAssets(values, count, perOption) {
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
  const limit = Math.max(IMAGES_PER_OPTION, Math.min(13, perOption ?? IMAGES_PER_OPTION));
  const max = limit * count;
  const quotes = await Promise.all(providers.map(async (provider) => ({ provider, ...await assetProviders[provider].estimate() })));
  const video = providers.includes('higgsfield'); // only Higgsfield makes video here
  const preview = { providers: quotes, max_images: max, per_option: limit, ...(video && { video: await videoEstimate(), max_videos: VIDEO.perOption * count }), approved: Boolean(values['allow-asset-spend']) };
  const spent = new Map(), sheets = new Map(), loops = new Map(); // images per option output, the style sheet its set is drawn from, and hero loops
  return { preview, providers: providers.map((provider) => ({ provider, use: assetProviders[provider].use, style_reference: Boolean(assetProviders[provider].styleReference) })), perOption: limit,
    ...(video && { async video({ image, prompt }) {
      if (!values['allow-asset-spend'] || process.env.CI) throw new Error('Asset spend is not approved: the hero video needs --allow-asset-spend');
      if ((loops.get(image.file) ?? 0) >= VIDEO.perOption) throw new Error(`This option's ${VIDEO.perOption}-video budget is spent`);
      await run('ffmpeg', ['-version']); // refuse before the paid call when the loop cannot be encoded
      const dir = dirname(image.file), raw = join(dir, 'provider-result.mp4');
      const cost = await videoEstimate();
      loops.set(image.file, (loops.get(image.file) ?? 0) + 1);
      const jobs = JSON.parse(await hf(['generate', 'create', VIDEO.model, '--prompt', videoPrompt(prompt), '--aspect_ratio', VIDEO.aspectRatio, '--duration', String(VIDEO.duration), '--resolution', VIDEO.resolution, '--start-image', image.file, '--end-image', image.file, '--wait']));
      writeFileSync(join(dir, 'provider-result-video.json'), JSON.stringify(jobs));
      const url = jobs[0]?.result_url;
      if (!url || new URL(url).protocol !== 'https:') throw new Error('Higgsfield returned no HTTPS video result');
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`Higgsfield video download: HTTP ${response.status}`);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > 80_000_000) throw new Error('Generated video exceeds 80 MB'); chunks.push(chunk); }
      writeFileSync(raw, Buffer.concat(chunks));
      const loop = join(dir, 'hero-loop.mp4');
      // Sized for the page: a short silent mp4 at most 1280 wide, small enough that the page stays under the 5 MB mock limit.
      for (const crf of [30, 34]) {
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-an', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', loop]);
        if (statSync(loop).size <= VIDEO.maxBytes) break;
      }
      if (!statSync(loop).size) throw new Error('The hero loop is empty');
      unlinkSync(raw);
      const slug = basename(image.path).replace(/\.\w+$/, '').replace(/-\d+$/, '') || 'hero'; // the still's own name: shop-photo-2.webp is shop-photo-loop.mp4
      return { provider: 'higgsfield', model: VIDEO.model, prompt: videoPrompt(prompt), path: `assets/${slug}-loop.mp4`, file: loop, credits: cost.amount, seconds: VIDEO.duration, dataUrl: `data:video/mp4;base64,${readFileSync(loop).toString('base64')}` };
    } }),
    async generate({ provider, prompt, aspectRatio = '1:1', name }, out) {
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
    const drawn = await adapter.generate({ prompt: chained ? `${sheet.prompt}\n\nNew scene: ${prompt}` : prompt, aspectRatio, dir, ...(chained && { sheet: sheet.file }) });
    if (perOption !== undefined && !sheet && adapter.styleReference) sheets.set(out, { provider, file: drawn, prompt });
    const isSheet = drawn === sheets.get(out)?.file;
    const file = join(dir, 'image.webp');
    await run('magick', [drawn, '-auto-orient', '-strip', '-resize', '1024x1024>', '-quality', '80', file]);
    if (!statSync(file).size || statSync(file).size > 800_000) throw new Error('Optimized asset must be between 1 byte and 800 KB');
    if (drawn !== file && !isSheet) unlinkSync(drawn); // the sheet stays on disk: the rest of the set is drawn from it
    const slug = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
    return { path: `assets/${slug}-${calls}.webp`, file, provider, model: assetProviders[provider].model, mime: 'image/webp', dataUrl: `data:image/webp;base64,${readFileSync(file).toString('base64')}`, ...(isSheet && { sheet: true }), ...(chained && { style_sheet: true }) };
  } };
}

const HERO = /<section\b[^>]*data-section=["']hero["'][^>]*>/i;
const attribute = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')) ?? []).slice(1).find((v) => v !== undefined) ?? '';
// The matching </section> of the hero, counting nesting so a section inside the hero does not end it early.
const endOfSection = (html, start) => {
  const tags = /<(\/?)section\b[^>]*>/gi; tags.lastIndex = start;
  for (let depth = 1, m; (m = tags.exec(html));) { depth += m[1] ? -1 : 1; if (!depth) return m.index; }
  return -1;
};
const LOOP_CSS = '<style data-hero-loop-css>[data-hero-loop-still]{display:none}@media (prefers-reduced-motion:reduce){video[data-hero-loop]{display:none}[data-hero-loop-still]{display:block}}</style>';

// The hero loop: the generated still the design placed in its hero becomes the page's hero video. The host injects it, so the design agent
// never handles video files, and the still stays in the markup as the poster and as what a reader with reduced motion sees.
export async function heroLoop(html, images, assets) {
  const open = html.match(HERO);
  if (!open || !images.length || !assets?.video) return { html, videos: [] };
  const start = open.index, end = endOfSection(html, start + open[0].length);
  if (end < 0) return { html, videos: [] };
  const inside = html.slice(start, end);
  for (const still of inside.matchAll(/<img\b[^>]*>/gi)) {
    const tag = still[0], src = attribute(tag, 'src');
    // Only a bare generated still: a <picture> or a figure slot has its own layout and is left alone.
    const image = images.find((i) => i.dataUrl === src);
    if (!image || inside.slice(0, still.index).lastIndexOf('<picture') > inside.slice(0, still.index).lastIndexOf('</picture')) continue;
    const loop = await assets.video({ image, prompt: image.prompt });
    const style = attribute(tag, 'style'), klass = attribute(tag, 'class'), alt = attribute(tag, 'alt').replace(/"/g, '&quot;');
    const keep = (display) => `${klass ? ` class="${klass}"` : ''} style="${display}width:100%;height:auto;${style}"`;
    // The still's display comes from LOOP_CSS alone: an inline display would outrank the reduced-motion rule and show both.
    const video = `<span data-hero-loop-wrap${klass ? ` class="${klass}"` : ''} style="display:block;${style}">`
      + `<video data-hero-loop autoplay muted loop playsinline poster="${image.dataUrl}" aria-label="${alt}"${keep('display:block;')}>`
      + `<source src="${loop.dataUrl}" type="video/mp4">${alt}</video>`
      + `<img data-hero-loop-still${klass ? ` class="${klass}"` : ''} src="${image.dataUrl}" alt="${alt}"${keep('')}></span>${LOOP_CSS}`;
    const { dataUrl, ...reported } = loop;
    return { html: html.slice(0, start + still.index) + video + html.slice(start + still.index + tag.length), videos: [{ ...reported, still: image.path }] };
  }
  return { html, videos: [] };
}
