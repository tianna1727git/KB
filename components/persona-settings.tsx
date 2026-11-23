'use client';
import {WorkspaceLoading} from './workspace-loading';
import {PencilSave} from './pencil-save';
import {useEffect,useState} from 'react';
import {Plus,RotateCcw,Users} from 'lucide-react';
import {DEFAULT_PERSONAS} from '../lib/studio/persona-defaults.mjs';
import {PersonaRobot} from './persona-robot';
type Persona=typeof DEFAULT_PERSONAS[number];
export function PersonaSettings(){
 const [personas,setPersonas]=useState<Persona[]>([]),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/studio/personaSettings',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'读取 Persona 设置失败');setPersonas(d.personas);setRevision(d.revision);}catch(e:any){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 function update(id:string,key:string,value:any){setPersonas(current=>current.map(p=>p.id===id?{...p,[key]:value}:p));setNotice('');}
 function add(){const id='custom-'+crypto.randomUUID();setPersonas(current=>[...current,{id,name:'新伙伴',title:'',careerStage:'',goals:'',challenges:'',decisionCriteria:'',communicationStyle:'',typicalQuestion:'',notes:'',enabled:true}]);}
 async function save(){if(busy)return;setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/studio/personaSettings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,personas})}),d=await r.json();if(!r.ok)throw Error(d.error||'保存失败');setPersonas(d.personas);setRevision(d.revision);setNotice('Persona设置已保存。');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 function restore(){setPersonas(DEFAULT_PERSONAS.map(p=>({...p})));setNotice('已恢复初始设置；点击保存后生效。');setError('');}
 return <section className="persona-settings"><header className="page-heading"><div><h1>Persona</h1><p>为内容研究与写作设定目标读者。每个画像都可以单独编辑、启用或停用。</p></div></header>
  {loading?<WorkspaceLoading compact/>:<><div className="persona-toolbar"><span><Users size={16}/>{personas.length}个读者画像</span><div><button type="button" onClick={restore}><RotateCcw size={15}/>恢复初始设置</button><button type="button" onClick={add} disabled={personas.length>=12}><Plus size={15}/>新增</button><button type="button" className="primary" onClick={()=>void save()} disabled={busy}><PencilSave/>{busy?'保存中…':'保存设置'}</button></div></div>
   {error&&<p className="banner error" role="alert">{error}</p>}{notice&&<p className="banner" role="status">{notice}</p>}
   <div className="persona-list">{personas.map((p,index)=><article className="panel persona-card" key={p.id}><header><div className="persona-heading"><PersonaRobot index={index}/><div><input aria-label="Persona名字" value={p.name} maxLength={80} onChange={e=>update(p.id,'name',e.target.value)}/></div></div><div className="persona-card-actions">
      <button className="icon-btn" type="button" aria-label={'启用 '+p.name} aria-pressed={p.enabled}
        title={p.enabled?'已启用，点击停用':'已停用，点击启用'} onClick={()=>update(p.id,'enabled',!p.enabled)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5Q10 3 19.8 4L20.4 19.8Q12 21 3.7 20Z"/>{p.enabled&&<path d="m6.5 12 4 4.1Q15 9.8 19 7"/>}</svg>
      </button>
      <button className="icon-btn" type="button" aria-label={'删除 '+p.name} title={'删除 '+p.name}
        onClick={()=>setPersonas(current=>current.filter(item=>item.id!==p.id))}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 6.7Q10 5.8 20.7 6.4M8.7 6l.6-3.1 5.1.1.6 3M5.5 8.4l1.2 12q4.8.9 10.9-.1l.9-12M10 10l.4 7.4m3.8-7.6-.3 7.7"/></svg>
      </button></div></header>
    <label className="field"><span>角色</span><input value={p.title} maxLength={180} onChange={e=>update(p.id,'title',e.target.value)} placeholder="角色名称"/></label>
    <label className="field"><span>角色与背景</span><textarea value={p.careerStage||''} maxLength={1600} rows={3} onChange={e=>update(p.id,'careerStage',e.target.value)}/></label>
    <div className="persona-fields"><label className="field"><span>目标与动机</span><textarea value={p.goals} maxLength={1200} rows={3} onChange={e=>update(p.id,'goals',e.target.value)}/></label><label className="field"><span>挑战与痛点</span><textarea value={p.challenges} maxLength={1200} rows={3} onChange={e=>update(p.id,'challenges',e.target.value)}/></label><label className="field"><span>决策与证据标准</span><textarea value={p.decisionCriteria} maxLength={1200} rows={3} onChange={e=>update(p.id,'decisionCriteria',e.target.value)}/></label><label className="field"><span>沟通偏好</span><textarea value={p.communicationStyle} maxLength={1200} rows={3} onChange={e=>update(p.id,'communicationStyle',e.target.value)}/></label></div>
    <label className="field"><span>典型提问</span><input value={p.typicalQuestion||''} maxLength={500} onChange={e=>update(p.id,'typicalQuestion',e.target.value)}/></label>{p.notes&&<p className="persona-note">{p.notes}</p>}
   </article>)}</div><div className="persona-footer"><p>独立站Persona与平台卖家分开；自由职业者与服务出口企业也保留各自的经营场景和适用条件。</p><button type="button" className="primary" onClick={()=>void save()} disabled={busy}><PencilSave/>{busy?'保存中…':'保存Persona设置'}</button></div></>}
 </section>;
}
