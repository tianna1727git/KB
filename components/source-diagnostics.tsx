'use client';
type R=Record<string,any>;
export function SourceDiagnostics({value,onOpenDocument}:{value?:R,onOpenDocument?:(id:string)=>void}){
 if(!value)return null;
 return <details className="source-diagnostics panel" open={value.eligible===0}><summary>Sources 可用性检查：{value.total} 条知识中，{value.eligible} 条符合引用条件</summary><p>以下按每条知识最先遇到的阻碍计数。知识数量不等于已审核、有效并允许对外引用的数量。</p>{value.excluded.map((r:R)=><p key={r.key}>{r.label}：<b>{r.count}</b> 条</p>)}{value.eligible>0&&<p>若检索仍为 0，说明当前主题没有匹配到这些可引用知识；可调整主题或补充相关知识，不代表资料库为空。</p>}{value.suggestions.length>0&&<><h4>与主题相关、但尚不可引用的来源</h4>{value.suggestions.map((s:R,i:number)=><div key={i} className="source-option"><b>{s.sourceName}</b><p>{s.knowledgeTitle} · {s.reason}</p>{s.documentId&&onOpenDocument&&<button className="text-btn" onClick={()=>onOpenDocument(s.documentId)}>查看来源与审核设置</button>}</div>)}</>}<p className="subtle">检索不消耗模型额度。不要为了检索命中而跳过原文核对或批量开放引用权限。</p></details>;
}
