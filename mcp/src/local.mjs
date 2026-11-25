// Forewit local MCP server (stdio), run on each user's own machine or own cloud sandbox. Prepares commit, reveal and
// profile transactions and lists local receipts. The wallet tools run that user's own Binance Agentic Wallet CLI (baw):
// sending needs two human approvals the model cannot give, a confirmation form shown by the MCP client (elicitation)
// and, when the wallet asks for it, approval in the Binance App. Forewit never holds a key or a wallet session.
// Network access: the pinned public RPC (read only eth_call) and baw. Logs go to stderr only.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  network, loadRound, chainNow, commitPlan, revealPlan, parseProbabilities, findReceipts, receiptDir, bawPreview,
} from '../vendor/agent/forewit.mjs';
import { selector, wordBool, wordUint } from '../vendor/agent/lib/keccak.mjs';
import { NETWORKS, DEFAULT_NETWORK, BAW_CHAIN_IDS, RISK_WARNING } from '../vendor/agent/config.mjs';
import { ok, guarded, paginate, cursorInput, address, roundId, VERSION } from './common.mjs';
import { runBaw, sendWithConfirmation } from '../vendor/agent/lib/baw.mjs';

const ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const networkInput = z.enum(['mainnet', 'testnet']).optional().describe(`Network, default ${DEFAULT_NETWORK}.`);
const iso = (s) => (s == null ? null : new Date(s * 1000).toISOString());

/** setPublicProfile(bool,string) calldata: a bool word, the string offset (0x40), then length and right padded UTF8 bytes. */
export function profileCalldata(isPublic, label) {
  const bytes = Buffer.from(label, 'utf8');
  const padded = Buffer.concat([bytes, Buffer.alloc((32 - (bytes.length % 32)) % 32)]);
  return selector('setPublicProfile(bool,string)') + wordBool(isPublic) + wordUint(64) + wordUint(bytes.length) + padded.toString('hex');
}

const txShape = z.object({
  chain_id: z.number().int(),
  to: z.string(),
  value: z.literal('0'),
  data: z.string(),
});
const walletShape = {
  transaction: txShape,
  baw_preview_command: z.string().describe('Binance Agentic Wallet preview command for this exact transaction. Preview only; executing needs the wallet owner.'),
  baw_can_sign_this_network: z.boolean().describe(`baw signs on chain ${BAW_CHAIN_IDS.join(', ')} only.`),
  risk_warning: z.string(),
};

function walletPart(net, from, data) {
  return {
    transaction: { chain_id: net.chainId, to: net.ledger, value: '0', data },
    baw_preview_command: bawPreview({ chainId: net.chainId, from, to: net.ledger, data }),
    baw_can_sign_this_network: BAW_CHAIN_IDS.includes(net.chainId),
    risk_warning: RISK_WARNING,
  };
}

