import { CopyBlock } from '../components';
import { useT } from '../i18n';

// Commands, URL and hosts keep hyphens, so they live in code, not in the locale files (src/test/start.test.tsx checks them).
const TEMPLATE_URL = 'https://github.com/owaisahmad870/forewit-agent-template';
const PHONE_HOSTS = 'www.binance.com\nbsc-rpc.publicnode.com\nforewit.xyz\napi.github.com\napi.predict.fun';
const CONNECTOR_URL = 'https://forewit.xyz/mcp';
// Real screenshots in public/start, one list per phone step (index matches start.phone.steps).
const PHONE_SHOTS: (string[] | undefined)[] = [['template'], ['private'], ['repo'], ['envmenu', 'envname'], ['network'], ['envvars'], ['connector']];
const PHONE_COPY: (string | undefined)[] = [undefined, undefined, undefined, undefined, PHONE_HOSTS, 'PREDICT_API_KEY=', CONNECTOR_URL];
const SHOT_SIZE: Record<string, [number, number]> = { template: [542, 122], private: [770, 445], repo: [780, 229], envmenu: [780, 299], envname: [526, 678], network: [526, 459], envvars: [526, 347], connector: [526, 412] };
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
      <section aria-labelledby="phone-h" className={card}>
        <h2 id="phone-h" className={h2}>1. {t('start.phone.title')}</h2>
        <p className="mb-3">{t('start.phone.intro')}</p>
        <ol className={ol}>{steps('phone').map((x, i) => (
          <li key={i}>
            {x}
            {i === 0 && <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 w-fit items-center rounded-md bg-accent px-4 font-semibold text-accent-ink">{t('start.phone.cta')}</a>}
            {PHONE_COPY[i] && <CopyBlock text={PHONE_COPY[i]} />}
            {PHONE_SHOTS[i]?.map((n) => <img key={n} src={`${import.meta.env.BASE_URL}start/${n}.webp`} width={SHOT_SIZE[n][0]} height={SHOT_SIZE[n][1]} alt={t(`start.phone.alt.${n}`)} loading="lazy" decoding="async" className={`mt-2 h-auto w-full rounded-md border border-line ${SHOT_SIZE[n][0] < 600 ? 'max-w-sm' : 'max-w-xl'}`} />)}
            {i === 7 && <ul className="mt-2 space-y-1">{raw<string[]>('start.phone.examples').map((e) => <li key={e}><CopyBlock text={e} /></li>)}</ul>}
          </li>
        ))}</ol>
      </section>
      <section aria-labelledby="computer-h" className={card}>
        <h2 id="computer-h" className={h2}>2. {t('start.computer.title')}</h2>
        <ol className={ol}>{steps('computer').map((x, i) => <li key={i}>{x}{i === 1 && <><CopyBlock text={QUICK_COMMAND} /><span className="mt-2 block text-sm">{t('start.computer.windows')}</span><CopyBlock text={QUICK_COMMAND_WINDOWS} /></>}</li>)}</ol>
      </section>
      <section aria-labelledby="agent-h" className={card}>
        <h2 id="agent-h" className={h2}>3. {t('start.agent.title')}</h2>
        <ol className={ol}>{steps('agent').map((x, i) => <li key={i}>{x}{i < 2 && <CopyBlock text={SKILL_COMMANDS[i]} />}</li>)}</ol>
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
