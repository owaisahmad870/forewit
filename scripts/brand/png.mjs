// Renders the Forewit PNG set from brand/*.svg with headless Chrome at 2x, then scripts/brand/resize.py makes the exact sizes.
// Run after build.py: node scripts/brand/png.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome not found');
const OUT = resolve('brand/png'); mkdirSync(OUT, { recursive: true });
const TMP = resolve(tmpdir(), 'forewit_brand'); mkdirSync(TMP, { recursive: true });
const url = (p) => 'file:///' + resolve(p).replace(/\\/g, '/').replace(/ /g, '%20');
const svg = (n) => readFileSync(`brand/${n}.svg`, 'utf8').replace(/<title>.*?<\/title>/, '');
const FONTS = `@font-face{font-family:Plex;font-weight:400;src:url(${url('web/node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff')})}
@font-face{font-family:Plex;font-weight:500;src:url(${url('web/node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff')})}`;
const LIME = '#BCF053', BG = '#04090C', OFF = '#F2F4F5', MUTED = '#8C979E';

// A faint pixel staircase in a corner, the same motif as the climbing i dot.
const stairs = (x, y, cell, n) => Array.from({ length: n }, (_, c) => Array.from({ length: c + 1 }, (_, r) =>
  `<rect x="${x + c * cell * 1.25}" y="${y - r * cell * 1.25}" width="${cell}" height="${cell}" fill="${LIME}" opacity="${(0.05 + 0.2 * (c / n)).toFixed(2)}"/>`).join('')).join('');

const page = (w, h, body, bg = BG) => `<!doctype html><meta charset="utf-8"><style>${FONTS}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}
body{font-family:Plex,sans-serif;color:${OFF}}</style>${body}`;

const banner = (w, h, wordW, tag, sub, deco) => page(w, h, `<svg width="${w}" height="${h}" style="position:absolute;inset:0">${deco}</svg>
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(h * 0.05)}px">
<div style="width:${wordW}px">${svg('forewit_wordmark_dark').replace('<svg ', '<svg width="100%" ')}</div>
<div style="font-size:${Math.round(h * 0.062)}px;font-weight:500;letter-spacing:-0.01em">${tag}</div>
<div style="font-size:${Math.round(h * 0.04)}px;color:${MUTED}">${sub}</div></div>`);

const jobs = {
  x_header: [1500, 500, banner(1500, 500, 520, 'Your edge, on the record.', 'Sealed forecasts, benchmarked against the market price  ·  forewit.xyz', stairs(1240, 440, 22, 7))],
  og: [1200, 630, banner(1200, 630, 560, 'Your edge, on the record.', 'Sealed forecasts, benchmarked against the market price  ·  forewit.xyz', stairs(960, 570, 22, 7))],
  x_avatar: [800, 800, page(800, 800, `<div style="position:absolute;inset:0">${svg('forewit_avatar_dark').replace('<svg ', '<svg width="800" height="800" ').replace(/rx="\d+"/, 'rx="0"')}</div>`)],
  icon_dark: [1024, 1024, page(1024, 1024, svg('forewit_icon_dark').replace('<svg ', '<svg width="1024" height="1024" '), 'transparent')],
  icon_light: [1024, 1024, page(1024, 1024, svg('forewit_icon_light').replace('<svg ', '<svg width="1024" height="1024" '), 'transparent')],
  wordmark_dark: [2400, 656, page(2400, 656, svg('forewit_wordmark_dark').replace('<svg ', '<svg width="2400" '), 'transparent')],
  wordmark_light: [2400, 656, page(2400, 656, svg('forewit_wordmark_light').replace('<svg ', '<svg width="2400" '), 'transparent')],
};
for (const [name, [w, h, html]] of Object.entries(jobs)) {
  const f = resolve(TMP, name + '.html'); writeFileSync(f, html);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--default-background-color=00000000',
    `--window-size=${w},${h}`, `--screenshot=${resolve(OUT, name + '@2x.png')}`, url(f)], { stdio: 'ignore' });
  console.log(`brand/png/${name}@2x.png`);
}
