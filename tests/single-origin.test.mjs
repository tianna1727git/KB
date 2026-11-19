import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request as httpRequest, createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
import {Miniflare, createFetchMock} from 'miniflare';
import {build} from 'esbuild';
import {openAuthDatabase} from '../server/auth-database.mjs';
import {createGateway} from '../server/gateway.mjs';
import {gatewayIdentity, signGatewayRequest} from '../lib/studio/gateway-identity.mjs';
import {hashPassword, randomToken, signTicket} from '../lib/studio/password-crypto.mjs';

const origin = 'https://tianna.net.cn';
const directory = mkdtempSync(join(tmpdir(), 'payo-gateway-test-'));
const passwordHash = await hashPassword('test-password-for-gateway');
const accounts = ['kb','pmi'].map(workspace => ({workspace, username: workspace === 'kb' ? 'Payo KB' : 'PMI KB', userId: workspace + '-owner', email: workspace + '@example.com', passwordHash}));
const secret = randomToken();
const environment = {STUDIO_AUTH_MODE: 'password', AUTH_TOPOLOGY: 'single-origin', AUTH_WORKSPACE: 'gateway',
  AUTH_PUBLIC_ORIGIN: origin, AUTH_KB_ORIGIN: origin, AUTH_PMI_ORIGIN: origin,
  AUTH_HANDOFF_SECRET: randomToken(), AUTH_PROXY_SECRET: secret, AUTH_ACCOUNTS_JSON: JSON.stringify(accounts)};

function call(port, path, {method='GET', body, cookie, headers={}} = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({hostname:'127.0.0.1',port,path,method,headers:{host:'tianna.net.cn',...(cookie?{cookie}:{}),...(body?{'content-type':'application/x-www-form-urlencoded',origin}:{}),...headers}}, res => {
      let text=''; res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });req.on('error',reject);req.end(body);
  });
}
const listen = server => new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close = server => new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
function identityRequest() {return new Request(origin+'/api/studio/state',{headers:{'oai-authenticated-user-id':'kb-owner','oai-authenticated-user-email':'kb@example.com','oai-authenticated-user-full-name':'Payo%20KB'}});}

test('backend rejects unsigned, altered, expired and cross-workspace identity assertions', async()=>{
  const request=identityRequest(), token=await signGatewayRequest(request,'kb',secret);
  const env={AUTH_PROXY_SECRET:secret,AUTH_WORKSPACE:'kb',AUTH_PUBLIC_ORIGIN:origin};
  const signed=(value,path='/api/studio/state',method='GET')=>new Request('http://127.0.0.1:5174'+path,{method,headers:{'x-studio-proxy-auth':value,'oai-authenticated-user-id':'forged'}});
  const valid=await gatewayIdentity(signed(token),env);
  assert.equal(valid.request.url,origin+'/api/studio/state');
  assert.equal(valid.request.headers.get('oai-authenticated-user-id'),'kb-owner');
  for(const [req,config] of [[signed(''),env],[signed(token+'x'),env],[signed(token),{...env,AUTH_WORKSPACE:'pmi'}],[signed(token,'/other'),env],[signed(token,undefined,'POST'),env],[signed(token),{...env,AUTH_PROXY_SECRET:randomToken()}]])assert.equal((await gatewayIdentity(req,config)).response.status,401);
  const claims=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
  const expired=await signTicket({...claims,exp:Math.floor(Date.now()/1000)-1},secret);
  assert.equal((await gatewayIdentity(signed(expired),env)).response.status,401);
});

