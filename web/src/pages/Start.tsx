import { Callout, CopyBlock } from '../components';
import { DocSection, DocShell, Steps } from '../DocShell';
import { useT } from '../i18n';
import { CONNECTOR_URL, INSTALL_SNIPPETS, TEMPLATE_URL } from '../commands';

// Commands, URL and hosts keep hyphens, so they live in code, not in the locale files (src/test/start.test.tsx checks them).
const PHONE_HOSTS = 'www.binance.com\nbsc-rpc.publicnode.com\nforewit.xyz\napi.github.com\napi.predict.fun\ndata-api.binance.vision';
// Real screenshots in public/start, one list per phone step (index matches start.phone.steps).
const PHONE_SHOTS: (string[] | undefined)[] = [['template'], ['private'], ['repo'], ['envmenu', 'envname'], ['network'], ['envvars'], ['connector']];
const PHONE_COPY: (string | undefined)[] = [undefined, undefined, undefined, undefined, PHONE_HOSTS, 'PREDICT_API_KEY=', CONNECTOR_URL];
const SHOT_SIZE: Record<string, [number, number]> = { template: [542, 122], private: [770, 445], repo: [780, 229], envmenu: [780, 299], envname: [526, 678], network: [526, 459], envvars: [526, 347], connector: [526, 412] };
export const SKILL_COMMANDS = ['npx skills add binance/binance-skills-hub --skill binance-agentic-wallet\nnpm install -g @binance/agentic-wallet@1.12.0', 'npx skills add owaisahmad870/forewit --skill forewit'];
export const QUICK_COMMAND = 'npx forewit@latest start';
export const QUICK_COMMAND_WINDOWS = 'npx.cmd forewit@latest start';
export const REVEAL_COMMAND = 'npx forewit@latest reveal --execute';
export const ANY_COMMANDS = ['npx forewit@latest markets --search "bitcoin"', 'npx forewit@latest predict --market <id> --p 65 --auto-reveal --execute'];

const link = 'text-accent underline underline-offset-4';

export function Start() {
  const { t, raw } = useT();
  const steps = (k: string) => raw<string[]>(`start.${k}.steps`);
  const toc = [['need-h', t('start.need.title')], ['phone-h', t('start.phone.title')], ['computer-h', t('start.computer.title')], ['agent-h', t('start.agent.title')], ['any-h', t('start.any.title')], ['next-h', t('start.next.title')]].map(([id, label]) => ({ id, label }));
  return (
    <DocShell current="start" title={t('start.title')} lead={t('start.intro')} meta={t('start.time')} toc={toc}>
      <DocSection id="need-h" title={t('start.need.title')}>
        <ul className="list-disc space-y-1.5 pl-5">{raw<string[]>('start.need.list').map((x, i) => <li key={i}>{x}</li>)}</ul>
      </DocSection>
      <DocSection id="phone-h" title={`1. ${t('start.phone.title')}`}>
        <p className="mb-4">{t('start.phone.intro')}</p>
        <figure className="mb-6">
          <img src={`${import.meta.env.BASE_URL}start/workflow.webp`} width={1280} height={720} alt={t('start.video.alt')} loading="lazy" decoding="async" className="h-auto w-full rounded-lg border border-line" />
          <figcaption className="mt-2 text-sm text-muted">{t('start.video.caption')}</figcaption>
        </figure>
        <Steps>{steps('phone').map((x, i) => (
          <>
            <p>{x}</p>
            {i === 0 && <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-semibold text-accent-ink">{t('start.phone.cta')}</a>}
            {PHONE_COPY[i] && <CopyBlock text={PHONE_COPY[i]} />}
            {PHONE_SHOTS[i]?.map((n) => <img key={n} src={`${import.meta.env.BASE_URL}start/${n}.webp`} width={SHOT_SIZE[n][0]} height={SHOT_SIZE[n][1]} alt={t(`start.phone.alt.${n}`)} loading="lazy" decoding="async" className={`mt-3 h-auto w-full rounded-md border border-line ${SHOT_SIZE[n][0] < 600 ? 'max-w-sm' : 'max-w-xl'}`} />)}
            {i === 5 && <div className="mt-3"><Callout kind="important"><p>{t('start.keyWarn')}</p></Callout></div>}
            {i === 7 && <ul className="mt-2 space-y-1">{raw<string[]>('start.phone.examples').map((e) => <li key={e}><CopyBlock text={e} /></li>)}</ul>}
          </>
        ))}</Steps>
      </DocSection>
      <DocSection id="computer-h" title={`2. ${t('start.computer.title')}`}>
        <Steps>{steps('computer').map((x, i) => <><p>{x}</p>{i === 1 && <><CopyBlock text={QUICK_COMMAND} /><p className="mt-3 text-sm text-muted">{t('start.computer.windows')}</p><CopyBlock text={QUICK_COMMAND_WINDOWS} /></>}</>)}</Steps>
      </DocSection>
      <DocSection id="agent-h" title={`3. ${t('start.agent.title')}`}>
        <div className="mb-6"><Callout kind="tip"><p>{t('start.pluginTip')}</p><CopyBlock text={INSTALL_SNIPPETS.plugin} /></Callout></div>
        <Steps>{steps('agent').map((x, i) => <><p>{x}</p>{i < 2 && <CopyBlock text={SKILL_COMMANDS[i]} />}</>)}</Steps>
      </DocSection>
      <DocSection id="any-h" title={t('start.any.title')}>
        <p className="mb-4">{t('start.any.intro')}</p>
        <Steps>{steps('any').map((x, i) => <><p>{x}</p>{i > 0 && <CopyBlock text={ANY_COMMANDS[i - 1]} />}</>)}</Steps>
        <p className="mt-4 text-sm text-muted">{t('start.any.note')}</p>
        <div className="mt-6"><Callout kind="note"><p>{t('start.reveal')}</p><CopyBlock text={REVEAL_COMMAND} /></Callout></div>
      </DocSection>
      <DocSection id="next-h" title={t('start.next.title')}>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><a href="#/me" className={link}>{t('start.next.me')}</a></li>
          <li><a href="#/leaderboard" className={link}>{t('start.next.leaderboard')}</a></li>
          <li><a href="#/docs/scoring" className={link}>{t('start.next.scoring')}</a></li>
        </ul>
      </DocSection>
    </DocShell>
  );
}
