// Writes a secret file atomically so that only the current user can read it.
// POSIX: directory 0700, file 0600. Windows: icacls removes inheritance and grants only the current user,
// then the ACL is read back and the write fails closed if any other principal remains.
import { mkdirSync, writeFileSync, renameSync, rmSync, chmodSync, statSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { dirname, join, resolve, parse, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';

const WIN = process.platform === 'win32';
// Absolute paths so a whoami or icacls earlier on PATH (Git Bash, MSYS) is never used.
const SYS32 = join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const run = (exe, args) => execFileSync(join(SYS32, exe), args, { encoding: 'utf8', windowsHide: true });

/** DOMAIN\user of the current Windows account. */
export function windowsUser() {
  const user = run('whoami.exe', []).trim();
  if (!/^[^\s:()]+\\[^:()]+$/.test(user)) throw new Error(`unexpected whoami output: ${user.slice(0, 80)}`);
  return user;
}

/** Principals in the ACL of `target`, parsed from icacls output. */
export function windowsPrincipals(target) {
  const lines = run('icacls.exe', [target]).split(/\r?\n/);
  if (!lines[0].startsWith(target + ' ')) throw new Error('unexpected icacls output');
  const principals = [];
  for (let i = 0; i < lines.length && lines[i].trim() !== ''; i++) {
    const ace = (i === 0 ? lines[i].slice(target.length) : lines[i]).trim();
    const at = ace.lastIndexOf(':(');
    if (at <= 0) throw new Error(`unparsed icacls entry: ${ace.slice(0, 80)}`);
    principals.push(ace.slice(0, at));
  }
  return principals;
}

function lockWindows(target, isDir, user) {
  run('icacls.exe', [target, '/inheritance:r', '/grant:r', `${user}:${isDir ? '(OI)(CI)F' : 'F'}`]);
  // /inheritance:r drops inherited entries only; explicit ones (often SYSTEM, Administrators) must be removed by name.
  for (const p of windowsPrincipals(target)) {
    if (p.toLowerCase() !== user.toLowerCase()) run('icacls.exe', [target, '/remove', /^S-1-[\d-]+$/.test(p) ? `*${p}` : p]);
  }
  const principals = windowsPrincipals(target);
  // Allow list, case insensitive: anything other than exactly the current user fails closed.
  const others = principals.filter((p) => p.toLowerCase() !== user.toLowerCase());
  if (principals.length === 0 || others.length) throw new Error(`ACL of ${target} still grants: ${others.join(', ') || 'nobody'}`);
}

function lockPosix(target, isDir) {
  chmodSync(target, isDir ? 0o700 : 0o600);
  if ((statSync(target).mode & 0o077) !== 0) throw new Error(`${target} is still accessible to group or others`);
}

function lock(target, isDir, user) {
  if (WIN) lockWindows(target, isDir, user);
  else lockPosix(target, isDir);
}

/** Throws unless `dir` is a dedicated subdirectory: locking home, temp or a drive root would lock out the system. */
export function assertDedicatedDir(dir) {
  for (const forbidden of [homedir(), tmpdir(), parse(resolve(dir)).root]) {
    if (resolve(dir).toLowerCase() === resolve(forbidden).toLowerCase()) throw new Error(`refusing to lock ${dir}; use a dedicated subdirectory`);
  }
}

/** Atomically writes `text` to `path`, readable only by the current user. Throws (and leaves no file) on failure. */
export function writeSecretFile(path, text) {
  const file = resolve(path);
  const dir = dirname(file);
  assertDedicatedDir(dir);
  const user = WIN ? windowsUser() : null;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  lock(dir, true, user); // new files in the directory now inherit owner only access
  const tmp = join(dir, `.${basename(file)}.${randomBytes(6).toString('hex')}.tmp`);
  let renamed = false;
  try {
    const fd = openSync(tmp, 'wx', 0o600);
    try {
      writeFileSync(fd, text, 'utf8');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    lock(tmp, false, user);
    renameSync(tmp, file);
    renamed = true;
    lock(file, false, user);
  } catch (err) {
    rmSync(tmp, { force: true });
    if (renamed) rmSync(file, { force: true }); // fail closed, but never delete a file this call did not replace
    throw err;
  }
  return file;
}
