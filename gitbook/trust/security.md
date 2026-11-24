---
description: What was reviewed, what was found, what was fixed, and what is still open.
---

# Security reviews

Forewit's contracts hold no funds, take no approvals and cannot be upgraded. The main thing to protect is the integrity of each track record. This page lists every review, its findings and their status.

{% hint style="info" %}
The reviews below were run by separate AI agents working from a fresh context, each told to find and then try to refute issues. They are not audits by a human security firm. The full reports are in the repository so you can judge them yourself.
{% endhint %}

## Summary

* Open High findings: 0. Open Medium findings: 0.
* Both contracts are live on BSC mainnet and verified on BscScan and Sourcify (exact match).
* Accepted risks are listed plainly in [Threat model and accepted risks](threat_model.md).

## ForecastLedger reviews

### First review, 23 Nov 2026

[`security_review/REPORT.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/REPORT.md). 30 items examined, 26 confirmed: 0 High, 1 Medium, 8 Low, 17 Info.

* M1, Medium: the round manager could withhold the market baseline after seeing reveals and outcomes, erasing the round's skill for everyone. **Fixed in v1.2**: the baseline is now posted in clear, once, only in the last 15 minutes before the commit deadline, before any reveal or outcome exists.
* L1: the round manager chooses the baseline values. **Mitigated**: raw order books archived, rounds without a baseline flagged, operator wallets never ranked.
* L2, L3: a burned or reissued Agent ID could give one person two addresses. **Mitigated and open**: the indexer flags `identityChanged`; whether burn or reissue is possible is an open question to the organizers (risk R4).
* L4: an early or stale baseline. **Fixed** (early half); the "last look" half is bounded to the 15 minute window.
* L5, L6, L7: seal and void timing. **Accepted** as risks R1, R2, R3.
* L8: the pauser role stayed with an old admin after an admin transfer. **Fixed in v1.2**.

### Delta review of v1.2, 23 Nov 2026

[`security_review/DELTA_REPORT.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/DELTA_REPORT.md). No new High or Medium. Verdict: safe to deploy given the accepted risks.

* Finding 1, Low: a missed 15 minute baseline window is permanent, and the round scores skill 0 for everyone. **Accepted**, with keeper retries and alerts.
* Finding 2, Low or Info: a forecaster can copy the market inside the 15 minute window. **Accepted and disclosed**.
* Finding 3, Info: stale comments and wording. **Fixed** before the mainnet deploy.
* Finding 4, Info: the invariant suite never ran paused or with a baseline. Pause is now part of the invariant suite; baseline coverage there is not confirmed.

### Mainnet build review, 24 Nov 2026

[`security_review/MAINNET_DELTA.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/MAINNET_DELTA.md). Open High 0, open Medium 0.

* L1, Low: the deploy script could let the deployer end with every role. **Fixed in the deploy script** (the verified contract source did not change). After the deploy the roles were read back onchain: the deployer holds no role.
* L2, Low: whoever seals first decides about a question that resolves after the deadline. **Accepted** as R2.
* I1 to I5, Info: wording, a full round fork test (refreshed and passing since), and trust assumptions on allowlisted contracts.

## ForewitScores review, 24 Nov 2026

[`security_review/SCORES_REVIEW.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/SCORES_REVIEW.md). Open High 0, open Medium 0, 3 Low.

* L1: a reissued name could carry the old score through the gate. **Narrowed**: `ForewitGate` now also requires `ForecastLedger.profileLabelId(caller) == tokenId`. A residual window remains until the next root. Stays Low.
* L2: the keeper key alone could revoke every historical root. **Fixed**: the keeper can revoke only the newest two epochs; only the admin can revoke older ones.
* L3: the keeper's self check used the same RPC as its build. **Process change**: build on one provider, recompute on a second, cross check every leaf against `getStats`. Implemented in the keeper, not independently reviewed.
* I1 to I6, Info: a pass survives a revoke, `MAX_AGE` measures post time, recompute edge cases, opt out is not retroactive, example gate details. **Open** as Info.

A delta review of the fixes (commit 40a8373) found no High or Medium. Its D1 finding (the indexer missed some token moves) was then fixed in the indexer; that fix has a test but was not reviewed again.

## Tools and tests

Recorded 24 Nov 2026:

* Foundry: 126 tests pass, BSC mainnet fork tests included. Coverage 100% on ForecastLedger, ForewitScores and ForewitGate.
* Slither: 0 High, 0 Medium in our code. Every Low and Info item is triaged in [`docs/SECURITY.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/SECURITY.md).
* Aderyn (in CI): 2 High, 10 Low reported on ForecastLedger, all triaged as false positives or by design.
* Golden vectors: 15 values asserted in both JavaScript and Solidity.
* Node tests: agent 65, MCP 27, keeper 19, indexer 21; web 40.

## Report a problem

Open an issue on [GitHub](https://github.com/owaisahmad870/forewit/issues).
