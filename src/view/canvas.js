// Plain-code ports from Open CoDesign apps/desktop at the commit in ENGINE.md (no React, no Electron IPC).
// The view page bundles this; tests import it directly.

// PreviewPane.tsx renders previews with sandbox INTERACTIVE_PREVIEW_SANDBOX ('allow-scripts allow-forms'); first-draft drops allow-forms.
export const SANDBOX = 'allow-scripts';

// PhoneFrame.tsx PHONE_FRAME_SIZING (screen 375x812, bezel 3) and PreviewPane.tsx PREVIEW_DIMENSIONS.desktop (1440x900),
// resized to the two widths first-draft designs for: 390 and 1280.
export const FRAMES = { phone: { width: 390, height: 844, bezel: 3 }, desktop: { width: 1280, height: 800 } };

// mode is the route's suffix: 'full', 'play', or nothing.
export function pageFor(option, mode) {
  if (!option) return 'grid';
  if (option.error || (mode !== 'full' && mode !== 'play')) return 'canvas';
  return mode;
}

// The canvas and Play show one device at a time, the one the route names or else the one that fits the viewport,
// as large as the stage allows without upscaling (PreviewPane.tsx computeFitPreviewZoom).
export const deviceFor = (device, viewportWidth) => device ?? (viewportWidth < 760 ? 'phone' : 'desktop');
const PADDING = 48;
export function fitDevice(device, width, height) {
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
