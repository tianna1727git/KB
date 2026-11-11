import {validLibraryCategory} from './library-categories';
import {convert as htmlToText} from 'html-to-text';
import {unzipSync,strFromU8} from 'fflate';
type R=Record<string,any>;
const MAX=20*1024*1024,enc=new TextEncoder();
const hash=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b as BufferSource))).map(x=>x.toString(16).padStart(2,'0')).join('');
export function publicURL(value:string){let u:URL;try{u=new URL(value);}catch{throw Error('请输入有效的公开网页 URL');}const h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||h.includes(':')||/^\[|^[\d.]+$/.test(h)||!h.includes('.')||/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(h)||h.endsWith('.localhost'))throw Error('仅支持不含账号密码的 HTTPS 公开网页地址');u.hash='';return u.href;}
function providerURL(raw:string){const u=new URL(publicURL(raw));const h=u.hostname;if(!['mineru.net','mineru.oss-cn-shanghai.aliyuncs.com','cdn-mineru.openxlab.org.cn'].includes(h)&&!h.endsWith('.mineru.net')&&!h.endsWith('.openxlab.org.cn')&&!h.endsWith('.aliyuncs.com'))throw Error('MinerU 返回的下载域名不受支持，请联系管理员核对官方域名');return u.href;}
async function bounded(r:Response,max:number){if(!r.ok)throw Error('远程服务返回 '+r.status);if(Number(r.headers.get('content-length'))>max)throw Error('返回内容超过处理上限');const reader=r.body?.getReader();if(!reader)throw Error('远程返回为空');let size=0;const chunks:Uint8Array[]=[];try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max)throw Error('返回内容超过处理上限');chunks.push(p.value);}}finally{await reader.cancel();}const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;}
async function storageKey(env:R){if(!/^[a-f0-9]{64}$/.test(env.MODEL_SETTINGS_ENCRYPTION_KEY||''))throw Error('安全存储尚未就绪，请联系管理员');return crypto.subtle.importKey('raw',Uint8Array.from(env.MODEL_SETTINGS_ENCRYPTION_KEY.match(/../g), (x:any)=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function token(env:R,uid:string,get:Function){let c;try{c=await get('mineru-settings:'+uid,'mineruSettings');}catch(e:any){if(e.code!==404)throw e;}if(c?.enabled){try{return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(c.iv),additionalData:enc.encode('mineru:'+uid)},await storageKey(env),new Uint8Array(c.ciphertext)));}catch{throw Error('无法读取 MinerU Token，请在配置区重新保存');}}if(env.MINERU_TOKEN)return env.MINERU_TOKEN;throw Error('请先配置 MinerU Token');}
async function call(key:string,path:string,body?:R){let r:Response;try{r=await fetch('https://mineru.net/api/v4/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(35000)});}catch{throw Error('MinerU 连接超时或不可用，请稍后刷新进度');}const bytes=await bounded(r,1024*1024);let j;try{j=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('MinerU 响应格式无效');}if(j.code!==0)throw Error('MinerU 请求失败（'+String(j.code).replace(/[^\w-]/g,'').slice(0,24)+'），请检查 Token、额度及文件格式');return j.data;}
export async function mineruAPI(req:Request,env:R,ctx:R):Promise<Response>{const {get,list,create,save,uid,fail,json}=ctx;const url=new URL(req.url),[action,rid,part]=url.pathname.replace('/api/studio/','').split('/');
 const meta=async()=>{let c;try{c=await get('mineru-settings:'+uid,'mineruSettings');}catch(e:any){if(e.code!==404)throw e;}return {configured:!!c?.enabled||!!env.MINERU_TOKEN,hasSavedToken:!!c?.ciphertext,revision:c?.revision||0,storageReady:/^[a-f0-9]{64}$/.test(env.MODEL_SETTINGS_ENCRYPTION_KEY||''),deploymentConfigured:!!env.MINERU_TOKEN};};
 if(action==='librarySubmit'){
  if(req.method!=='POST')fail('请求方法无效',405);
  const formRequest=(req.headers.get('content-type')||'').includes('multipart/form-data');let local=false,consent=false,libraryCategory:unknown;
  if(formRequest){const form=await req.clone().formData(),file=form.get('file');if(!(file instanceof File))fail('请选择文件');local=/\.(md|markdown|txt|html|htm)$/i.test((file as File).name);consent=form.get('consent')==='true';libraryCategory=form.get('libraryCategory');}
  else{const b:any=await req.clone().json();consent=b.consent===true;libraryCategory=b.libraryCategory;}
  if(!validLibraryCategory(libraryCategory))fail('请选择有效的资料分类');
  if(!local){if(!consent)fail('请确认提交后由 MinerU 自动解析');await token(env,uid,get);}
  const target=new URL('/api/studio/'+(formRequest?'libraryRawUpload':'libraryURL'),req.url);
  const created=await mineruAPI(new Request(target,req),env,ctx);if(!created.ok)return created;
  const data:any=await created.json(),f=data.file;
  if(f.fileKey||f.conversionState==='running')return json({...data,submitted:true});
  const converted=await mineruAPI(new Request(new URL('/api/studio/libraryConvert',req.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:f.id,revision:f.revision,consent:true})}),env,ctx);
  if(!converted.ok)return converted;return json({...data,file:await converted.json(),submitted:true});
 }
 if(action==='mineruSettings'){
  if(req.method==='GET')return json(await meta());if(req.method!=='POST')fail('请求方法无效',405);const raw=await req.text();if(raw.length>6000)fail('配置内容过长');const b=JSON.parse(raw),m=await meta();if(b.revision!==m.revision)fail('配置已更新，请刷新',409);if(b.consent!==true)fail('请确认授权 MinerU 处理所选资料');const value=String(b.token||'').trim();if(value.length<16||value.length>4096||/\s/.test(value))fail('请填写有效的 MinerU Token');const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('mineru:'+uid)},await storageKey(env),enc.encode(value));const time=new Date().toISOString();const res=await env.DB.prepare("INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'mineruSettings',?,'saved',1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=studio_records.revision+1,updated=excluded.updated WHERE studio_records.owner=excluded.owner AND studio_records.revision=?").bind('mineru-settings:'+uid,uid,JSON.stringify({iv:Array.from(iv),ciphertext:Array.from(new Uint8Array(encrypted)),enabled:true}),time,time,m.revision).run();if(res.meta.changes!==1)fail('配置已更新，请刷新',409);return json(await meta());
 }
 if(action==='libraryAsset'){
  if(req.method!=='GET')fail('请求方法无效',405);const f=await get(rid,'library');const a=(f.assets||[]).find((x:R)=>x.id===part);if(!a)fail('资源不存在',404);const obj=await env.BUCKET.get(a.key);if(!obj)fail('资源不存在',404);return new Response(obj.body,{headers:{'Content-Type':a.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }
 if(action==='libraryVersions'){
  if(req.method!=='GET')fail('请求方法无效',405);await get(rid,'library');const vs=(await list('libraryVersion')).filter((v:R)=>v.libraryId===rid);if(part){const v=vs.find((v:R)=>v.id===decodeURIComponent(part));if(!v)fail('版本不存在',404);const o=await env.BUCKET.get(v.fileKey);if(!o)fail('版本文件不存在',404);return new Response(o.body,{headers:{'Content-Type':'text/markdown;charset=utf-8','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent('Markdown-V'+v.version+'.md'),'Cache-Control':'private, no-store'}});}return json({versions:vs.map(({fileKey,...v}:R)=>v)});
 }
 if(req.method!=='POST')fail('请求方法无效',405);
 if(action==='libraryRawUpload'){
  const form=await req.formData(),file:any=form.get('file'),libraryCategory=form.get('libraryCategory')||undefined;if(libraryCategory!==undefined&&!validLibraryCategory(libraryCategory))fail('资料分类无效');if(!(file instanceof File)||!file.size||file.size>MAX)fail('请选择不超过20 MB的文件');if(!/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|html|htm|md|markdown|png|jpg|jpeg|webp|bmp|gif|jp2)$/i.test(file.name))fail('文件格式不受支持');const bytes=new Uint8Array(await file.arrayBuffer()),originalHash=await hash(bytes),duplicate=(await list('library')).find((f:R)=>f.originalHash===originalHash||f.sha256===originalHash);if(duplicate)return json({file:libraryCategory&&!duplicate.libraryCategory?await save(duplicate,{libraryCategory}):duplicate,duplicate:true});const key='library/'+uid+'/'+crypto.randomUUID()+'.original';await env.BUCKET.put(key,bytes);return json({file:await create('library',{name:file.name,title:file.name,path:file.name,sourceFormat:file.name.split('.').pop()?.toLowerCase(),libraryCategory,size:file.size,originalHash,originalKey:key,originalName:file.name,format:file.name.split('.').pop()?.toLowerCase(),source:file.name,collection:'用户上传',conversionState:'pending',conversionVersion:0,warnings:[]},'stored')});
 }
 const b:any=await req.json();
 if(action==='libraryURL'){
  const libraryCategory=b.libraryCategory;if(libraryCategory!==undefined&&!validLibraryCategory(libraryCategory))fail('资料分类无效');
  const source=publicURL(String(b.url||''));const duplicate=(await list('library')).find((f:R)=>f.sourceURL===source);if(duplicate)return json({file:libraryCategory&&!duplicate.libraryCategory?await save(duplicate,{libraryCategory}):duplicate,duplicate:true});const name=String(b.name||new URL(source).hostname).trim().slice(0,200);return json({file:await create('library',{name,title:name,path:name,sourceFormat:'url',libraryCategory,sourceURL:source,source,format:'url',size:0,collection:'网页',conversionState:'pending',conversionVersion:0,warnings:[]},'stored')});
 }
 let f=await get(b.id,'library');
 async function finish(markdown:string,extra:R={}){if(!markdown.trim()||enc.encode(markdown).length>2*1024*1024)fail('转换正文为空或超过2 MB，请拆分资料');const baseVersion=f.fileKey?(f.conversionVersion||1):0;if(f.fileKey&&!f.conversionVersion){const time=new Date().toISOString();await env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'libraryVersion',?,'saved',1,?,?,?)").bind('library-version:'+f.id+':1',uid,JSON.stringify({libraryId:f.id,version:1,fileKey:f.fileKey,sha256:f.sha256,origin:'原有 Markdown',source:f.source}),time,time).run();}const version=baseVersion+1,key='library/'+uid+'/'+f.id+'/v'+version+'-'+crypto.randomUUID()+'.md',sha256=await hash(enc.encode(markdown));await env.BUCKET.put(key,markdown);const time=new Date().toISOString(),next={...f,...extra,fileKey:key,sha256,size:enc.encode(markdown).length,conversionState:'done',conversionVersion:version,contentUpdatedAt:baseVersion?time:(f.contentUpdatedAt||f.uploadedAt||f.created),convertedAt:time,conversionError:'',remoteState:'done'};const result=await env.DB.batch([
 env.DB.prepare('UPDATE studio_records SET payload=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(next),time,f.id,uid,f.revision),
 env.DB.prepare("INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) SELECT ?,'libraryVersion',?,'saved',1,?,?,? WHERE EXISTS(SELECT 1 FROM studio_records WHERE id=? AND owner=? AND revision=? AND json_extract(payload,'$.fileKey')=?)").bind('library-version:'+f.id+':'+version,uid,JSON.stringify({libraryId:f.id,version,fileKey:key,sha256,origin:extra.origin||f.origin||'local',source:f.source,originalHash:f.originalHash||null,sourceURL:f.sourceURL||null}),time,time,f.id,uid,f.revision+1,key)
 ]);if(result[0].meta.changes!==1)fail('资料已变化，请刷新',409);return json(await get(f.id,'library'));}
 if(action==='libraryMarkdownSave'){
  if(!f.fileKey||f.conversionState&&f.conversionState!=='done'||f.revision!==b.revision)fail('资料版本已变化或尚未完成转换',409);if(typeof b.markdown!=='string')fail('正文格式无效');return finish(b.markdown,{origin:'人工编辑',warnings:[...(f.warnings||[]),'此 Markdown 已人工编辑，请核对原文。']});
 }
 const grantKey=(batch:string)=>'mineru-grants/'+uid+'/'+f.id+'/'+encodeURIComponent(batch);
 async function readGrant(){if(!f.batchId)return null;const o=await env.BUCKET.get(grantKey(f.batchId));if(!o)return null;const g:any=await o.json();return g&&Number(g.expires)>Date.now()?g:null;}
 async function remoteResult(key:string){const d=await call(key,f.batchId?'extract-results/batch/'+encodeURIComponent(f.batchId):'extract/task/'+encodeURIComponent(f.taskId));return f.batchId?d?.extract_result?.find((x:R)=>x.data_id===f.id||x.file_name===f.originalName):d;}
 async function sendFile(link:string){
  const target=providerURL(link),o=await env.BUCKET.get(f.originalKey);if(!o)fail('原件不存在',404);
  f=await save(f,{conversionState:'running',conversionError:'',remoteState:'uploading',uploadAttempts:(f.uploadAttempts||0)+1,uploadLeaseUntil:Date.now()+190000});
  try{const uploaded=await fetch(target,{method:'PUT',body:o.body,headers:{'Content-Length':String(o.size)},redirect:'manual',signal:AbortSignal.timeout(180000)});
   if(!uploaded.ok){if(uploaded.status>=500||[408,429].includes(uploaded.status))return json(await save(f,{conversionState:'running',remoteState:'upload-check',uploadLeaseUntil:0,conversionError:'上传服务暂时不可用，正在核对原任务；不会直接重复创建解析任务。'}));if(uploaded.status===403)await env.BUCKET.delete(grantKey(f.batchId));return json(await save(f,{conversionState:'failed',remoteState:'upload-failed',uploadLeaseUntil:0,conversionError:'文件上传返回 '+uploaded.status+'；原件已保留，点击重试会先核对原任务。'}));}
   return json(await save(f,{remoteState:'pending',uploadLeaseUntil:0,conversionError:''}));
  }catch{console.warn('mineru_transfer_uncertain',{phase:'file-upload',libraryId:f.id});return json(await save(f,{conversionState:'running',remoteState:'upload-check',uploadLeaseUntil:0,conversionError:'文件上传响应超时，正在核对原任务；不会直接重复创建解析任务。'}));}
 }
 if(action==='libraryConvert'){
  if(f.revision!==b.revision)fail('资料已更新，请刷新',409);if(f.fileKey&&f.conversionState!=='failed')return json(f);if(f.conversionState==='running')return json(f);
  const local=/^(md|markdown|txt|html|htm)$/.test(f.format);if(!local&&b.consent!==true)fail('请确认将所选资料发送至 MinerU');const key=local?'':await token(env,uid,get);
  // Recover a known task before creating another one, including pre-fix failed uploads.
  if(!local&&(f.batchId||f.taskId)){
   const result=await remoteResult(key);if(!result)fail('原任务状态暂不可用，请稍后刷新；未创建新任务',503);
   if(!['failed','waiting-file'].includes(result.state))return json(await save(f,{conversionState:'running',remoteState:result.state==='done'?'downloading':result.state,conversionError:'',uploadLeaseUntil:0}));
   if(result.state==='waiting-file'){const grant=await readGrant();if(grant){f=await save(f,{uploadAttempts:0});return sendFile(grant.url);}}
   // Only a confirmed failed or never-uploaded task may be replaced on explicit retry.
  }
  f=await save(f,{conversionState:'running',conversionError:'',previousBatchId:f.batchId||null,batchId:null,taskId:null,uploadAttempts:0,uploadLeaseUntil:0,remoteState:'submitting',conversionStartedAt:new Date().toISOString()},'stored');
  try{
   if(local){const o=await env.BUCKET.get(f.originalKey);if(!o)fail('原件不存在',404);let text='';try{text=new TextDecoder('utf-8',{fatal:true}).decode(await o.arrayBuffer());}catch{fail('文本文件请使用 UTF-8 编码');}const html=/^(html|htm)$/.test(f.format);if(html)text=htmlToText(text,{wordwrap:false,limits:{maxInputLength:MAX},selectors:[{selector:'img',format:'skip'},{selector:'script',format:'skip'},{selector:'style',format:'skip'},{selector:'a',options:{ignoreHref:true}}]});return await finish(text,{origin:html?'本地 HTML 转换':'本地文本转换',warnings:html?['已提取 HTML 中的静态文字；脚本、样式与图片不参与转换，请对照原件核对。']:[]});}
   if(f.sourceURL){const data=await call(key,'extract/task',{url:publicURL(f.sourceURL),model_version:/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|webp|bmp|gif|jp2)$/i.test(new URL(f.sourceURL).pathname)?'vlm':'MinerU-HTML',is_ocr:true,enable_table:true,enable_formula:true,data_id:f.id});if(typeof data?.task_id!=='string')throw Error('MinerU 未返回任务标识');return json(await save(f,{taskId:data.task_id,remoteState:'pending',origin:'MinerU',isOCR:true}));}
   const d=await call(key,'file-urls/batch',{files:[{name:f.originalName,data_id:f.id,is_ocr:true}],model_version:'vlm',enable_table:true,enable_formula:true,language:'ch'});if(typeof d?.batch_id!=='string'||!Array.isArray(d.file_urls)||d.file_urls.length!==1)throw Error('MinerU 上传响应无效');const target=providerURL(d.file_urls[0]);
   await env.BUCKET.put(grantKey(d.batch_id),JSON.stringify({url:target,expires:Date.now()+23*3600000}));f=await save(f,{batchId:d.batch_id,origin:'MinerU',isOCR:true,remoteState:'uploading'});return await sendFile(target);
  }catch(e:any){return json(await save(f,{conversionState:'failed',conversionError:String(e.message||'提交失败，请稍后重试').slice(0,300)},'stored'));}
 }
 if(action==='libraryConvertPoll'){
  if(f.conversionState!=='running'&&!(f.batchId&&/upload|waiting-file/.test(f.remoteState||'')))return json(f);if(!f.batchId&&!f.taskId){if(Date.now()-Date.parse(f.conversionStartedAt)>180000)return json(await save(f,{conversionState:'failed',conversionError:'提交中断，请重试；重试可能重复计入 MinerU 用量。'}));return json(f);}
  const key=await token(env,uid,get);const result=await remoteResult(key);if(!result)return json(f);
  if(result.state==='failed')return json(await save(f,{conversionState:'failed',conversionError:'MinerU 解析失败，请检查文件格式、页数及额度后重试。',remoteState:'failed',uploadLeaseUntil:0}));
  if(result.state==='waiting-file'){
   if(Number(f.uploadLeaseUntil)>Date.now())return json(f);
   const grant=await readGrant();if(grant&&f.remoteState==='upload-check'&&(f.uploadAttempts||0)<2)return sendFile(grant.url);
   return json(await save(f,{conversionState:'failed',remoteState:'waiting-file',recoveryCheckedAt:new Date().toISOString(),uploadLeaseUntil:0,conversionError:'文件尚未完成上传，解析未开始。原件已保留，点击重试解析可继续，无需重新上传原件。'}));
  }
  if(result.state!=='done')return json(await save(f,{conversionState:'running',conversionError:'',uploadLeaseUntil:0,remoteState:String(result.state).slice(0,30),conversionProgress:result.extract_progress||null}));
  f=await save(f,{conversionState:'running',remoteState:'downloading',conversionError:'',uploadLeaseUntil:0});
  // Only provider-supplied HTTPS storage URLs are fetched; never send Authorization to storage.
  try{const zip=await bounded(await fetch(providerURL(result.full_zip_url),{redirect:'manual',signal:AbortSignal.timeout(180000)}),MAX);let size=0,count=0;const files=unzipSync(zip,{filter:e=>{size+=e.originalSize;if(++count>1500||size>40*1024*1024||e.originalSize>10*1024*1024||e.name.split('/').includes('..')||e.name.startsWith('/'))throw Error('转换包过大或路径无效，请拆分资料');return /\.(md|json|html|png|jpe?g|webp|gif)$/i.test(e.name);}});const names=Object.keys(files),md=names.find(n=>/(^|\/)full\.md$/.test(n))||names.find(n=>n.endsWith('.md'));if(!md)throw Error('转换包缺少 Markdown');const assets:R[]=[];let markdown=strFromU8(files[md]);for(const name of names.filter(n=>/\.(png|jpe?g|webp|gif)$/i.test(n))){const id=String(assets.length),assetKey='library/'+uid+'/'+f.id+'/assets/'+crypto.randomUUID(),mime=/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':/\.gif$/i.test(name)?'image/gif':'image/jpeg';await env.BUCKET.put(assetKey,files[name]);assets.push({id,key:assetKey,name,mime});const relative=name.startsWith(md.slice(0,md.lastIndexOf('/')+1))?name.slice(md.lastIndexOf('/')+1):name;markdown=markdown.split(']('+relative+')').join('](/api/studio/libraryAsset/'+f.id+'/'+id+')');}
   const artifactKey='library/'+uid+'/'+f.id+'/result-'+crypto.randomUUID()+'.zip';await env.BUCKET.put(artifactKey,zip);return await finish(markdown,{origin:'MinerU',assets,artifactKey,warnings:['OCR、表格和阅读顺序可能有误，请对照原件核对。页码与版面定位以原始结果包中的 JSON 为准；本系统未生成逐字置信度。',...(f.sourceURL?['网页为转换时抓取的快照，可能与当前页面不同。']:[])]});
  }catch(e:any){const transient=['AbortError','TimeoutError','TypeError'].includes(e.name);return json(await save(f,{conversionState:transient?'running':'failed',remoteState:'download-retry',conversionError:transient?'解析已完成，结果下载暂时中断，系统会重试取回原结果。':String(e.message||'结果保存失败').slice(0,300)}));}
 }
 return fail('接口不存在',404);
}
