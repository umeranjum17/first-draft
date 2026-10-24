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

// The canvas shows the device the route names, else the one that fits the viewport: on a wide screen (860px and up, where the
// Studio has its panel) 'both', the desktop and the phone side by side, when `roomy` (Both fits large, BOTH_MIN), else 'desktop';
// under 860px one device, and 'both' falls back to it.
export const WIDE = 860;
export const deviceFor = (device, viewportWidth, roomy = true) => (device === 'both' && viewportWidth < WIDE ? undefined : device)
  ?? (viewportWidth < 760 ? 'phone' : viewportWidth < WIDE || !roomy ? 'desktop' : 'both');
// Both opens by default only where it can be drawn at this scale or more; on a smaller canvas (1280 or 1440 wide with the panel
// open) the Studio opens on Desktop, which fills the width, and Both is one click away.
export const BOTH_MIN = 0.83;
// Fit to space: each device is drawn at the largest scale that fits the stage, larger than its true size on a big stage,
// with PADDING around it (the stage's edge to the frame, both sides together).
const PADDING = 24;
// Comment pins sit in the margin beside the frame (a 26px pin centred 22px out reaches 35px, inside this and half the padding): a design with pins keeps this much more room on each side.
export const PIN_GUTTER = 24;
// Side by side: the two frames share one scale, so the phone keeps its true size beside the desktop, with this much room
// between them on screen (wider with pins, whose margins meet there) and a caption above each.
export const pairGap = (pins) => (pins ? 72 : 32);
export const CAPTION = 34;
const outer = (d) => ({ w: FRAMES[d].width + (FRAMES[d].bezel ?? 0) * 2, h: FRAMES[d].height + (FRAMES[d].bezel ?? 0) * 2 });
export function fitDevice(device, width, height, gutter = 0) {
  const room = (n) => Math.max(1, n);
  if (device === 'both') {
    const d = outer('desktop'), p = outer('phone');
    return Math.min(room(width - PADDING - gutter * 2 - pairGap(gutter > 0)) / (d.w + p.w), room(height - PADDING - CAPTION) / Math.max(d.h, p.h));
  }
  const { w, h } = outer(device);
  return Math.min(room(width - PADDING - gutter * 2) / w, room(height - PADDING) / h);
}

// comment/CommentBubble.tsx commentKeyAction and commentBubblePosition, unchanged: the add-a-comment box opens below the
// point it is about, or above it when there is no room below, so it never covers that point.
export function commentKeyAction(event) {
  if (event.isComposing || event.keyCode === 229) return null;
  if (event.key === 'Escape') return 'dismiss';
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey) ? 'send' : null;
}
export function commentBubblePosition(anchor, bubble, viewport) {
  const below = anchor.top + anchor.height + 8;
  const above = anchor.top - bubble.height - 8;
  return {
    top: Math.max(12, Math.min(below + bubble.height <= viewport.height - 12 || above < 12 ? below : above, viewport.height - bubble.height - 12)),
    left: Math.max(12, Math.min(anchor.left, viewport.width - bubble.width - 12)),
  };
}

// preview/helpers.ts formatIframeError and isTrustedPreviewMessageSource, unchanged.
export function formatIframeError(kind, message, source, lineno) {
  const location = source && lineno ? ` (${source}:${lineno})` : '';
  return `${kind}: ${message}${location}`;
}
export function isTrustedPreviewMessageSource(source, previewWindow) {
  return source !== null && source === previewWindow;
}
