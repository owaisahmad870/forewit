# Demo video outline (Forewit, 2 to 3 minutes)

Summary: a 2 minute 55 second submission video that opens with a 10 second story (a forecasting track record nobody can fake or buy, because it is tied to a non transferable Agent ID) and then walks one real round from commit to score.
Each scene lists time, what is on screen, the voiceover, the judging criteria it serves, and whether it can be recorded now on testnet or needs mainnet (after the canary round in docs/MAINNET_CHECKLIST.md step 6).

## Ground rules for the recording
* The line "Forecasting scores only. Not financial advice." stays on screen as a small lower third for the whole video, and again on the end card.
* Every number shown must come from the live dashboard or chain on recording day. Write no number into the voiceover in advance; fill the brackets below from the dashboard.
* Any shot that shows sample or testnet data keeps the site's "Sample data" badge visible and gets a caption "Testnet" or "Sample data". Never present sample numbers as real results.
* Never show a seed phrase, private key, pairing code, salt or reveal receipt. Crop the terminal so the salt line is out of frame.
* Every transaction in the video is confirmed by a human typing yes. The agent never sends on its own.
* Labels used below: NOW means it can be recorded today on testnet or with sample data. MAINNET means it needs the mainnet ledger and comes after the canary round passes.

## Criteria map (judges' weights)
* Agent ID depth (30%): scenes 1, 2, 3, 5, 8 and 10. Identity is the product: the commit gate, the track record, the crowd.
* Practicality (25%): scenes 4, 5 and 9. A real user, a real agent, a real wallet, two minutes a day, no funds held.
* Completion (25%): scenes 4 to 11. Live contracts, live rounds, scoring with no manual edits, bilingual site, security work.
* Innovation (20%): scenes 1, 6 and 8. A record that cannot be bought, skill against the market price, a sybil resistant crowd compared with the market.

## Scene 1: the 10 second story (0:00 to 0:10)
* On screen: black frame, then the Forewit mark (a forecast on the 0 to 1 scale) and one line typed out: "A forecasting track record nobody can fake or buy." Cut to a leaderboard row: a forecaster, their skill against the market, their rounds.
* Voiceover: "Anyone can claim they called it. Forewit proves it: forecasts locked before the deadline, scored against the market, tied to an Agent ID nobody can sell."
* Criteria: innovation, Agent ID depth.
* Recording: NOW for the title card. The leaderboard cut uses sample data with the sample badge, or MAINNET once a real forecaster is ranked.

## Scene 2: the problem (0:10 to 0:25)
* On screen: three quick cards. "Screenshots after the fact." "Track records for sale." "A thousand wallets, one person." Each card gets a red strike through as the voiceover names it.
* Voiceover: "Forecasting reputations today are easy to fake. People post calls after the fact, buy accounts with a history, or run hundreds of wallets so one of them looks brilliant. And a crowd made of fake accounts tells you nothing."
* Criteria: innovation, practicality (a real problem).
* Recording: NOW (motion graphics only).

## Scene 3: the Agent ID check at commit (0:25 to 0:45)
* On screen: split screen. Left, the verified ForecastLedger source on BscScan with the commit gate highlighted (`AGENT_ID.balanceOf(msg.sender) == 0` reverts). Right, `baw wallet agent-id --json` in a terminal showing `claimed: true`. Caption: "One Agent ID per Binance user. Non transferable."
* Voiceover: "Forewit only accepts a forecast from a wallet that holds a Binance Agent ID. An Agent ID is one per person and cannot be transferred, so a track record cannot be bought, and a crowd cannot be faked with extra wallets."
* Criteria: Agent ID depth.
* Recording: the `baw wallet agent-id` shot is NOW (read only). The source shot is NOW from testnet instance E (same code, verified on BscScan testnet), and should be swapped for the MAINNET verified contract after deploy. Testnet uses a mock Agent ID contract, so the real gate against the real Agent ID is MAINNET only.

## Scene 4: a live round on the site (0:45 to 1:05)
* On screen: forewit.xyz home on a phone frame. The current round card: countdown to the commit deadline, each question shown as its event question plus option (for example "Highest temperature in Shenzhen on November 24?" with "24°C"), the market price, the number of commits. Tap into the round page.
* Voiceover: "Every day Forewit opens a round of real questions from Predict.fun, the prediction markets inside Binance Wallet. Crypto prices, weather, macro. No sports, no politics. The selection rule is published before the round opens and never changes after."
* Criteria: completion, practicality.
* Recording: NOW with sample or testnet data (badge visible). Rerecord on MAINNET with a real round for the final cut.

## Scene 5: an agent commits through the Binance Agentic Wallet (1:05 to 1:40)
* On screen: Claude Code with the Forewit skill (agent/SKILL.md). The user types: "Show me today's Forewit round and help me commit." Claude runs the preflight (signed in, Agent ID claimed, Developer Mode on), lists the questions, and the user gives probabilities, for example 72, 15 and 50. Claude prints the wallet preview: target is the pinned ledger, value 0, simulation passed, risk flags. Claude stops and asks. The user types yes. The transaction hash appears; cut to it on BscScan, sent from the Agent ID wallet. Alternative take: the same flow in a terminal with `node agent/forewit.mjs commit --execute`, which asks for the typed yes itself.
* Voiceover: "You can play with any agent. Here Claude uses the Forewit skill and the Binance Agentic Wallet. It checks your Agent ID, helps you think, and prepares a commit: a hidden hash of your probabilities. Nothing is sent until you read the preview and say yes. Value zero, the only cost is gas."
* Criteria: practicality, Agent ID depth, completion.
* Recording: the dry run (round, forecast, and the printed `baw` commands) is NOW. The preview, the yes and the BscScan transaction are MAINNET: the Agentic Wallet works on BSC mainnet only and the CLI refuses `--execute` without the pinned mainnet ledger.

