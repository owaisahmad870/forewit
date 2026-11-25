---
description: What Forewit makes public, what stays on your computer, and what never leaves it.
---

# Privacy

A blockchain is public. Forewit tries to make only what it must public, and keeps your name off it unless you choose otherwise.

## Public onchain (anyone can see)

* Your wallet address, and that it committed to a round. Committing requires holding an Agent ID, so it is public that this wallet holds one.
* Your commit hash. It reveals nothing until you reveal.
* After the commit deadline, your revealed probabilities.
* Your scores and cumulative stats (`getStats`).

## Public only if you opt in

* Your Agent ID name next to your record, on the leaderboard and in ForewitScores. You opt in with `profile --label <name>` or the MCP tool `prepare_profile`. Opt out with `--off`; opting out always clears the name.
* Only opted in holders get a ForewitScores leaf. A leaf is keyed by `keccak256(name)`, so anyone can hash your name and find your score. That is the point of opting in.
* Opting out is not retroactive. Earlier leaves files and the onchain profile event keep the name to wallet link.

Forewit never offers a way to look up a wallet by name for people who have not opted in.

## On your computer only

* Your salts and reveal receipts, in `~/.forewit/`, readable only by your account (mode 0600 on Linux and macOS, an owner only access list on Windows, checked after writing).
* The CLI never uploads a salt or your forecast before you send the commit. If you turn on auto reveal (opt in), the commit carries a copy locked with the drand time lock until just after the deadline: nobody, Forewit included, can read it earlier.
* The MCP server never shows a salt to your assistant before the commit deadline.

## What goes where

* **Your AI model** (`forewit agent`): only the question texts, the current time and the commit deadline. Never your salt, wallet or receipt. You choose the provider; their terms apply.
* **BSC RPC**: the CLI reads the chain through a public RPC (`bsc-rpc.publicnode.com` by default). The RPC provider sees your IP address and the calls.
* **Binance Agentic Wallet**: signing happens in `baw` and the Binance App, under Binance's terms. Forewit never sees your keys, session or pairing code, and never asks for them.
* **The website**: a static site on Cloudflare Pages. It loads JSON from its own `data/` folder. We found no analytics or tracking scripts in its code. It stores your language and view choices in your browser's local storage. Cloudflare, as the host, processes requests under its own policy.

## What Forewit never collects

Seed phrases, private keys, API secrets, session tokens or pairing codes. If anyone asks you for one in Forewit's name, it is not us.
