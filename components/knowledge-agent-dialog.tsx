/// <reference types="vite/client" />
'use client';
import {useEffect,useRef,useState} from 'react';
import policySource from '../lib/studio/organization-policy.mjs?raw';
import runtimeSource from '../lib/studio/api-ingestion.ts?raw';
import parserSource from '../lib/studio/mineru.ts?raw';

export function KnowledgeAgentDialog({onClose}:{onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [code,setCode]=useState(''),[revision,setRevision]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  dialog.current?.showModal();
  const controller=new AbortController();
  fetch('/api/studio/ingestionRules',{signal:controller.signal}).then(async response=>{
   const data=await response.json() as {rules:unknown,revision:number,error?:string};
   if(!response.ok)throw Error(data.error||'加载失败');
   setCode(JSON.stringify(data.rules,null,2));setRevision(data.revision);
  }).catch(error=>{if(!controller.signal.aborted)setMessage(error.message);});
  return ()=>controller.abort();
 },[]);
 async function save(){
  setBusy(true);setMessage('');
  try {
   const rules=JSON.parse(code);
   const response=await fetch('/api/studio/ingestionRules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,rules})});
   const data=await response.json() as {rules:unknown,revision:number,error?:string};
   if(!response.ok)throw Error(data.error||'保存失败');
   setRevision(data.revision);setMessage('已保存，新建整理任务将使用此版本。');
  }catch(error){setMessage(error instanceof SyntaxError?'JSON格式有误，请检查后保存。':String((error as Error).message));}
  finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="knowledge-agent-dialog panel" aria-labelledby="knowledge-agent-title" onClose={onClose}>
  <header><h2 id="knowledge-agent-title">知识整理Agent</h2><button autoFocus aria-label="关闭" className="text-btn" onClick={()=>dialog.current?.close()}>✕</button></header>
  <h3>输入</h3><p>原始资料、资料名与版本、分类、使用权限及已有的公开原文URL。</p>
  <h3>执行规则</h3><ol>
   <li><b>解析资料。</b>通过MinerU处理需要转换的文件，沿用已有的Markdown。保留标题、步骤、表格及脚注，解析疑点进入复核。</li>
   <li><b>按分类切片。</b>每片完整表达一个知识点，保留适用条件与逐处引文。对照产品、主体、市场、版本和日期判断冲突。</li>
   <li><b>写入知识库。</b>逐条核对证据与公开引用权限，确认后进入关键词检索；待复核条目留在审核队列。</li>
  </ol>
  <h3>输出</h3><p>可按关键词检索的切片、对应原文位置与适用条件，以及待复核原因。</p>
  <details><summary>编辑执行规则代码</summary><label>分类与复核规则（JSON）<textarea spellCheck={false} value={code} disabled={revision===null||busy} onChange={e=>setCode(e.target.value)}/></label><button className="primary" disabled={busy||revision===null} onClick={save}>保存规则</button></details>
  <p role="status">{message}</p>
  <details><summary>查看实现代码</summary>{[['MinerU解析',parserSource],['切片与定位',policySource],['复核与入库',runtimeSource]].map(([name,source])=><details key={name}><summary>{name}</summary><pre tabIndex={0}>{source}</pre></details>)}</details>
 </dialog>;
}
