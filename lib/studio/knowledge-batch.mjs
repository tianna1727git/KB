// One-time owner-authorized operation: "全部 3,676 条", approved in this conversation.
export const KNOWLEDGE_BATCH_REQUEST='confirm-all-3676-20261028-v2';
export const KNOWLEDGE_BATCH_CUTOFF='2026-10-28T04:19:41.000Z';
const stamp=()=>new Date().toISOString();
export async function knowledgeBatchAPI(req,env,ctx){const {uid,email,get,list,save,fail,json}=ctx;
 const authorized=email.toLowerCase()==='tianna1727@gmail.com';if(!authorized){if(req.method==='GET')return json({authorized:false});fail('无权执行本次批量入库',403);}
 const rid='knowledge-batch:'+KNOWLEDGE_BATCH_REQUEST+':'+uid;
 async function read(){try{return await get(rid,'knowledgeBatch');}catch(e){if(e.code!==404)throw e;return null;}}
 const view=j=>({authorized:true,requestId:KNOWLEDGE_BATCH_REQUEST,cutoff:KNOWLEDGE_BATCH_CUTOFF,expected:3676,id:j?.id||null,state:j?.state||'not_started',total:j?.total||0,processed:j?.processed||0,confirmed:j?.confirmed||0,alreadyConfirmed:j?.alreadyConfirmed||0,skipped:j?.skipped||0,skipReasons:j?.skipReasons||{},documentsReady:j?.documentsReady||0,error:j?.error||'',leaseUntil:j?.leaseUntil||0});
 let job=await read();if(req.method==='GET')return json(view(job));if(req.method!=='POST')fail('请求方法无效',405);const b=await req.json();if(b.requestId!==KNOWLEDGE_BATCH_REQUEST||b.confirmed!==true)fail('请使用本次已授权的批量入库任务');
 if(!job){
  if(b.action!=='start')fail('批量任务尚未创建',409);
  const [chunks,documents]=await Promise.all([list('chunk'),list('document')]);const ds=new Map(documents.map(d=>[d.id,d]));
  const snapshot=chunks.filter(k=>k.state!=='excluded'&&Date.parse(k.created)<=Date.parse(KNOWLEDGE_BATCH_CUTOFF)).map(k=>({id:k.id,revision:k.revision,docId:k.docId,sourceRevision:ds.get(k.docId)?.revision||null}));
  if(snapshot.length>3676)fail('当前记录与授权范围不一致，未执行入库',409);
  const snapshotKey='knowledge-batches/'+uid+'/'+KNOWLEDGE_BATCH_REQUEST+'-'+crypto.randomUUID()+'.json';await env.BUCKET.put(snapshotKey,JSON.stringify(snapshot));const time=stamp();
  const payload={requestId:KNOWLEDGE_BATCH_REQUEST,snapshotKey,total:snapshot.length,processed:0,confirmed:0,alreadyConfirmed:0,skipped:0,skipReasons:{},documentsReady:0,cursor:0,phase:'chunks',documentIds:[...new Set(snapshot.map(k=>k.docId))],documentCursor:0,sourceRevisions:Object.fromEntries(documents.map(d=>[d.id,d.revision])),leaseUntil:0,error:'',authorization:'用户再次明确要求全部3676条入库，包括仅标题条目，不再要求逐条核对；保留风险、来源版本与外部引用权限',cutoff:KNOWLEDGE_BATCH_CUTOFF};
  await env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'knowledgeBatch',?,'waiting',1,?,?,?)").bind(rid,uid,JSON.stringify(payload),time,time).run();job=await read();return json(view(job));
 }
 if(job.state==='done')return json(view(job));if(b.action==='start')return json(view(job));if(b.action!=='step')fail('任务动作无效');if(job.state==='running'&&job.leaseUntil>Date.now())return json(view(job));
 job=await save(job,{leaseUntil:Date.now()+60000,error:''},'running');
 try{
  const object=await env.BUCKET.get(job.snapshotKey);if(!object)fail('入库快照缺失，未继续操作',409);const snapshot=await object.json();
  if(job.phase==='chunks'){
   const [chunks,documents]=await Promise.all([list('chunk'),list('document')]);const cs=new Map(chunks.map(k=>[k.id,k])),ds=new Map(documents.map(d=>[d.id,d]));const slice=snapshot.slice(job.cursor,job.cursor+60),updates=[];let confirmed=job.confirmed,already=job.alreadyConfirmed,skipped=job.skipped;const reasons={...job.skipReasons};
   const skip=reason=>{skipped++;reasons[reason]=(reasons[reason]||0)+1;};
   for(const entry of slice){const k=cs.get(entry.id),d=ds.get(entry.docId);if(!k||k.state==='excluded'){skip('条目已变更或撤除');continue;}if(k.batchRequestId===KNOWLEDGE_BATCH_REQUEST){confirmed++;continue;}if(k.state==='approved'){already++;continue;}if(k.revision!==entry.revision||!d||d.revision!==entry.sourceRevision||k.docRevision!==d.revision){skip('条目或来源版本已变化');continue;}if(d.disabled||d.supersededBy){skip('来源已停用或被替代');continue;}
    const next={...k,confirmedAt:stamp(),confirmedBy:uid,confirmedVia:'用户授权批量入库，风险提示保留',batchRequestId:KNOWLEDGE_BATCH_REQUEST};updates.push({entry,k,next});
   }
   const time=stamp();if(updates.length){const rs=await env.DB.batch(updates.map(({entry,k,next})=>env.DB.prepare("UPDATE studio_records SET payload=?,state='approved',revision=revision+1,updated=? WHERE id=? AND owner=? AND kind='chunk' AND revision=? AND state='pending' AND EXISTS(SELECT 1 FROM studio_records d WHERE d.id=? AND d.owner=? AND d.kind='document' AND d.revision=?)").bind(JSON.stringify(next),time,k.id,uid,entry.revision,k.docId,uid,entry.sourceRevision)));for(const r of rs){if(r.meta.changes===1)confirmed++;else skip('处理期间记录已变化');}}
   const cursor=job.cursor+slice.length;job=await save(job,{cursor,processed:cursor,confirmed,alreadyConfirmed:already,skipped,skipReasons:reasons,phase:cursor>=snapshot.length?'documents':'chunks',leaseUntil:0},'waiting');return json(view(job));
  }
  const [documents,chunks]=await Promise.all([list('document'),list('chunk')]);const ds=new Map(documents.map(d=>[d.id,d]));let ready=job.documentsReady;const ids=job.documentIds.slice(job.documentCursor,job.documentCursor+4);
  for(const id of ids){const d=ds.get(id),all=chunks.filter(k=>k.docId===id&&k.state!=='excluded');if(!d||d.disabled||d.supersededBy||!all.length||all.some(k=>k.state!=='approved'))continue;if(d.state==='ready'){ready++;continue;}if(d.revision!==job.sourceRevisions[id])continue;
   const time=stamp(),payload={...d,bulkConfirmedAt:time,bulkRequestId:KNOWLEDGE_BATCH_REQUEST,events:[...(d.events||[]),{name:'用户授权批量入库，原有风险及引用权限保留',time,state:'complete'}]};const result=await env.DB.batch([
    env.DB.prepare("UPDATE studio_records SET payload=?,state='ready',revision=revision+1,updated=? WHERE id=? AND owner=? AND kind='document' AND revision=? AND NOT EXISTS(SELECT 1 FROM studio_records k WHERE k.owner=? AND k.kind='chunk' AND json_extract(k.payload,'$.docId')=? AND k.state NOT IN ('approved','excluded'))").bind(JSON.stringify(payload),time,id,uid,d.revision,uid,id),
    env.DB.prepare("UPDATE studio_records SET payload=json_set(payload,'$.docRevision',?),revision=revision+1,updated=? WHERE owner=? AND kind='chunk' AND state<>'excluded' AND json_extract(payload,'$.docId')=? AND EXISTS(SELECT 1 FROM studio_records d WHERE d.id=? AND d.owner=? AND d.kind='document' AND d.revision=? AND json_extract(d.payload,'$.bulkRequestId')=?)").bind(d.revision+1,time,uid,id,id,uid,d.revision+1,KNOWLEDGE_BATCH_REQUEST)
   ]);if(result[0].meta.changes===1){ready++;if(d.previousId){let previous;try{previous=await get(d.previousId,'document');}catch{}if(previous&&!previous.supersededBy)await save(previous,{supersededBy:d.id});}}
  }
  const cursor=job.documentCursor+ids.length,done=cursor>=job.documentIds.length;job=await save(job,{documentCursor:cursor,documentsReady:ready,leaseUntil:0,...(done?{completedAt:stamp()}: {})},done?'done':'waiting');return json(view(job));
 }catch(e){job=await save(job,{leaseUntil:0,error:e.message||'批量入库中断，可继续'},'failed');return json(view(job));}
}
