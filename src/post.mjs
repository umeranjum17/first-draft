// Post a design to a sign-off board: copy the options into the board's mocks folder and `sign-off-axi post` the design card, with each
// option's Play route in the running view (started here when it is not up) as that option's --link (sign-off-axi 0.5.0+, a tappable
// Open under its mock) and, as the fallback, in the --tradeoff text: the card's iframe sandbox blocks a link inside the mock.
import { execFile, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { viewHost } from './view.mjs';
import { readOptionReferences, writeOptionReferences } from './reference-capture.mjs';

const CLI = new URL('./cli.mjs', import.meta.url).pathname;
const LETTERS = 'abcdef'; // sign-off's design card shows up to 6 options
export class PostError extends Error {
  constructor(code, message, help = []) { super(message); this.code = code; this.help = help; }
}

// The design the running view serves, read from its own page, so a view on this port for another design is not mistaken for ours.
const served = async (url) => {
  try {
    const page = await (await fetch(url, { signal: AbortSignal.timeout(3000) })).text();
    return JSON.parse(page.match(/<script type="application\/json" id="design">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
  } catch { return null; }
};

// Reuse the view on this host and port when it serves this design; otherwise start one that outlives this command.
async function ensureView({ files, host, port }) {
  const base = `http://${host.includes(':') ? `[${host}]` : host}:${port}/`;
  const labels = files.map((f) => basename(f, extname(f)));
  const up = await served(base);
  if (up) {
    if (JSON.stringify(up.options.map((o) => o.label)) === JSON.stringify(labels)) return { url: base, started: false };
    throw new PostError('PORT_IN_USE', `${base} already serves "${up.name}", not these options`, ['Stop that `first-draft-axi view`, or pass --port <port> for this design']);
  }
  const child = spawn(process.execPath, [CLI, 'view', ...files, '--host', host, '--port', String(port)], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const first = await new Promise((ok) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; if (out.includes('\n')) ok(out); });
    child.on('close', () => ok(out));
  });
  child.stdout.destroy();
  child.unref();
  let r;
  try { r = JSON.parse(first); } catch { throw new PostError('VIEW_FAILED', 'the view did not start', [`Run \`first-draft-axi view ${files[0]} --port ${port}\` to see why`]); }
  if (r.error) throw new PostError('VIEW_FAILED', r.error.message, r.help);
  return { url: r.viewing.url, started: true, pid: child.pid };
}

// evidence: file the options as an Evidence card (title, note with each Play url, --media), which asks no pick: journeys, tests and demos.
export async function post({ files, name, title, labels = [], tradeoff, key, recommend, evidence, media = [], board, host: hostFlag, port }) {
  if (files.length > LETTERS.length) throw new PostError('USAGE', `a sign-off design card shows up to ${LETTERS.length} options; ${files.length} found`, ['Post a folder of at most 6 options']);
  if (evidence && recommend) throw new PostError('USAGE', '--evidence asks no pick, so it takes no --recommend', ['Drop --recommend, or drop --evidence to ask for a pick']);
  if (evidence && !media.length) throw new PostError('USAGE', '--evidence needs --media <screenshot>: an Evidence card shows captures of the options', ['Run `first-draft-axi post <design> --title "<what this shows>" --evidence --media shot.png`']);
  const rec = /^\d+$/.test(recommend) ? LETTERS[Number(recommend) - 1] : recommend;
  if (!evidence && (!rec || !LETTERS.slice(0, files.length).includes(rec))) throw new PostError('USAGE', `--recommend is the option you would pick: a-${LETTERS[files.length - 1]} or 1-${files.length}`, ['Run `first-draft-axi post <design> --title "<question>" --recommend a`', 'Journeys, tests and demos pick nothing: use --evidence']);
  let boardFile = board && resolve(board);
  for (let d = resolve('.'); !boardFile; d = dirname(d)) {
    if (existsSync(join(d, '.sign-off')) && statSync(join(d, '.sign-off')).isDirectory()) boardFile = join(d, '.sign-off', 'decisions.json');
    else if (dirname(d) === d) throw new PostError('NO_BOARD', 'no .sign-off board folder here or above', ['Run `sign-off-axi init`, or pass --board <board.json>']);
  }
  const { host, advertise, given } = await viewHost(hostFlag);
  if (!advertise || (!given && host === '127.0.0.1')) throw new PostError('NO_TAILNET', 'tailscale ip -4 found no tailnet address, and the link must not point at localhost', ['Pass --host <tailnet address>']);
  const view = await ensureView({ files, host: advertise, port });
  const dir = join(dirname(boardFile), 'mocks', name);
  if (!evidence) mkdirSync(dir, { recursive: true });
  const options = files.map((file, i) => {
    const link = `${new URL(view.url).origin}/#/o/${i + 1}/play`;
    if (evidence) return { option: LETTERS[i], label: labels[i] || `Option ${i + 1}`, link };
    const copy = join(dir, `option-${i + 1}.html`);
    if (resolve(file) === copy) throw new PostError('USAGE', `${file} is already the board copy; post the original option files`);
    copyFileSync(file, copy);
    writeOptionReferences(copy,readOptionReferences(file));
    return { option: LETTERS[i], label: labels[i] || `Option ${i + 1}`, mock: relative(dirname(boardFile), copy), link };
  });
  const open = `Open in first-draft: ${options.map((o) => `${o.label} ${o.link}`).join(' · ')}`;
  const args = evidence ? ['post', boardFile, '--type', 'evidence', '--title', title, ...(key ? ['--key', key] : []), '--about', tradeoff ? `${tradeoff} ${open}` : open, ...media.flatMap((m) => ['--media', m])]
    : ['post', boardFile, '--type', 'design', '--title', title, ...(key ? ['--key', key] : []), '--tradeoff', tradeoff ? `${tradeoff} ${open}` : open, '--recommend', rec,
    ...options.flatMap((o) => ['--option', `${o.option}=${o.label}`, '--mock', `${o.option}=${o.mock}`, '--link', `${o.option}=${o.link}`])];
  try {
    const { stdout } = await promisify(execFile)('sign-off-axi', args, { maxBuffer: 1e7 });
    return { board: boardFile, view, options, sign_off: stdout.trim() };
  } catch (e) {
    throw new PostError('POST_FAILED', `sign-off-axi post failed: ${(e.stderr || e.stdout || e.message).trim()}`, ['Run `sign-off-axi doctor`']);
  }
}
