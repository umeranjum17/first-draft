// A retained-screen comparison; acquisition stays in the existing permission-checked pipeline.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { references } from './references.mjs';
import { ReferenceNetwork } from './reference-network.mjs';
import { searchReferences } from './reference-search.mjs';
import { captureSources } from './reference-sources.mjs';
import { judgeBenchmark, resolveJudge } from './judge.mjs';
import { resolveEngine } from './byokit.mjs';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = (s) => typeof s === 'string' && s.trim() && s.length <= 2000;

export async function benchmark({ product, screen, input, width = 390, theme = 'light', project, out, discovery = true, judge = true, c = {} }) {
  if (!text(product) || !text(screen) || ![390, 1280].includes(width) || !['light', 'dark'].includes(theme) || !out) throw new Error('benchmark needs --product, --screen, --out, --width 390|1280 and --theme light|dark');
  if ((!discovery || !judge) && process.env.FIRST_DRAFT_TEST_BENCHMARK !== '1') throw new Error('--no-discovery and --no-judge are test-only plumbing; FIRST_DRAFT_TEST_BENCHMARK=1 is required, never for user results');
  c = await resolveEngine(c);
  if (judge) c.review = await resolveJudge(c, c.judge);
  const rows = [];
  if (input) {
    if (statSync(input).size > 100_000) throw new Error('Benchmark input exceeds 100 KB');
    const entries = JSON.parse(readFileSync(input, 'utf8'));
    if (!Array.isArray(entries) || entries.length > 12) throw new Error('Benchmark input must be an array of at most twelve captures');
    for (const e of entries) {
      if (!['reference', 'current', 'candidate', 'counterexample'].includes(e.role) || !text(e.name) || !text(e.file) || !text(e.source) || !text(e.permission)
        || !['light', 'dark'].includes(e.theme) || (e.role !== 'counterexample' && e.theme !== theme) || !(e.captured_at === null || typeof e.captured_at === 'string' && Number.isFinite(Date.parse(e.captured_at)))) throw new Error('Each capture needs role, name, file, source, permission, captured_at (ISO date or null if unknown) and matching theme (except negative examples)');
    }
    let bytes = 0;
    for (const { file, ...e } of entries) {
      const [image] = await references([resolve(dirname(resolve(input)), file)]);
      if ((bytes += Buffer.from(image.dataUrl.slice(22), 'base64').length) > 10_000_000) throw new Error('Benchmark local captures exceed 10 MB after normalization');
      rows.push({ ...e, image });
    }
  }
  const targets = rows.filter((r) => ['current', 'candidate'].includes(r.role));
  if (judge && !targets.length) throw new Error('Benchmark needs at least one current or candidate capture to judge');
  let found = { searches: [], sources: [] };
  if (discovery) {
    const network = new ReferenceNetwork({ requests: 14, bytes: 4_000_000, queries: true });
    let searched;
    try { searched = await searchReferences({ product_type: `${product}: ${screen}`, queries: [`${product} ${screen} official app screenshots -generator -mockup -stock`, `${product} ${screen} press kit app store -generator -mockup`], network }); }
    finally { network.close(); }
    searched.candidates = searched.candidates.map((s) => {
      // ponytail: reject explicitly synthetic listings only; reference suitability still requires the pixel judge.
      const synthetic = /(?:screenshot|mockup).{0,40}generator|stock (?:photos?|images?)|shutterstock/i.test(`${s.name} ${s.description}`);
      return { ...s, ...((synthetic || theme !== 'light') && { not_capturable: synthetic ? 'Synthetic screenshot generator or stock gallery, not a real app screen' : 'Benchmark public capture supports light only; not relabelled as dark' }) };
    });
    found = await captureSources({ ...searched, project, ...c });
    for (const s of found.sources.filter((s) => s.status === 'captured')) {
      const shot = s.shots.find((s) => s.width === width);
      rows.push({ role: 'reference', name: s.name, source: s.url, permission: s.licence_note, captured_at: s.fetched_at, theme, image: { mime: 'image/png', dataUrl: shot.dataUrl } });
    }
  }
  rows.forEach((r, i) => { r.id = `capture-${i + 1}`; r.image.id = r.id; const png = Buffer.from(r.image.dataUrl.slice(22), 'base64'); r.native_width = png.readUInt32BE(16); r.native_height = png.readUInt32BE(20); });
  const report = { version: 1, product, screen, width, theme, checked_at: new Date().toISOString(), captures: rows, discovery: found, engine: { agent: c.agent, model: c.model }, scores: [], judge: 'test-only unscored plumbing; not a user result' };
  const save = () => { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(`${out}.json`, JSON.stringify(report, null, 2)); writeFileSync(out, benchmarkSheet(report)); };
  if (judge) {
    for (const target of targets) report.scores.push({ id: target.id, ...await judgeBenchmark({ c, product, screen, target, rows }) });
    report.judge = `independent: ${[...new Set(report.scores.map(s => `${s.agent} / ${s.model}`))].join(', ')}; reference-based model assessment; not a fidelity certification`;
  }
  save(); // Publish only a complete assessment; a failed run cannot replace a previous good result.
  return { sheet: resolve(out), report: resolve(`${out}.json`), captures: rows.length, references: rows.filter((r) => r.role === 'reference').length, engine: report.engine, scores: report.scores, judge: report.judge, refused: [...found.searches.filter((s) => s.status === 'refused'), ...found.sources.filter((s) => s.status !== 'captured')] };
}

