// Archive the records in one transaction. Keep stored originals and completed
// writing history so a deleted row never destroys a shared file in storage.
export async function deleteLibraryRows(ids,{uid,env,list,fail}){
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id))fail('请选择要删除的资料');
 const [libraries,documents,jobs]=await Promise.all(['library','document','ingestion'].map(list));
 const byHash=new Map();
 for(const file of libraries)if(file.sha256)byHash.set(file.sha256,byHash.has(file.sha256)?null:file);
 const sources=new Set(),docs=new Set();
 for(const id of new Set(ids)){
  if(libraries.some(f=>f.id===id)){sources.add(id);continue;}
  const doc=documents.find(d=>d.id===id);
  if(!doc)fail('资料已变化，请刷新列表',409);
  docs.add(id);
  const linked=doc.libraryId?libraries.find(f=>f.id===doc.libraryId):byHash.get(doc.hash);
  if(linked)sources.add(linked.id);
 }
 for(const doc of documents){
  if(sources.has(doc.libraryId)||(!doc.libraryId && sources.has(byHash.get(doc.hash)?.id)))docs.add(doc.id);
 }
 const selected=new Set([...docs,...sources]);
 const related=jobs.filter(j=>selected.has(j.sourceId)||docs.has(j.documentId));
 if(related.some(j=>['running','committing'].includes(j.state))||libraries.some(f=>sources.has(f.id)&&f.conversionState==='running'))fail('资料正在处理，请在任务结束后删除',409);
 const archive=(kind,condition,values)=>env.DB.prepare("UPDATE studio_records SET kind=?,revision=revision+1,updated=? WHERE owner=? AND kind=? AND "+condition)
  .bind('deleted-'+kind,new Date().toISOString(),uid,kind,JSON.stringify(values));
 const byId='id IN (SELECT value FROM json_each(?))';
 const byDocument="json_extract(payload,'$.docId') IN (SELECT value FROM json_each(?))";
 await env.DB.batch([archive('chunk',byDocument,[...docs]),archive('ingestion',byId,related.map(j=>j.id)),archive('document',byId,[...docs]),archive('library',byId,[...sources])]);
 return {deleted:new Set(ids).size};
}
