// An option's motion: the frame series render-check's motion() captured at 390 and 1280, kept beside the option in <option>.motion/
// (one JPEG per frame and motion.json), with the judge's motion verdict. The view shows the series where the option is reviewed.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

// A brief asks for motion in words: an option that does not move then misses something it was asked for.
export const MOTION_WORDS = /\b(?:animat\w*|motion|moving|typing|typewriter|typed out|puls(?:e|es|ing)|marquee|ticker|blink\w*|spinn\w*|counting up|count-up)\b/i;

export const motionDir = (file) => file.replace(/\.html?$/i, '') + '.motion';

// The verdict for an option that does not move: no score, and a defect when the brief asked for motion.
export const still = (brief) => ({ present: false, score: null, reason: 'Nothing moved: every frame at 390 and at 1280 is the same, so there is no motion to score.',
  defects: MOTION_WORDS.test(brief) ? ['The brief asks for motion and nothing in the option moves.'] : [] });

export function writeMotion(file, motion, verdict) {
  const dir = motionDir(file);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = motion.frames.map(({ dataUrl, id, width, height, frame, at_ms }) => {
    writeFileSync(join(dir, `${id}.jpg`), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    return { file: `${id}.jpg`, width, height, frame, at_ms };
  });
  writeFileSync(join(dir, 'motion.json'), `${JSON.stringify({ option: basename(file), moves: motion.moves, widths: motion.widths, frames, verdict }, null, 2)}\n`);
  return dir;
}

export function readMotion(file) {
  const path = join(motionDir(file), 'motion.json');
  if (!existsSync(path)) return null;
  const m = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(m.frames) || m.frames.some((f) => !/^motion-\d+-\d+\.jpg$/.test(f.file))) throw new Error('motion.json lists a frame that is not one of its own');
  return m;
}
