import {USAGE_SCOPES,sourceUsage} from './usage-scope.mjs';

const sha256=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');

export async function importManifestEntry(b,env,{uid,get,fail}){
 const {name,url,scope,markdown='',markdownName='',category='',order}=b;
 if(typeof name!=='string'||!name.trim()||name.length>500||!Number.isInteger(order)||order<1||
    !USAGE_SCOPES.some(s=>s.value===scope)||typeof markdown!=='string'||markdown.length>2000000||
    !String(url).startsWith('https://payoneerinc.sharepoint.com/teams/ProductMarketingChina/'))fail('SharePoint清单行无效');
 const key=await sha256(url),entryId='sp-entry:'+uid+':'+key,ownId='sp-file:'+uid+':'+key;
 const lookup=async(id,kind)=>{try{return await get(id,kind);}catch(error){if(error.code!==404)throw error;return null;}};
 const entry=await lookup(entryId,'sharepointEntry');
 const sourceId=entry?.sourceId||b.sourceId||ownId;
 const file=await lookup(sourceId,'library');
 const hash=markdown?await sha256(markdown):'';
 if(sourceId!==ownId && (!file||file.name!==markdownName||!hash||![file.originalHash,file.sha256].some(h=>typeof h==='string' && (h===hash||h===b.originalHash))))fail('现有资料与清单正文不匹配',409);
 const now=new Date().toISOString(),queries=[];
 const insert=(id,kind,payload,state)=>env.DB.prepare('INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(id,kind,uid,state,JSON.stringify(payload),now,now);
 if(!file){
  const fileKey=markdown?'library/'+uid+'/'+key+'.md':null;
  if(fileKey)await env.BUCKET.put(fileKey,markdown);
  queries.push(insert(ownId,'library',{name,title:name,source:url,sourceFormat:name.split('.').pop(),libraryCategory:category,usageScope:scope,fileKey,sha256:hash||null,conversionState:markdown&&!b.needsOriginal?'done':'missing',size:new TextEncoder().encode(markdown).length},'stored'));
 }
 if(!entry)queries.push(insert(entryId,'sharepointEntry',{sourceId,name,url,order,needsOriginal:!markdown||!!b.needsOriginal},'saved'));
 const mid='library-usage:'+uid+':'+sourceId,metadata=await lookup(mid,'libraryUsage');
 if(file && sourceUsage(file,metadata).usageScope!==scope){
  const payload={sourceId,usageScope:scope,referenceURL:''};
  if(metadata)queries.push(env.DB.prepare('UPDATE studio_records SET payload=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(payload),now,mid,uid,metadata.revision));
  else queries.push(insert(mid,'libraryUsage',payload,'saved'));
 }
 if(queries.length){const result=await env.DB.batch(queries);if(result.some(r=>!r.meta.changes))fail('资料已变化，请重试同步',409);}
 return {sourceId};
}
