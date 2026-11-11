export function knowledgeSummary(file,documents=[],jobs=[]){
 const hash=file.sha256||file.hash;
 const related=documents.filter(d=>!d.supersededBy&&(d.id===file.id||d.libraryId===file.id||hash&&d.hash===hash));
 const document=related.find(d=>d.semantic&&(!hash||d.hash===hash));
 if(document)return {knowledgeState:'done',knowledgeDocumentId:document.id};
 if(file.semantic)return {knowledgeState:'done',knowledgeDocumentId:file.documentId||file.id};
 const ids=new Set([file.id,file.libraryId,...related.map(d=>d.id)].filter(Boolean));
 const job=jobs.filter(j=>ids.has(j.sourceId)&&(!j.hash||!hash||j.hash===hash)).sort((a,b)=>Date.parse(b.created||b.updated||0)-Date.parse(a.created||a.updated||0))[0];
 if(job){const state=['running','committing'].includes(job.state)?'running':job.state==='failed'?'failed':job.state==='succeeded'?'review':'waiting';const interrupted=state==='running'&&job.updated&&Date.now()-Date.parse(job.updated)>180000;return {knowledgeState:interrupted?'failed':state,knowledgeJobId:job.id,knowledgeError:interrupted?'上次整理中断，请打开任务重试':job.error||''};}
 if(related.some(d=>d.semantic))return {knowledgeState:'stale'};
 return {knowledgeState:'not_started'};
}
