// `init` in a fresh repo, end to end with the real CLI and a throwaway HOME: the work folder and the skill land in the repo for each harness,
// nothing is written outside it, a re-run changes nothing, and the packaged skill only names commands the CLI has.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'src/cli.mjs');
const SKILL = join(ROOT, 'skills/first-draft-axi');

test('init sets up any repo: .first-draft/ and the skill for claude, codex and pi, safe to re-run, nothing outside the repo but an asked-for link', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'first-draft-init-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const home = join(dir, 'home'), repo = join(dir, 'repo');
  mkdirSync(home); mkdirSync(join(repo, 'src/deep'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const env = { PATH: process.env.PATH, HOME: home, FIRST_DRAFT_HOME: join(home, '.first-draft') };
  const init = async (args = [], cwd = join(repo, 'src/deep')) => {
    const r = await promisify(execFile)(process.execPath, [CLI, 'init', ...args], { cwd, env }).catch((e) => e);
    return JSON.parse(r.stdout);
  };

  const first = await init();
  assert.equal(first.init.repo, repo, 'run from a subfolder, init sets up the repo root');
  assert.deepEqual(first.init.created, ['.first-draft/.gitignore']);
  assert.deepEqual(first.init.skills.map((s) => [s.harness, s.dir, s.status]), [['claude', '.claude/skills', 'installed'], ['codex', '.agents/skills', 'installed'], ['pi', '.agents/skills', 'installed']]);
  assert.equal(first.init.skills[2].shared_with, 'codex');
  for (const d of ['.claude/skills', '.agents/skills']) for (const f of ['SKILL.md', 'REFERENCE.md']) assert.equal(readFileSync(join(repo, d, 'first-draft-axi', f), 'utf8'), readFileSync(join(SKILL, f), 'utf8'));
  assert.equal(readFileSync(join(repo, '.first-draft/.gitignore'), 'utf8'), '*\n');
  assert.ok(lstatSync(join(repo, '.first-draft/designs')).isDirectory());
  assert.deepEqual(readdirSync(home), [], 'nothing was written outside the repo');
  assert.ok(first.help.some((h) => /--model claude-sonnet-5-5/.test(h)) && first.help.some((h) => /No model is saved|doctor/.test(h)));
  assert.equal(execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: repo, encoding: 'utf8' }).split('\n').filter((l) => l && !/\.claude|\.agents/.test(l)).length, 0, 'designs, cache and view state never show in git');

  const again = await init();
  assert.equal(again.init.created, 'nothing new (re-run is a no-op)');
  assert.deepEqual(again.init.skills.map((s) => s.status), ['already installed', 'already installed', 'already installed']);

  // An older copy of this skill is brought up to date; a different skill of the same name is left alone.
  writeFileSync(join(repo, '.claude/skills/first-draft-axi/SKILL.md'), '---\nname: first-draft-axi\n---\nold\n');
  writeFileSync(join(repo, '.agents/skills/first-draft-axi/SKILL.md'), '---\nname: somebody-elses\n---\nmine\n');
  const fixed = await init();
  assert.deepEqual(fixed.init.skills.map((s) => s.status.split(' ')[0]), ['updated', 'kept', 'kept']);
  assert.equal(readFileSync(join(repo, '.claude/skills/first-draft-axi/SKILL.md'), 'utf8'), readFileSync(join(SKILL, 'SKILL.md'), 'utf8'));
  assert.match(readFileSync(join(repo, '.agents/skills/first-draft-axi/SKILL.md'), 'utf8'), /mine/);

  // One harness only; an unknown one is refused with the choices; --global is the one thing written outside the repo, a link.
  const other = join(dir, 'other');
  mkdirSync(other);
  const claudeOnly = await init(['--harness', 'claude'], other);
  assert.equal(claudeOnly.init.repo, other, 'outside a git repo init sets up the current folder');
  assert.deepEqual(readdirSync(other, { all: true }).sort(), ['.claude', '.first-draft']);
  assert.equal((await init(['--harness', 'emacs'])).error.code, 'USAGE');
  const linked = await init(['--harness', 'claude,codex', '--global']);
  assert.deepEqual(linked.init.linked.map((l) => l.status), ['linked', 'linked']);
  assert.equal(readlinkSync(join(home, '.claude/skills/first-draft-axi')), SKILL);
  assert.equal(readlinkSync(join(home, '.agents/skills/first-draft-axi')), SKILL);
  assert.deepEqual((await init(['--harness', 'claude', '--global'])).init.linked.map((l) => l.status), ['already linked']);

  // Saving the agent is a separate, config-only call and touches no repo.
  const before = readdirSync(other, { all: true }).sort();
  const saved = await init(['--agent', 'byokit:claude', '--model', 'claude-sonnet-5-5'], other);
  assert.equal(saved.saved.model, 'claude-sonnet-5-5');
  assert.deepEqual(readdirSync(other, { all: true }).sort(), before);
  assert.equal((await init(['--agent', 'byokit:claude', '--model', 'claude-sonnet-5-5', '--global'])).error.code, 'USAGE');
});
