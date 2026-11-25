// /proof renders from the loaded dataset only: network label and explorer from the chain id, tx links, scores section gated.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Dataset, Snapshot, SnapRound } from '../lib/data';
import { Proof, proofFacts } from '../pages/Proof';

const round = (id: string, committers: string[], outcomes: SnapRound['outcomes']): SnapRound => ({
  roundId: id, questions: [0, 1].map((i) => ({ conditionId: `0x${i}`, ctf: '0xCtF0000000000000000000000000000000000001', yesSlot: 0, marketId: String(i) })),
  committers, revealed: [], scored: {}, forfeited: {}, outcomes, baseline: null,
  commitDeadline: '1', revealDeadline: '2', commitCount: committers.length, revealRate: null,
});
const A = '0x04ca5c9c38ac62d48fda6fe5328db4a0edee4b7a', B = '0xdcde642b2da60be15048f14ecb801578098b2e5f';
const snap = (extra: object = {}): Snapshot => ({
  network: 97, ledger: '0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1', builtAt: '2026-11-23T00:00:00Z',
  metrics: { distinctCommitters: 2, rounds: 2, perDay: {} },
  rounds: [round('2', [B, A], { 0: 'Unresolved', 1: 'No' }), round('1', [A], { 0: 'Yes', 1: 'Void' })],
  ...extra,
} as Snapshot);
const html = (s: Snapshot) => renderToStaticMarkup(<Proof data={{ manifest: { snapshot: '', rounds: [] }, snapshot: s, rounds: [] } as Dataset} />);

describe('proof page', () => {
  it('counts distinct holders once, in first round order, and questions resolved against the CTF', () => {
    const f = proofFacts(snap());
    expect(f.holders.map((h) => h.addr)).toEqual([A, B]);
    expect(f.holders.map((h) => h.roundId)).toEqual(['1', '2']);
    expect([f.rounds, f.resolved, f.questions, f.voided]).toEqual([2, 3, 4, 1]);
    expect(f.ctfs).toHaveLength(1);
  });
  it('counts holders who only made v2 open forecasts once, after the round holders', () => {
    const C = '0x' + 'c'.repeat(40);
    const f = proofFacts(snap({ open: { forecasts: [], committers: [A, C] } }));
    expect(f.holders.map((h) => h.addr)).toEqual([A, B, C]);
    expect(f.holders[2].tx).toBeNull();
  });
  it('testnet data: testnet label and testnet.bscscan.com links', () => {
    const out = html(snap());
    expect(out).toContain('BSC testnet');
    expect(out).toContain('https://testnet.bscscan.com/address/0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1');
    expect(out).not.toContain('https://bscscan.com');
  });
  it('mainnet data: mainnet label, bscscan.com links, no testnet note', () => {
    const out = html(snap({ network: 56 }));
    expect(out).toContain('BSC mainnet');
    expect(out).toContain('https://bscscan.com/address/');
    expect(out).not.toContain('testnet');
  });
  it('links each holder to the first commit tx, and falls back to the address when the tx is not indexed', () => {
    const out = html(snap({ firstCommits: { [A]: { tx: '0xfeed', roundId: '1', block: '5' } } }));
    expect(out).toContain('https://testnet.bscscan.com/tx/0xfeed');
    expect(out).toContain(`https://testnet.bscscan.com/address/${B}`);
    expect(out).toContain('commit transaction not indexed yet');
  });
  it('shows the ForewitScores root history only when the dataset has scoresRoots', () => {
    expect(html(snap())).not.toContain('ForewitScores root history');
    const out = html(snap({ scoresRoots: [{ roundId: '1', root: '0xr00t', tx: '0xabc' }] }));
    expect(out).toContain('ForewitScores root history');
    expect(out).toContain('0xr00t');
    expect(out).toContain('https://testnet.bscscan.com/tx/0xabc');
  });
});
