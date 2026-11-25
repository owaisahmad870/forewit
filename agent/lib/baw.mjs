// Execute mode: runs the Binance Agentic Wallet CLI (baw) for one commit or reveal, behind an explicit typed yes.
// Syntax and codes from the binance agentic wallet skill, references/external-sign.md, preflight.md, wallet-view.md.
// baw is always started without a shell, with an argument array. Gas price and gas limit are never passed.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { cleanText } from './question.mjs';
import { isAddress } from './keccak.mjs';
import { BAW_CHAIN_IDS, RISK_WARNING } from '../config.mjs';

const CHAIN = String(BAW_CHAIN_IDS[0]);
// PowerShell often blocks baw.ps1 (script execution disabled); the baw.cmd shim runs without a policy change
const BAW_CLI = process.platform === 'win32' ? 'baw.cmd' : 'baw';
export const RETRY_CHECKS = [
  `baw wallet tx-history --type pending --binanceChainId ${CHAIN} --json`,
  `baw wallet tx-lock --binanceChainId ${CHAIN} --json`,
];
export const DEV_MODE_HELP =
  'Developer Mode is off, expired or over its limit. In the Binance App open Agentic Wallet, Settings (top right icon), ' +
  'turn on Developer Mode, read and confirm the risk warning, and approve the signature request. It lasts 7 days (each use ' +
  'extends it), has its own daily limit, and the wallet balance must be under its cap. Then run this command again.';

/**
 * The one place that decides which program is baw. FOREWIT_BAW_BIN is for tests only (a fake baw script).
 * On Windows npm installs baw as a .cmd shim, which cannot run without a shell, so its JS entry is run with node instead.
 */
export function bawCommand(env = process.env) {
  const bin = env.FOREWIT_BAW_BIN || 'baw';
  if (/\.m?js$/i.test(bin)) return { file: process.execPath, pre: [bin] };
  if (bin !== 'baw' || process.platform !== 'win32') return { file: bin, pre: [] };
  // npm's default global folder too, for shells whose PATH lacks it
  const dirs = [...(env.PATH ?? env.Path ?? '').split(delimiter), env.APPDATA && join(env.APPDATA, 'npm')].filter(Boolean);
  for (const dir of dirs) {
    if (!existsSync(join(dir, 'baw.cmd'))) continue;
    const pkg = join(dir, 'node_modules', '@binance', 'agentic-wallet');
    try {
      const b = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).bin;
      const rel = typeof b === 'string' ? b : b?.baw;
      if (rel) return { file: process.execPath, pre: [join(pkg, rel)] };
    } catch { /* keep looking */ }
  }
  throw new Error('baw not found. Install the Binance Agentic Wallet CLI (npm package @binance/agentic-wallet).');
}

/** Runs baw with --json output and returns its parsed reply. Errors arrive as JSON on stdout with exit code 1. */
export function runBaw(args) {
  const { file, pre } = bawCommand();
  const r = spawnSync(file, [...pre, ...args], { encoding: 'utf8', timeout: 90000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 << 20 });
  if (r.error?.code === 'ENOENT') throw new Error('baw not found. Install the Binance Agentic Wallet CLI (npm package @binance/agentic-wallet).');
  try {
    const j = JSON.parse(r.stdout);
    if (j && typeof j === 'object') return j;
  } catch { /* fall through */ }
  return { success: false, unknown: true, error: { code: null, message: r.error ? r.error.message : 'unreadable baw output' } };
}

const codeOf = (reply) => Number(reply?.error?.code);
const errText = (reply) => cleanText(String(reply?.error?.message ?? reply?.error?.name ?? 'unknown error'));

/** Refusals that need no network and no baw: run them before a salt is made or anything is printed. */
export function assertCanExecute(net, io) {
  if (!io?.isTTY?.()) throw new Error('--execute needs an interactive terminal so the wallet owner can type yes; stdin is not a TTY. Nothing was sent.');
  if (!BAW_CHAIN_IDS.includes(net.chainId) || !isAddress(net.ledger ?? '')) {
    throw new Error(`--execute needs BSC mainnet (chain ${CHAIN}) with a pinned ledger; baw cannot sign on ${net.name} (chain ${net.chainId}). Run without --execute for the dry run.`);
  }
}

