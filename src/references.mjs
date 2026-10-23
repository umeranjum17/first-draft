// Reference pixels are model inputs, never assets for the exported page.
import { execFile } from 'node:child_process';
import { accessSync, closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { delimiter, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
const MAX = 5_000_000, TOTAL = 10_000_000, COUNT = 6;
const TYPES = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' };
const converter = () => ['magick', 'convert'].flatMap((name) => (process.env.PATH ?? '').split(delimiter).map((dir) => resolve(dir, name))).find((file) => { try { accessSync(file, constants.X_OK); return true; } catch { return false; } });
export const referenceFlags = { ref: { type: 'string', multiple: true } };
export const referenceHelp = 'References: --ref <local.png|jpg|webp> (repeatable, up to 6; 5 MB each, 10 MB total). Needs ImageMagick. Visual input only: not embedded unless requested.';
export const referenceDoctor = () => ({ label: 'reference images', status: converter() ? 'ok' : 'warn', detail: converter() ? 'PNG/JPEG/WebP validation and conversion available' : 'Install ImageMagick to use --ref; no image is silently dropped' });

export async function references(paths = []) {
  if (!paths.length) return [];
  if (paths.length > COUNT) throw new Error('--ref accepts at most 6 images');
  const bin = converter();
  if (!bin) throw new Error('--ref needs ImageMagick (magick or convert on PATH) to validate and normalize image input');
  let total = 0, converted = 0;
  const images = [];
  for (const path of paths) {
    const type = TYPES[extname(path).toLowerCase()];
    if (!type || /^[a-z][a-z0-9+.-]*:\/\//i.test(path)) throw new Error('--ref needs a local PNG, JPG or WebP path');
    let fd, data;
    try {
      fd = openSync(resolve(path), constants.O_RDONLY | constants.O_NONBLOCK);
      const stat = fstatSync(fd);
      if (!stat.isFile() || !stat.size || stat.size > MAX) throw new Error('--ref must be a nonempty regular image file, at most 5 MB');
      const buf = Buffer.alloc(MAX + 1); let size = 0, n;
      while (size < buf.length && (n = readSync(fd, buf, size, buf.length - size, null))) size += n;
      if (size > MAX || (total += size) > TOTAL) throw new Error('--ref exceeds 5 MB per image or 10 MB total');
      data = buf.subarray(0, size);
    } finally { if (fd !== undefined) closeSync(fd); }
    const signature = type === 'png' ? data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : type === 'jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255 : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    if (!signature) throw new Error('--ref image bytes do not match the PNG/JPG/WebP extension');
    try {
      // Explicit raster coder + bounded resources: never interpret paths, URLs or SVG/delegates as images.
      const call = promisify(execFile)(bin, ['-limit', 'memory', '64MiB', '-limit', 'map', '128MiB', '-limit', 'disk', '0', '-limit', 'width', '4096', '-limit', 'height', '4096', `${type}:-[0]`, '-auto-orient', '-strip', 'png:-'], { encoding: 'buffer', maxBuffer: MAX, timeout: 15_000 });
      call.child.stdin.on('error', () => {}); // Decoder rejection can close stdin before all bytes are written; execFile reports its cause.
      call.child.stdin.end(data);
      const { stdout } = await call;
      if (!stdout.length || (converted += stdout.length) > TOTAL) throw new Error('normalized references exceed 10 MB');
      images.push({ id: `reference-${images.length + 1}`, mime: 'image/png', dataUrl: `data:image/png;base64,${stdout.toString('base64')}` });
    } catch (e) { throw new Error(`Cannot decode --ref image (maximum 4096x4096): ${e.stderr?.toString().trim() || e.message}`); }
  }
  return images;
}
