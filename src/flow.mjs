// A flow is a brief that asks for several screens of one journey (onboarding, sign-up, a wizard, a checkout): one shell and one grid on
// every screen, a step of the way through, not N pages that each invent their own layout. It is read from the brief's own words and the
// screens it names, so the drawing contract, the critic's rubric and the reference kind all agree on what it is.
export const FLOW_WORDS = /\b(onboarding|sign[\s-]?up flow|welcome flow|wizard|multi[\s-]?step|step[\s-]by[\s-]step|setup flow|checkout flow|flow)\b/i;
export const SCREENS_WORDS = /\b(\d{1,2})\s*(?:-|\s)?screens?\b/i;
export const flowOf = (brief = '', screens = []) => {
  const count = Math.min(12, Number(brief.match(SCREENS_WORDS)?.[1] ?? 0) || screens.length);
  return FLOW_WORDS.test(brief) && count >= 3 ? { count, screens } : null;
};
// The one shell every screen of the flow keeps: what makes it a flow rather than a set of screens. Count-free, so the contract is one
// sentence whatever the brief's number of screens (the brief names the count).
export const flowRule = () => 'This is a flow of several screens, not one page and not N separate pages: every screen keeps ONE shell and ONE grid (a header row at the same height with a back control and Skip, the title at the same position, size and measure, the progress dots at the same place, and the round next button in the same corner), so only the content between them changes; the same progress dots advance the same way on every screen, each screen carries one idea and one decision, the first screen opens the flow and the last names the first step.';
// Illustrations for a flow: one character, one style, on every screen, drawn from one sheet so it stays the same character.
export const characterRule = () => 'Illustrations for this flow: ONE character in ONE drawing style (a hand-drawn ink line and a soft wash) appears on every screen, in a different pose or scene each. Call generate_image_asset once first for the character\'s style sheet alone (purpose "character style sheet"): the character on a plain ground, with its line, wash and palette. Then call it once per screen for that screen\'s scene and place the result inside that screen. Every later image of a flow is drawn from that first image, so the character, the line weight and the palette stay the same.';
