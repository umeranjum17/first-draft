// The landing page's footer names the released version: package.json's, stamped into docs/index.html by the build and the Pages deploy.
import { readFileSync, writeFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const page = readFileSync('docs/index.html', 'utf8'), slot = /(<span class="version">)[^<]*(<\/span>)/;
if (!slot.test(page)) throw new Error('docs/index.html has no <span class="version"> in its footer to stamp');
const stamped = page.replace(slot, `$1${version}$2`);
if (stamped !== page) writeFileSync('docs/index.html', stamped);
