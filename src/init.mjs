// `init` in any repo: the .first-draft/ work folder and the first-draft-axi skill for the coding agents that read skills.
// Safe to re-run: what is already right is kept. The skill is copied into the repo (so it can be committed and always matches
// the CLI that wrote it); --global links it from the home folder instead, the only thing init writes outside the repo.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = fileURLToPath(new URL('../skills/first-draft-axi', import.meta.url));
const NAME = 'first-draft-axi';
// Each harness reads skills from one folder in a project and one in the home folder; codex and pi share .agents/skills.
const HARNESS = {
  claude: { dir: '.claude/skills', home: () => join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'skills') },
  codex: { dir: '.agents/skills', home: () => join(homedir(), '.agents', 'skills') },
  pi: { dir: '.agents/skills', home: () => join(homedir(), '.agents', 'skills') },
};
export const HARNESSES = Object.keys(HARNESS);
export class InitError extends Error {
  constructor(code, message, help = []) { super(message); this.code = code; this.help = help; }
}

// The repo is the nearest folder with .git (a file in a worktree), else the folder init runs in.
export const repoRoot = (from) => {
  for (let d = resolve(from); ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d;
    if (dirname(d) === d) return resolve(from);
  }
};

// Every file of the packaged skill, as name -> content.
const files = () => Object.fromEntries(readdirSync(SKILL, { recursive: true }).filter((f) => statSync(join(SKILL, f)).isFile()).map((f) => [f, readFileSync(join(SKILL, f), 'utf8')]));
const ours = (dir) => { try { return /^name:\s*"?first-draft-axi"?\s*$/m.test(readFileSync(join(dir, 'SKILL.md'), 'utf8')); } catch { return false; } };
const same = (dir, want) => Object.entries(want).every(([f, text]) => { try { return readFileSync(join(dir, f), 'utf8') === text; } catch { return false; } });

// Copy the skill to <base>/first-draft-axi: new, up to date, updated (an older copy of ours) or kept (a skill of that name that is not ours).
const copySkill = (base, want) => {
  const dest = join(base, NAME);
  if (existsSync(dest) || lstatSync(dest, { throwIfNoEntry: false })) {
    if (lstatSync(dest).isSymbolicLink() || !statSync(dest).isDirectory() || !ours(dest)) return 'kept (a different skill of this name is there)';
    if (same(dest, want)) return 'already installed';
    rmSync(dest, { recursive: true });
    cpSync(SKILL, dest, { recursive: true });
    return 'updated';
  }
  mkdirSync(base, { recursive: true });
  cpSync(SKILL, dest, { recursive: true });
  return 'installed';
};
// Link the skill from the home folder; a link we made is repointed, anything else there is kept.
const linkSkill = (base) => {
  const dest = join(base, NAME), at = lstatSync(dest, { throwIfNoEntry: false });
  if (at) {
    if (!at.isSymbolicLink()) return 'kept (a skill of this name is there)';
    if (resolve(dirname(dest), readlinkSync(dest)) === SKILL) return 'already linked';
    rmSync(dest);
  }
  mkdirSync(base, { recursive: true });
  symlinkSync(SKILL, dest, 'dir');
  return at ? 'relinked' : 'linked';
};

export function initProject({ cwd, harnesses = HARNESSES, global = false }) {
  const bad = harnesses.filter((h) => !HARNESS[h]);
  if (!harnesses.length || bad.length) throw new InitError('USAGE', `--harness takes ${HARNESSES.join(', ')}${bad.length ? `; not ${bad.join(', ')}` : ''}`, [`Run \`first-draft-axi init --harness ${HARNESSES.join(',')}\``]);
  const root = repoRoot(cwd), work = join(root, '.first-draft'), created = [];
  // `*` ignores the folder, this file included: designs, the reference cache and view state never dirty the repo (git add -f keeps a design).
  if (!existsSync(join(work, '.gitignore'))) {
    mkdirSync(join(work, 'designs'), { recursive: true });
    writeFileSync(join(work, '.gitignore'), '*\n');
    created.push('.first-draft/.gitignore');
  }
  if (!existsSync(join(work, 'designs'))) { mkdirSync(join(work, 'designs'), { recursive: true }); created.push('.first-draft/designs/'); }
  const want = files(), skills = [];
  for (const h of harnesses) {
    const dir = HARNESS[h].dir;
    const shared = skills.find((s) => s.dir === dir);
    skills.push({ harness: h, dir, status: shared ? shared.status : copySkill(join(root, dir), want), ...(shared && { shared_with: shared.harness }) });
  }
  const linked = global ? [...new Set(harnesses.map((h) => HARNESS[h].home()))].map((base) => ({ link: base.replace(homedir(), '~') + `/${NAME}`, status: linkSkill(base) })) : [];
  return { root, work: relative(root, work) || '.', created, skills, linked };
}