const hex = (bytes) => z.string().regex(new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`));
const seconds = z.number().int().nonnegative();
// Shape a receipt file must have to be listed; anything else is skipped with a warning.
const receiptFile = z.object({
  network: z.string(), chainId: z.number().int(), ledger: hex(20), roundId: z.number().int().positive(), forecaster: hex(20),
  commitHash: hex(32), salt: hex(32), probabilitiesBps: z.array(z.number().int()).optional(),
  commitDeadline: seconds.nullable(), revealDeadline: seconds.nullable().optional(), createdAt: z.string().optional(),
});

const roundInput = roundId.optional().describe('Round id, default the latest round on the ledger.');

/**
 * Salts never enter agent context before the commit deadline: with the salt and the forecast anyone could reveal or copy it.
 * Checks chain time on each receipt's pinned network. Throws (a tool error) if any listed round is still open for commits.
 * Returns the receipts whose deadline cannot be checked (unpinned ledger, for example a deprecated instance, or no deadline):
 * their salt is withheld with a warning instead of blocking every other backup.
 */
async function saltGate(receipts, warnings) {
  const nowByChain = new Map();
  const withheld = new Set();
  for (const r of receipts) {
    const net = Object.values(NETWORKS).find((n) => n.chainId === r.chainId && n.ledger && n.ledger.toLowerCase() === r.ledger.toLowerCase());
    if (!net || r.commitDeadline == null) {
      withheld.add(r);
      warnings.push({ file: r.file, reason: net ? 'no commit deadline in the receipt; salt withheld' : 'ledger is not a pinned Forewit ledger, so the commit deadline cannot be checked; salt withheld' });
      continue;
    }
    if (!nowByChain.has(net.chainId)) nowByChain.set(net.chainId, await chainNow(net));
    if (nowByChain.get(net.chainId) < r.commitDeadline) {
      throw new Error(`round ${r.roundId} is open for commits until ${iso(r.commitDeadline)}; salts stay local until then. Use prepare_reveal after the deadline, or filter with round_id.`);
    }
  }
  return withheld;
}

/** `home` is the folder that holds .forewit/ (default: the user's home directory). It is not a tool input. */
export function createLocalServer({ home } = {}) {
  const server = new McpServer({ name: 'forewit-local', version: VERSION, title: 'Forewit (local, prepares transactions)' });
  const tool = (name, config, fn, annotations = ANNOTATIONS) =>
    server.registerTool(name, { ...config, inputSchema: z.object(config.inputSchema).strict(), outputSchema: z.object(config.outputSchema), annotations: { ...annotations, title: config.title } }, guarded(fn));

  tool('prepare_commit', {
    title: 'Prepare a commit',
    description: 'Makes a random salt, saves the reveal receipt (salt included) in ~/.forewit with owner only access, and returns the commit hash, calldata and baw preview command. Probabilities are percentages, one per question, clamped to 1 to 99. The salt is not returned. Optional auto reveal (opt in, ask the user; recommended): with auto_reveal true a copy of the forecast and salt, locked until just after the commit deadline (drand quicknet), rides in the calldata and the Forewit keeper reveals it after the deadline, so the user needs no second step.',
    inputSchema: {
      from: address.describe('Agentic wallet address that will send the commit.'),
      probabilities_percent: z.array(z.number().min(0).max(100)).min(1).max(16),
      round_id: roundInput,
      network: networkInput,
      auto_reveal: z.boolean().optional().describe('Default false (opt in). True: Forewit reveals after the deadline from a time locked copy in the commit. False: the salt stays only on this machine and the user reveals after the deadline.'),
    },
    outputSchema: {
      network: z.string(), ledger: z.string(), round_id: z.number().int(), from: z.string(),
      commit_deadline: z.string(), reveal_deadline: z.string(), auto_reveal: z.boolean(),
      probabilities_bps: z.array(z.number().int()), clamped_indexes: z.array(z.number().int()),
      packed: z.string(), commit_hash: z.string(), already_committed: z.boolean(),
      receipt_file: z.string(), salt_returned: z.literal(false),
      ...walletShape,
    },
  }, async ({ from, probabilities_percent, round_id, network: name, auto_reveal = false }) => {
    const net = network(name);
    const { bps, clamped } = parseProbabilities(probabilities_percent.join(','));
    const loaded = await loadRound(net, round_id === undefined ? undefined : String(round_id));
    const { receipt, file, existing, data, autoReveal } = await commitPlan({ net, from, bps, home, loaded, autoReveal: auto_reveal });
    console.error(`forewit mcp: saved receipt for round ${loaded.id} at ${file}`);
    return ok({
      network: net.name, ledger: net.ledger, round_id: loaded.id, from,
      commit_deadline: iso(loaded.round.commitDeadline), reveal_deadline: iso(loaded.round.revealDeadline), auto_reveal: autoReveal,
      probabilities_bps: bps, clamped_indexes: clamped, packed: receipt.packed, commit_hash: receipt.commitHash,
      already_committed: existing, receipt_file: file, salt_returned: false,
      ...walletPart(net, from, data),
    });
  });

  tool('prepare_reveal', {
    title: 'Prepare a reveal',
    description: 'After the commit deadline and before the reveal deadline: finds the local receipt that matches the onchain commit and returns the reveal calldata (which contains the salt, as the reveal must) and baw preview command. Refused while commits are still open.',
    inputSchema: { from: address.describe('Wallet that made the commit.'), round_id: roundInput, network: networkInput },
    outputSchema: {
      network: z.string(), ledger: z.string(), round_id: z.number().int(), from: z.string(),
      already_revealed: z.boolean(), reveal_deadline: z.string(),
      probabilities_bps: z.array(z.number().int()).nullable(), commit_hash: z.string().nullable(), receipt_file: z.string().nullable(),
      transaction: txShape.nullable(), baw_preview_command: z.string().nullable(), baw_can_sign_this_network: z.boolean(), risk_warning: z.string(),
    },
  }, async ({ from, round_id, network: name }) => {
    const net = network(name);
    const loaded = await loadRound(net, round_id === undefined ? undefined : String(round_id));
    const plan = await revealPlan({ net, from, home, loaded });
    const base = { network: net.name, ledger: net.ledger, round_id: loaded.id, from, reveal_deadline: iso(loaded.round.revealDeadline) };
    if (plan.alreadyRevealed) {
      return ok({ ...base, already_revealed: true, probabilities_bps: null, commit_hash: null, receipt_file: null, transaction: null, baw_preview_command: null, baw_can_sign_this_network: BAW_CHAIN_IDS.includes(net.chainId), risk_warning: RISK_WARNING });
    }
    return ok({ ...base, already_revealed: false, probabilities_bps: plan.bps, commit_hash: plan.onchain, receipt_file: plan.receipt.file, ...walletPart(net, from, plan.data) });
  });

  tool('prepare_profile', {
    title: 'Prepare a profile change',
    description: 'Returns calldata and the baw preview command for setPublicProfile: opt in to the public leaderboard (optionally showing your Agent ID name, without .ai) or opt out. Opting out clears the name.',
    inputSchema: {
      from: address.describe('Wallet that holds the Agent ID.'),
      is_public: z.boolean(),
      label: z.string().regex(/^[a-z0-9_-]{1,64}$/, 'Agent ID name in lowercase letters, digits, underscore or hyphen, without .ai').optional(),
      network: networkInput,
    },
    outputSchema: { network: z.string(), ledger: z.string(), from: z.string(), is_public: z.boolean(), label: z.string(), ...walletShape },
  }, async ({ from, is_public, label = '', network: name }) => {
    const net = network(name);
    const shown = is_public ? label : '';
    return ok({ network: net.name, ledger: net.ledger, from, is_public, label: shown, ...walletPart(net, from, profileCalldata(is_public, shown)) });
  });

  tool('my_receipts', {
    title: 'My receipts',
    description: 'Lists reveal receipts saved in ~/.forewit. Returns metadata and file paths. include_salt adds each salt, and is refused while any listed round is still open for commits (chain time). Files that are not valid receipts are listed in warnings. Paginated, newest first.',
    inputSchema: {
      from: address.optional(),
      round_id: roundId.optional(),
      network: networkInput,
      include_salt: z.boolean().optional().describe('Include each salt, for a private backup after the commit deadline. Default false.'),
      ...cursorInput,
    },
    outputSchema: {
      folder: z.string(),
      receipts: z.array(z.object({
        file: z.string(), network: z.string(), chain_id: z.number().int(), ledger: z.string(), round_id: z.number().int(), forecaster: z.string(),
        commit_hash: z.string(), probabilities_bps: z.array(z.number().int()), commit_deadline: z.string().nullable(), reveal_deadline: z.string().nullable(),
        created_at: z.string().nullable(), salt: z.string().optional(),
      })),
      warnings: z.array(z.object({ file: z.string(), reason: z.string() })),
      next_cursor: z.string().nullable(),
    },
  }, async ({ from, round_id, network: name, include_salt = false, cursor, limit }) => {
    const filter = { forecaster: from, roundId: round_id };
    if (name) filter.chainId = network(name).chainId;
    const warnings = [];
    const found = [];
    for (const r of findReceipts(filter, home, warnings)) {
      const parsed = receiptFile.safeParse(r);
      if (parsed.success) found.push({ ...parsed.data, file: r.file });
      else warnings.push({ file: r.file, reason: `not a valid receipt (fields: ${[...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ')})` });
    }
    for (const w of warnings) console.error(`forewit mcp: skipped ${w.file}: ${w.reason}`);
    found.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { page, next_cursor } = paginate(found, { cursor, limit });
    const withheld = include_salt ? await saltGate(page, warnings) : null;
    return ok({
      folder: receiptDir(home),
      receipts: page.map((r) => ({
        file: r.file, network: r.network, chain_id: r.chainId, ledger: r.ledger, round_id: r.roundId,
        forecaster: r.forecaster, commit_hash: r.commitHash, probabilities_bps: r.probabilitiesBps ?? [],
        commit_deadline: iso(r.commitDeadline), reveal_deadline: iso(r.revealDeadline), created_at: r.createdAt ?? null,
        ...(include_salt && !withheld.has(r) ? { salt: r.salt } : {}),
      })),
      warnings,
      next_cursor,
    });
  }, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

  // Wallet tools: the signed in wallet is the user's own baw session on this machine or in this sandbox.
  const SEND = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };
  const walletAddress = () => {
    const a = (runBaw(['wallet', 'address', '--json'])?.data?.addresses ?? []).find((x) => String(x.binanceChainId) === '56')?.address;
    if (!/^0x[0-9a-fA-F]{40}$/.test(a ?? '')) throw new Error('the Agentic Wallet is not signed in or has no BSC address. Use wallet_sign_in first.');
    return a;
  };
  // the human gate: a form the MCP client shows to the person; the model cannot fill it in
  const humanIo = (log) => ({
    isTTY: () => true,
    log: (...l) => log.push(...l),
    ask: async () => {
      if (!server.server.getClientCapabilities()?.elicitation) {
        throw new Error('this client cannot show a confirmation form (MCP elicitation), so Forewit will not send. Run the command line in your own terminal instead: npx forewit@latest start');
      }
      const r = await server.server.elicitInput({
        message: ['Forewit: send this transaction from your Agentic Wallet?', ...log.filter((x) => x !== '').slice(-40)].join('\n').slice(0, 6000),
        requestedSchema: { type: 'object', properties: { confirm: { type: 'string', title: 'Type yes to send', description: 'Anything else cancels. Value is 0; only network gas is paid.' } }, required: ['confirm'] },
      });
      return r.action === 'accept' ? String(r.content?.confirm ?? '') : '';
    },
  });
  const sendOut = { status: z.enum(['BROADCASTED', 'PENDING_CONFIRMATION']), tx_hash: z.string().nullable(), note: z.string() };
  const sent = (status, log) => ({
    status, tx_hash: log.join('\n').match(/txHash: (0x[0-9a-fA-F]{64})/)?.[1] ?? null,
    note: status === 'PENDING_CONFIRMATION' ? 'Approve it in the Binance App now. Never send it again.' : 'Sent.',
  });

  tool('wallet_status', {
    title: 'Wallet status',
    description: 'Reads the Binance Agentic Wallet on this machine: signed in or not, Agent ID, Developer Mode and the BSC address. Changes nothing.',
    inputSchema: {},
    outputSchema: { signed_in: z.boolean(), agent_id: z.string().nullable(), developer_mode: z.boolean().nullable(), bsc_address: z.string().nullable() },
  }, async () => {
    const signedIn = runBaw(['wallet', 'status', '--json'])?.data?.status === 'CONNECTED';
    if (!signedIn) return ok({ signed_in: false, agent_id: null, developer_mode: null, bsc_address: null });
    const id = runBaw(['wallet', 'agent-id', '--json'])?.data;
    const dev = runBaw(['wallet', 'settings', '--json'])?.data?.devMode;
    const exp = typeof dev?.expiresAt === 'number' ? dev.expiresAt * 1000 : Date.parse(dev?.expiresAt ?? '');
    let addr = null;
    try { addr = walletAddress(); } catch { /* shown as null */ }
    return ok({ signed_in: true, agent_id: id?.claimed ? String(id.agentId ?? '') : null, developer_mode: dev?.enabled === true && exp > Date.now(), bsc_address: addr });
  }, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });

  tool('wallet_sign_in', {
    title: 'Sign in to the Agentic Wallet',
    description: 'Starts the Binance Agentic Wallet sign in. Show the person the link and the pairing code exactly as returned; they open the link, check the code in the Binance App and approve. Then call wallet_sign_in_wait with the qr_code_id. The link expires after about 5 minutes.',
    inputSchema: {},
    outputSchema: { already_signed_in: z.boolean(), link: z.string().nullable(), pairing_code: z.string().nullable(), qr_code_id: z.string().nullable() },
  }, async () => {
    const d = runBaw(['auth', 'signin', '--json'])?.data ?? {};
    if (d.status === 'ALREADY_CONNECTED') return ok({ already_signed_in: true, link: null, pairing_code: null, qr_code_id: null });
    if (!d.urlForWeb || !d.qrCodeId) throw new Error('sign in could not start; try again in a minute');
    return ok({ already_signed_in: false, link: String(d.urlForWeb), pairing_code: String(d.pairingCode ?? ''), qr_code_id: String(d.qrCodeId) });
  });

  tool('wallet_sign_in_wait', {
    title: 'Wait for the sign in approval',
    description: 'Waits up to about 50 seconds for the person to approve the sign in in the Binance App. Call again while it says waiting; if it says expired, start over with wallet_sign_in.',
    inputSchema: { qr_code_id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/) },
    outputSchema: { status: z.enum(['signed_in', 'waiting', 'expired']) },
  }, async ({ qr_code_id }) => {
    const r = runBaw(['auth', 'verify', '--qrCodeId', qr_code_id, '--json'], { timeout: 50000 });
    if (runBaw(['wallet', 'status', '--json'])?.data?.status === 'CONNECTED') return ok({ status: 'signed_in' });
    return ok({ status: r?.success === false && !r.unknown ? 'expired' : 'waiting' });
  });

  tool('commit_forecast', {
    title: 'Commit a forecast from the Agentic Wallet',
    description: "Commits the person's own forecast for a round from their signed in Agentic Wallet. Saves the reveal receipt (salt) on this machine first, runs the wallet preview, then shows the person a confirmation form; it sends only if they type yes there, and the Binance App may ask them to approve too. Only use percentages the person gave you. With auto_reveal (recommended, ask them) Forewit reveals for them after the deadline.",
    inputSchema: {
      probabilities_percent: z.array(z.number().min(0).max(100)).min(1).max(16).describe("The person's own chance for each question, in order, 1 to 99."),
      round_id: roundInput,
      auto_reveal: z.boolean().optional().describe('Default false (opt in). True: a copy locked until just after the deadline rides in the commit and Forewit reveals it.'),
    },
    outputSchema: { round_id: z.number().int(), from: z.string(), probabilities_bps: z.array(z.number().int()), auto_reveal: z.boolean(), receipt_file: z.string(), ...sendOut },
  }, async ({ probabilities_percent, round_id, auto_reveal = false }) => {
    const net = network('mainnet');
    const from = walletAddress();
    const { bps } = parseProbabilities(probabilities_percent.join(','));
    const loaded = await loadRound(net, round_id === undefined ? undefined : String(round_id));
    const plan = await commitPlan({ net, from, bps, home, loaded, autoReveal: auto_reveal });
    const log = [`Round ${loaded.id} commit, your forecast: ${bps.map((b) => b / 100 + '%').join(', ')}`, `Auto reveal: ${plan.autoReveal ? 'on' : 'off'}`];
    const status = await sendWithConfirmation({ net, from, data: plan.data, what: `commit for round ${loaded.id}`, io: humanIo(log) });
    return ok({ round_id: loaded.id, from, probabilities_bps: bps, auto_reveal: plan.autoReveal, receipt_file: plan.file, ...sent(status, log) });
  }, SEND);

  tool('reveal_forecast', {
    title: 'Reveal a forecast from the Agentic Wallet',
    description: 'After the commit deadline: reveals the commit with the local receipt, through the same wallet preview and confirmation form. Not needed when auto reveal was on, unless status still shows not revealed an hour after the deadline.',
    inputSchema: { round_id: roundInput },
    outputSchema: { round_id: z.number().int(), from: z.string(), already_revealed: z.boolean(), status: z.enum(['BROADCASTED', 'PENDING_CONFIRMATION']).nullable(), tx_hash: z.string().nullable(), note: z.string() },
  }, async ({ round_id }) => {
    const net = network('mainnet');
    const from = walletAddress();
    const loaded = await loadRound(net, round_id === undefined ? undefined : String(round_id));
    const plan = await revealPlan({ net, from, home, loaded });
    if (plan.alreadyRevealed) return ok({ round_id: loaded.id, from, already_revealed: true, status: null, tx_hash: null, note: 'Already revealed.' });
    const log = [`Round ${loaded.id} reveal: ${plan.bps.map((b) => b / 100 + '%').join(', ')}`];
    const status = await sendWithConfirmation({ net, from, data: plan.data, what: `reveal for round ${loaded.id}`, io: humanIo(log) });
    return ok({ round_id: loaded.id, from, already_revealed: false, ...sent(status, log) });
  }, SEND);

  return server;
}
