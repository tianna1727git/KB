'use client';
import {useState} from 'react';
import {ArrowLeft,Check,RefreshCw,Sparkles,AlertCircle,BookOpen,ShieldCheck,Download,Save} from 'lucide-react';
import {ArticleCanvas} from './article-canvas';
import {ArticleOutput} from './article-output';
import {DraftHistory} from './writing-sources';
type R=Record<string,any>;
export function WritingWorkspace({task,busy,modelReady,auto,title,body,onTitle,onBody,onBack,onSettings,onLibrary,onContinue,onRestart,onSave,onComplete,onRevision,onDocument,onUpdate}:R){
 const [confirmed,setConfirmed]=useState(false),[editing,setEditing]=useState(false),[localError,setLocalError]=useState('');
 const ready=['check','review','done'].includes(task.stage)&&!!task.markdown,review=task.stage==='review',done=task.stage==='done',changed=title!==task.title||body!==task.markdown;
 const position=done?5:review?4:3,stages=['输入关键词','确定主题','选择官网','生成文稿','人工审核','导出'];
 const phases=[['sources','匹配写作素材'],['research','组织素材与大纲'],['write','按官网规范起草'],['check','检查事实、引用与SEO']];
 const phase=task.stage==='outline'?1:task.stage==='revise'?2:Math.max(0,phases.findIndex(([key])=>key===task.stage));
 const legacyReferenceBlock=/未找到能够核实所选素材的公开参考引用|没有核实通过的公开参考引用/.test(task.error||'');
 const blocked=task.state==='failed'||!!task.error||!!task.stale?.length||!modelReady||task.stage==='sources'&&!auto;
 async function action(fn:()=>Promise<any>){setLocalError('');try{await fn();}catch(e:any){setLocalError(e.message);}}
 return <><button className="text-btn back" onClick={onBack}><ArrowLeft size={15}/>返回内容生产工作台</button>
  <header className="page-heading"><div><h1>{task.title||task.keyword}</h1><p>{task.platform} · {task.audience}</p></div><span className={'writing-status '+(blocked?'blocked':'')}>{done?'已审核，可导出':review?'待人工审核':blocked?'需要处理':task.state==='running'?'正在生成':'准备生成'}</span></header>
  <nav className="writing-journey" aria-label="文章生产流程">{stages.map((label,i)=><div key={label} className={i<position?'finished':i===position?'current':''} aria-current={i===position?'step':undefined}><span>{i<position?<Check size={14}/>:i+1}</span><b>{label}</b></div>)}</nav>
  <div className="writing-summary"><span>关键词 <b>{task.keyword}</b></span><span>发文平台 <b>官网</b></span><span>输出 <b>排版文稿 / HTML / Markdown</b></span></div>
  {localError&&<p className="banner error" role="alert">{localError}</p>}
  {!ready?<section className="panel writing-generation" aria-label="生成文稿"><div className="writing-generation-title"><span className="writing-orb"><Sparkles size={28}/></span><h2>{blocked?'生成暂未完成':'正在准备你的官网文稿'}</h2><p>正在组织素材、起草并检查。</p></div>
   <ol className="writing-phases">{phases.map(([key,label],i)=><li key={key} className={i<phase?'finished':i===phase?'current':''}><span>{i<phase?<Check size={15}/>:i+1}</span><div><b>{label}</b><small>{i<phase?'已完成':i===phase?blocked?'等待处理':task.state==='running'?'正在执行':'等待执行':'待执行'}</small></div>{i===phase&&task.state==='running'&&<RefreshCw size={16} className="spin"/>}</li>)}</ol>
   {blocked&&<div className="writing-blocker" role="alert"><AlertCircle size={19}/><div><h3>{!modelReady?'请先配置文稿生成服务':task.stale?.length?'参考来源已变化':/公开|来源|素材|资料|引用/.test(task.error||'')||task.stage==='sources'?'需要补充或核实写作依据':'生成过程中遇到问题'}</h3><p>{!modelReady?'当前未配置可用的生成服务，暂时无法自动生成。任务和已有内容已保留。':(legacyReferenceBlock?'引用规则已更新，可直接继续生成。':task.error)||task.stale?.join('、')||'当前没有可用于本次写作的有效素材。请补充资料后继续。'}</p><div className="actions">{!modelReady?<button className="primary" onClick={onSettings}>配置生成服务</button>:<><button onClick={onLibrary}>查看资料库</button><button className="primary" disabled={busy} onClick={()=>action(onContinue)}>处理后继续生成</button></>}</div></div></div>}
   {!blocked&&task.state!=='running'&&!auto&&<button className="primary" disabled={busy} onClick={()=>action(onContinue)}><Sparkles size={15}/>继续生成文稿</button>}

  </section>:<div className="writing-review-layout canvas-layout"><section className="panel writing-review-main"><div className="panel-heading"><div><h2>{done?'审核完成 · 导出文稿':review?'人工审核':'文稿检查中'}</h2></div><details className="canvas-seo"><summary>SEO 信息</summary><div><b>SEO 标题</b><p>{task.seoTitle||title}</p><b>描述</b><p>{task.metaDescription}</p><b>关键词</b><p>{[task.keyword,...task.secondaryKeywords||[]].join('、')}</p><b>URL</b><p>{task.slug}</p></div></details></div>
   {task.error&&<p className="banner error" role="alert">{task.error}</p>}{task.stale?.length>0&&<p className="banner error" role="alert">参考来源已变化：{task.stale.join('、')}。请重新生成。</p>}
   {editing&&!done&&<div className="writing-editor"><label className="field"><span>文章标题</span><input aria-label="文章标题" value={title} maxLength={200} onChange={e=>{onTitle(e.target.value);setConfirmed(false);}}/></label><label className="field"><span>文章正文（Markdown）</span><textarea aria-label="文章正文" className="body-editor" value={body} onChange={e=>{onBody(e.target.value);setConfirmed(false);}}/></label><button className="primary" disabled={busy||!changed} onClick={()=>action(onSave)}><Save size={15}/>保存修改并重新检查</button></div>}
   {body?.trim()&&(done?<ArticleOutput task={task} markdown={body} title={title} allowExport={true}/>:<ArticleCanvas task={{...task,markdown:body,title}} disabled={busy||!modelReady||changed} onUpdate={onUpdate}/>)}
   {review&&<div className="human-review"><h3><ShieldCheck size={18}/>确认审核</h3><label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={changed||busy}/>我已核对正文、公开引用及适用条件，并处理待补充项</label><div className="actions">{!!task.issues?.length&&<button disabled={busy||changed||task.round>=2} onClick={()=>action(onRevision)}><RefreshCw size={15}/>按检查意见修改</button>}<button className="primary" disabled={busy||changed||!confirmed||!!task.stale?.length} onClick={()=>action(()=>onComplete(confirmed))}><Check size={15}/>确认审核，进入导出</button></div></div>}
  </section><aside className="writing-review-aside canvas-checks"><details className="panel"><summary>检查结果{task.issues?.length?' · '+task.issues.length+' 项':''}</summary><p>{task.checkSummary||'检查中…'}</p>{(task.issues||[]).map((issue:R,i:number)=><div className="writing-review-issue" key={i}><b>{issue.reason}</b><p>{issue.suggestion}</p></div>)}{(task.missing||[]).map((line:string,i:number)=><p className="risk-note" key={i}>{line}</p>)}</details></aside></div>}
  <details className="panel writing-details"><summary>生成记录与历史版本</summary><div>{(task.events||[]).map((e:R,i:number)=><p key={i}><b>{e.name}</b> · {e.detail||'结果已保存'} {e.time&&new Date(e.time).toLocaleString('zh-CN')}</p>)}{task.outline&&<details><summary>生成的大纲</summary><pre>{task.outline}</pre></details>}<button disabled={busy||!!task.demoFlow} onClick={()=>{if(window.confirm('重新生成会保留历史版本，是否继续？'))action(onRestart);}}><RefreshCw size={14}/>重新生成</button></div><DraftHistory task={task}/></details>
 </>;
}
