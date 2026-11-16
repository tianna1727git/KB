import {parseArgs} from 'node:util';
import {hashPassword} from '../lib/studio/password-crypto.mjs';

const {values} = parseArgs({options: {
  workspace: {type: 'string'}, username: {type: 'string'}, email: {type: 'string'}, 'user-id': {type: 'string'},
}});
const workspace = values.workspace, username = values.username, email = values.email;
const userId = values['user-id'] || `${workspace}-owner`;
if (!['kb', 'pmi'].includes(workspace) || !username?.trim() || username !== username.trim() || username.length > 80 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || !/^[A-Za-z0-9_-]{1,80}$/.test(userId)) {
  console.error('Usage: node scripts/create-login-account.mjs --workspace kb|pmi --username NAME --email EMAIL [--user-id STABLE_ID]');
  process.exit(1);
}
async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = ''; for await (const chunk of process.stdin) value += chunk;
    return value.replace(/\r?\n$/, '');
  }
  process.stderr.write('输入密码（至少12位，不回显）：');
  process.stdin.setRawMode(true); process.stdin.setEncoding('utf8'); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', onData); process.stderr.write('\n');};
    function onData(chunk) {
      for (const c of chunk) {
        if (c === '\u0003') { finish(); reject(Error('已取消')); return; }
        if (c === '\r' || c === '\n') { finish(); resolve(value); return; }
        if (c === '\u007f' || c === '\b') value = [...value].slice(0, -1).join('');
        else if (c >= ' ') value += c;
      }
    }
    process.stdin.on('data', onData);
  });
}
const password = await readPassword();
if (password.length < 12 || password.length > 256) {console.error('密码长度必须为12至256位。'); process.exit(1);}
console.log(JSON.stringify({username, userId, email, workspace, passwordHash: await hashPassword(password)}, null, 2));
