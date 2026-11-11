// Direction sidecar files: each option's planned direction beside it as `<option>.html.direction.json`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

// Write the direction plan for one option: { name, learn_from, layout, type, palette, signature }.
export function writeDirection(file, direction) {
  if (!direction || typeof direction !== 'object') return;
  const { name, learn_from, layout, type, palette, signature } = direction;
  if (!name || !learn_from || !layout || !type || !palette || !signature) return;
  const path = `${file}.direction.json`;
  writeFileSync(path, `${JSON.stringify({ name, learn_from, layout, type, palette, signature }, null, 2)}\n`);
}

// Read the direction for one option; returns null if the file does not exist or is invalid.
export function readDirection(file) {
  const path = `${file}.direction.json`;
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const { name, learn_from, layout, type, palette, signature } = data;
    if (!name || !learn_from || !layout || !type || !palette || !signature) return null;
    return { name, learn_from, layout, type, palette, signature };
  } catch (e) {
    console.warn(`${basename(path)} cannot be read: ${e.message}`);
    return null;
  }
}
