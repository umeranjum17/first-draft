// Explicit test-only loader. Not shipped in the npm package; the normal CLI has no provider fixture switches.
import { registerHooks } from 'node:module';
import { accessSync, constants, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(import.meta.url);
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS?.includes(here) ? '' : `--import=${here}`, process.env.NODE_OPTIONS ?? ''].filter(Boolean).join(' ');
// Supply a second native-protocol engine only in isolated fixture homes. Existing explicit native fixtures take priority.
const home = process.env.FIRST_DRAFT_HOME;
if (home && (process.env.FIRST_DRAFT_TEST_BYOKIT_BASE || process.env.FIRST_DRAFT_TEST_REF_ORIGIN)) {
  const ownedRoot = process.env.HOME || home;
  const own = (process.env.PATH ?? '').split(delimiter).filter(p => p === ownedRoot || p.startsWith(ownedRoot + '/')).some(p => { try { accessSync(join(p, 'codex'), constants.X_OK); return true; } catch { return false; } });
  try {
    const config = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8'));
    if (['byokit:codex', 'byokit:openai:key'].includes(config.agent)) {
      const hasClaude = (process.env.PATH ?? '').split(delimiter).filter(p => p === ownedRoot || p.startsWith(ownedRoot + '/')).some(p => { try { accessSync(join(p, 'claude'), constants.X_OK); return true; } catch { return false; } });
      if (!hasClaude) {
        const bin = join(home, 'fixture-judge-bin'); mkdirSync(bin, { recursive: true });
        writeFileSync(join(bin, 'claude'), `#!${process.execPath}\nimport ${JSON.stringify(new URL('./claude-judge.mjs', import.meta.url).href)};\n`, { mode: 0o700 });
        process.env.PATH = bin + delimiter + (process.env.PATH ?? '');
      }
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!own) {
    const bin = join(home, 'fixture-bin'); mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'codex'), `#!${process.execPath}\nimport ${JSON.stringify(new URL('./judge-bridge.mjs',import.meta.url).href)};\n`, { mode: 0o700 });
    process.env.PATH = bin + delimiter + (process.env.PATH ?? '');
  }
}
registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  if (!url.includes('/src/')) return loaded;
  let source = String(loaded.source);
  if (url.endsWith('/src/byokit.mjs') && process.env.FIRST_DRAFT_TEST_BYOKIT_BASE) source = source.replace('model: found,', 'model: { ...found, baseUrl: process.env.FIRST_DRAFT_TEST_BYOKIT_BASE },');
  if (url.endsWith('/src/reference-network.mjs') && process.env.FIRST_DRAFT_TEST_REF_ORIGIN) {
    source = "import { request as httpRequest } from 'node:http';\n" + "const fixtureOrigin = () => {\n  const value = process.env.FIRST_DRAFT_TEST_REF_ORIGIN;\n  if (!value) return null;\n  const u = new URL(value);\n  if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port || u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw new Error('FIRST_DRAFT_TEST_REF_ORIGIN must name one exact loopback HTTP fixture origin');\n  return u.origin;\n};\n" + source;
    source = source.replace("u.protocol !== 'https:'", "(u.protocol !== 'https:' && u.origin !== fixtureOrigin())")
      .replace("(u.port && u.port !== '443')", "(u.port && u.port !== '443' && u.origin !== fixtureOrigin())")
      .replace('const u = referenceUrl(url, this.queries);', 'const u = referenceUrl(url, this.queries), fixture = u.origin === fixtureOrigin();')
      .replace('const addresses = isIP', "const addresses = fixture ? [{ address: '127.0.0.1', family: 4 }] : isIP")
      .replace('addresses.some(a => !publicIP(a.address))', '(!fixture && addresses.some(a => !publicIP(a.address)))')
      .replace('httpsRequest(u,', '(fixture ? httpRequest : httpsRequest)(u,');
  }
  if (url.endsWith('/src/reference-search.mjs') && process.env.FIRST_DRAFT_TEST_REF_ORIGIN) source = source.replace(/const bases = [\s\S]*?(?=\nconst text =)/, "// One seam for tests and offline runs: an exact loopback fixture origin serves the same three shapes.\nconst bases = () => {\n  const f = process.env.FIRST_DRAFT_TEST_REF_ORIGIN;\n  if (!f) return {\n    web: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,\n    hn: (q) => `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=15`,\n    reddit: (sub, q) => `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&t=year&limit=10`,\n  };\n  const o = new URL(f).origin;\n  return { web: (q) => `${o}/web?q=${encodeURIComponent(q)}`, hn: (q) => `${o}/hn?query=${encodeURIComponent(q)}`, reddit: (sub, q) => `${o}/reddit/${sub}?q=${encodeURIComponent(q)}` };\n};\n");
  return { ...loaded, source };
} });
