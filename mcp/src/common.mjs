// Helpers shared by both Forewit MCP servers.
import { z } from 'zod';

export const VERSION = '0.1.0';

/** Wraps structured output the way MCP 2025-06-18 and later expect: structuredContent plus the same JSON as text. */
export const ok = (data) => ({ structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }] });

/** A tool execution error (isError true), never a protocol error. Messages never echo market text. */
export const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

/** Runs a handler and turns any thrown Error into a tool execution error. */
export const guarded = (fn) => async (args, extra) => {
  try {
    return await fn(args, extra);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
};

// Cursor pagination: the cursor is an opaque base64url offset.
export const cursorInput = {
  cursor: z.string().max(64).optional().describe('Opaque cursor from next_cursor of the previous page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page, 1 to 100, default 25.'),
};

export function paginate(items, { cursor, limit = 25 }) {
  let start = 0;
  if (cursor !== undefined) {
    const text = Buffer.from(cursor, 'base64url').toString('utf8');
    if (!/^\d{1,9}$/.test(text) || Number(text) > items.length) throw new Error('invalid cursor');
    start = Number(text);
  }
  const end = start + limit;
  return { page: items.slice(start, end), next_cursor: end < items.length ? Buffer.from(String(end)).toString('base64url') : null };
}

export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x prefixed 20 byte hex address');
export const roundId = z.number().int().min(1).max(1e9);
