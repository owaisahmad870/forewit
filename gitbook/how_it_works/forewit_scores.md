---
description: ForewitScores lets any contract or agent check a holder's Forewit skill onchain with one call.
---

# ForewitScores

ForewitScores is a public notice board. After each round is settled, the keeper pins one fingerprint (a Merkle root) that covers the score of every holder who opted in. Any app holding a score and its proof can ask the board "is this exactly what the fingerprint says?" and gets yes or no, without adding up every round itself.

## What is live

* ForewitScores on BSC mainnet: [0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc), verified on BscScan and Sourcify. It reads from the ForecastLedger [0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6).
* Status on 24 Nov 2026: no root posted yet (`latestEpoch` is 0). The first root follows the first settled round with at least one opted in holder. Until then `verify` returns false for everyone.

## What a score is

Each leaf holds three numbers, computed from ForecastLedger events only (forfeits count):

* `tokenId`: your Agent ID token id, `uint256(keccak256(bytes(label)))`.
* `skill`: `sumSkill / (baselineQuestions + 20)`, integer division truncated toward zero. This is the leaderboard score from [Scoring](scoring.md).
* `n`: your `baselineQuestions`, the sample size.

A wallet gets a leaf only if, at the root's snapshot block, it has at least one scored or forfeited round, holds no role on the ledger, has a public profile with an Agent ID name (`npx forewit@0.1.5 profile ... --label yourname`), and that Agent ID has not moved out of the wallet since the opt in. Everyone else is listed in the leaves file by address and reason only.

## How to check a score

A free view call:

```solidity
function verify(uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) external view returns (bool);
```

It returns true only if the latest root exists, is not revoked, and the proof matches it. For history there is `verifyAt(epoch, tokenId, skill, n, proof)`. The keeper publishes every proof in the leaves file (`web/public/data/scores/latest.json` in the repository, served under `data/scores/` on the site).

A proof is public, so a contract that gates on a score must also check that the caller owns the token: `AGENT_ID.ownerOf(tokenId) == msg.sender`. See [Gate on a Forewit score](../developers/gate_on_a_score.md).

## Anyone can recompute every root

Every root can be rebuilt from BSC logs alone, with no archive node and no trust in Forewit:

```bash
node indexer/scores.mjs recompute --network mainnet --scores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc
```

It exits 0 only if the rebuilt root equals the onchain root. See [Recompute any score or root](../developers/recompute.md). Before each post the keeper builds the tree on one RPC provider, recomputes it on a second, and posts only if both agree.

Roots are append only. A wrong root is fixed by posting a corrected root, then revoking the bad one with a public reason. The keeper can revoke only the newest two roots; older ones only the admin.

Full spec: [docs/SCORES.md](https://github.com/owaisahmad870/forewit/blob/main/docs/SCORES.md). Function list: [Contract reference: ForewitScores](../developers/forewit_scores_reference.md).
