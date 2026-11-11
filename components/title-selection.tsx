'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw,ArrowRight,Check,Sparkles} from 'lucide-react';
type R=Record<string,any>;
async function request(path:string,body?:R){const r=await fetch('/api/studio/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await r.json();if(!r.ok)throw Error(value.error||'操作失败');return value;}
export function TitleSelection({task,onUpdate}:{task:R;onUpdate:(t:R)=>void}){
 const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 async function submit(refresh=false){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const next=await request(refresh?'run':'selectTitles',{id:task.id,revision:task.revision,...(refresh?{keepIds:selected}:{ids:selected})});onUpdate(next);if(next.error)setError(next.error);}catch(e:any){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 const options=task.titleOptions||[],available=new Set(options.map((x:R)=>x.id)),ids=selected.filter(id=>available.has(id));
 return <section className="panel title-selection" aria-label="选择文章标题"><header><div><h2>选几个标题，开始写作</h2><p>已整理 {task.materials?.length||0} 条素材 · 支持多选</p></div><button disabled={busy||task.state==='running'||ids.length>9} onClick={()=>submit(true)}><RefreshCw size={16} className={busy?'spin':''}/>换一组</button></header>
 {(error||task.error)&&<p className="banner error" role="alert">{error||task.error}</p>}
 <div className="title-option-grid">{options.map((item:R)=><label key={item.id} className={'title-option '+(ids.includes(item.id)?'selected':'')}><input type="checkbox" checked={ids.includes(item.id)} disabled={busy||task.state==='running'} onChange={e=>setSelected(e.target.checked?[...ids,item.id]:ids.filter(x=>x!==item.id))}/><div><h3>{item.title}</h3><p>{item.angle}</p><small>{item.materialRefs?.length||0} 条素材支撑</small></div></label>)}</div>
 <footer><span>{ids.length?'已选 '+ids.length+' 个标题':'请选择标题'}</span><button className="primary" disabled={busy||task.state==='running'||!ids.length||!!task.stale?.length} onClick={()=>submit()}><Sparkles size={16}/>{busy?'处理中…':'开始生成'+(ids.length?' '+ids.length+' 篇':'')}</button></footer></section>;
}
export function ArticleBatch({task,modelReady,onOpen,background=false,autoRun=true,skipTaskId=''}:{task:R;modelReady:boolean;onOpen:(id:string)=>void;background?:boolean;autoRun?:boolean;skipTaskId?:string}){
 const [items,setItems]=useState<R[]>([]),[error,setError]=useState('');const active=useRef(false);
 useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;
 async function tick(){if(stopped)return;if(active.current){timer=setTimeout(tick,1000);return;}active.current=true;
 try{const rows=await Promise.all((task.childTaskIds||[]).map((id:string)=>request('task/'+id)));if(stopped)return;setItems(rows);
 const next=rows.find(t=>t.id!==skipTaskId&&t.state==='waiting'&&['write','check'].includes(t.stage));
 if(next&&modelReady&&autoRun){const result=await request('run',{id:next.id,revision:next.revision});if(!stopped)setItems(rows.map(t=>t.id===result.id?result:t));}
 }catch(e:any){if(!stopped)setError(e.message);}finally{active.current=false;if(!stopped)timer=setTimeout(tick,1500);}}
 tick();return()=>{stopped=true;clearTimeout(timer);};},[task.id,modelReady,autoRun,skipTaskId]);
 async function retry(t:R){if(active.current)return;active.current=true;setError('');try{const updated=await request('run',{id:t.id,revision:t.revision});setItems(rows=>rows.map(x=>x.id===t.id?updated:x));}catch(e:any){setError(e.message);}finally{active.current=false;}}
 if(background)return null;
 return <section className="panel title-selection" aria-label="本次生成文稿"><header><div><h2>本次文稿</h2><p>{items.filter(t=>['review','done'].includes(t.stage)).length} / {task.childTaskIds?.length||0} 篇已生成</p></div></header>{error&&<p className="banner error">{error}</p>}{!modelReady&&<p className="banner">请先配置文稿生成服务。</p>}<div className="article-batch-list">{items.map(t=><article key={t.id}><div><h3>{t.title}</h3><p>{t.error||({write:'正在起草',check:'正在检查',review:'待人工审核',done:'审核完成'} as R)[t.stage]||'等待生成'}</p></div><div className="actions">{t.state==='failed'&&<button disabled={!modelReady} onClick={()=>retry(t)}>重试</button>}<button onClick={()=>onOpen(t.id)}>{['review','done'].includes(t.stage)?'查看文稿':'查看进度'}<ArrowRight size={15}/></button></div></article>)}</div></section>;
}