test('one public origin routes real Worker APIs and POSTs by session, blocks bypass, and revokes logout', async()=>{
  mkdirSync('.sites-runtime/tests',{recursive:true});
  await build({entryPoints:['tests/password-auth-worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'.sites-runtime/tests/single-origin.mjs'});
  const mocks=[], bridges=[];
  const authDB=openAuthDatabase(join(directory,'auth.sqlite'));
  let gateway;
  try {
    const ports=[];
    for(const workspace of ['kb','pmi']) {
      const fetchMock=createFetchMock();fetchMock.disableNetConnect();
      const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/tests/single-origin.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock,
        bindings:{STUDIO_AUTH_MODE:'gateway',AUTH_WORKSPACE:workspace,AUTH_PUBLIC_ORIGIN:origin,AUTH_PROXY_SECRET:secret}});
      mocks.push(mf);
      const db=await mf.getD1Database('DB');
      for(const statement of readFileSync('drizzle/0000_mature_bug.sql','utf8').replaceAll('--> statement-breakpoint','').split(';').filter(s=>s.trim()))await db.prepare(statement).run();
      const bridge=createServer(async(req,res)=>{
        try {
          const chunks=[];for await(const chunk of req)chunks.push(chunk);
          const response=await mf.dispatchFetch('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
          res.writeHead(response.status,Object.fromEntries(response.headers));
          if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
        }catch{res.writeHead(500);res.end();}
      });bridges.push(bridge);ports.push(await listen(bridge));
    }
    gateway=createGateway({...environment,DB:authDB,KB_UPSTREAM:'http://127.0.0.1:'+ports[0],PMI_UPSTREAM:'http://127.0.0.1:'+ports[1]});
    const port=await listen(gateway);
    assert.equal((await call(port,'/login')).status,200);
    assert.equal((await call(port,'/api/studio/state')).status,401);
    assert.equal((await call(port,'/login',{headers:{host:'evil.example'}})).status,421);
    assert.equal((await call(port,'/mcp')).status,403);
    for(const account of accounts){
      const result=await call(port,'/auth/login',{method:'POST',body:new URLSearchParams({username:account.username,password:'test-password-for-gateway'}).toString()});
      assert.equal(result.status,303,result.text);assert.equal(result.headers.location,'/');
      const cookie=result.headers['set-cookie'][0].split(';')[0];
      const state=await call(port,'/api/studio/state?workspace=other',{cookie,headers:{'x-studio-workspace':account.workspace==='kb'?'pmi':'kb','oai-authenticated-user-id':'forged','x-studio-proxy-auth':'forged'}});
      assert.equal(state.status,200,state.text);assert.equal(JSON.parse(state.text).user.id,account.userId);
      assert.equal(state.headers['cache-control'],'private, no-store');assert.equal(state.text.includes('x-studio-proxy-auth'),false);
      const echo=await call(port,'/__test_echo',{method:'POST',cookie,body:'hello='+encodeURIComponent('中文上传内容')});
      assert.equal(echo.status,200);assert.equal(JSON.parse(echo.text).workspace,account.workspace);assert.equal(JSON.parse(echo.text).body,'hello='+encodeURIComponent('中文上传内容'));
      assert.equal((await call(port,'/__test_echo',{method:'POST',cookie,body:'x=1',headers:{origin:'https://evil.example'}})).status,403);
      assert.equal((await call(ports[0],'/api/studio/state',{cookie})).status,401);
      assert.equal((await call(ports[1],'/api/studio/state',{cookie})).status,401);
      const logout=await call(port,'/auth/logout',{method:'POST',body:'',cookie,headers:{origin}});
      assert.equal(logout.status,303);assert.equal(logout.headers.location,origin+'/login');
      assert.equal((await call(port,'/api/studio/state',{cookie})).status,401);
    }
    const wrong=await call(port,'/auth/login',{method:'POST',body:'username=Payo+KB&password=wrong'});assert.equal(wrong.status,401);
  }finally{
    if(gateway)await close(gateway);
    for(const bridge of bridges)await close(bridge);
    for(const mf of mocks)await mf.dispose();
    authDB.close();
  }
});

test('configuration reuses account IDs, model keys and database bindings; refuses overwrites',()=>{
  const root=join(directory,'config');mkdirSync(join(root,'secrets'),{recursive:true});
  for(const account of accounts){
    writeFileSync(join(root,'secrets',account.workspace+'-account.json'),JSON.stringify(account));
    writeFileSync(join(root,'secrets',account.workspace+'.env'),"MODEL_SETTINGS_ENCRYPTION_KEY='"+'a'.repeat(64)+"'\n");
    mkdirSync(join(root,account.workspace,'dist/server'),{recursive:true});
    writeFileSync(join(root,account.workspace,'dist/server/wrangler.json'),JSON.stringify({main:'index.js',d1_databases:[{binding:'DB',database_id:'preserved'}],assets:{directory:'../client'}}));
  }
  const args=['scripts/configure-single-origin.mjs','--root',root];
  const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const config=JSON.parse(readFileSync(join(root,'kb/dist/server/wrangler.gateway.json'),'utf8'));
  assert.equal(config.d1_databases[0].database_id,'preserved');assert.equal(config.assets.run_worker_first,true);
  assert.equal(statSync(join(root,'secrets/gateway.env')).mode&0o777,0o600);
  assert.match(readFileSync(join(root,'secrets/kb-gateway.env'),'utf8'),new RegExp('a'.repeat(64)));
  assert.equal(result.stdout.includes(passwordHash),false);
  assert.notEqual(spawnSync(process.execPath,args).status,0);
  const original=readFileSync(join(root,'secrets/gateway.env'),'utf8');
  assert.equal(spawnSync(process.execPath,[...args,'--refresh-build-config']).status,0);
  assert.equal(readFileSync(join(root,'secrets/gateway.env'),'utf8'),original);
});

test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('Payo upload gateway streams above 40 MB while PMI retains its existing limit',async()=>{
 const db=openAuthDatabase(join(directory,'upload-gateway.sqlite')),backends=[];let gateway;
 try{
  const ports=[];for(const workspace of ['kb','pmi']){const server=createServer(async(req,res)=>{try{let size=0;for await(const chunk of req)size+=chunk.length;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({workspace,size}));}catch{res.destroy();}});backends.push(server);ports.push(await listen(server));}
  gateway=createGateway({...environment,DB:db,GATEWAY_KB_MAX_BODY_MB:'201',KB_UPSTREAM:'http://127.0.0.1:'+ports[0],PMI_UPSTREAM:'http://127.0.0.1:'+ports[1]});const port=await listen(gateway),body=Buffer.alloc(41*1024*1024,65);
  for(const account of accounts){const login=await call(port,'/auth/login',{method:'POST',body:new URLSearchParams({username:account.username,password:'test-password-for-gateway'}).toString()});assert.equal(login.status,303);const cookie=login.headers['set-cookie'][0].split(';')[0];const response=await call(port,'/api/studio/librarySubmitStream',{method:'POST',cookie,body,headers:{'content-type':'application/octet-stream','content-length':String(body.length)}});assert.equal(response.status,account.workspace==='kb'?200:413,response.text);if(account.workspace==='kb')assert.equal(JSON.parse(response.text).size,body.length);else{const chunked=await call(port,'/api/studio/librarySubmitStream',{method:'POST',cookie,body,headers:{'content-type':'application/octet-stream','transfer-encoding':'chunked'}});assert.equal(chunked.status,413,chunked.text);}}
 }finally{if(gateway)await close(gateway);for(const server of backends)await close(server);db.close();}
});
