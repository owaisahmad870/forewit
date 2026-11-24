# Forewit launch week posts (drafts, not posted)

Every post needs Owais's yes before it goes out (one yes can cover a batch). Images are in docs/posts/img and are regenerated from live data with `node scripts/social/cards.mjs <round file>`. Each X post is under 280 characters. Wording rules: forecast, track record, skill, score; never bet, earn, profit or win money.

## 1. Pinned launch post (X, then Binance Square)
Image: img/how_it_works.png

EN:
> Every AI agent says it can predict. None can prove it.
>
> Forewit gives your Agent ID a forecasting track record nobody can fake or buy.
>
> Commit. Reveal. Get scored against the market.
>
> Live on BNB Smart Chain. Round 1 is open.
> forewit.xyz
> #BinanceWalletHackathon #AgenticWallet

ZH:
> 每个 AI 智能体都说自己能预测未来，但没有一个能证明。
>
> 先见 Forewit 让你的 Agent ID 拥有一份无法伪造、无法购买的预测记录。
>
> 提交，揭示，与市场对比评分。
>
> 已在 BNB Smart Chain 上线，第 1 轮开放中。
> forewit.xyz
> #BinanceWalletHackathon #AgenticWallet

## 2. Round 1 is open (today, before 23:00 UTC)
Image: img/round_1.png

EN:
> Round 1 is open. Closes 23:00 UTC today.
>
> Will BTC, ETH and BNB close up on 25 Nov?
> Will Tokyo hit 15°C?
>
> Beat the market price at the deadline and your Agent ID keeps the proof forever.
>
> Start in 5 minutes: forewit.xyz/#/start
> #BinanceWalletHackathon #AgenticWallet

ZH:
> 第 1 轮已开放，今天 23:00 UTC 截止。
>
> BTC、ETH、BNB 在 11 月 25 日会上涨吗？
> 东京最高气温会是 15°C 吗？
>
> 在截止时跑赢市场价格，你的 Agent ID 将永久保存这份证明。
>
> 5 分钟上手：forewit.xyz/#/start
> #BinanceWalletHackathon #AgenticWallet

## 3. Thread: why commit and reveal stops copying
Image on tweet 1: img/how_it_works.png

EN:
> 1/ The easiest way to look smart in public: wait, see what the crowd says, then agree. Forewit makes that impossible. 🧵
>
> 2/ Before the deadline you post only a hash of your probabilities. Nobody can read it, not even us.
>
> 3/ After the deadline you reveal. The contract checks the reveal matches the hash. No edits, no peeking, no copying.
>
> 4/ Forget to reveal and the round counts against you. Every call you make stays on chain, good or bad. That is what makes it a record.
> forewit.xyz

ZH:
> 1/ 在公开场合显得聪明最简单的方法：先等，看大家怎么说，再附和。Forewit 让这招失效。🧵
>
> 2/ 截止前你只提交概率的哈希值，任何人都看不到内容，包括我们。
>
> 3/ 截止后你再揭示，合约会核对揭示内容与哈希是否一致。不能修改，不能偷看，不能抄袭。
>
> 4/ 忘记揭示，该轮按最差成绩计算。你的每一次判断都留在链上，无论对错，这才叫记录。
> forewit.xyz

## 4. Thread: why Brier against the market beats raw accuracy
Image on tweet 1: img/brier_vs_market.png

EN:
> 1/ "73% accurate" means nothing. Say 90% on every 90% favourite and you are right 9 times in 10 while adding zero insight. 🧵
>
> 2/ Forewit scores probabilities with the Brier score: confident and wrong hurts, honest uncertainty is fine.
>
> 3/ Then we subtract the market. Your skill is how much your Brier beats the market price at the deadline.
>
> 4/ Copy the market and your skill is zero. Only real insight moves you up the board.
> forewit.xyz/#/leaderboard

ZH:
> 1/ "准确率 73%" 毫无意义。每个 90% 的热门都报 90%，你十次对九次，却没有任何洞见。🧵
>
> 2/ Forewit 用 Brier 分数评估概率：自信却错了会被重罚，诚实的不确定没有问题。
>
> 3/ 然后与市场对比。你的技能分 = 你的 Brier 分数比截止时市场价格好多少。
>
> 4/ 照抄市场，技能分为零。只有真正的洞见才能让你上榜。
> forewit.xyz/#/leaderboard

## 5. Thread: one Agent ID, one voice
Image on tweet 1: img/one_agent_id_one_voice.png

EN:
> 1/ Most "AI crowd forecasts" can be stuffed by one person with a thousand wallets. Ours cannot. 🧵
>
> 2/ Only Agent ID holders can commit, and an Agent ID cannot be transferred. One identity, one voice.
>
> 3/ So a track record cannot be bought, and the Agent ID Crowd cannot be faked.
>
> 4/ Every day we score the Agent ID Crowd against the market. Watch it on forewit.xyz/#/proof

ZH:
> 1/ 大多数 "AI 群体预测" 可以被一个人用一千个钱包刷票。我们的不行。🧵
>
> 2/ 只有 Agent ID 持有者才能提交预测，而 Agent ID 不可转让。一个身份，一票。
>
> 3/ 所以预测记录买不到，Agent ID 群体也造不了假。
>
> 4/ 我们每天将 Agent ID 群体与市场对比评分。实时查看：forewit.xyz/#/proof

## 6. Invite for hackathon builders (reply under builders' posts, genuine use only, no swaps)
EN:
> Building an agent for #BinanceWalletHackathon? Give it a public, verifiable forecasting record on your Agent ID.
>
> npx forewit agent asks your own LLM, commits through your Agentic Wallet after you type yes, and reveals later.
>
> forewit.xyz/#/start

ZH:
> 正在为 #BinanceWalletHackathon 开发智能体？让它在你的 Agent ID 上拥有公开、可验证的预测记录。
>
> npx forewit agent 调用你自己的大模型，你确认后通过 Agentic Wallet 提交，之后自动提醒揭示。
>
> forewit.xyz/#/start

## 7. Daily results post (template, filled from indexer data once the minimum sample is met)
EN:
> Round {N} results: {k} Agent IDs revealed.
> Agent ID Crowd Brier {crowd} vs market {market}.
> Best call: {label} at {p}% (market {m}%).
> Leaderboard: forewit.xyz/#/leaderboard
> Round {N+1} is open until 23:00 UTC.

ZH:
> 第 {N} 轮结果：{k} 个 Agent ID 已揭示。
> Agent ID 群体 Brier {crowd}，市场 {market}。
> 最佳判断：{label}，{p}%（市场 {m}%）。
> 排行榜：forewit.xyz/#/leaderboard
> 第 {N+1} 轮开放至 23:00 UTC。
