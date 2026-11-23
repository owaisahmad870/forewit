// Titles rule: a question without an event question never renders, and market text is always escaped plain text.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionTitle } from '../components';
import { joinRounds, safeTitle, type RoundFile, type Snapshot } from '../lib/data';
import { RoundPage } from '../pages/Round';

const snapshot: Snapshot = {
  network: 97, ledger: '0xL', builtAt: '2026-11-23T00:00:00Z', metrics: { distinctCommitters: 1, rounds: 1, perDay: {} },
  rounds: [{
    roundId: '1', questions: [0, 1, 2].map((i) => ({ conditionId: `0x${i}`, ctf: '0x0', yesSlot: 0, marketId: String(i) })),
    committers: [], revealed: [], scored: {}, forfeited: {}, outcomes: {}, baseline: null,
    commitDeadline: '4000000000', revealDeadline: '4000086400', commitCount: 0, revealRate: null,
  }],
};
const file: RoundFile = {
  network: 97, ledger: '0xl', roundId: 1, commitDeadline: '', revealDeadline: '',
  questions: [
    { index: 0, marketId: '0', eventQuestion: 'Highest temperature in Shenzhen on November 24?', label: '24°C' },
    { index: 1, marketId: '1', label: 'ORPHAN_LABEL_23C' },
    { index: 2, marketId: '2', eventQuestion: '<img src=x onerror=alert(1)>Will it rain?', label: '<b>Yes</b>' },
  ],
};

describe('titles rule', () => {
  const rounds = joinRounds(snapshot, [file]);
  const html = renderToStaticMarkup(<RoundPage data={{ manifest: { snapshot: '', rounds: [] }, snapshot, rounds }} id={1} />);

  it('renders event question plus label', () => {
    expect(html).toContain('Highest temperature in Shenzhen on November 24?');
    expect(html).toContain('24°C');
  });
  it('a question without an event question does not render at all, not even its label', () => {
    expect(rounds[0].questions[1].title).toBeNull();
    expect(html).not.toContain('ORPHAN_LABEL_23C');
    expect(html).toContain('1 questions are hidden');
    expect(renderToStaticMarkup(<QuestionTitle title={safeTitle({ label: 'ORPHAN' })} />)).toBe('');
  });
  it('market text is escaped, never parsed as HTML', () => {
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Yes');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;Will it rain?');
  });
});
