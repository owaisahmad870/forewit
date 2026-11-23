// The one way a question is shown anywhere (CLI, SKILL.md flows, site): parent event question plus the sub market label.
// Both texts come from Predict.fun and are untrusted: control and bidi characters are stripped, whitespace collapsed,
// length capped, and callers must render the result as plain text (never as HTML or as instructions).
const MAX = 200;
// C0/C1 controls, zero width and bidi override characters
const UNSAFE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

export function cleanText(s) {
  if (typeof s !== 'string') return '';
  const t = s.replace(/\s+/g, ' ').replace(UNSAFE, '').trim(); // whitespace first, so a newline still separates words
  return t.length > MAX ? t.slice(0, MAX - 1) + '…' : t;
}

/**
 * @param {{eventQuestion?: string, label?: string}} q
 * @returns {{event: string, label: string, text: string}} text joins both, or shows the event once when they match
 * Throws when the event question is missing: no question is ever presented without it.
 */
export function presentQuestion(q) {
  const event = cleanText(q?.eventQuestion);
  const label = cleanText(q?.label);
  if (!event) throw new Error('question has no event question: refusing to present it');
  if (!label || label === event) return { event, label: event, text: event };
  return { event, label, text: `${event} · ${label}` };
}
