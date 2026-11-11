export const ORGANIZATION_VERSION='knowledge-organization-v2';
export const CATEGORY_POLICIES={
 'About Payoneer':{min:400,max:800,unit:'独立主体/服务范围/团队职责主题',rule:'保留主体、服务对象、地区、职责边界和联系方式用途。'},
 Events:{min:600,max:1200,unit:'活动议题或连续论点',rule:'区分活动信息、限时优惠、历史观点与常青方法；分别提取活动日期、政策有效期、统计年份。未知日期不得假定永久有效。'},
 'Product Guide':{min:400,max:1000,unit:'完整操作阶段及步骤',rule:'保留操作场景、产品、地区、平台、账户类型、前置条件、分支和步骤顺序。步骤编号只引用原文；不要混合不同版本或分支。'},
 'Products & Solutions':{min:600,max:1200,unit:'客户场景—需求—方案',rule:'提取产品名称、适用客户、业务场景、配套产品、资格、限制和价值依据。原文明示关系与建议关系必须区分。'},
 'Product Brochure':{min:250,max:700,unit:'产品卖点及限定条件',rule:'功能、宣传卖点必须与资格、地区、费率、有效期及脚注一起保存；不得将优势改写成保证。'},
 'Templates & Tools':{min:400,max:1200,unit:'工作表或计算模块',rule:'保留输入、输出、单位、公式和参数依据。没有原公式时明确标记未保留公式；Markdown 表格不代表可执行计算器。'},
 Whitepaper:{min:800,max:1500,unit:'研究问题、结论及证据',rule:'保留研究主题、国家/行业、发布年份、统计期间、样本口径、数据来源及局限。历史数据不改写为当前事实。产品关联只能是有证据的建议。'}
};
export const PRODUCT_REGISTRY=[
 {id:'product:payoneer-card',name:'Payoneer 随心付',aliases:['随心付','payoneer card','payoneer cards']},
 {id:'product:receiving-account',name:'Payoneer 收款账户',aliases:['收款账户','receiving account','receiving accounts','本地收款账户','全球swift','swift收款']},
 {id:'product:checkout',name:'Payoneer Checkout',aliases:['checkout','派安盈收单','payoneer收单']},
 {id:'product:payment-request',name:'Payoneer 收款请求',aliases:['收款请求','request a payment','payment request']},
 {id:'product:fx',name:'派安盈换汇',aliases:['预约汇率','余额互换','换汇','currency conversion']},
 {id:'product:working-capital',name:'Payoneer 营运资金',aliases:['early payments','working capital','速盈收']},
 {id:'product:vmp',name:'VMP 全球生态聚合平台',aliases:['vmp','全球生态聚合平台','全球生态聚集平台']}
];
const normalized=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export function stableEntityId(kind,value){let hash=14695981039346656037n;for(const byte of new TextEncoder().encode(normalized(value)))hash=((hash^BigInt(byte))*1099511628211n)&0xffffffffffffffffn;return kind+':'+hash.toString(16).padStart(16,'0');}
export function resolveProducts(value){const text=normalized(Array.isArray(value)?value.join(' '):value);return PRODUCT_REGISTRY.filter(product=>product.aliases.some(alias=>text.includes(normalized(alias)))).map(({id,name})=>({id,name,status:'registered'}));}
export function organizationContext(source,metadata={}){const category=metadata.libraryCategory||source.libraryCategory||'未分类';return {policyVersion:ORGANIZATION_VERSION,libraryCategory:category,sourceFormat:source.sourceFormat||source.format||'md',sourceId:source.id,sourceFamilyId:source.familyId||source.libraryId||source.id,sourceHash:source.hash||source.sha256||'',sourceVersion:source.sourceVersion||source.conversionVersion||1,effective:source.effective||'',expires:source.expires||'',policy:CATEGORY_POLICIES[category]||{min:500,max:1200,unit:'完整业务主题',rule:'保持完整语义、证据和条件，不推断资料分类。'},productRegistry:PRODUCT_REGISTRY};}
export function categorySourceBlocks(markdown,context){
 if(typeof markdown!=='string'||!markdown.trim()||markdown.length>160000)throw Error('当前 Agent 支持正文不超过16万字符；请拆分长资料后处理。');
 const policy=context.policy||CATEGORY_POLICIES[context.libraryCategory]||{min:500,max:1200};const blocks=[];const lines=markdown.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g)||[];
 let offset=0,start=0,heading=[],currentHeading=[],code=false,table=false;
 const emit=end=>{if(end<=start)return;blocks.push({id:'B'+(blocks.length+1),start,end,text:markdown.slice(start,end),heading:[...currentHeading]});start=end;currentHeading=[...heading];};
 for(const line of lines){const isFence=/^\s*(```|~~~)/.test(line);const isTable=!code&&/^\s*\|/.test(line);const match=!code&&line.match(/^(#{1,6})\s+(.+?)\s*(?:\r\n|\r|\n)?$/);if(match){if(offset>start&&offset-start>=policy.min)emit(offset);heading=heading.slice(0,Number(match[1].length)-1);heading[match[1].length-1]=match[2];if(offset===start)currentHeading=[...heading];}
  if(offset-start>=policy.max&&!code&&!table&&!isTable&&/^\s*$/.test(line))emit(offset+line.length);
  offset+=line.length;if(isFence)code=!code;table=isTable;
 }
 emit(markdown.length);
 // Oversized semantic units remain lossless; bounded blocks provide model-safe evidence.
 const bounded=[];for(const block of blocks){let cursor=block.start;while(cursor<block.end){let end=Math.min(cursor+3500,block.end);if(end<block.end){const newline=markdown.lastIndexOf('\n',end);if(newline>cursor+1500)end=newline+1;}bounded.push({...block,id:'B'+(bounded.length+1),start:cursor,end,text:markdown.slice(cursor,end),continued:cursor>block.start||end<block.end});cursor=end;}}
 return bounded.map((block,index)=>({...block,order:index,parentId:stableEntityId('section',[context.sourceFamilyId,...block.heading].join('/')),previousBlockId:bounded[index-1]?.id||null,nextBlockId:bounded[index+1]?.id||null,libraryCategory:context.libraryCategory}));
}
export function assertUsableSource(markdown){if(/未抓取网页正文|未进行语音转写/.test(markdown)&&markdown.length<1500)throw Error('此资料只有网页/视频入口，需先导入网页正文或转写文本后再知识整理。');if(!markdown.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/^#{1,6}[^\r\n]*$/gm,'').trim())throw Error('此资料缺少可提取的正文，请先完成 OCR 或补充文本。');}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),text={type:'string'},texts={type:'array',items:text};
export const organizationSchema=object({scenario:text,process:text,stepNumbers:{type:'array',items:{type:'integer'}},branch:text,prerequisites:texts,conditions:texts,dates:{type:'array',items:object({kind:{type:'string',enum:['published','event_start','event_end','effective','expires','data_period']},value:text})},contentRole:{type:'string',enum:['evergreen','event_info','promotion','historical','unknown']},researchTopic:text,toolInputs:texts,toolOutputs:texts,formulas:texts});
function cleanList(value,max=20){if(!Array.isArray(value)||value.length>max||value.some(v=>typeof v!=='string'||v.length>1000))throw Error('整理元数据列表无效');return [...new Set(value.map(v=>v.trim()).filter(Boolean))];}
function exactList(value,evidence){const values=cleanList(value);if(values.some(text=>!evidence.includes(text)))throw Error('前置条件、限制或公式必须逐字引用当前证据');return values;}
export function decorateExtraction(item,raw,blocks,context){
 if(context?.policyVersion!==ORGANIZATION_VERSION)return item;
 const evidence=item.evidence.map(e=>e.quote).join('\n'),provided=raw.organization;const warnings=[];let organization;
 if(provided){
  for(const key of ['scenario','process','branch','researchTopic'])if(typeof provided[key]!=='string'||provided[key].length>500)throw Error('场景/流程元数据无效');
  if(!Array.isArray(provided.stepNumbers)||provided.stepNumbers.length>100||provided.stepNumbers.some(n=>!Number.isInteger(n)||n<1||n>1000))throw Error('步骤编号无效');
  for(const n of provided.stepNumbers){const pattern=new RegExp('(?:第\\s*'+n+'\\s*步|(?:^|[\\r\\n])\\s*(?:[-*]\\s*)?'+n+'[.、)）])');if(!pattern.test(evidence))throw Error('步骤编号缺少原文依据');}
  if(!['evergreen','event_info','promotion','historical','unknown'].includes(provided.contentRole))throw Error('内容时效类型无效');
  if(!Array.isArray(provided.dates)||provided.dates.length>12||provided.dates.some(d=>!['published','event_start','event_end','effective','expires','data_period'].includes(d.kind)||typeof d.value!=='string'||!d.value.trim()||d.value.length>100||!evidence.includes(d.value)))throw Error('时间信息必须有当前原文证据，不得补造日期');
  if(provided.branch&&!evidence.includes(provided.branch))throw Error('分支条件必须逐字引用当前证据');
  organization={scenario:provided.scenario,process:provided.process,stepNumbers:[...new Set(provided.stepNumbers)].sort((a,b)=>a-b),branch:provided.branch,prerequisites:exactList(provided.prerequisites,evidence),conditions:exactList(provided.conditions,evidence),dates:provided.dates,contentRole:provided.contentRole,researchTopic:provided.researchTopic,toolInputs:exactList(provided.toolInputs,evidence),toolOutputs:exactList(provided.toolOutputs,evidence),formulas:exactList(provided.formulas,evidence),relationshipBasis:'suggested'};
 }else{organization={scenario:'',process:'',stepNumbers:[],branch:'',prerequisites:[],conditions:[],dates:[],contentRole:'unknown',researchTopic:'',toolInputs:[],toolOutputs:[],formulas:[],relationshipBasis:'suggested'};warnings.push('兼容旧结果：结构化整理元数据尚未补充');}
 const scope=evidence+' '+blocks.filter(block=>item.evidence.some(e=>e.blockId===block.id)).flatMap(block=>block.heading||[]).join(' ');const products=resolveProducts(scope);const unknown=item.products.filter(name=>normalized(scope).includes(normalized(name))&&!resolveProducts(name).length).map(name=>({id:stableEntityId('product-candidate',name),name,status:'candidate'}));
 const processFamilyId=organization.process?stableEntityId('process',context.sourceFamilyId+'/'+organization.process):null;
 const locationBlocks=blocks.filter(block=>item.evidence.some(e=>e.blockId===block.id));
 if(context.libraryCategory==='Product Guide'&&item.type==='操作流程'&&!processFamilyId)warnings.push('操作流程未明确关联，请核对场景与流程总览');
 if(context.libraryCategory==='Events'&&!organization.dates.length)warnings.push('活动或政策的时间信息未明确，引用前需确认');
 if(context.libraryCategory==='Templates & Tools'&&!organization.formulas.length)warnings.push('未保留可核对的原公式，不作为可执行计算器');
 return {...item,organization,policyVersion:ORGANIZATION_VERSION,libraryCategory:context.libraryCategory,sourceFormat:context.sourceFormat,productEntities:[...products,...unknown],scenarioId:organization.scenario?stableEntityId('scenario',[...products.map(p=>p.id),...item.platforms,...item.regions,organization.scenario].join('/')):null,processFamilyId,processVersionId:processFamilyId?processFamilyId+':'+context.sourceHash:null,researchTopicId:organization.researchTopic?stableEntityId('research',organization.researchTopic):null,sourceLocations:locationBlocks.map(({id,start,end,heading,parentId,previousBlockId,nextBlockId,continued})=>({blockId:id,start,end,heading:heading||[],parentId:parentId||null,previousBlockId:previousBlockId||null,nextBlockId:nextBlockId||null,continued:!!continued})),organizationWarnings:warnings};
}
export function organizationCommit(item,index,context,allItems){
 if(item.policyVersion!==ORGANIZATION_VERSION)return {};
 const siblings=allItems.filter(other=>item.processVersionId&&other.processVersionId===item.processVersionId&&other.organization?.branch===item.organization?.branch).sort((a,b)=>Math.min(...a.evidence.map(e=>e.start))-Math.min(...b.evidence.map(e=>e.start)));const order=siblings.findIndex(other=>other.id===item.id);
 return {sourceItemId:item.id,organizationContext:{policyVersion:context?.policyVersion,sourceId:context?.sourceId,sourceVersion:context?.sourceVersion,sourceHash:context?.sourceHash},flow:{processFamilyId:item.processFamilyId,processVersionId:item.processVersionId,originalStepNumbers:item.organization.stepNumbers,branch:item.organization.branch,sequenceOrder:order>=0?order+1:index+1,sequenceBasis:'整理序号，非原文步骤编号',previousSourceItemId:siblings[order-1]?.id||null,nextSourceItemId:siblings[order+1]?.id||null,knownStepCount:siblings.length,completeness:'仅覆盖已选且通过复核的知识；未声明流程完整'},organizationWarnings:item.organizationWarnings||[]};
}
export function processOverviews(items){const groups=new Map();for(const item of items){if(!item.processVersionId)continue;const key=item.processVersionId+'|'+item.organization.branch;const group=groups.get(key)||{processFamilyId:item.processFamilyId,processVersionId:item.processVersionId,branch:item.organization.branch,title:item.organization.process,steps:[]};group.steps.push({sourceItemId:item.id,title:item.title,stepNumbers:item.organization.stepNumbers,start:Math.min(...item.evidence.map(e=>e.start))});groups.set(key,group);}return [...groups.values()].map(group=>{const observed=[...new Set(group.steps.flatMap(step=>step.stepNumbers))].sort((a,b)=>a-b),missingOriginalStepNumbers=observed.length?Array.from({length:observed.at(-1)-observed[0]+1},(_,i)=>observed[0]+i).filter(step=>!observed.includes(step)):[];return {...group,steps:group.steps.sort((a,b)=>a.start-b.start),missingOriginalStepNumbers,completeness:missingOriginalStepNumbers.length?'原文步骤编号存在断点，需人工核对是否遗漏':'已选条目的流程目录，未声称覆盖原文全部步骤'};});}
export function parseEvidenceDate(value,endOfDay=false){const match=String(value||'').match(/^(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})(?:日)?$/);if(!match)return null;const [year,month,day]=match.slice(1).map(Number);const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;return Date.UTC(year,month-1,day,endOfDay?23:0,endOfDay?59:0,endOfDay?59:0);}
export function temporalState(item,stamp=Date.now()){
 const org=item.organization;if(!org)return {state:'unspecified',label:'未标记时效'};
 const date=kind=>org.dates?.find(d=>d.kind===kind)?.value;
 const effective=parseEvidenceDate(date('effective')),expires=parseEvidenceDate(date('expires')||(org.contentRole==='event_info'?date('event_end'):''),true);
 if(effective!==null&&effective>stamp)return {state:'future',label:'尚未生效'};
 if(expires!==null&&expires<stamp)return {state:'expired',label:'已过期，仅供历史参考'};
 if(org.contentRole==='historical')return {state:'historical',label:'历史观点/数据，保留原统计期间'};
 if(['promotion','event_info'].includes(org.contentRole)&&expires===null)return {state:'unknown',label:'有效期未明确，引用前需确认'};
 return {state:'current',label:'未发现明确过期标记，不等于独立事实核验'};
}
export const ORGANIZATION_INSTRUCTIONS='按 organizationContext.policy 执行分类规则。organization 的 scenario/process/researchTopic 是检索分组建议，不代表事实关联；branch、prerequisites、conditions、toolInputs、toolOutputs、formulas 必须逐字来自该条目的 evidence；没有依据返回空字符串/空数组。dates.value 保留原文日期表达并由当前 evidence 支持，不猜测有效期。步骤编号只填原文明确的“第N步”或编号列表；系统另存整理序号。活动结束不使常青方法自动失效；历史数据不改写为当前事实。产品名、别名保留，系统负责注册标识；同词共现只能是相关建议。工具缺少公式时不补造计算逻辑。';
