import {test} from 'node:test';import assert from 'node:assert/strict';
import {evidenceAnchors,apiEvidenceRequest} from '../lib/studio/api-ingestion-evidence.mjs';
import {sourceBlocks,validateExtraction,validateLinks,validateAudit} from '../lib/studio/ingestion-agent.mjs';
const text='# 收款\r\n\r\nPayoneer **支持收款**，金额 $ 100。\r\nOCR 换行 保持原样。\r\n\r\n# 条件\r\n\r\n仅限企业。';const blocks=sourceBlocks(text);
const item={title:'收款',statement:'Payoneer 支持收款。',type:'产品说明',products:[],platforms:[],regions:[],keywords:[]};
test('API extraction resolves source anchors to exact original Markdown and positions',()=>{const anchors=evidenceAnchors(blocks);assert.ok(anchors.length>=4);for(const a of anchors)assert.equal(text.slice(a.start,a.end),a.quote);const request=apiEvidenceRequest('extract',{blocks,document:'OCR资料'});const anchor=anchors.find(a=>a.quote.includes('$ 100'));assert.deepEqual(request.schema.properties.items.items.properties.evidence.items.required,['anchorId']);const raw=request.hydrate({items:[{...item,evidence:[{anchorId:anchor.id}]}],omissions:[]});const result=validateExtraction(raw,blocks);const e=result.items[0].evidence[0];assert.equal(text.slice(e.start,e.end),e.quote);assert.match(e.quote,/\*\*支持收款\*\*/);assert.throws(()=>request.hydrate({items:[{...item,evidence:[{anchorId:'B999-E1'}]}],omissions:[]}));});
test('ambiguous repeated paragraphs receive unique source context, without rewriting',()=>{const source='重复。\n\n条件一。\n\n重复。';const bs=sourceBlocks(source);for(const a of evidenceAnchors(bs)){assert.equal(source.slice(a.start,a.end),a.quote);assert.equal(bs[0].text.indexOf(a.quote),bs[0].text.lastIndexOf(a.quote));}const long='甲'.repeat(950)+'\n'+'乙'.repeat(950);for(const a of evidenceAnchors(sourceBlocks(long)))assert.equal(long.slice(a.start,a.end),a.quote);});
test('condition and conflict anchors stay bound to their original items',()=>{const source=sourceBlocks('支持收款。\n\n仅限企业。');const items=validateExtraction({items:[{...item,evidence:[{blockId:'B1',quote:'支持收款。'}]},{...item,title:'条件',statement:'仅限企业。',evidence:[{blockId:'B1',quote:'仅限企业。'}]}],omissions:[]},source).items;const req=apiEvidenceRequest('link',{items});const links=validateLinks(req.hydrate({links:[{itemId:'K1',conditionItemId:'K2',reason:'主体限制',evidence:[{anchorId:'C-K2-E1'}]}]}),items,source);assert.equal(links[0].evidence[0].quote,'仅限企业。');assert.throws(()=>req.hydrate({links:[{itemId:'K1',conditionItemId:'K2',evidence:[{anchorId:'C-K1-E1'}]}]}));const existing=[{id:'old',body:'仅限个人。'}],audit=apiEvidenceRequest('audit',{items,existing,sourceBlocks:source});const raw=audit.hydrate({checks:items.map(i=>({itemId:i.id,supported:true,issues:[]})),conflicts:[{itemId:'K2',otherId:'old',reason:'主体不同',currentAnchorId:'A-K2-E1',otherAnchorId:'X-old'}],summary:'需人工核对',uncovered:[]});const result=validateAudit(raw,items,existing,source);assert.equal(result.conflicts[0].currentQuote,'仅限企业。');assert.equal(result.conflicts[0].otherQuote,'仅限个人。');assert.throws(()=>audit.hydrate({...raw,conflicts:[{itemId:'K2',otherId:'old',currentAnchorId:'A-K1-E1',otherAnchorId:'X-old'}]}));});

test('budget guide maps condition fields back to the selected Markdown evidence',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {organizationContext}=await import('../lib/studio/organization-policy.mjs');
 const records=JSON.parse(await readFile(new URL('../lib/studio/library-data.json',import.meta.url),'utf8'));
 const guide=records.find(f=>f.name.includes('管理费用支出预算')&&f.name.endsWith('.md'));
 const context=organizationContext(guide),blocks=sourceBlocks(guide.markdown,context);
 const req=apiEvidenceRequest('extract',{blocks,organizationContext:context});
 const data=JSON.parse(req.messages[1].content);
 const q=data.organizationExcerpts.find(e=>e.quote==='首次使用时，点击【创建您的第一个预算】。');
 const org={scenario:'',process:'',stepNumbers:[],branch:'',prerequisites:[q.id],conditions:[],dates:[],contentRole:'unknown',researchTopic:'',toolInputs:[],toolOutputs:[],formulas:[]};
 const raw={items:[{...item,title:'首次创建预算',statement:q.quote,organization:org,evidence:[{anchorId:q.anchorId}]}],omissions:[]};
 const result=validateExtraction(req.hydrate(raw),blocks,'',context).items[0];
 assert.equal(result.organization.prerequisites[0],q.quote);
 const e=result.evidence[0];assert.equal(guide.markdown.slice(e.start,e.end),e.quote);
 raw.items[0].organization.prerequisites=['首次使用时应创建预算'];
 assert.throws(()=>req.hydrate(raw),/未绑定当前切片/);
 raw.items[0].organization.prerequisites=[data.organizationExcerpts.find(v=>v.anchorId!==q.anchorId).id];
 assert.throws(()=>req.hydrate(raw),/未绑定当前切片/);
});
