// An option's source, readable beside the export: <option>.source/ holds the files the engine wrote (App.jsx and the files it imports),
// so a reviewer can read what made the page instead of decoding the page's in-band base64 comment. An index.html option carries its own
// source in the page, so it is not written twice.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const sourceDir = (file) => file.replace(/\.html?$/i, '') + '.source';

export function writeSource(file, files) {
  for (const [path] of files) if (!path || path.startsWith('/') || path.split('/').includes('..')) throw new Error(`the source path ${path} is outside the option's source folder`);
  const dir = sourceDir(file);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, text] of files) {
    const target = join(dir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  return dir;
}
