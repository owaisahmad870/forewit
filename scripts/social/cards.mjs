// Social cards for X and Binance Square (1200 x 675), rendered from live round data so every number is correct.
// Run: node scripts/social/cards.mjs [roundFile]   writes docs/posts/img/*.svg and *.png (PNG via headless Chrome)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = 'docs/posts/img';
mkdirSync(OUT, { recursive: true });
const M = JSON.parse(readFileSync('brand/mark.json', 'utf8'));
const C = { bg: '#04090C', surface: '#0E151A', line: '#1F2A30', text: '#F2F4F5', muted: '#8C979E', accent: '#BCF053', pos: '#7be0ae', market: '#98a2b3' };
const FONT = "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const frame = (body, foot = 'forewit.xyz') => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" font-family="${FONT}">
<rect width="1200" height="675" fill="${C.bg}"/>
<circle cx="1080" cy="80" r="260" fill="${C.accent}" opacity="0.07"/>
<g transform="translate(64 72) scale(0.028)"><path fill="${C.text}" d="${M.word}"/><path fill="${C.accent}" d="${M.steps}"/></g>
<text x="${64 + M.viewBox[2] * 0.028 + 14}" y="72" font-size="26" fill="${C.muted}">先见</text>
${body}
<line x1="64" y1="600" x2="1136" y2="600" stroke="${C.line}"/>
<text x="64" y="638" font-size="22" fill="${C.muted}">${esc(foot)}</text>
<text x="1136" y="638" font-size="22" fill="${C.muted}" text-anchor="end">BNB Smart Chain · Agent ID</text>
</svg>`;

function roundCard(r) {
  const dl = new Date(r.commitDeadline);
  const when = `${dl.toUTCString().slice(5, 16)} ${dl.toISOString().slice(11, 16)} UTC`;
  const rows = r.questions.slice(0, 6).map((q, i) => {
    const label = q.label && q.label !== q.eventQuestion ? `  ·  ${q.label}` : '';
    return `<text x="96" y="${262 + i * 58}" font-size="28" fill="${C.text}"><tspan fill="${C.accent}" font-weight="700">${i + 1}</tspan>   ${esc(q.eventQuestion)}<tspan fill="${C.muted}">${esc(label)}</tspan></text>`;
  }).join('\n');
  return frame(`<text x="64" y="160" font-size="56" font-weight="700" fill="${C.text}">Daily round ${r.roundId} is open</text>
<text x="64" y="206" font-size="26" fill="${C.muted}">Commit your forecast before ${when}. Scored against the market.</text>
${rows}
<rect x="64" y="${262 + Math.min(r.questions.length, 6) * 58}" width="560" height="56" rx="28" fill="${C.accent}"/>
<text x="344" y="${299 + Math.min(r.questions.length, 6) * 58}" font-size="26" font-weight="700" fill="${C.bg}" text-anchor="middle">Your Agent ID is your track record</text>`, 'Forecast with your Agent ID: forewit.xyz/#/start');
}

const step = (x, n, title, lines) => `<g transform="translate(${x} 200)"><rect width="320" height="330" rx="20" fill="${C.surface}" stroke="${C.line}"/>
<text x="32" y="70" font-size="44" font-weight="700" fill="${C.accent}">${n}</text><text x="32" y="130" font-size="34" font-weight="700" fill="${C.text}">${title}</text>
${lines.map((l, i) => `<text x="32" y="${185 + i * 38}" font-size="24" fill="${C.muted}">${esc(l)}</text>`).join('')}</g>`;

const howItWorks = () => frame(`<text x="64" y="150" font-size="50" font-weight="700" fill="${C.text}">A track record nobody can fake or buy</text>
${step(64, '1', 'Commit', ['A hidden hash of your', 'probabilities, signed by', 'your Agent ID wallet.'])}
${step(440, '2', 'Reveal', ['After the deadline, so', 'nobody can copy you and', 'nobody can change a call.'])}
${step(816, '3', 'Score', ['Brier score against the', 'market price at the', 'deadline. Skill, not luck.'])}`);

const oneVoice = () => frame(`<text x="64" y="160" font-size="54" font-weight="700" fill="${C.text}">One Agent ID, one voice</text>
<text x="64" y="215" font-size="28" fill="${C.muted}">Agent IDs cannot be transferred, so a record cannot be bought,</text>
<text x="64" y="255" font-size="28" fill="${C.muted}">and a crowd of Agent IDs cannot be stuffed with sock puppets.</text>
<g transform="translate(64 320)">${Array.from({ length: 24 }, (_, i) => `<circle cx="${(i % 12) * 88 + 30}" cy="${Math.floor(i / 12) * 90 + 40}" r="28" fill="${i % 5 === 0 ? C.accent : C.surface}" stroke="${C.line}"/>`).join('')}</g>
<text x="64" y="560" font-size="30" font-weight="700" fill="${C.pos}">Agent ID Crowd vs the market, scored every day.</text>`);

function brier() {
  const bar = (y, label, w, color, val) => `<text x="64" y="${y + 34}" font-size="28" fill="${C.text}">${label}</text>
<rect x="420" y="${y}" width="${w}" height="48" rx="8" fill="${color}"/><text x="${432 + w}" y="${y + 34}" font-size="26" fill="${C.muted}">${val}</text>`;
  return frame(`<text x="64" y="150" font-size="50" font-weight="700" fill="${C.text}">Accuracy is easy. Beating the market is not.</text>
<text x="64" y="200" font-size="26" fill="${C.muted}">Saying 90% on a 90% favourite is right 9 times in 10 and adds nothing.</text>
${bar(260, 'Raw accuracy', 460, C.market, 'rewards copying')}
${bar(340, 'Brier score', 380, '#5b6b88', 'rewards calibration')}
${bar(420, 'Skill vs market', 300, C.accent, 'rewards real insight')}
<text x="64" y="540" font-size="28" fill="${C.pos}">Forewit ranks skill: how much your Brier score beats the market's.</text>`);
}

const roundFile = process.argv[2] || 'keeper/archive/mainnet/rounds/1.json';
const cards = { how_it_works: howItWorks(), one_agent_id_one_voice: oneVoice(), brier_vs_market: brier() };
if (existsSync(roundFile)) { const r = JSON.parse(readFileSync(roundFile, 'utf8')); cards[`round_${r.roundId}`] = roundCard(r); }
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync);
for (const [name, svg] of Object.entries(cards)) {
  writeFileSync(`${OUT}/${name}.svg`, svg);
  if (chrome) execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1200,675', `--screenshot=${resolve(OUT, name + '.png')}`, 'file:///' + resolve(OUT, name + '.svg').replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log(`${OUT}/${name}.${chrome ? 'png' : 'svg'}`);
}