/** Read only checks before any preview. Pending transactions or a locked wallet stop the run: never send twice. */
export function preflight(now = Date.now()) {
  const status = runBaw(['wallet', 'status', '--json']);
  if (status?.data?.status !== 'CONNECTED') throw new Error(`the Agentic Wallet is not signed in (baw wallet status is not CONNECTED). Sign in with: ${BAW_CLI} auth signin`);
  const id = runBaw(['wallet', 'agent-id', '--json']);
  if (codeOf(id) === 20003008) throw new Error('the Agent ID service is temporarily unavailable (20003008). This does not mean you have no Agent ID; try again later.');
  if (id?.data?.claimed !== true) throw new Error('this wallet has no claimed Agent ID (baw wallet agent-id). Claim one in the Binance App, Web3 wallet, Agent ID.');
  const dev = runBaw(['wallet', 'settings', '--json'])?.data?.devMode;
  const exp = dev?.expiresAt;
  const expMs = typeof exp === 'number' ? exp * 1000 : typeof exp === 'string' ? Date.parse(exp) : NaN; // docs say seconds, baw 1.12.0 returns ISO text
  if (dev?.enabled !== true || !(expMs > now) || dev?.balanceExceeded === true) throw new Error(DEV_MODE_HELP);
  if (runBaw(['wallet', 'tx-lock', '--binanceChainId', CHAIN, '--json'])?.data?.status !== 'UNLOCKED') {
    throw new Error('the wallet is locked: a transaction is pending onchain or waiting for approval in the Binance App. Resolve it, then check status before trying again.');
  }
  const pending = runBaw(['wallet', 'tx-history', '--type', 'pending', '--binanceChainId', CHAIN, '--json'])?.data?.transactions;
  if (!Array.isArray(pending)) throw new Error('could not read pending transactions (baw wallet tx-history --type pending); refusing to send.');
  if (pending.length) throw new Error(`the wallet has ${pending.length} pending transaction(s). Wait until they confirm, then run status before sending again. Never resend.`);
}

function explainError(reply, stage) {
  const code = codeOf(reply);
  if (code === 351802 || code === 351804) return `${code}: ${DEV_MODE_HELP}`;
  if (code === 351803) return '351803: risk blocked by the Binance Agentic Wallet. Stopped. Forewit never works around a risk block.';
  if (code === 351805) return `351805: the simulation failed (${errText(reply)}). Common reasons: the commit window closed, the wallet holds no Agent ID, the reveal window is not open, or the receipt does not match. Run status; do not retry blindly.`;
  return `${stage} failed${Number.isFinite(code) ? ` (${code})` : ''}: ${errText(reply)}`;
}

// Field names confirmed on a real BSC mainnet preview (baw 1.12.0, 23 Nov 2026, agent/test/fixtures/baw_preview_contract_call.json):
// parsedTx is { transactionType: 'ContractInteraction', action: <4 byte selector>, contractAddress, contractAddressList,
// transactionTypeTranslationKey }. It echoes neither the value nor the full calldata, so value 0 is proven by the
// simulation showing no balance, allowance or authority change, and the calldata by the selector plus our own argv.
export function parsedCall(parsedTx) {
  const p = parsedTx ?? {};
  return { type: p.transactionType, to: p.contractAddress, selector: p.action };
}

const isEmptyList = (v) => Array.isArray(v) && v.length === 0;

/** Refuses unless the preview targets the pinned ledger, has value 0 and carries exactly our calldata. */
export function checkPreview(d, { ledger, data }) {
  const got = parsedCall(d?.parsedTx);
  const bad = [];
  if (got.type !== 'ContractInteraction') bad.push(`transaction type ${cleanText(String(got.type))} is not ContractInteraction`);
  if (typeof got.to !== 'string' || got.to.toLowerCase() !== ledger.toLowerCase()) bad.push(`target ${cleanText(String(got.to))} is not the pinned ledger ${ledger}`);
  if (typeof got.selector !== 'string' || got.selector.toLowerCase() !== data.slice(0, 10).toLowerCase()) bad.push('function selector is missing or differs from ours');
  const sim = d?.simulationResult ?? {};
  if (!['balanceChanges', 'allowanceChanges', 'authorityChanges'].every((k) => isEmptyList(sim[k]))) bad.push('the simulation shows a balance, allowance or authority change, so value is not 0');
  if (sim.simulationErrorDetail || (sim.simulationCode != null && !/^0+$/.test(String(sim.simulationCode)))) bad.push(`simulation did not pass (${cleanText(String(sim.simulationCode))})`);
  if (typeof d?.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(d.requestId)) bad.push('no usable requestId');
  const keys = Object.keys(d?.parsedTx ?? {}).map((k) => cleanText(k)).join(', ');
  if (bad.length) throw new Error(`refusing this preview: ${bad.join('; ')} (parsedTx fields: ${keys || 'none'}). Nothing was sent.`);
}

