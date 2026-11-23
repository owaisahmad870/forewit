# Keeper host (BSC mainnet)

The keeper runs on a small VPS with systemd timers, so it never depends on a personal PC. Approved by Owais 23 Nov 2026.

## What runs when (UTC)
* 03:00 daily: `keeper.mjs daily` selects (rule v3.1) and opens the daily round, commit deadline 23:00 UTC the same day.
* 22:57 daily: `keeper.mjs baseline` snapshots the order books and commits the baseline (refuses outside the last 5 minutes).
* Every 15 minutes: `keeper.mjs tick` seals and reveals the baseline after the deadline, finalizes resolved questions, scores finished rounds.
* Every 30 minutes: `keeper.mjs watchdog` checks every duty of the last 15 rounds from chain state and alerts on anything missed. GitHub Actions runs the same read only check every 30 minutes as an independent second watchdog (.github/workflows/watchdog.yml).

## Alerts
* Telegram: the keeper posts failures and missed duties to a Telegram chat (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
* Dead man's switch: each scheduled job pings its own healthchecks.io check on success (HC_PING_DAILY, HC_PING_BASELINE, HC_PING_TICK, HC_PING_WATCHDOG) and the /fail URL on failure. If a ping does not arrive in time (host down, timer broken), healthchecks.io alerts through its Telegram integration.
* Missed duty detection is unit tested: keeper/test/watchdog.test.mjs.

## Cost (check current prices before ordering)
* VPS: Hetzner CX22 (2 vCPU, 4 GB) about 4 to 5 EUR per month; DigitalOcean or Vultr basic droplet about 6 USD per month.
* healthchecks.io: free tier (20 checks). Telegram bot: free. GitHub Actions watchdog: free while within the plan minutes (about 2 minutes per run, 48 runs a day: about 2,900 minutes a month on a private repo, so either make the repo public at submission or reduce the GitHub watchdog to hourly while private; the free private quota is 2,000 minutes).
* BNB for keeper gas: a daily round is about 0.25 M gas to open, 0.05 M baseline, 0.1 M seal and reveal, 0.05 M per finalize, plus scoring; well under 0.001 BNB per day at 0.05 gwei.

## Setup steps (Owais)
1. Create the VPS: Ubuntu 24.04 LTS, SSH key login only, no password login. Note its IP.
2. On the VPS as root: `ssh-keygen -t ed25519 -f /root/.ssh/prescient_deploy -N ""`, add the public key to github.com/owaisahmad870/prescient as a read only deploy key, and add a `Host github.com` entry using that key in /root/.ssh/config.
3. Copy keeper/deploy/install.sh to the VPS and run `bash install.sh git@github.com:owaisahmad870/prescient.git`. First run installs Node 26.13.1 (checksum verified), the code, npm dependencies and the units, then stops before enabling timers.
4. Create the encrypted credential (keys never written in plain text to disk for long):
   * write /root/keeper.env with: LEDGER_MAINNET, MAINNET_KEEPER_PRIVATE_KEY (the fresh mainnet keeper key, backed up offline), KEEPER_CONFIRM_MAINNET=yes, PREDICT_API_KEY, BSC_RPC_URL (keyed), LOGS_RPC_URL (optional), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HC_PING_DAILY, HC_PING_BASELINE, HC_PING_TICK, HC_PING_WATCHDOG;
   * `systemd-creds encrypt --name=keeper.env /root/keeper.env /etc/prescient/keeper.env.cred && shred -u /root/keeper.env`;
   * the file is decrypted only into the service's private credentials directory while a job runs.
5. Rerun `bash install.sh ...` to enable the four timers; `systemctl list-timers 'prescient*'` shows the schedule.
6. healthchecks.io: create four checks (daily: period 1 day, grace 1 hour; baseline: period 1 day, grace 10 minutes; tick: period 15 minutes, grace 10 minutes; watchdog: period 30 minutes, grace 15 minutes), connect the Telegram integration, put the ping URLs in step 4.
7. GitHub: repository variable LEDGER_MAINNET, secrets TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, optional BSC_RPC_URL and HC_PING_WATCHDOG_GH.
8. Before mainnet: run a full testnet round on the VPS (same units with `--network testnet` and the testnet ledger) and confirm a deliberately skipped baseline raises a Telegram alert.

## Update the keeper
* `cd /opt/prescient/app && git pull --ff-only && PATH=/opt/prescient/node/bin:$PATH npm ci` (or rerun install.sh). Rules never change while a round is open.
