// Text for public channels (the alerts issue): GitHub masks secrets in job logs, not in API comment bodies.
// Drops URLs (a keyed RPC URL carries its key) and any long token that is not a 0x hex value (tx hashes and
// addresses stay readable).
export function redactPublic(msg) {
  return String(msg)
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/(?<![0-9A-Za-z_-])(?!0x)[A-Za-z0-9_-]{32,}/g, '<redacted>');
}
