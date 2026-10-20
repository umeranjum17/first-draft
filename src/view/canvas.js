// Plain-code ports from Open CoDesign apps/desktop at the commit in ENGINE.md (no React, no Electron IPC).
// The view page bundles this; tests import it directly.

// PreviewPane.tsx renders previews with sandbox INTERACTIVE_PREVIEW_SANDBOX ('allow-scripts allow-forms'); first-draft drops allow-forms.
export const SANDBOX = 'allow-scripts';

// PhoneFrame.tsx PHONE_FRAME_SIZING (screen 375x812, bezel 3) and PreviewPane.tsx PREVIEW_DIMENSIONS.desktop (1440x900),
// resized to the two widths first-draft designs for: 390 and 1280.
export const FRAMES = { phone: { width: 390, height: 844, bezel: 3 }, desktop: { width: 1280, height: 800 } };

// PreviewPane.tsx computeFitPreviewZoom fits one artboard; this fits phone and desktop on one row,
// and stacks them, each fitted to the width, when that row would be too small to read.
const PADDING = 48, GAP = 32, MIN_ROW = 0.45;
export function fitCanvas(containerWidth) {
  const phone = FRAMES.phone.width + FRAMES.phone.bezel * 2, desktop = FRAMES.desktop.width;
  const available = Math.max(1, containerWidth - PADDING);
  const row = Math.min(1, available / (phone + GAP + desktop));
  if (row >= MIN_ROW) return { stacked: false, phone: row, desktop: row };
  return { stacked: true, phone: Math.min(1, available / phone), desktop: Math.min(1, available / desktop) };
}

// mode is the route's suffix: 'full', 'play', or nothing.
export function pageFor(option, mode) {
  if (!option) return 'grid';
  if (option.error || (mode !== 'full' && mode !== 'play')) return 'canvas';
  return mode;
}

// Play shows one device at a time, as large as the stage allows without upscaling.
export const playDevice = (device, viewportWidth) => device ?? (viewportWidth < 760 ? 'phone' : 'desktop');
export function fitPlay(device, width, height) {
  const f = FRAMES[device], w = f.width + (f.bezel ?? 0) * 2, h = f.height + (f.bezel ?? 0) * 2;
  return Math.min(1, Math.max(1, width - PADDING) / w, Math.max(1, height - PADDING) / h);
}

// preview/helpers.ts formatIframeError and isTrustedPreviewMessageSource, unchanged.
export function formatIframeError(kind, message, source, lineno) {
  const location = source && lineno ? ` (${source}:${lineno})` : '';
  return `${kind}: ${message}${location}`;
}
export function isTrustedPreviewMessageSource(source, previewWindow) {
  return source !== null && source === previewWindow;
}
