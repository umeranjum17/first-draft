// Anonymous, bounded public GETs. The browser never makes its own network requests.
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { BlockList, isIP } from 'node:net';

export const REFERENCE_UA = 'FirstDraftReference/1.0 (+https://github.com/umeranjum17/first-draft; anonymous design reference capture)';
const denied = new BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) denied.addSubnet(ip, bits, 'ipv4');
for (const [ip, bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]]) denied.addSubnet(ip, bits, 'ipv6');
const publicIP = (ip) => isIP(ip) === 4 ? !denied.check(ip, 'ipv4') : isIP(ip) === 6 && /^[23][0-9a-f]{3}:/i.test(ip) && !denied.check(ip, 'ipv6');
const fixtureOrigin = () => {
  const value = process.env.FIRST_DRAFT_TEST_REF_ORIGIN;
  if (!value) return null;
  const u = new URL(value);
  if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port || u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw new Error('FIRST_DRAFT_TEST_REF_ORIGIN must name one exact loopback HTTP fixture origin');
  return u.origin;
};
export function referenceUrl(value) {
  const u = new URL(value);
  if ((u.protocol !== 'https:' && u.origin !== fixtureOrigin()) || u.username || u.password || u.search || (u.port && u.port !== '443' && u.origin !== fixtureOrigin())) throw new Error('Reference candidates need a public HTTPS URL without credentials, query strings or a custom port');
  u.hash = '';
  return u;
}

// Fail closed on malformed robots. Most-specific matching agent group and longest path win.
function robotsAllows(text, url) {
  const groups = []; let group = null, rulesStarted = false;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/); if (!m) throw new Error('Malformed robots.txt; capture refused');
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (!group || rulesStarted) { group = { agents: [], rules: [], delay: 0 }; groups.push(group); rulesStarted = false; }
      if (!value) throw new Error('Malformed robots user-agent');
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow', 'crawl-delay'].includes(key)) {
      rulesStarted = true;
      if (key === 'crawl-delay') { if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Unclear robots crawl-delay'); group.delay = Number(value) * 1000; }
      else if (value) group.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const score = (g) => Math.max(-1, ...g.agents.map(a => a === '*' ? 0 : REFERENCE_UA.toLowerCase().split(' ')[0].includes(a) ? a.length : -1));
  const best = Math.max(-1, ...groups.map(score)), selected = groups.filter(g => score(g) === best && best >= 0);
  // Compare percent-encoded UTF-8 path/query without decoding reserved slashes.
  const normalize = (s) => encodeURI(s).replace(/%25([a-f\d]{2})/gi, '%$1').replace(/%([a-f\d]{2})/gi, (v, n) => /^[A-Za-z\d._~-]$/.test(String.fromCharCode(parseInt(n,16))) ? String.fromCharCode(parseInt(n,16)) : v.toUpperCase());
  const path = normalize(url.pathname + url.search);
  const matches = selected.flatMap(g => g.rules).filter(r => {
    const p = normalize(r.path), end = p.endsWith('$');
    const pattern = (end ? p.slice(0,-1) : p).split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${pattern}${end ? '$' : ''}`).test(path);
  }).sort((a,b) => normalize(b.path).replace(/[*$]/g,'').length - normalize(a.path).replace(/[*$]/g,'').length || Number(b.allow) - Number(a.allow));
  if (matches[0] && !matches[0].allow) throw new Error(`robots.txt disallows ${url.pathname}`);
  return Math.max(750, ...selected.map(g => g.delay));
}

export class ReferenceNetwork {
  constructor() { this.count = 0; this.bytes = 0; this.robots = new Map(); this.last = new Map(); this.queue = Promise.resolve(); this.abort = new AbortController(); this.sources = []; }
  close() { this.abort.abort(); }
  async raw(url, limit) {
    this.abort.signal.throwIfAborted();
    if (++this.count > 32) throw new Error('Reference request cap exceeded (32)');
    const u = referenceUrl(url), fixture = u.origin === fixtureOrigin();
    const addresses = fixture ? [{ address: '127.0.0.1', family: 4 }] : isIP(u.hostname.replace(/^\[|\]$/g,'')) ? [{ address: u.hostname.replace(/^\[|\]$/g,''), family: isIP(u.hostname.replace(/^\[|\]$/g,'')) }] : await lookup(u.hostname, { all: true });
    if (!addresses.length || (!fixture && addresses.some(a => !publicIP(a.address)))) throw new Error(`Reference host is not entirely public: ${u.hostname}`);
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(10_000)]);
    return await new Promise((ok, no) => {
      const pinned = addresses[0];
      const req = (fixture ? httpRequest : httpsRequest)(u, { signal, method: 'GET', agent: false, headers: { 'user-agent': REFERENCE_UA, accept: '*/*', 'accept-encoding': 'identity' }, lookup: (_host, options, cb) => cb(null, options.all ? [pinned] : pinned.address, pinned.family) }, res => {
        let size = 0; const chunks = [];
        res.on('data', chunk => { size += chunk.length; this.bytes += chunk.length; if (size > limit || this.bytes > 8_000_000) res.destroy(new Error('Reference byte cap exceeded (2 MB per resource, 8 MB total)')); else chunks.push(chunk); });
        res.on('error', no);
        res.on('end', () => ok({ url: u.href, status: res.statusCode, type: String(res.headers['content-type'] ?? ''), location: res.headers.location, data: Buffer.concat(chunks), headers: res.headers }));
      });
      req.on('error', no); req.end();
    });
  }
  async allowed(url) {
    const u = referenceUrl(url);
    if (!this.robots.has(u.origin)) this.robots.set(u.origin, (async () => {
      const r = await this.raw(`${u.origin}/robots.txt`, 64_000);
      if (r.status === 404) return '';
      if (r.status !== 200 || !/^text\//i.test(r.type)) throw new Error(`Cannot establish robots policy for ${u.origin}: HTTP ${r.status}`);
      return r.data.toString('utf8');
    })());
    const delay = robotsAllows(await this.robots.get(u.origin), u);
    if (delay > 10_000) throw new Error('robots crawl-delay exceeds the reference timeout; capture refused');
    const remaining = delay - (Date.now() - (this.last.get(u.origin) ?? 0));
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
    this.last.set(u.origin, Date.now());
  }
  get(url, redirects = 0) {
    const run = this.queue.then(async () => { await this.allowed(url); return this.raw(url, 2_000_000); });
    this.queue = run.catch(() => {});
    return run.then(async r => {
      if ([301,302,303,307,308].includes(r.status)) {
        if (redirects >= 3 || !r.location) throw new Error('Reference redirect limit exceeded');
        const target=referenceUrl(new URL(r.location,r.url).href);
        if(target.origin !== new URL(r.url).origin) throw new Error('Reference redirect left the source site; capture refused');
        return this.get(target.href, redirects + 1);
      }
      if (r.status !== 200 || r.headers['www-authenticate']) throw new Error(`Public reference refused: HTTP ${r.status} at ${r.url}`);
      if (r.headers['content-encoding'] && r.headers['content-encoding'] !== 'identity') throw new Error('Compressed reference response refused; byte budget cannot be verified');
      this.sources.push({ url: r.url, fetched_at: new Date().toISOString(), bytes: r.data.length });
      return r;
    });
  }
}
