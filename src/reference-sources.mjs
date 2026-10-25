// The sources list beside a brief: every reference the search found, with its URL, where it was found and a one-line written
// description; the pages whose own terms allow it are captured through the same permission-checked path as any reference, and a
// refusal keeps its link, description and reason so a human can open it. Nothing is scraped and nothing is drawn in its place.
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { captureReference, validPng } from './reference-capture.mjs';
import { referenceUrl } from './reference-network.mjs';
const SHOT = 3_000_000, FILE = 12_000_000, CAPTURE_LIMIT = 6, MAX = 24;

export const sourcesSidecar = (file) => `${file}.sources.json`;
const one = (v, n = 2000) => typeof v === 'string' && v.trim() && v.length <= n;

export function readSources(file) {
  const path = sourcesSidecar(file);
  if (!existsSync(path)) return null;
  if (statSync(path).size > FILE) throw new Error('the inspiration sources list exceeds 12 MB');
  const set = JSON.parse(readFileSync(path, 'utf8'));
  const url = (v) => { const u = new URL(v); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('invalid inspiration source URL'); };
  if (set.version !== 1 || !Number.isFinite(Date.parse(set.searched_at)) || !Array.isArray(set.sources) || set.sources.length > MAX || !Array.isArray(set.searches) || !Array.isArray(set.queries)) throw new Error('invalid inspiration sources list');
  for (const s of set.sources) {
    if (!one(s.name, 200) || !one(s.description) || !one(s.found_via, 40)) throw new Error('invalid inspiration source entry');
    if (s.url === null ? !one(s.package, 200) : !one(s.found_at)) throw new Error('invalid inspiration source entry');
    if (s.url !== null) url(s.url);
    if (!['captured', 'link-only'].includes(s.status) || !(s.why === undefined || one(s.why))) throw new Error('invalid inspiration source status');
    if (s.status === 'captured' ? !Array.isArray(s.shots) || !s.shots.length || s.shots.length > 2 : Array.isArray(s.shots) && s.shots.length) throw new Error('an inspiration source is captured with one or two screenshots, or link only');
    for (const shot of s.shots ?? []) {
      if (!Number.isInteger(shot.width) || shot.width < 200 || shot.width > 1600 || !Number.isInteger(shot.height) || shot.height < 200 || shot.height > 4000
        || typeof shot.dataUrl !== 'string' || shot.dataUrl.length > SHOT || !shot.dataUrl.startsWith('data:image/png;base64,') || !validPng(Buffer.from(shot.dataUrl.slice(22), 'base64'), shot.width, shot.height)) throw new Error('invalid inspiration screenshot');
    }
    if (s.status === 'captured' && s.url !== null && (!one(s.terms_url) || !one(s.licence_note) || !Number.isFinite(Date.parse(s.fetched_at)))) throw new Error('a captured page needs its terms link, note and capture time');
    if (s.status === 'captured' && s.url !== null) url(s.terms_url);
  }
  for (const s of set.searches) { if (!one(s.source, 40) || !one(s.url) || !['ok', 'refused'].includes(s.status) || !Number.isInteger(s.found) || s.found < 0 || (s.why !== undefined && !one(s.why))) throw new Error('invalid inspiration search entry'); url(s.url); }
  for (const q of set.queries) { if (!one(q.query, 200) || !one(q.url)) throw new Error('invalid inspiration query'); url(q.url); }
  return set;
}

export const writeSources = (file, set) => {
  if (set) writeFileSync(sourcesSidecar(file), `${JSON.stringify(set)}\n`);
  else try { unlinkSync(sourcesSidecar(file)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
};

// Candidates through the one existing capture path. A refusal is kept as a link with the description the search gave it.
export async function captureSources({ candidates, queries, searches, product_type, project = process.cwd(), agent, model, timeoutMs }) {
  const sources = [];
  let tokens_in = 0, tokens_out = 0;
  for (const [i, c] of candidates.entries()) {
    const base = { name: c.name, url: c.url, description: c.description, found_via: c.found_via, found_at: c.found_at };
    if (c.not_capturable) { sources.push({ ...base, status: 'link-only', why: `not captured: ${c.not_capturable}` }); continue; }
    if (i >= CAPTURE_LIMIT) { sources.push({ ...base, status: 'link-only', why: `not captured: this run captures at most ${CAPTURE_LIMIT} pages; open the link` }); continue; }
    try {
      const captured = await captureReference({ candidate: c, project, agent, model, timeoutMs });
      const { terms_url, licence_note, fetched_at, shots } = captured.metadata;
      tokens_in += captured.tokens_in; tokens_out += captured.tokens_out;
      sources.push({ ...base, status: 'captured', terms_url, licence_note, fetched_at, shots });
    } catch (e) { sources.push({ ...base, status: 'link-only', why: `not captured: ${e.message}` }); }
  }
  const set = { version: 1, searched_at: new Date().toISOString(), product_type, queries, searches, sources };
  if (Buffer.byteLength(JSON.stringify(set)) > FILE) throw new Error(`the captured inspiration exceeds the ${FILE / 1e6} MB budget; nothing was kept`);
  return { ...set, tokens_in, tokens_out };
}

// A mobile brief's competitor: real screens of a real app on an emulator, kept for internal reference only.
export const appEntry = ({ name, packageName, device, apk, shots }) => ({
  name, package: packageName, url: null, found_via: 'emulator', found_at: `adb -s ${device}`, description: `Installed${apk ? ` from ${apk}` : ''} on ${device} and captured its own screens`, status: 'captured', internal_reference_only: true, device, shots,
});