## Scene 6: reveal and scoring against the market (1:40 to 2:00)
* On screen: after the deadline, the user asks Claude to reveal; same preview and yes. Then the round page after resolution: each question shows its outcome, the market price at the deadline, the crowd and the histogram of revealed forecasts. Then the user's own Brier and skill: the Scored event on BscScan, or their leaderboard row if they opted in. Overlay the formula: "Skill = market Brier minus your Brier."
* Voiceover: "Minutes before the deadline, the market price is posted onchain as the baseline. After the deadline, you reveal. When the markets resolve onchain, the contract scores everyone with the Brier score and compares it with the market. Copying the market scores zero skill. Only real information scores above it. No manual edits, ever."
* Criteria: innovation, completion.
* Recording: the scored round page is NOW with testnet data (testnet instance E has run end to end through the keeper). The real reveal and the real scored round are MAINNET.

## Scene 7: leaderboard and calibration (2:00 to 2:12)
* On screen: the leaderboard: rank by shrunk skill, Brier, calibration error, rounds, participation. Then a profile's reliability diagram (10 bins with the diagonal), if it is live by then; otherwise stay on the calibration error column.
* Voiceover: "Rank uses skill against the market, shrunk for small samples, and only people who opt in are listed. Calibration shows whether your seventy percent really happens seventy percent of the time."
* Criteria: completion, practicality.
* Recording: NOW with sample data (badge visible). MAINNET for real forecasters, after at least 5 scored rounds so someone is ranked.

## Scene 8: Agent ID Crowd versus Market (2:12 to 2:25)
* On screen: the home headline card: "Agent ID Crowd vs Market", Brier for each over [n] questions, the two bars, and the verdict line, whichever way it goes. Then the Agent ID Crowd page with the per round table.
* Voiceover: "Because every Agent ID is one real person, the forecasts add up to a crowd you can trust. Forewit compares this Agent ID Crowd with the market every round, and shows the result even when the market is ahead."
* Criteria: innovation, Agent ID depth.
* Recording: NOW with sample data (badge visible). MAINNET for the real comparison; read [n] and both Brier values from the dashboard on the day.

## Scene 9: bilingual site (2:25 to 2:33)
* On screen: tap the 中文 button in the header. The whole site switches: the brand reads Forewit 先见, the round, the leaderboard and the risk warning appear in Simplified Chinese. Toggle light and dark once.
* Voiceover: "Forewit is fully bilingual, English and Simplified Chinese, and built for phones first."
* Criteria: completion, practicality (reach).
* Recording: NOW.

## Scene 10: security and trust (2:33 to 2:45)
* On screen: four quick cards, each with its source on screen. "Independent security review: report and fixes published" (security_review/ in the repo). "Verified on BscScan" (the contract page). "Owner permissions: no upgrades, no edits to scores or outcomes, pause never blocks a reveal" (the README section and the Owner permissions page). "Holds no funds. Value 0 on every transaction." Then the distinct holders counter: "[distinct Agent ID holders] forecasters, [rounds] rounds."
* Voiceover: "Verified, non upgradeable, no funds held. Nobody, not even the owner, can edit a score or an outcome, and pause never blocks a reveal. The independent review is public."
* Criteria: completion, practicality.
* Recording: the review, permissions and no funds cards are NOW. Before recording, confirm docs/SECURITY.md shows no open High or Medium and say only what it says. "Verified on BscScan" and the holder counter are MAINNET.

## Scene 11: close (2:45 to 2:55)
* On screen: end card with the Forewit mark, "A forecasting track record nobody can fake.", forewit.xyz, @forewitai, "Built on Binance Agent ID and BNB Smart Chain", and the risk line "Forecasting scores only. Not financial advice." in full size.
* Voiceover: "Forewit. Your forecasts, your Agent ID, a record nobody can fake. Play today's round at forewit.xyz, and follow @forewitai."
* Criteria: all (the 10 second story, repeated).
* Recording: NOW.

## Shot list by readiness
* NOW (testnet or sample data): scenes 1, 2, 9, 11; the title and problem cards; the `baw wallet agent-id` read; the testnet verified source; the CLI dry run; the site pages for scenes 4, 6, 7 and 8 with the sample badge visible; the review and permissions cards.
* MAINNET (after the canary round passes): the real commit gate; the Agentic Wallet preview, typed yes and BscScan transaction for commit and reveal; a real scored round; real leaderboard, calibration and crowd numbers; the mainnet verified contract; the distinct holder counter.
* Plan: record the NOW shots this week as a rough cut, then replace each sample shot with its mainnet version as soon as real rounds are scored, leaving time to file at least 24 hours before the deadline.
