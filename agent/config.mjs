// Pinned network constants. The CLI only ever builds calls to these ledger addresses; there is no override flag.
// Mainnet ledger pinned 24 Nov 2026 after deploy and verification; mainnet is now the default network.

export const NETWORKS = Object.freeze({
  mainnet: Object.freeze({
    name: 'mainnet',
    chainId: 56,
    ledger: '0xd11e67ff70ACD42E01d79130f280162b00Bb09B6', // ForecastLedger v1.2, deployed 24 Nov 2026 (block 135450390), verified on BscScan and Sourcify
    rpc: 'https://bsc-rpc.publicnode.com',
    explorer: 'https://bscscan.com',
  }),
  testnet: Object.freeze({
    name: 'testnet',
    chainId: 97,
    ledger: '0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1', // instance E (Forewit build); A to D are deprecated,
    rpc: 'https://bsc-testnet-rpc.publicnode.com',
    explorer: 'https://testnet.bscscan.com',
  }),
});

// Mainnet becomes the default automatically once its ledger address is pinned above.
export const DEFAULT_NETWORK = NETWORKS.mainnet.ledger ? 'mainnet' : 'testnet';

// The Binance Agentic Wallet (baw) signs on BSC mainnet only.
export const BAW_CHAIN_IDS = Object.freeze([56]);

export const MIN_BPS = 100; // 1%
export const MAX_BPS = 9900; // 99%
export const MAX_QUESTIONS = 16;

// Spec 7.3, verbatim.
export const RISK_WARNING =
  'Forecasting scores only. Not financial advice. Forewit does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.';
