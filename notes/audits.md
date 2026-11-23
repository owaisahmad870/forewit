# Audits, validator and loss map

**Summary (read first):**
* Validator for the judged track: a fresh context reviewer scores the live product on the rubric (Agent ID depth 30, practicality 25, completion 25, innovation 20) with cited evidence, before each milestone. No run yet.
* Hard gate validator: our own log based count of distinct Agent ID holders calling commit (must reach 30; stretch 150).
* One advisor audit so far (23 Nov 2026, bootstrap).

## Validator (what it retrodicts)
* Rubric reviewer: not yet run. It cannot retrodict past results (no public scores), so treat it as a checklist scorer, not a predictor. Log every score with date and evidence.
* Holder gate: count distinct msg.sender of Committed events on our contract where Agent ID balanceOf > 0 at the block. Cross check against BscScan once deployed.

## Loss map (where points are lost)
* 23 Nov 2026 baseline: 0 of 30 holders, 0 of 7 rounds, no live product. Largest risk is distribution (the 30 holder gate) and the baw Developer Mode friction, not the contract.

## Audits (advisor)
* 23 Nov 2026, bootstrap audit:
  * House rule (no hyphens, no tables) overrides the Aurum templates: all notes use "*" bullets.
  * My first EIP1967 slot constant was wrong (false negative). Recomputed: Agent ID and CTFs have no proxy slots; ERC8004 registries are EIP1967 proxies.
  * Asked to log Yes slot, YB mapping, label hash, non transferability and API resolution as hypotheses with evidence counts. Done in knowledge.md; YB neg risk mapping and 3 more label hashes then checked and passed.
  * Biggest blocker today is the missing toolchain (forge, cast, anvil, Slither, Aderyn, Python): no Solidity until it is installed.
* 23 Nov 2026, selection rule options (data: top 500 open mainnet markets by 24 h volume, commit deadline 20 h out, binary, two sided, spread <= 0.10, volume >= 100 USD):
  * Liquid supply by time from deadline to category endsAt: before deadline 113 (crypto up/down and same day sports), 0 to 12 h 29, 12 to 24 h 2, 24 to 72 h 12 (7 events, all sports, 8.3k USD 24 h volume), 3 to 7 days 13, over 7 days 96 (event markets, 125k USD).
  * Daily crypto markets "Bitcoin/Ethereum/BNB Up or Down on <D>": created D minus 2 at 17:00 UTC, measured from D minus 1 17:00 to D 17:00 UTC; BTC has about 52k USD 24 h volume on its live day.
  * Options put to Owais: A window 6 to 72 h (daily BTC, ETH, BNB plus sports), B keep 24 to 72 h with a volume floor (sports only), C crypto only. Recommended A. Long dated event markets cannot be used: scoring needs every question resolved onchain.
* 23 Nov 2026, full census (all 17,303 open mainnet markets, 4,928 categories, deadline 20 h out): rule v1 window holds 4,493; names 3,006; two sided 777; spread <= 0.10: 657, all sports; only 14 have >= 100 USD 24 h volume (9 events). Confirms rule v1 cannot supply 5 liquid questions a day; supports v2.
