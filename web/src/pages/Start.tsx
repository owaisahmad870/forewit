import { Blocks, Card, CopyBlock, Explain } from '../components';
import { useT } from '../i18n';

// URL, hosts and prompt keep hyphens, so they live in code, not in the locale files
const TEMPLATE_URL = 'https://github.com/owaisahmad870/forewit-agent-template';
const PHONE_HOSTS = 'www.binance.com\nbsc-rpc.publicnode.com\nforewit.xyz\napi.github.com';
const PHONE_PROMPT = 'Follow CLAUDE.md. Commit my forecast for the current Forewit round.';

type Block = Parameters<typeof Blocks>[0]['blocks'][number];

// Commands per step, in the same order as start.steps in the locales. Code, not prose: the locale files allow no hyphens.
// Every forewit subcommand and flag here exists in agent/forewit.mjs and every baw line is one the CLI prints or the baw
// 1.12.0 help lists (checked by src/test/start.test.tsx). The easy way is the npm package's guided start (forewit start);
// the manual path runs the same CLI from the repository.
const ROUND_FILE = 'web/public/data/rounds/1.json';
export const SKILL_COMMANDS = ['npx skills add binance/binance-skills-hub --skill binance-agentic-wallet\nnpm install -g @binance/agentic-wallet@1.12.0', 'npx skills add owaisahmad870/forewit --skill forewit'];
export const QUICK_COMMAND = 'npx forewit@latest start';
export const QUICK_COMMAND_WINDOWS = 'npx.cmd forewit@latest start';
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
      <section aria-labelledby="skill-h" className="max-w-[68ch] rounded-lg border border-accent bg-surface p-4">
        <h2 id="skill-h" className="mb-2 text-lg font-semibold">{t('start.skill.title')}</h2>
        <p>{t('start.skill.intro')}</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {raw<string[]>('start.skill.steps').map((x, i) => <li key={i}>{x}{i < 2 && <CopyBlock text={SKILL_COMMANDS[i]} />}</li>)}
        </ol>
        <p className="mt-3 text-sm text-muted">{t('start.skill.connector')}</p>
      </section>
      <section aria-labelledby="quick-h" className="max-w-[68ch] rounded-lg border border-line bg-surface p-4">
        <h2 id="quick-h" className="mb-2 text-lg font-semibold">{t('start.quick.title')}</h2>
        <ol className="list-decimal space-y-2 pl-5">{raw<string[]>('start.quick.steps').map((x, i) => <li key={i}>{x}</li>)}</ol>
        <CopyBlock text={QUICK_COMMAND} />
        <p className="mt-3 text-sm">{t('start.quick.windows')}</p>
        <CopyBlock text={QUICK_COMMAND_WINDOWS} />
        <p className="mt-3 text-sm text-muted">{t('start.quick.after')} <a href="#/me" className="text-accent underline underline-offset-4">{t('me.title')}</a></p>
      </section>
      <Explain terms={['agentId', 'forecast', 'commit', 'salt', 'reveal', 'forfeit']} summary="help.whatTerms" />
      <p className="max-w-[68ch] rounded-lg border border-accent bg-surface-2 p-3 font-semibold">{t('start.preview')}</p>
      <section aria-labelledby="phone-h" className="max-w-[68ch] rounded-lg border border-line bg-surface p-4">
        <h2 id="phone-h" className="mb-2 text-lg font-semibold">{t('start.phone.title')}</h2>
        <p>{t('start.phone.intro')}</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">{raw<string[]>('start.phone.steps').map((x, i) => <li key={i}>{x}</li>)}</ol>
        <CopyBlock text={PHONE_HOSTS} />
        <CopyBlock text={PHONE_PROMPT} />
        <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-semibold text-accent-ink">{t('start.phone.cta')}</a>
        <p className="mt-2 text-sm text-muted">{t('start.phone.note')}</p>
      </section>
      <details className="max-w-full">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-lg font-semibold">{t('start.quick.manual')}</summary>
      <ol className="mt-3 space-y-4">
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
      </details>
      <p className="flex flex-wrap gap-x-4">
        <a href="#/proof" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('start.toProof')}</a>
        <a href="#/docs/agents" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('docs.pages.agents.title')}</a>
        <a href="#/play" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('play.title')}</a>
        <a href="#/rounds" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('help.go.rounds')}</a>
      </p>
    </article>
  );
}
