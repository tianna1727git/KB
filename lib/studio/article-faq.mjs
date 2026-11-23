import {rank,canUse} from './knowledge.mjs';
export const FAQ_MISSING='FAQ不足3条；请补充可核验依据或重新生成FAQ。';
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
export function faqSection(entries){const unique=[...new Map((entries||[]).map(e=>{const question=String(e.faqQuestion||e.question||'').trim(),answer=String(e.faqAnswer||e.answer||'').trim();return [question,{question,answer,materialRef:e.materialRef}];}).filter(([question,e])=>question&&e.answer)).values()].slice(0,5);return unique.length?'## 常见问题（FAQ）\n\n'+unique.map(e=>'### '+e.question+'\n\n'+e.answer+(e.materialRef?' ['+e.materialRef+']':'')).join('\n\n'):'';}
export function appendFAQ(markdown,entries,generated=[]){
 // Generated FAQs are replaced by source-backed questions, never model memory.
 const lines=String(markdown).split('\n');let skip=false,depth=0;const kept=[];
 for(const line of lines){const h=line.match(/^(#{1,6})\s+(.+)$/);if(h&&/FAQ|常见问题|常见问答|常见疑问/i.test(h[2])){skip=true;depth=h[1].length;continue;}if(skip&&h&&h[1].length<=depth)skip=false;if(!skip)kept.push(line);}
 return [kept.join('\n').trim(),faqSection([...(entries||[]),...(generated||[])])].filter(Boolean).join('\n\n');
}
export function validateFAQ(task,markdown){if(!task.faqPolicyVersion)return;const value=String(markdown).trim(),match=value.match(/^##\s+(?:常见问题|常见问答|FAQ).*$/im);if(!match)throw Error('文章缺少FAQ部分，请补充有依据的常见问题。');const faq=value.slice(match.index),count=[...faq.matchAll(/^###\s+.+$/gm)].length,hasLibraryFAQ=!!task.faqEntries?.length;if(count<1||count>5||(!hasLibraryFAQ&&count<3))throw Error(hasLibraryFAQ?'FAQ须保留匹配知识中的问答。':'没有FAQ知识时，请生成3–5个基于本文和来源的问题。');const required=faqSection(task.faqEntries).replace(/^##\s+[^\n]+\n\n/,'').trim();if(required&&!faq.includes(required))throw Error('FAQ须保留匹配知识中的完整问答；请重新生成FAQ后再保存。');}
