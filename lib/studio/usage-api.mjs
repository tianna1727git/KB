import {validUsageScope,sourceUsage,publicReferenceURL,REFERENCE_POLICY} from './usage-scope.mjs';
export async function usageAPI(req,env,{get,list,uid,fail,json}){
 const action=new URL(req.url).pathname.split('/').pop(),libraries=await list('library'),documents=await list('document');
 const canonical=source=>source.kind==='document'?(libraries.find(f=>f.id===source.libraryId)||libraries.find(f=>f.sha256&&f.sha256===source.hash)||source):source;
 if(action==='referenceSettings'){
  const rid='reference-settings:'+uid;let current;try{current=await get(rid,'referenceSettings');}catch(e){if(e.code!==404)throw e;}
  if(req.method==='GET')return json({...current,...REFERENCE_POLICY,allowAlternativePublicSources:current?.allowAlternativePublicSources??REFERENCE_POLICY.allowAlternativePublicSources,revision:current?.revision||0});
  if(req.method!=='POST')fail('请求方法无效',405);const b=await req.json();if(typeof b.allowAlternativePublicSources!=='boolean'||!Number.isInteger(b.revision)||b.revision<0)fail('引用配置无效');
  const time=new Date().toISOString(),payload=JSON.stringify({allowAlternativePublicSources:b.allowAlternativePublicSources,unverifiedContent:REFERENCE_POLICY.unverifiedContent,writingMaterialRequiresPublicReference:false});
  const result=await env.DB.prepare("INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'referenceSettings',?,'saved',1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=studio_records.revision+1,updated=excluded.updated WHERE studio_records.owner=excluded.owner AND studio_records.revision=?").bind(rid,uid,payload,time,time,b.revision).run();
  if(!result.meta.changes)fail('引用配置已变化，请刷新',409);return json({...await get(rid,'referenceSettings'),unverifiedContent:REFERENCE_POLICY.unverifiedContent,writingMaterialRequiresPublicReference:false});
 }
 if(req.method!=='POST')fail('请求方法无效',405);const b=await req.json();
 if(action==='libraryUsageInitialize'){
  // Explicit, idempotent migration for the source named by the owner; never changes source versions.
  const target=await get(b.referenceId,'library');if(target.name!=='中国官网-本地收款账户')fail('请核对指定的参考引用资料');
  const targetURL=publicReferenceURL(target.sourceURL||target.source),sources=new Map([...libraries,...documents].map(source=>{const c=canonical(source);return [c.id,c];})),time=new Date().toISOString();
  let initialized=0;for(const batch of Array.from({length:Math.ceil(sources.size/50)},(_,i)=>[...sources.values()].slice(i*50,i*50+50))){const results=await env.DB.batch(batch.map(source=>env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'libraryUsage',?,'saved',1,?,?,?)").bind('library-usage:'+uid+':'+source.id,uid,JSON.stringify({sourceId:source.id,usageScope:source.id===target.id?'reference':'writing',referenceURL:source.id===target.id?targetURL:''}),time,time)));initialized+=results.reduce((n,r)=>n+r.meta.changes,0);}
  await env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'usageMigration',?,'saved',1,?,?,?)").bind('usage-migration-v1:'+uid,uid,JSON.stringify({referenceId:target.id,sourceCount:sources.size}),time,time).run();const usages=await list('libraryUsage');return json({initialized,total:sources.size,reference:[...sources.values()].filter(s=>sourceUsage(s,usages.find(m=>m.sourceId===s.id)).usageScope==='reference').map(s=>({id:s.id,name:s.name})),writing:[...sources.values()].filter(s=>sourceUsage(s,usages.find(m=>m.sourceId===s.id)).usageScope==='writing').length});
 }
 if(action!=='libraryUsageUpdate')fail('接口不存在',404);
 if(!validUsageScope(b.usageScope)||!Number.isInteger(b.usageRevision)||b.usageRevision<0)fail('请选择有效的使用范围');
 const source=await get(b.id);if(!['library','document'].includes(source.kind))fail('请选择资料库中的文件');const c=canonical(source),referenceURL=b.usageScope==='reference'?publicReferenceURL(b.referenceURL||c.sourceURL||c.source):'',rid='library-usage:'+uid+':'+c.id,time=new Date().toISOString(),payload=JSON.stringify({sourceId:c.id,usageScope:b.usageScope,referenceURL});
 const result=b.usageRevision===0?await env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'libraryUsage',?,'saved',1,?,?,?)").bind(rid,uid,payload,time,time).run():await env.DB.prepare("UPDATE studio_records SET payload=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND kind='libraryUsage' AND revision=?").bind(payload,time,rid,uid,b.usageRevision).run();
 if(!result.meta.changes)fail('使用范围已变化，请刷新后重试',409);return json(sourceUsage(c,await get(rid,'libraryUsage')));
}
