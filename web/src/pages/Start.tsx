import { Blocks, Card, CopyBlock } from '../components';
import { useT } from '../i18n';

type Block = Parameters<typeof Blocks>[0]['blocks'][number];

// Commands per step, in the same order as start.steps in the locales. Code, not prose: the locale files allow no hyphens.
// Every forewit subcommand and flag here exists in agent/forewit.mjs (checked by src/test/start.test.tsx); baw lines are the
// ones the CLI itself prints or runs in its preflight.
export const START_COMMANDS: string[][] = [
  [],
  ['baw wallet status --json', 'baw wallet agent-id --json', 'baw wallet settings --json'],
  ['npx forewit round --round-file <URL of the public round JSON>', 'npx forewit forecast --p 72,15,50'],
  [
    'baw wallet address --json',
    'npx forewit commit --from 0xYourAgenticWallet --p 72,15,50',
    'npx forewit receipt --from 0xYourAgenticWallet',
  ],
  ['npx forewit reveal --from 0xYourAgenticWallet', 'npx forewit status --from 0xYourAgenticWallet'],
];
// Mainnet only (the CLI refuses --execute elsewhere); shown under step 4 as the one step alternative.
export const EXECUTE_COMMAND = 'npx forewit commit --execute --from 0xYourAgenticWallet --p 72,15,50';

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
      <p className="max-w-[68ch] rounded-lg border border-accent bg-surface-2 p-3 font-semibold">{t('start.preview')}</p>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i}>
            <Card>
              <h2 className="mb-3 text-lg font-semibold">{t('start.step', { n: i + 1 })} {s.h}</h2>
              <Blocks blocks={s.blocks} />
              {START_COMMANDS[i]?.length ? <CopyBlock text={START_COMMANDS[i].join('\n')} /> : null}
              {i === 3 && <><p className="mt-4 max-w-[68ch]">{t('start.oneStep')}</p><CopyBlock text={EXECUTE_COMMAND} /></>}
              {s.shot && <Shot text={s.shot} />}
            </Card>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap gap-x-4">
        <a href="#/proof" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('start.toProof')}</a>
        <a href="#/docs/agents" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('docs.pages.agents.title')}</a>
        <a href="#/play" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('play.title')}</a>
      </p>
    </article>
  );
}
