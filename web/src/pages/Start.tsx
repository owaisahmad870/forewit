import { Callout, CopyBlock, OnThisPage } from '../components';
import { useT } from '../i18n';

// Commands, URL and hosts keep hyphens, so they live in code, not in the locale files (src/test/start.test.tsx checks them).
const TEMPLATE_URL = 'https://github.com/owaisahmad870/forewit-agent-template';
const PHONE_HOSTS = 'www.binance.com\nbsc-rpc.publicnode.com\nforewit.xyz\napi.github.com\napi.predict.fun\ndata-api.binance.vision';
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
  const toc = [['need-h', t('start.need.title')], ['phone-h', t('start.phone.title')], ['computer-h', t('start.computer.title')], ['agent-h', t('start.agent.title')], ['any-h', t('start.any.title')], ['next-h', t('start.next.title')]].map(([id, label]) => ({ id, label }));
  const sec = `${card} scroll-mt-20`;
  return (
    <article className="space-y-5">
      <header className="max-w-[68ch]">
        <h1 className="text-2xl font-semibold">{t('start.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('start.time')}</p>
        <p className="mt-3">{t('start.intro')}</p>
      </header>
      <OnThisPage items={toc} />
      <section id="need-h" aria-labelledby="need-t" className={sec}>
        <h2 id="need-t" className={h2}>{t('start.need.title')}</h2>
        <ul className="list-disc space-y-1 pl-5">{raw<string[]>('start.need.list').map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
      <section id="phone-h" aria-labelledby="phone-t" className={sec}>
        <h2 id="phone-t" className={h2}>1. {t('start.phone.title')}</h2>
        <p className="mb-3">{t('start.phone.intro')}</p>
        <figure className="mb-4">
          <img src={`${import.meta.env.BASE_URL}start/workflow.webp`} width={1280} height={720} alt={t('start.video.alt')} loading="lazy" decoding="async" className="h-auto w-full rounded-md border border-line" />
          <figcaption className="mt-1 text-sm text-muted">{t('start.video.caption')}</figcaption>
        </figure>
        <ol className={ol}>{steps('phone').map((x, i) => (
          <li key={i}>
            {x}
            {i === 0 && <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 w-fit items-center rounded-md bg-accent px-4 font-semibold text-accent-ink">{t('start.phone.cta')}</a>}
            {PHONE_COPY[i] && <CopyBlock text={PHONE_COPY[i]} />}
            {PHONE_SHOTS[i]?.map((n) => <img key={n} src={`${import.meta.env.BASE_URL}start/${n}.webp`} width={SHOT_SIZE[n][0]} height={SHOT_SIZE[n][1]} alt={t(`start.phone.alt.${n}`)} loading="lazy" decoding="async" className={`mt-2 h-auto w-full rounded-md border border-line ${SHOT_SIZE[n][0] < 600 ? 'max-w-sm' : 'max-w-xl'}`} />)}
            {i === 5 && <div className="mt-2"><Callout kind="important"><p>{t('start.keyWarn')}</p></Callout></div>}
            {i === 7 && <ul className="mt-2 space-y-1">{raw<string[]>('start.phone.examples').map((e) => <li key={e}><CopyBlock text={e} /></li>)}</ul>}
          </li>
        ))}</ol>
      </section>
      <section id="computer-h" aria-labelledby="computer-t" className={sec}>
        <h2 id="computer-t" className={h2}>2. {t('start.computer.title')}</h2>
        <ol className={ol}>{steps('computer').map((x, i) => <li key={i}>{x}{i === 1 && <><CopyBlock text={QUICK_COMMAND} /><span className="mt-2 block text-sm">{t('start.computer.windows')}</span><CopyBlock text={QUICK_COMMAND_WINDOWS} /></>}</li>)}</ol>
      </section>
      <section id="agent-h" aria-labelledby="agent-t" className={sec}>
        <h2 id="agent-t" className={h2}>3. {t('start.agent.title')}</h2>
        <ol className={ol}>{steps('agent').map((x, i) => <li key={i}>{x}{i < 2 && <CopyBlock text={SKILL_COMMANDS[i]} />}</li>)}</ol>
      </section>
      <section id="any-h" aria-labelledby="any-t" className={sec}>
        <h2 id="any-t" className={h2}>{t('start.any.title')}</h2>
        <p>{t('start.any.intro')}</p>
        <ol className={`mt-3 ${ol}`}>{steps('any').map((x, i) => <li key={i}>{x}{i > 0 && <CopyBlock text={ANY_COMMANDS[i - 1]} />}</li>)}</ol>
        <p className="mt-3 text-sm text-muted">{t('start.any.note')}</p>
      </section>
      <Callout kind="note"><p>{t('start.reveal')}</p><CopyBlock text={REVEAL_COMMAND} /></Callout>
      <section id="next-h" aria-labelledby="next-t" className="max-w-[68ch] scroll-mt-20">
        <h2 id="next-t" className={h2}>{t('start.next.title')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><a href="#/me" className="text-accent underline underline-offset-4">{t('start.next.me')}</a></li>
          <li><a href="#/leaderboard" className="text-accent underline underline-offset-4">{t('start.next.leaderboard')}</a></li>
          <li><a href="#/docs/scoring" className="text-accent underline underline-offset-4">{t('start.next.scoring')}</a></li>
        </ul>
      </section>
    </article>
  );
}