function printPreview(d, data, log) {
  const s = (v) => cleanText(typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
  log('', 'Preview from the Binance Agentic Wallet:', '  parsedTx:');
  for (const [k, v] of Object.entries(d.parsedTx ?? {})) log(`    ${cleanText(k)}: ${s(v)}`);
  log(`  calldata sent (baw echoes only its selector, checked above): ${data}`);
  const sim = d.simulationResult ?? {};
  log('  simulationResult:');
  for (const [k, v] of Object.entries(sim)) log(`    ${cleanText(k)}: ${s(v)}`);
  const risks = d.risks ?? {};
  const details = Array.isArray(risks.riskDetails) ? risks.riskDetails : [];
  const flagged = Object.entries(risks.addresses ?? {});
  log('  risks:');
  if (!details.length && !flagged.length) log('    none reported');
  for (const r of details) log(`    ${s(r.riskType)}: ${s(r.title)}: ${s(r.description)}`);
  for (const [addr, a] of flagged) for (const r of a?.riskDetails ?? []) log(`    address ${s(addr)} flagged (level ${s(a.riskLevel)}): ${s(r.title)}: ${s(r.description)}`);
  if (Array.isArray(risks.riskBehaviors) && risks.riskBehaviors.length) log(`    riskBehaviors: ${s(risks.riskBehaviors)}`);
  log(`  requireConfirmation: ${s(d.requireConfirmation)}${d.requireConfirmation ? ' (you will also approve it in the Binance App)' : ''}`);
}

/**
 * Preview, show, ask for a typed yes, execute. `io` is { isTTY(): boolean, ask(prompt): Promise<string>, log?(...lines) }.
 * Returns 'BROADCASTED' or 'PENDING_CONFIRMATION'; throws on every refusal, abort or error.
 */
export async function sendWithConfirmation({ net, from, data, what, io }) {
  const log = io.log ?? ((...l) => console.log(l.join('\n')));
  assertCanExecute(net, io);
  if (!isAddress(from) || !/^0x[0-9a-f]+$/.test(data)) throw new Error('refusing to send unvalidated input');
  preflight();
  const previewArgs = ['contract-call', 'preview', '--binanceChainId', CHAIN, '--from', from, '--to', net.ledger, '--value', '0', '--inputData', data, '--json'];
  const preview = runBaw(previewArgs);
  if (preview?.success !== true) throw new Error(`${explainError(preview, 'preview')} Nothing was sent.`);
  const d = preview.data;
  checkPreview(d, { ledger: net.ledger, data });
  printPreview(d, data, log);
  log('', `Risk warning: ${RISK_WARNING}`, `This sends the ${what} from ${from} to ${net.ledger} with value 0 (network gas only). Forewit pays no returns.`);
  const answer = await io.ask('Type yes to send it, anything else aborts: ');
  if (String(answer ?? '').trim() !== 'yes') throw new Error('aborted: you did not type yes. Nothing was sent.');
  const exp = typeof d.expiresAt === 'string' && !/^d+$/.test(d.expiresAt) ? Date.parse(d.expiresAt) : Number(d.expiresAt); // docs: ms number
  if (Number.isFinite(exp) && Date.now() >= exp) {
    throw new Error('the preview expired before you confirmed. Nothing was sent; run the command again for a fresh preview.');
  }

  const result = runBaw(['contract-call', 'execute', '--requestId', d.requestId, '--json']);
  const r = result?.data;
  if (result?.success === true && r?.status === 'BROADCASTED' && /^0x[0-9a-fA-F]{64}$/.test(r.txHash ?? '')) {
    log('', `BROADCASTED. txHash: ${r.txHash}`, `  ${net.explorer}/tx/${r.txHash}`);
    return 'BROADCASTED';
  }
  if (result?.success === true && r?.status === 'PENDING_CONFIRMATION') {
    log('', 'PENDING_CONFIRMATION: approve this transaction in the Binance App now.',
      'Do not run this command again for it: never resend. It completes once you approve it in the App.',
      'Check it with:', ...RETRY_CHECKS.map((c) => '  ' + c));
    return 'PENDING_CONFIRMATION';
  }
  const why = result?.success === false && !result.unknown ? explainError(result, 'execute') : 'execute returned an unknown or unreadable result, so the transaction state is unknown';
  throw new Error(`${why.replace(/\.$/, '')}. Do not resend. Before any retry check: ${RETRY_CHECKS.join(' and ')}`);
}
