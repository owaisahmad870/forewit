import { CopyBlock } from '../components';
import { useT } from '../i18n';

// Commands, URL and hosts keep hyphens, so they live in code, not in the locale files (src/test/start.test.tsx checks them).
const TEMPLATE_URL = 'https://github.com/owaisahmad870/forewit-agent-template';
const PHONE_HOSTS = 'www.binance.com\nbsc-rpc.publicnode.com\nforewit.xyz\napi.github.com\napi.predict.fun';
const PHONE_PROMPT = 'Forecast a market: bitcoin 15 minute';
export const SKILL_COMMANDS = ['npx skills add binance/binance-skills-hub --skill binance-agentic-wallet\nnpm install -g @binance/agentic-wallet@1.12.0', 'npx skills add owaisahmad870/forewit --skill forewit'];
export const QUICK_COMMAND = 'npx forewit@latest start';
export const QUICK_COMMAND_WINDOWS = 'npx.cmd forewit@latest start';
export const REVEAL_COMMAND = 'npx forewit@latest reveal --execute';
export const ANY_COMMANDS = ['npx forewit@latest markets --search "bitcoin"', 'npx forewit@latest predict --market <id> --p 65 --auto-reveal --execute'];

const card = 'max-w-[68ch] rounded-lg border border-line bg-surface p-4';
const h2 = 'mb-2 text-lg font-semibold';
const ol = 'list-decimal space-y-2 pl-5';

export function Start() {
  const { t, raw } = useT();
  const steps = (k: string) => raw<string[]>(`start.${k}.steps`);
  return (
    <article className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('start.title')}</h1>
      <p className="max-w-[68ch]">{t('start.intro')}</p>
      <section aria-labelledby="need-h" className={card}>
        <h2 id="need-h" className={h2}>{t('start.need.title')}</h2>
        <ul className="list-disc space-y-1 pl-5">{raw<string[]>('start.need.list').map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
      <section aria-labelledby="computer-h" className={card}>
        <h2 id="computer-h" className={h2}>1. {t('start.computer.title')}</h2>
        <ol className={ol}>{steps('computer').map((x, i) => <li key={i}>{x}{i === 1 && <><CopyBlock text={QUICK_COMMAND} /><span className="mt-2 block text-sm">{t('start.computer.windows')}</span><CopyBlock text={QUICK_COMMAND_WINDOWS} /></>}</li>)}</ol>
      </section>
      <section aria-labelledby="agent-h" className={card}>
        <h2 id="agent-h" className={h2}>2. {t('start.agent.title')}</h2>
        <ol className={ol}>{steps('agent').map((x, i) => <li key={i}>{x}{i < 2 && <CopyBlock text={SKILL_COMMANDS[i]} />}</li>)}</ol>
      </section>
      <section aria-labelledby="phone-h" className={card}>
        <h2 id="phone-h" className={h2}>3. {t('start.phone.title')}</h2>
        <ol className={ol}>{steps('phone').map((x, i) => <li key={i}>{x}</li>)}</ol>
        <CopyBlock text={PHONE_HOSTS} />
        <CopyBlock text={PHONE_PROMPT} />
        <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-semibold text-accent-ink">{t('start.phone.cta')}</a>
      </section>
      <section aria-labelledby="any-h" className="max-w-[68ch] rounded-lg border border-accent bg-surface p-4">
        <h2 id="any-h" className={h2}>{t('start.any.title')}</h2>
        <p>{t('start.any.intro')}</p>
        <ol className={`mt-3 ${ol}`}>{steps('any').map((x, i) => <li key={i}>{x}{i > 0 && <CopyBlock text={ANY_COMMANDS[i - 1]} />}</li>)}</ol>
        <p className="mt-3 text-sm text-muted">{t('start.any.note')}</p>
      </section>
      <p>{t('start.after')} <a href="#/me" className="text-accent underline underline-offset-4">{t('me.title')}</a></p>
      <section aria-label={t('start.reveal')} className="max-w-[68ch] text-sm"><p>{t('start.reveal')}</p><CopyBlock text={REVEAL_COMMAND} /></section>
    </article>
  );
}
