/// Minimal scroll geometry, so the "stuck to bottom" check is testable without
/// a real DOM element.
export interface ScrollGeometry {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/// Within this many px of the bottom counts as "at the bottom" — a little
/// slack so sub-pixel layout jitter doesn't flip auto-scroll off.
export const STICK_THRESHOLD_PX = 96;

/// Whether the scroll position is close enough to the bottom that new content
/// should keep auto-scrolling into view.
export function isNearBottom(el: ScrollGeometry, threshold = STICK_THRESHOLD_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}
