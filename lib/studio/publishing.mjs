import {articleHTML,articleMarkdown,citationEntries} from './article-output.mjs';
const suffix=' | Payoneer派安盈中国官网';
const string=(v,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const safeURL=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Field mapping for the supplied zcms-upload-seo-blog skill. This prepares an
// immutable, public-content-only handoff; it does not claim external execution.
export function publicationPackage(task, input={}) {
 const title=string(task.title,200),slug=string(input.slug??task.slug,200);
 const desc=string(input.desc??task.metaDescription,1000);
 const metaTitle=string(input.metaTitle??task.seoTitle??title,250).replace(/(?:\s*\|\s*Payoneer派安盈中国官网)+$/,'')+suffix;
 const list=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))].slice(0,20):[];
 const category=list(input.category),tags=list(input.tags),coverImage=safeURL(input.coverImage),authorAvatar=safeURL(input.authorAvatar);
 const publishTime=string(input.publishTime,30),timeZone='Asia/Shanghai';
 const plain=articleMarkdown(task).replace(/\[[^\]]*\]\([^)]*\)/g,'').replace(/[#*_`]/g,'');
 const estimated=Math.max(1,Math.ceil((plain.match(/[\u3400-\u9fff]/g)||[]).length/400+(plain.match(/[A-Za-z]+/g)||[]).length/200));
 const fields={title,slug,desc,coverImage,category,tags,authorName:string(input.authorName||'Payoneer派安盈',200),authorIntro:string(input.authorIntro||'Payoneer派安盈大中华区市场团队',500),authorAvatar,publishTime,readDuration:string(input.readDuration||estimated+'分钟',40),metaTitle,metaDescription:desc,metaKeywords:list([task.keyword,...task.secondaryKeywords||[]]).join(', '),subContent:''};
 const content=articleHTML(task,{fragment:true}).replace(/^<h1>[^]*?<\/h1>\s*/,'');
 const missing=Object.entries(fields).filter(([k,v])=>['title','slug','desc','coverImage','category','tags','authorName','authorIntro','authorAvatar','publishTime','readDuration'].includes(k)&&(!v||Array.isArray(v)&&!v.length)).map(([k])=>k);
 if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))missing.push('slug');
 if(publishTime&&!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(publishTime))missing.push('publishTime');
 if(!task.markdown?.trim())missing.push('content');
 const canonicalURL=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)?'https://www.payoneer.cn/blogs/'+slug:null;
 return {schemaVersion:'zcms-blog-handoff-v1',agent:'content-publishing',skill:'zcms-upload-seo-blog',source:{taskId:task.id,revision:task.revision,draftVersion:task.draftVersion,approvedAt:task.approvedAt||null},target:{table:'blog',environment:'stage',operation:'upload_and_verify',timeZone},fields:{...fields,content:(coverImage?'<p><img src="'+escape(coverImage)+'" alt="'+escape(title)+'"></p>\n':'')+content,schema:canonicalURL?{'@context':'https://schema.org','@type':'FinancialProduct','@id':canonicalURL,url:canonicalURL,name:title,description:desc,brand:{'@type':'Brand',name:'Payoneer 派安盈'},serviceType:task.keyword,provider:{'@type':'FinancialService',name:'Payoneer Inc.'}}:null},publicReferences:citationEntries(task).map(r=>({number:r.number,title:r.title,url:r.referenceURL})),validation:{ready:missing.length===0,missing:[...new Set(missing)]},execution:{status:'awaiting_stage_api',transport:'api',authentication:'x-api-key',richText:'html_pending_zcms_field_mapping',externalRecordId:null,verifiedAt:null,productionPublish:false}};
}
