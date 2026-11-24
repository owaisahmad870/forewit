// First visit help: docs read as a guided path (previous and next in DOC_SLUGS order) and every glossary term resolves.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocPage, DocsIndex } from '../pages/Static';

describe('docs guided path', () => {
  it('links previous and next in index order', () => {
    const out = renderToStaticMarkup(<DocPage slug="scoring" />);
    expect(out).toContain('href="#/docs/how" rel="prev"');
    expect(out).toContain('Previous: How it works');
    expect(out).toContain('Next: Question selection');
  });
  it('first and last pages have one direction only', () => {
    expect(renderToStaticMarkup(<DocPage slug="how" />)).not.toContain('Previous:');
    expect(renderToStaticMarkup(<DocPage slug="faq" />)).not.toContain('Next:');
  });
  it('the glossary has no missing locale keys', () => {
    const out = renderToStaticMarkup(<DocsIndex />);
    expect(out).toContain('Brier score');
    expect(out).not.toContain('help.');
  });
});
