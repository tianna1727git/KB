import {validLibraryCategory} from './library-categories';
export async function libraryCategoryBatchAPI(req,env,{list,fail,json,uid}){
 if(req.method!=='POST')fail('请求方法无效',405);
 let body;try{body=await req.json();}catch{fail('请求格式无效');}
 if(!body||typeof body!=='object'||Array.isArray(body))fail('请求格式无效');
 if(!validLibraryCategory(body.libraryCategory))fail('请选择有效的资料分类');
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>500)fail('请选择1–500份资料');
 if(body.items.some(item=>!item||typeof item.id!=='string'||!item.id||item.id.length>512||!Number.isSafeInteger(item.categoryRevision)||item.categoryRevision<0)||new Set(body.items.map(item=>item.id)).size!==body.items.length)fail('资料或分类版本无效');
 const [libraries,documents]=await Promise.all([list('library'),list('document')]);
 const sources=new Map([...libraries,...documents].map(source=>[source.id,source]));
 const libraryIds=new Map(libraries.map(source=>[source.id,source]));
 const groups=new Map();
 for(const item of body.items){
  const source=sources.get(item.id);if(!source)fail('记录不存在或无权访问',404);
  const linked=source.kind==='document'?(libraryIds.get(source.libraryId)||(source.hash&&libraries.find(file=>file.sha256===source.hash))):source;
  const sourceId=linked?.id||source.id,current=groups.get(sourceId);
  if(current){if(current.categoryRevision!==item.categoryRevision)fail('同一资料的分类版本不一致，请刷新后重试',409);current.ids.push(item.id);}
  else groups.set(sourceId,{sourceId,categoryRevision:item.categoryRevision,ids:[item.id]});
 }
 const time=new Date().toISOString(),entries=[...groups.values()];
 const results=await env.DB.batch(entries.map(entry=>{
  const metadataId='library-metadata:'+uid+':'+entry.sourceId,payload=JSON.stringify({sourceId:entry.sourceId,libraryCategory:body.libraryCategory});
  return entry.categoryRevision===0?env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'libraryMetadata',?,'saved',1,?,?,?)").bind(metadataId,uid,payload,time,time):env.DB.prepare("UPDATE studio_records SET payload=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND kind='libraryMetadata' AND revision=?").bind(payload,time,metadataId,uid,entry.categoryRevision);
 }));
 const updated=[],conflicts=[];results.forEach((result,index)=>(result.meta.changes?updated:conflicts).push(...entries[index].ids));
 return json({updated,conflicts,total:body.items.length,libraryCategory:body.libraryCategory});
}
