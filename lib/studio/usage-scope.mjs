export const USAGE_SCOPES=Object.freeze([{value:'writing',label:'写作素材'},{value:'reference',label:'参考引用'}]);
export const validUsageScope=value=>USAGE_SCOPES.some(scope=>scope.value===value);
export const usageLabel=value=>USAGE_SCOPES.find(scope=>scope.value===value)?.label||'写作素材';
export function publicReferenceURL(value){
 let url;try{url=new URL(value);}catch{throw Error('参考引用需要公开可查的 HTTPS 来源网址');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||host.includes(':')||/^[\d.]+$/.test(host)||!host.includes('.')||/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)||host.endsWith('.localhost'))throw Error('请填写公开可查的 HTTPS 来源网址');
 url.hash='';return url.href;
}
export function sourceUsage(source={},metadata){
 const usageScope=validUsageScope(metadata?.usageScope)?metadata.usageScope:validUsageScope(source.usageScope)?source.usageScope:'writing';
 let referenceURL='';try{referenceURL=publicReferenceURL(metadata?.referenceURL||source.referenceURL||source.sourceURL||source.source);}catch{}
 return {usageScope,usageLabel:usageLabel(usageScope),usageRevision:metadata?.revision||0,referenceURL:usageScope==='reference'?referenceURL:'',canCite:usageScope==='reference'&&!!referenceURL};
}
export function withSourceUsage(documents,libraries=[],metadata=[]){
 const byId=new Map(libraries.map(source=>[source.id,source])),byHash=new Map(libraries.filter(source=>source.sha256).map(source=>[source.sha256,source])),bySource=new Map(metadata.map(entry=>[entry.sourceId,entry]));
 return documents.map(document=>{const source=byId.get(document.libraryId)||byHash.get(document.hash)||document;return {...document,...sourceUsage(source,bySource.get(source.id)||bySource.get(document.id))};});
}
export function inheritUsage(chunks,documents){const byId=new Map(documents.map(d=>[d.id,d]));return chunks.map(chunk=>({...chunk,...sourceUsage(byId.get(chunk.docId)),usageRevision:byId.get(chunk.docId)?.usageRevision||0}));}
export function isPublicEvidence(source){return source.usageScope==='reference'&&source.canCite===true&&!!source.referenceURL;}
export const REFERENCE_POLICY={allowAlternativePublicSources:true,unverifiedContent:'retain_as_writing',writingMaterialRequiresPublicReference:false};
