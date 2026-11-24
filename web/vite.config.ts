import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Strict CSP, injected only into the production build (the dev server needs inline styles for hot reload).
// frame-ancestors is ignored in a meta tag; set it as a response header on the host.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  // Cloudflare Pages response headers: the same CSP plus what a meta tag cannot carry (frame-ancestors, HSTS).
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
  },
});

export const HEADERS = [
  '/*',
  `  Content-Security-Policy: ${CSP}; frame-ancestors 'none'; upgrade-insecure-requests`,
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  '  Cross-Origin-Opener-Policy: same-origin',
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '/data/*',
  '  Cache-Control: public, max-age=60',
  '',
].join('\n');

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), csp()],
  build: { assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
