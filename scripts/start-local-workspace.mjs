import {parseArgs} from 'node:util';
import {join, isAbsolute} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

const {values} = parseArgs({options: {root: {type: 'string'}, workspace: {type: 'string'}}});
if (!values.root || !isAbsolute(values.root) || !['kb','pmi'].includes(values.workspace)) throw Error('Required: --root ABSOLUTE_DIRECTORY --workspace kb|pmi');
const workspace = values.workspace, directory = join(values.root, workspace);
const config = join(directory, 'dist/server/wrangler.gateway.json');
const envFile = join(values.root, 'secrets', workspace + '-gateway.env');
if (!existsSync(config) || !existsSync(envFile)) throw Error('Run configure-single-origin.mjs first');
const settings = JSON.parse(readFileSync(config, 'utf8'));
if (settings.vars?.STUDIO_AUTH_MODE !== 'gateway' || settings.vars?.AUTH_WORKSPACE !== workspace || settings.assets?.run_worker_first !== true) throw Error('Invalid gateway backend configuration');
const child = spawn(process.execPath, [
  '--import', join(directory, 'scripts/sites-env.mjs'), join(directory, 'node_modules/wrangler/bin/wrangler.js'), 'dev',
  '--config', config, '--local', '--persist-to', join(values.root, 'data', workspace), '--env-file', envFile,
  '--ip', '127.0.0.1', '--port', workspace === 'kb' ? '5174' : '5175', '--local-protocol', 'http', '--upstream-protocol', 'http', '--inspector-port', '0',
], {cwd: directory, stdio: 'inherit'});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => {console.error('Workspace could not start'); process.exitCode = 1;});
child.on('exit', code => {process.exitCode = code ?? 0;});
