// Forewit local MCP server (stdio). Prepares commit, reveal and profile transactions and lists local receipts.
// It never signs, never sends and never runs baw: it returns calldata and the baw preview command for the wallet owner.
// Network access: the pinned public RPC of the chosen network only (read only eth_call). Logs go to stderr only.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  network, loadRound, commitPlan, revealPlan, parseProbabilities, findReceipts, receiptDir, bawPreview,
} from '../vendor/agent/forewit.mjs';
import { selector, wordBool, wordUint } from '../vendor/agent/lib/keccak.mjs';
import { DEFAULT_NETWORK, BAW_CHAIN_IDS, RISK_WARNING } from '../vendor/agent/config.mjs';
import { ok, guarded, paginate, cursorInput, address, roundId, VERSION } from './common.mjs';

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

const roundInput = roundId.optional().describe('Round id, default the latest round on the ledger.');

/** `home` is the folder that holds .forewit/ (default: the user's home directory). It is not a tool input. */
export function createLocalServer({ home } = {}) {
  const server = new McpServer({ name: 'forewit-local', version: VERSION, title: 'Forewit (local, prepares transactions)' });
  const tool = (name, config, fn, annotations = ANNOTATIONS) =>
    server.registerTool(name, { ...config, inputSchema: z.object(config.inputSchema).strict(), outputSchema: z.object(config.outputSchema), annotations: { ...annotations, title: config.title } }, guarded(fn));

  tool('prepare_commit', {
    title: 'Prepare a commit',
    description: 'Makes a random salt, saves the reveal receipt (salt included) in ~/.forewit with owner only access, and returns the commit hash, calldata and baw preview command. Probabilities are percentages, one per question, clamped to 1 to 99. The salt is not returned.',
    inputSchema: {
      from: address.describe('Agentic wallet address that will send the commit.'),
      probabilities_percent: z.array(z.number().min(0).max(100)).min(1).max(16),
      round_id: roundInput,
      network: networkInput,
    },
    outputSchema: {
      network: z.string(), ledger: z.string(), round_id: z.number().int(), from: z.string(),
      commit_deadline: z.string(), reveal_deadline: z.string(),
      probabilities_bps: z.array(z.number().int()), clamped_indexes: z.array(z.number().int()),
      packed: z.string(), commit_hash: z.string(), already_committed: z.boolean(),
      receipt_file: z.string(), salt_returned: z.literal(false),
      ...walletShape,
    },
  }, async ({ from, probabilities_percent, round_id, network: name }) => {
    const net = network(name);
    const { bps, clamped } = parseProbabilities(probabilities_percent.join(','));
    const loaded = await loadRound(net, round_id === undefined ? undefined : String(round_id));
    const { receipt, file, existing, data } = await commitPlan({ net, from, bps, home, loaded });
    console.error(`forewit mcp: saved receipt for round ${loaded.id} at ${file}`);
    return ok({
      network: net.name, ledger: net.ledger, round_id: loaded.id, from,
      commit_deadline: iso(loaded.round.commitDeadline), reveal_deadline: iso(loaded.round.revealDeadline),
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
    description: 'Lists reveal receipts saved in ~/.forewit. Returns metadata and file paths; the salt only when include_salt is true. Paginated, newest first.',
    inputSchema: {
      from: address.optional(),
      round_id: roundId.optional(),
      network: networkInput,
      include_salt: z.boolean().optional().describe('Include each salt, for a private backup. Default false.'),
      ...cursorInput,
    },
    outputSchema: {
      folder: z.string(),
      receipts: z.array(z.object({
        file: z.string(), network: z.string(), chain_id: z.number().int(), ledger: z.string(), round_id: z.number().int(), forecaster: z.string(),
        commit_hash: z.string(), probabilities_bps: z.array(z.number().int()), commit_deadline: z.string().nullable(), reveal_deadline: z.string().nullable(),
        created_at: z.string().nullable(), salt: z.string().optional(),
      })),
      next_cursor: z.string().nullable(),
    },
  }, async ({ from, round_id, network: name, include_salt = false, cursor, limit }) => {
    const filter = { forecaster: from, roundId: round_id };
    if (name) filter.chainId = network(name).chainId;
    const found = findReceipts(filter, home).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { page, next_cursor } = paginate(found, { cursor, limit });
    return ok({
      folder: receiptDir(home),
      receipts: page.map((r) => ({
        file: r.file, network: String(r.network), chain_id: Number(r.chainId), ledger: String(r.ledger), round_id: Number(r.roundId),
        forecaster: String(r.forecaster), commit_hash: String(r.commitHash), probabilities_bps: (r.probabilitiesBps ?? []).map(Number),
        commit_deadline: iso(r.commitDeadline), reveal_deadline: iso(r.revealDeadline), created_at: r.createdAt ?? null,
        ...(include_salt ? { salt: String(r.salt) } : {}),
      })),
      next_cursor,
    });
  }, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

  return server;
}
