import { Blocks, Card, CopyBlock, Explain } from '../components';
import { useT } from '../i18n';

type Block = Parameters<typeof Blocks>[0]['blocks'][number];

// Commands per step, in the same order as start.steps in the locales. Code, not prose: the locale files allow no hyphens.
// Every forewit subcommand and flag here exists in agent/forewit.mjs and every baw line is one the CLI prints or the baw
// 1.12.0 help lists (checked by src/test/start.test.tsx). Mainnet runs from the repository: npm forewit 0.0.1 is testnet only.
const ROUND_FILE = 'web/public/data/rounds/1.json';
export const START_COMMANDS: string[][] = [
  ['git clone https://github.com/owaisahmad870/forewit.git', 'cd forewit', 'npm ci'],
  ['npm install -g @binance/agentic-wallet@1.12.0', 'baw wallet status --json', 'baw auth signin'],
  ['baw wallet agent-id --json', 'baw wallet settings --json'],
  [`node agent/forewit.mjs round --round-file ${ROUND_FILE}`, 'node agent/forewit.mjs forecast --p 60,40,50,30'],
  [
    'baw wallet address --json',
    `node agent/forewit.mjs commit --execute --from 0xYourAgenticWallet --p 60,40,50,30 --round-file ${ROUND_FILE}`,
    'node agent/forewit.mjs receipt --from 0xYourAgenticWallet',
  ],
  ['node agent/forewit.mjs reveal --execute --from 0xYourAgenticWallet', 'node agent/forewit.mjs status --from 0xYourAgenticWallet'],
];
// Windows PowerShell blocks npm.ps1 and baw.ps1 when script execution is disabled; the .cmd shims need no policy change.
export const WINDOWS_COMMANDS = ['npm.cmd install -g @binance/agentic-wallet@1.12.0', 'baw.cmd wallet status --json', 'baw.cmd auth signin'];

function Shot({ text }: { text: string }) {
  const { t } = useT();
  return (
    <figure className="mt-3 flex min-h-32 items-center justify-center rounded-lg border-2 border-dashed border-line p-4 text-center text-sm text-muted">
      <figcaption>{t('start.shot', { what: text })}</figcaption>
    </figure>
  );
}

export function Start() {
  const { t, raw } = useT();
  const steps = raw<{ h: string; blocks: Block[]; shot?: string }[]>('start.steps');
  return (
    <article className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('start.title')}</h1>
      <p className="max-w-[68ch]">{t('start.intro')}</p>
      <Explain terms={['agentId', 'forecast', 'commit', 'salt', 'reveal', 'forfeit']} summary="help.whatTerms" />
      <p className="max-w-[68ch] rounded-lg border border-accent bg-surface-2 p-3 font-semibold">{t('start.preview')}</p>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i}>
            <Card>
              <h2 className="mb-3 text-lg font-semibold">{t('start.step', { n: i + 1 })} {s.h}</h2>
              <Blocks blocks={s.blocks} />
              {START_COMMANDS[i]?.length ? <CopyBlock text={START_COMMANDS[i].join('\n')} /> : null}
              {i === 1 && <><p className="mt-4 max-w-[68ch]">{t('start.windows')}</p><CopyBlock text={WINDOWS_COMMANDS.join('\n')} /></>}
              {s.shot && <Shot text={s.shot} />}
            </Card>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap gap-x-4">
        <a href="#/proof" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('start.toProof')}</a>
        <a href="#/docs/agents" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('docs.pages.agents.title')}</a>
        <a href="#/play" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('play.title')}</a>
        <a href="#/rounds" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('help.go.rounds')}</a>
      </p>
    </article>
  );
}
