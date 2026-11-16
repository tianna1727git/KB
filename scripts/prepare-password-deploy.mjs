import {parseArgs} from 'node:util';
import {readFileSync, writeFileSync} from 'node:fs';

const {values: args} = parseArgs({options: Object.fromEntries([
  'workspace', 'name', 'kb-origin', 'pmi-origin', 'database-id', 'database-name', 'bucket',
].map(key => [key, {type: 'string'}]))});
function httpsOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) throw Error('Origin must be an HTTPS origin without a trailing slash or path');
  return value;
}
if (!['kb', 'pmi'].includes(args.workspace) || !/^[a-z0-9-]{1,63}$/.test(args.name || '') ||
  !/^[a-f0-9-]{36}$/.test(args['database-id'] || '') || !args['database-name'] || !args.bucket) {
  throw Error('Required: --workspace kb|pmi --name WORKER --kb-origin HTTPS_ORIGIN --pmi-origin HTTPS_ORIGIN --database-id UUID --database-name NAME --bucket NAME');
}
const kb = httpsOrigin(args['kb-origin']), pmi = httpsOrigin(args['pmi-origin']);
if (kb === pmi) throw Error('The workspaces must use different origins');
const build = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
// A separate generated config leaves Sites hosting identity and build output intact.
const config = {
  name: args.name, main: build.main, compatibility_date: build.compatibility_date,
  compatibility_flags: build.compatibility_flags, no_bundle: true, rules: build.rules,
  assets: {directory: '../client', binding: 'ASSETS', run_worker_first: true, not_found_handling: 'none'},
  d1_databases: [{binding: 'DB', database_id: args['database-id'], database_name: args['database-name']}],
  r2_buckets: [{binding: 'BUCKET', bucket_name: args.bucket}],
  vars: {STUDIO_AUTH_MODE: 'password', AUTH_WORKSPACE: args.workspace, AUTH_KB_ORIGIN: kb, AUTH_PMI_ORIGIN: pmi},
  workers_dev: true,
};
writeFileSync('dist/server/wrangler.password.json', JSON.stringify(config, null, 2) + '\n');
console.log('Created dist/server/wrangler.password.json. Configure secrets before deploying.');
