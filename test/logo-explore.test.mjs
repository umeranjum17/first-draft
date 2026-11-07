// logo --explore auto draws its reference images on Codex only. Higgsfield spends credits, so it runs only when --explore names it.
// A stand-in `higgsfield` on PATH records every call; Codex is not signed in (empty HOME), so auto has no provider and must not fall back.
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { exploreImages } from '../src/logo-images.mjs';

test('logo --explore auto never calls Higgsfield; only an explicit --explore higgsfield does', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fd-explore-'));
  const kept = { PATH: process.env.PATH, HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, XDG_DATA_HOME: process.env.XDG_DATA_HOME, CI: process.env.CI };
  t.after(() => { for (const [k, v] of Object.entries(kept)) v === undefined ? delete process.env[k] : (process.env[k] = v); rmSync(dir, { recursive: true, force: true }); });
  const bin = join(dir, 'bin'), calls = join(dir, 'higgsfield-calls.log'), home = join(dir, 'home');
  mkdirSync(bin); mkdirSync(home);
  writeFileSync(join(bin, 'higgsfield'), `#!/bin/sh\necho "$*" >> '${calls}'\nif [ "$1" = generate ] && [ "$2" = cost ]; then echo '{"credits": 1}'; fi\nexit 0\n`);
  chmodSync(join(bin, 'higgsfield'), 0o755);
  Object.assign(process.env, { PATH: `${bin}:${kept.PATH}`, HOME: home, XDG_CONFIG_HOME: home, XDG_DATA_HOME: home });
  delete process.env.CI;

  const auto = await exploreImages({ spec: 'auto', count: 1, brief: "Umer's tea shop", dir });
  assert.ok(auto.off, 'with Codex not signed in, auto makes no image');
  assert.match(auto.off, /Codex needs its subscription login/);
  assert.equal(existsSync(calls), false, 'auto never ran higgsfield');

  const named = await exploreImages({ spec: 'higgsfield', count: 1, brief: "Umer's tea shop", dir }).catch((e) => ({ error: e.message }));
  assert.ok(existsSync(calls), 'the stand-in records a call when Higgsfield is named');
  assert.match(readFileSync(calls, 'utf8'), /account status/);
  assert.ok(named.provider === 'higgsfield' || named.error, 'a named provider is used, or its failure is shown');
});
