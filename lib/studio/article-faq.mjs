import {rank,canUse} from './knowledge.mjs';
export const FAQ_MISSING='未找到关键词匹配的FAQ问答，请补充FAQ分类知识。';
const plain=value=>String(value||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/\[[SM]\d+\]/g,'').replace(/^#{1,6}\s*/gm,'').replace('适用条件（关联建议，需确认）：','适用条件：').trim();
export function faqCandidates(keyword,chunks,documents){
 const candidates=[];
 for(const k of chunks){const d=documents.find(d=>d.id===k.docId);if(d?.libraryCategory!=='FAQ'||!canUse(k,documents)||k.purpose==='rule')continue;
 const body=k.body||k.statement||'',lines=body.split('\n');let question='',answer=[];
 const emit=()=>{const a=plain(answer.join('\n'));if(question&&a.length>=15&&a.length<=4000)candidates.push({...k,faqQuestion:question,faqAnswer:a,title:question,body:question+'\n'+a,source:d.source,sourceVersion:d.sourceVersion||1,libraryCategory:'FAQ'});};
 for(const line of lines){const q=plain(line).replace(/^\*\*|\*\*$/g,'');if(q.length<180&&/[？?]$/.test(q)&&!/^[-|]/.test(q)){emit();question=q;answer=[];}else if(question)answer.push(line);}emit();
 // A question used as the slice title is also a valid complete Q/A.
 if(!question&&/[？?]$/.test(k.title||'')){const a=plain(body);if(a.length>=15&&a.length<=4000)candidates.push({...k,faqQuestion:k.title,faqAnswer:a,title:k.title,body:k.title+'\n'+a,source:d.source,sourceVersion:d.sourceVersion||1,libraryCategory:'FAQ'});}
 }
 const unique=[...new Map(candidates.map(c=>[c.faqQuestion+'\n'+c.faqAnswer,c])).values()];
 return rank(keyword,unique,3);
}
export function faqSection(entries){return entries?.length?'## 常见问题（FAQ）\n\n'+entries.map(e=>'### '+e.faqQuestion+'\n\n'+e.faqAnswer+' ['+e.materialRef+']').join('\n\n'):'';}
export function appendFAQ(markdown,entries){
 // Generated FAQs are replaced by source-backed questions, never model memory.
 const lines=String(markdown).split('\n');let skip=false,depth=0;const kept=[];
 for(const line of lines){const h=line.match(/^(#{1,6})\s+(.+)$/);if(h&&/FAQ|常见问题|常见问答|常见疑问/i.test(h[2])){skip=true;depth=h[1].length;continue;}if(skip&&h&&h[1].length<=depth)skip=false;if(!skip)kept.push(line);}
 return [kept.join('\n').trim(),faqSection(entries)].filter(Boolean).join('\n\n');
}
export function validateFAQ(task,markdown){if(!task.faqPolicyVersion)return;const section=faqSection(task.faqEntries);if(section&&!String(markdown).trim().endsWith(section))throw Error('FAQ须保留匹配知识中的完整问答；请重新生成FAQ后再保存。');}
