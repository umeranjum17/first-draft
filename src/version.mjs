// The version a person is running: package.json's, or <version>-dev when it runs from a source checkout whose HEAD carries no release
// tag (v<version> or <version>), so code under development never passes for the published release. A pre-release version shows as it is.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tagged = () => {
  try { return execFileSync('git', ['-C', root, 'tag', '--points-at', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').some((t) => t === version || t === `v${version}`); }
  catch { return false; } // no git to ask: the checkout is not known to be a release
};

export const VERSION = version.includes('-') || !existsSync(join(root, '.git')) || tagged() ? version : `${version}-dev`;
