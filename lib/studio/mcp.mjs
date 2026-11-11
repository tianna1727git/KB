// Sites validates the caller and supplies the same Site-scoped identity used by the UI.
// Never accept identity, owner, URL, or a storage key from tool arguments.
const textSchema={type:'string',minLength:1,maxLength:500};
const revisionSchema={type:'integer',minimum:1};
const schema=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const tools=[
 ['payo_refresh_due_insights','检查当前账号的Insights每7天更新设置，到期才更新已配置来源；不运行付费模型',schema(),false],
 ['payo_identity','验证当前登录身份和知识整理版本',schema(),true],
 ['payo_list_sources','分页列出当前账号的资料、分类和解析/整理状态；不包含原件存储地址',schema({offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:50}}),true],
 ['payo_read_source','读取一份资料的 Markdown 正文；较长正文可按字符分页读取',schema({id:textSchema,kind:{type:'string',enum:['library','document']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:24000}},['id','kind']),true],
 ['payo_start_organization','为指定资料创建或恢复新版人工整理任务；不调用付费模型',schema({id:textSchema},['id']),false],
 ['payo_get_organization','查询当前账号的整理任务状态',schema({id:textSchema},['id']),true],
 ['payo_export_packet','导出整份资料的新版整理任务包；提取、条件关联和复核按任务包规则执行',schema({id:textSchema,revision:revisionSchema},['id','revision']),false],
 ['payo_import_packet','导入已核对的整理结果；使用原有逐字证据和来源版本校验，不自动入库',schema({id:textSchema,revision:revisionSchema,token:textSchema,format:{type:'string',enum:['payo-knowledge-document-v1']},reviewed:{type:'boolean',const:true},result:{type:'object'}},['id','revision','token','format','reviewed','result']),false],
 ['payo_commit_organization','将通过证据复核的指定条目存入知识库（待确认、内部使用）；保留原件和历史资料',schema({id:textSchema,revision:revisionSchema,ids:{type:'array',minItems:1,maxItems:200,uniqueItems:true,items:textSchema},reviewed:{type:'boolean',const:true}},['id','revision','ids','reviewed']),false],
 ['payo_search_knowledge','关键词搜索当前账号的知识切片，返回分类、来源、证据和完整分页信息',schema({q:{type:'string',maxLength:500},page:{type:'integer',minimum:1},pageSize:{type:'integer',minimum:1,maximum:50}},['q']),true],
 ['payo_read_knowledge','读取当前账号的切片详情和原文证据上下文',schema({id:textSchema},['id']),true]
].map(([name,description,inputSchema,readOnly])=>({name,description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:false,openWorldHint:false}}));
function validate(value,s){
 if(s.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('参数必须是对象');
  for(const k of s.required||[])if(!(k in value))throw Error('缺少参数：'+k);
  if(s.additionalProperties===false)for(const k of Object.keys(value))if(!(k in s.properties))throw Error('未知参数：'+k);
  for(const [k,v] of Object.entries(value))if(s.properties?.[k])validate(v,s.properties[k]);
 }else if(s.type==='string'){if(typeof value!=='string'||value.length<(s.minLength||0)||value.length>(s.maxLength||Infinity))throw Error('文本参数无效');}
 else if(s.type==='integer'){if(!Number.isInteger(value)||value<(s.minimum??-Infinity)||value>(s.maximum??Infinity))throw Error('分页或版本参数无效');}
 else if(s.type==='boolean'&&typeof value!=='boolean')throw Error('确认参数无效');
 else if(s.type==='array'){if(!Array.isArray(value)||value.length<(s.minItems||0)||value.length>(s.maxItems||Infinity)||s.uniqueItems&&new Set(value).size!==value.length)throw Error('条目列表无效');for(const v of value)validate(v,s.items);}
 if(s.enum&&!s.enum.includes(value)||s.const!==undefined&&value!==s.const)throw Error('参数值无效');
}
const sourceFields=['id','kind','name','title','revision','sourceVersion','libraryCategory','sourceFormat','usageScope','usageLabel','usageRevision','referenceURL','canCite','conversionState','conversionError','documentId','isDocument','knowledgeStatus','knowledgeStatusLabel','state','created','updated'];
const pickSource=s=>Object.fromEntries(sourceFields.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
export async function mcp(request,env,api){
 const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='POST')return response({error:'仅支持 POST'},405);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>600*1024)return response({error:'请求过大'},413);
 let message;try{message=JSON.parse(raw);}catch{return response({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON 格式无效'}});}
 const id=message?.id??null,ok=result=>response({jsonrpc:'2.0',id,result});
 if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return response({jsonrpc:'2.0',id,error:{code:-32600,message:'请求格式无效'}});
 if(message.method==='server/discover')return ok({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(message.method==='initialize')return ok({protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'payo-knowledge',version:'1.0.0'}});
 if(message.method==='notifications/initialized')return new Response(null,{status:202});
 if(message.method==='ping')return ok({});
 if(message.method==='tools/list')return ok({tools});
 if(message.method!=='tools/call')return response({jsonrpc:'2.0',id,error:{code:-32601,message:'未知方法'}});
 try{
  const uid=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
  if(!uid||!email)throw Error('需要连接网站插件并使用 ChatGPT 登录；服务访问凭据不提供用户身份');
  const tool=tools.find(t=>t.name===message.params?.name);if(!tool)throw Error('未知工具');
  const args=message.params?.arguments??{};validate(args,tool.inputSchema);
  async function call(path,body){
   const url=new URL('/api/studio/'+path,request.url),headers=new Headers();
   headers.set('oai-authenticated-user-id',uid);headers.set('oai-authenticated-user-email',email);
   if(body)headers.set('Content-Type','application/json');
   const r=await api(new Request(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);
   const data=await r.json();if(!r.ok)throw Error(data.error||'操作失败');return data;
  }
  let result;
  switch(tool.name){
   case 'payo_refresh_due_insights':result=await call('insightsRefreshDue',{});break;
   case 'payo_identity': result={authenticated:true,email,policyVersion:'knowledge-organization-v2',scope:'仅当前账号资料；不自动授予对外引用权限'};break;
   case 'payo_list_sources': {const data=await call('library');const offset=args.offset??0,limit=args.limit??20;result={total:data.files.length,items:data.files.slice(offset,offset+limit).map(pickSource),nextOffset:offset+limit<data.files.length?offset+limit:null};break;}
   case 'payo_read_source': {const data=await call(args.kind+'/'+encodeURIComponent(args.id));const body=data.markdown||'',offset=args.offset??0,limit=args.limit??12000;result={...pickSource(data),markdown:body.slice(offset,offset+limit),offset,totalCharacters:body.length,nextOffset:offset+limit<body.length?offset+limit:null};break;}
   case 'payo_start_organization':result=await call('ingestionStart',{id:args.id,executionMode:'manual'});break;
   case 'payo_get_organization':result=await call('ingestion?id='+encodeURIComponent(args.id));break;
   case 'payo_export_packet':result=await call('knowledgePacketExport',args);break;
   case 'payo_import_packet':result=await call('knowledgePacketImport',args);break;
   case 'payo_commit_organization':result=await call('ingestionCommit',args);break;
   case 'payo_search_knowledge':result=await call('knowledge?'+new URLSearchParams({q:args.q,page:String(args.page??1),pageSize:String(args.pageSize??20)}));break;
   case 'payo_read_knowledge':result=await call('knowledgeItem/'+encodeURIComponent(args.id));break;
  }
  return ok({content:[{type:'text',text:JSON.stringify(result)}],isError:false});
 }catch(e){return ok({content:[{type:'text',text:e.message||'操作失败'}],isError:true});}
}
