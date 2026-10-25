// A mobile brief's competitors, from a real Android emulator: install the app the person names (an APK, or a package already on
// the device), open it and capture its own screens. Internal reference only: the app's pixels are never embedded in the output.
// Every adb call names its own serial, runs one at a time with a deadline, and any missing piece is a clear refusal - never a hang
// and never a failure of the rest of the run.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { validPng } from './reference-capture.mjs';
const run = promisify(execFile);
const PKG = /^[a-z][a-z\d_]*(?:\.[a-z\d_]+)+$/i;

export const appHelp = '--app <apk-or-package> (repeatable) with --inspiration: on an Android emulator, install that app (a local .apk file, or a package already installed) and capture its own screens as internal mobile reference. Needs adb and one attached emulator; --device <serial> picks which. Nothing is captured when no emulator is attached, and the rest of the run continues.';

export function findAdb() {
  const names = process.platform === 'win32' ? ['adb.exe'] : ['adb'];
  const dirs = [...(process.env.PATH ?? '').split(delimiter), ...(process.env.ANDROID_HOME ? [join(process.env.ANDROID_HOME, 'platform-tools')] : []), ...(process.env.ANDROID_SDK_ROOT ? [join(process.env.ANDROID_SDK_ROOT, 'platform-tools')] : [])];
  for (const name of names) for (const dir of dirs) {
    const file = resolve(dir, name);
    try { accessSync(file, constants.X_OK); return file; } catch { /* not here */ }
  }
  return null;
}

const adb = async (bin, serial, args, ms = 20_000) => (await run(bin, ['-s', serial, ...args], { encoding: 'buffer', timeout: ms, maxBuffer: 16_000_000, windowsHide: true })).stdout;

// The one emulator to use: named explicitly, or the only one attached. Never a physical phone and never a guess between two.
export async function pickDevice(bin, wanted) {
  const { stdout } = await run(bin, ['devices'], { encoding: 'utf8', timeout: 15_000 });
  const ready = stdout.split(/\r?\n/).slice(1).map((l) => l.split(/\s+/)).filter((c) => c[1] === 'device').map((c) => c[0]);
  const emulators = ready.filter((s) => s.startsWith('emulator-'));
  if (wanted) {
    if (!ready.includes(wanted)) throw new Error(`no attached Android device with serial ${wanted}; nothing was installed or captured`);
    return wanted;
  }
  if (!emulators.length) throw new Error('no Android emulator is attached (adb devices shows none); start one or pass --device <serial>, so no competitor app can be installed or captured');
  if (emulators.length > 1) throw new Error(`${emulators.length} Android emulators are attached (${emulators.join(', ')}); pass --device <serial> to choose one, so none is captured by accident`);
  return emulators[0];
}

export async function captureApp({ target, project = process.cwd(), serial, bin = findAdb(), timeoutMs = 180_000 }) {
  if (!bin) throw new Error('Android app capture needs adb on PATH (Android SDK platform-tools); no app screens were captured');
  if (!PKG.test(target.trim()) && !/\.apk$/i.test(target)) throw new Error('--app takes a local .apk file or an Android package name such as com.example.app');
  const apk = /\.apk$/i.test(target) ? resolve(target) : null;
  if (apk && !existsSync(apk)) throw new Error(`no APK at ${apk}; nothing was installed`);
  const work = (async () => {
    const device = await pickDevice(bin, serial);
    let pkg = target.trim();
    if (apk) {
      // The APK's own package is the one package ids it installs: aapt is not assumed to be on the machine.
      const before = new Set((await adb(bin, device, ['shell', 'pm', 'list', 'packages', '-3'], 30_000)).toString('utf8').split(/\r?\n/).map((l) => l.replace('package:', '').trim()).filter(Boolean));
      const out = (await adb(bin, device, ['install', '-r', '-t', apk], 150_000)).toString('utf8');
      if (!/Success/i.test(out)) throw new Error(`adb could not install ${apk}: ${out.trim().slice(0, 300)}`);
      const added = [...new Set((await adb(bin, device, ['shell', 'pm', 'list', 'packages', '-3'], 30_000)).toString('utf8').split(/\r?\n/).map((l) => l.replace('package:', '').trim()).filter(Boolean))].filter((p) => !before.has(p));
      if (added.length !== 1) throw new Error(added.length ? `${apk} installed ${added.length} packages (${added.join(', ')}); pass --app <package-name> to choose one` : `${apk} installs a package already on ${device}; pass --app <package-name> instead`);
      pkg = added[0].trim();
    }
    if (!PKG.test(pkg)) throw new Error(`cannot tell which package ${apk ?? target} installs; pass --app <package-name> instead`);
    const resolved = (await adb(bin, device, ['shell', 'cmd', 'package', 'resolve-activity', '--brief', pkg], 30_000)).toString('utf8').trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '';
    if (!resolved.includes('/')) throw new Error(`${pkg} is not installed on ${device}, or has no launchable activity; nothing was captured`);
    const started = (await adb(bin, device, ['shell', 'am', 'start', '-W', '-n', resolved], 40_000)).toString('utf8');
    if (/Error|Exception/i.test(started)) throw new Error(`could not open ${pkg} on ${device}: ${started.split(/\r?\n/).find((l) => /error/i.test(l)) ?? started.trim().slice(0, 200)}`);
    const shots = [];
    for (const [i, settle] of [[0, 2500], [1, 1200]]) {
      await new Promise((r) => setTimeout(r, settle));
      const png = await adb(bin, device, ['exec-out', 'screencap', '-p'], 30_000);
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      if (!validPng(png, width, height)) throw new Error(`${pkg} on ${device} returned no readable screenshot`);
      shots.push({ width, height, dataUrl: `data:image/png;base64,${png.toString('base64')}` });
      if (i === 0) await adb(bin, device, ['shell', 'input', 'swipe', String(Math.round(width / 2)), String(Math.round(height * 0.75)), String(Math.round(width / 2)), String(Math.round(height * 0.3)), '300'], 20_000);
    }
    const dir = resolve(project, '.first-draft', 'refs', `app-${pkg.replace(/[^a-z0-9]+/gi, '-')}-${createHash('sha256').update(`${pkg}${String(Date.now())}`).digest('hex').slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    shots.forEach((s, i) => writeFileSync(join(dir, `screen-${i + 1}.png`), Buffer.from(s.dataUrl.slice(22), 'base64')));
    return { package: pkg, device, apk, dir, shots };
  })();
  let timer;
  try { return await Promise.race([work, new Promise((_, no) => { timer = setTimeout(() => no(new Error('Android app capture exceeded its deadline; nothing more was captured')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