export function benchmarkSheet(r) {
  const prose = (s) => esc(String(s).replace(/\bcapture-(\d+)\b/gi, 'Image $1'));
  const capture = (c) => `<article><h2>${esc(c.role)} · ${esc(c.name)}</h2><p>Image ${esc(c.id.split('-').at(-1))} · ${c.native_width}×${c.native_height} original · displayed ${r.width}px · ${esc(c.theme)}</p><img width="${r.width}" src="${c.image.dataUrl}" alt="${esc(c.name)}"><p>Source: ${esc(c.source)}</p><p>Permission: ${esc(c.permission)}</p><p>Captured: ${esc(c.captured_at ?? 'unknown (owner supplied)')}</p></article>`;
  const scores = r.scores.map((s) => `<section><h2>${esc(r.captures.find((c) => c.id === s.id).name)} — reference-based scores</h2><table><thead><tr><th>Axis</th><th>1–10</th><th>Reference evidence</th><th>Target comparison</th></tr></thead><tbody>${s.axes.map((a) => `<tr><th>${esc(a.axis.replaceAll('_', ' '))}</th><td>${a.score ?? 'not comparable'}</td><td>${esc(a.references.map((id) => r.captures.find((c) => c.id === id)?.name).join(', '))}: ${prose(a.observed)}</td><td>${prose(a.comparison)}</td></tr>`).join('')}</tbody></table></section>`).join('');
  const refused = [...r.discovery.searches.filter((s) => s.status === 'refused'), ...r.discovery.sources.filter((s) => s.status !== 'captured')];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Screen benchmark</title><style>:root{color-scheme:${r.theme};font:16px/1.5 system-ui}body{margin:24px}h1{font-size:26px}h2{font-size:18px}p{overflow-wrap:anywhere}.captures{display:flex;gap:24px;overflow-x:auto;align-items:start;margin-inline:-24px}article{flex:0 0 ${r.width}px}img{display:block;height:auto}section{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:720px;table-layout:fixed}th,td{text-align:left;vertical-align:top;padding:10px;border:1px solid #888;overflow-wrap:anywhere}th:first-child{width:14%}th:nth-child(2){width:10%}</style><h1>${esc(r.product)} · ${esc(r.screen)}</h1><p>${r.width}px · ${esc(r.theme)} · Scoring: ${esc(r.judge)}. Supplied captures are scaled, never recoloured. Scroll horizontally to compare.</p><div class="captures">${r.captures.map(capture).join('')}</div>${scores}<h2>Not captured</h2><ul>${refused.map((s) => `<li>${esc(s.name ?? s.source)} · ${esc(s.url)} — ${esc(s.why)}</li>`).join('')}</ul></html>`;
}
