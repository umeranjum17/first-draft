import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
const data = new URL('./fixtures/fleet-demo.json', import.meta.url).pathname;

test('CLI consistency gate catches wrong figures and held-ticket state; absent data passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fd-consistency-'));
  const run = (html) => {
    const page = join(dir, 'page.html'); writeFileSync(page, html);
    try { return { code: 0, output: execFileSync(process.execPath, [cli, 'check', page, '--data', data], { encoding: 'utf8' }) }; }
    catch (e) { return { code: e.status, output: e.stdout }; }
  };
  try {
    const good = run('<p>Queue count 3; open 4; plan 3; landed today 2</p><h2>held-for-captain</h2><p>Wait for the captain\'s call</p>');
    assert.equal(good.code, 0); assert.match(good.output, /"note":"checked"/);
    const wrongCount = run('<p>Queue count 9</p>'); assert.equal(wrongCount.code, 1); assert.match(wrongCount.output, /count count is 9/);
    const inconsistent = join(dir, 'inconsistent.json'); writeFileSync(inconsistent, JSON.stringify({ queue: { count: 4, items: [{}, {}, {}] } }));
    const countPage = join(dir, 'count.html'); writeFileSync(countPage, '<p>Queue count 4</p>');
    let sumError; try { execFileSync(process.execPath, [cli, 'check', countPage, '--data', inconsistent], { encoding: 'utf8' }); } catch (e) { sumError = e; }
    assert.equal(sumError?.status, 1); assert.match(sumError?.stdout, /does not sum to 3 items/);
    const wrongState = run('<h2>Stuck 2</h2><p>Wait for the captain\'s call</p>'); assert.equal(wrongState.code, 1); assert.match(wrongState.output, /Wait for the captain's call/);
    const emptyData = join(dir, 'empty.json'); writeFileSync(emptyData, 'null');
    const page = join(dir, 'page.html'); writeFileSync(page, '<p>anything</p>');
    const absent = execFileSync(process.execPath, [cli, 'check', page, '--data', emptyData], { encoding: 'utf8' });
    assert.match(absent, /no data to check/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
