# Forewit baseline for crypto Up or Down questions

**Summary:** for a daily "Bitcoin (Ethereum, BNB) Up or Down" question, `forewit plan` suggests a chance from price alone: how far the coin has moved since the window started, against its typical volatility. Over one year it scored Brier 0.214 at our commit deadline against 0.25 for a coin flip (n 1092, about 9 standard errors better) and is calibrated within noise. It is a floor to beat, not an edge over the market.

## The rule it predicts
Predict.fun daily Up or Down (market rules, read 26 Nov 2026): Up if the Binance spot 1 minute "Close" for the 12:00 ET candle on day D is higher than the one for 12:00 ET on day D minus 1; equal closes resolve 50/50. Our daily round closes commits at 23:00 UTC, which is 6 hours after the window starts in winter (7 in summer).

## The model (agent/lib/baseline.mjs)
* Before the window starts: 50%.
* After: P(Up) = Phi(ln(now / start) / (sigma x sqrt(minutes left))), sigma per minute from the last 7 days of hourly closes. A driftless random walk, so it is calibrated by construction if volatility is right.
* Clamped to 2% to 98%. Prices from data-api.binance.vision (Binance public market data, no key), fallback api.binance.com.

## Evidence (scripts/research/baseline_backtest.mjs, run 26 Nov 2026)
* Data: BTCUSDT, ETHUSDT, BNBUSDT, 27 Nov 2025 to 25 Nov 2026, 1092 question days; price at each check time is the last closed hourly close.
* Brier by hours after the window start (lower is better; 50/50 always scores 0.25):
  * 0.5 h: 0.2508 (SE 0.0005)
  * 3 h: 0.2288 (SE 0.0035)
  * 6 h (our winter deadline): 0.2142 (SE 0.0041)
  * 12 h: 0.1824 (SE 0.0054)
  * 18 h: 0.1446 (SE 0.0061)
  * 23 h: 0.0580 (SE 0.0049)
* Calibration error at 6 h: 4.4 points. A perfectly calibrated model with the same forecasts scores 3.0 on average and 4.55 at the 95th percentile at this sample size, so 4.4 is within noise.
* Volatility scale: picked 0.8 on the older half, no clear gain on the newer half (0.2144 vs 0.2152 at 6 h), so the shipped model keeps 1.0 (untuned).

## Pre registration and what changed
* Gate written before the run: ship if Brier below 0.245 and calibration error below 3 points. Brier passed by a wide margin. The calibration threshold turned out to be below the metric's own noise floor at n 1092 (3.0 for a perfect model), so it was replaced by "within the 95th percentile of a perfectly calibrated model", which it passes. Logged in notes/ledger.md.

## Limits (read before relying on it)
* Not yet compared with the Predict.fun market price at the same moment. The market sees the same price move, so expect the baseline to be close to the market, not better. Beating the market needs information the price walk does not have.
* Fat tails and volatility jumps (news) are not modelled.
* Before the window starts (the round opens about 03:10 UTC, the window at 17:00 UTC in winter) it says 50%. Forecast near the deadline for the most informed baseline: `forewit plan` sets `next.at` to the deadline minus 30 minutes.
