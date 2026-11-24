// Copies the shared Forewit code into vendor/ so the npm package carries the exact code the repo tests:
// the zero dependency agent CLI, the site's data layer (types stripped) and the scoring docs in both languages.
// Run from any folder; vendor/ is generated, never edited by hand.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const out = (p) => fileURLToPath(new URL(`../vendor/${p}`, import.meta.url));

rmSync(out(''), { recursive: true, force: true });
mkdirSync(out('agent/lib'), { recursive: true });
mkdirSync(out('web'), { recursive: true });
for (const f of ['forewit.mjs', 'config.mjs']) cpSync(root(`agent/${f}`), out(`agent/${f}`));
cpSync(root('agent/lib'), out('agent/lib'), { recursive: true });
cpSync(root('web/src/lib/question.mjs'), out('web/question.mjs'));
cpSync(root('LICENSE'), fileURLToPath(new URL('../LICENSE', import.meta.url))); // npm packs LICENSE from the package folder only
process.removeAllListeners('warning'); // stripTypeScriptTypes prints an experimental warning on every build
writeFileSync(out('web/data.mjs'), stripTypeScriptTypes(readFileSync(root('web/src/lib/data.ts'), 'utf8')));
const scoring = Object.fromEntries(['en', 'zh'].map((l) => [l, JSON.parse(readFileSync(root(`web/src/locales/${l}.json`), 'utf8')).docs.pages.scoring]));
writeFileSync(out('scoring.json'), JSON.stringify(scoring, null, 1) + '\n');
console.error('forewit mcp: vendor/ built');
