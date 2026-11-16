import {readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync} from 'node:fs';
import {resolve, join, isAbsolute} from 'node:path';
import {parseArgs} from 'node:util';
import {randomToken, validPasswordHash} from '../lib/studio/password-crypto.mjs';

const {values} = parseArgs({options: {root: {type: 'string'}, origin: {type: 'string', default: 'https://tianna.net.cn'}, 'refresh-build-config': {type: 'boolean', default: false}}});
if (!values.root || !isAbsolute(values.root)) throw Error('--root must be the absolute payo-workspaces directory');
const origin = new URL(values.origin);
if (origin.protocol !== 'https:' || origin.origin !== values.origin) throw Error('--origin must be an HTTPS origin without a trailing slash');
const root = resolve(values.root), secretDir = join(root, 'secrets');
const accounts = ['kb', 'pmi'].map(workspace => {
  const account = JSON.parse(readFileSync(join(secretDir, workspace + '-account.json'), 'utf8'));
  if (account.workspace !== workspace || typeof account.username !== 'string' || !account.username.trim() || account.username !== account.username.trim() || account.username.length > 80 ||
    typeof account.userId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(account.userId) ||
    typeof account.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) || !validPasswordHash(account.passwordHash)) throw Error('Invalid account file for ' + workspace);
  return account;
});
if (accounts[0].userId === accounts[1].userId || accounts[0].username === accounts[1].username) throw Error('Accounts must be distinct');
function previousKey(workspace) {
  const source = readFileSync(join(secretDir, workspace + '.env'), 'utf8');
  const match = source.match(/^MODEL_SETTINGS_ENCRYPTION_KEY='([a-f0-9]{64})'\s*$/m);
  if (!match) throw Error('Missing original model encryption key for ' + workspace);
  return match[1];
}
function dotenv(vars) {
  return Object.entries(vars).map(([key, value]) => {
    if (/[\r\n']/.test(value)) throw Error('Unsupported environment value');
    return `${key}='${value}'`;
  }).join('\n') + '\n';
}
const proxySecret = randomToken();
const outputs = [[join(secretDir, 'gateway.env'), dotenv({
  STUDIO_AUTH_MODE: 'password', AUTH_TOPOLOGY: 'single-origin', AUTH_WORKSPACE: 'gateway',
  AUTH_PUBLIC_ORIGIN: origin.origin, AUTH_KB_ORIGIN: origin.origin, AUTH_PMI_ORIGIN: origin.origin,
  AUTH_HANDOFF_SECRET: randomToken(), AUTH_PROXY_SECRET: proxySecret,
  AUTH_ACCOUNTS_JSON: JSON.stringify(accounts).replaceAll("'", '\\u0027'),
  AUTH_DATABASE_PATH: join(root, 'data/auth/sessions.sqlite'),
  KB_UPSTREAM: 'http://127.0.0.1:5174', PMI_UPSTREAM: 'http://127.0.0.1:5175', GATEWAY_PORT: '5176',
})]];
for (const workspace of ['kb', 'pmi']) {
  outputs.push([join(secretDir, workspace + '-gateway.env'), dotenv({
    STUDIO_AUTH_MODE: 'gateway', AUTH_WORKSPACE: workspace, AUTH_PUBLIC_ORIGIN: origin.origin,
    AUTH_PROXY_SECRET: proxySecret, MODEL_SETTINGS_ENCRYPTION_KEY: previousKey(workspace),
  })]);
  const serverDir = join(root, workspace, 'dist/server');
  const config = JSON.parse(readFileSync(join(serverDir, 'wrangler.json'), 'utf8'));
  config.vars = {...config.vars, STUDIO_AUTH_MODE: 'gateway', AUTH_WORKSPACE: workspace, AUTH_PUBLIC_ORIGIN: origin.origin};
  config.assets = {...config.assets, binding: 'ASSETS', run_worker_first: true, not_found_handling: 'none'};
  outputs.push([join(serverDir, 'wrangler.gateway.json'), JSON.stringify(config, null, 2) + '\n']);
}
const refresh = values['refresh-build-config'];
if (refresh) {
  if (!['gateway.env','kb-gateway.env','pmi-gateway.env'].every(file => existsSync(join(secretDir,file))) ||
    !readFileSync(join(secretDir,'gateway.env'),'utf8').includes(`AUTH_PUBLIC_ORIGIN='${origin.origin}'\n`)) throw Error('Matching gateway secrets are required before refreshing build config');
} else if (outputs.some(([path]) => existsSync(path))) throw Error('A gateway configuration already exists; nothing was overwritten');
mkdirSync(secretDir, {recursive: true, mode: 0o700}); chmodSync(secretDir, 0o700);
for (const [path, content] of outputs.filter(([path]) => !refresh || path.endsWith('wrangler.gateway.json'))) writeFileSync(path, content, {flag: refresh ? 'w' : 'wx', mode: 0o600});
console.log(refresh ? 'Build configurations refreshed; all secrets and data were preserved.' : 'Single-origin configuration created. Existing accounts, encryption keys and workspace data were preserved. No services were started.');
