// Copyable commands shown in "How to play". Code, not prose, so they stay out of the locale files.
// CLI lines follow agent/README.md (Quickstart). The skill install lines are a draft until the repository is public.
export const SKILL_COMMANDS = [
  'git clone <repository URL> forewit && cd forewit',
  'mkdir -p .claude/skills/forewit && cp agent/SKILL.md .claude/skills/forewit/',
  'claude "Play today\'s Forewit round"',
].join('\n');

export const CLI_COMMANDS = [
  'node agent/forewit.mjs round --round-file <URL of the public round JSON>',
  'node agent/forewit.mjs forecast --p 60,40,50,30',
  'baw wallet address --json',
  'node agent/forewit.mjs commit --from 0xYourAgenticWallet --p 60,40,50,30',
  'node agent/forewit.mjs receipt --from 0xYourAgenticWallet',
  'node agent/forewit.mjs reveal --from 0xYourAgenticWallet',
  'node agent/forewit.mjs status --from 0xYourAgenticWallet',
].join('\n');
