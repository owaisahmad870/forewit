// Copyable commands shown in "How to play". Code, not prose, so they stay out of the locale files.
// CLI lines follow agent/README.md (Quickstart). The skill install lines are a draft until the repository is public.
export const SKILL_COMMANDS = [
  'git clone <repository URL> prescient && cd prescient',
  'mkdir -p .claude/skills/prescient && cp agent/SKILL.md .claude/skills/prescient/',
  'claude "Play today\'s PRESCIENT round"',
].join('\n');

export const CLI_COMMANDS = [
  'node agent/prescient.mjs round --round-file <URL of the public round JSON>',
  'node agent/prescient.mjs forecast --p 72,15,50',
  'baw wallet address --json',
  'node agent/prescient.mjs commit --from 0xYourAgenticWallet --p 72,15,50',
  'node agent/prescient.mjs receipt --from 0xYourAgenticWallet',
  'node agent/prescient.mjs reveal --from 0xYourAgenticWallet',
  'node agent/prescient.mjs status --from 0xYourAgenticWallet',
].join('\n');
