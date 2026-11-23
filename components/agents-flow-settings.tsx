/// <reference types="vite/client" />
'use client';
import {KnowledgeAgentDialog} from './knowledge-agent-dialog';
import {useState} from 'react';
import {ArrowRight,Bot,ChevronRight,Workflow} from 'lucide-react';
import {systemPrompt} from '../lib/studio/agent.mjs';

import writerSource from '../lib/studio/article-faq.mjs?raw';
import checkerSource from '../lib/studio/knowledge.mjs?raw';
import publisherSource from '../lib/studio/publishing.mjs?raw';

const implementation:Record<string,{file:string,source:string}>={
 'writer': { file: 'article-faq.mjs', source: writerSource },
 'checker': { file: 'knowledge.mjs', source: checkerSource },
 'publisher': { file: 'publishing.mjs', source: publisherSource },
};

type Agent={id:string,name:string,role:string,tools:string[]};
type Props={agents:Agent[],config:Record<string,any>,onNavigate:(view:string)=>void,onSettings:()=>void};
const io:Record<string,{input:string[],output:string[],rule:string,code:string}>={
 writer:{input:['经确认的大纲、素材与已核验公开证据','平台规则、品牌/法务规则、FAQ知识与CTA候选','修改时还包括现有正文和检查问题'],output:['标题、完整Markdown正文、SEO标题/描述与slug','次级关键词、3–5条FAQ、CTA放置建议','待补证据或事实缺口'],rule:'仅用当前任务提供的事实；政策、标准、产品规则和关键数字需要权威/官方来源；必须有FAQ；不编造CTA。',code:systemPrompt('内容写作 Agent')},
 checker:{input:['当前正文、已确认大纲、素材与公开证据','适用规则、来源状态和CTA信息'],output:['检查摘要','按严重程度标注的问题、原文定位及修改建议','仍缺少的资料或核实项'],rule:'逐项对照来源与规则，不替代人工审核；引用、适用条件或事实无法核实就指出问题。',code:systemPrompt('内容检查 Agent')},
 publisher:{input:['人工审核通过的正文、SEO字段、CTA与公开引用'],output:['ZCMS blog字段交接包','当前状态：等待Stage API接入；尚未自动写入或回读验证'],rule:'仅整理已审核内容并提供字段校验；发布接口未接通前，不声称已发布。',code:'// 当前仅生成发布交接包；Stage API写入与回读验证待接入。'}
};

function displayAgentText(text:string) {
 return text.replace(/(?<=[\u3400-\u9fff]) +(?=[A-Za-z0-9])|(?<=[A-Za-z0-9]) +(?=[\u3400-\u9fff])/g,'');
}

export function AgentsFlowSettings({agents,config,onNavigate,onSettings}:Props){
 const [dialogAgent,setDialogAgent]=useState<string|null>(null);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 return <>
  <div className="page-heading"><div><h1>Agents</h1><p>查看每个Agent实际接收的数据、输出结果、执行规则和实现代码。</p></div></div>
  <div className="agent-cards">{agents.map(agent=>{const detail=io[agent.id];return <section className="panel agent-card" key={agent.id}>
   <header className="agent-card-heading">
    <div className={'agent-icon '+agent.id}><Bot size={25}/></div>
    {(agent.id==='ingestion'||agent.id==='research')?<button className="text-btn" aria-haspopup="dialog" onClick={()=>setDialogAgent(agent.id)}>查看执行规则与代码</button>:detail&&<button type="button" className="text-btn" aria-expanded={!!expanded[agent.id]} aria-controls={'agent-spec-'+agent.id}
      onClick={()=>setExpanded(current=>({...current,[agent.id]:!current[agent.id]}))}>
      {expanded[agent.id]?'收起执行规则与代码':'查看执行规则与代码'}
    </button>}
   </header>
   <h2>{displayAgentText(agent.name)}</h2><p>{displayAgentText(agent.role)}</p><div className="tag-list">{agent.tools.map(tool=><span key={tool}>{displayAgentText(tool)}</span>)}</div>
   <footer>{agent.id==='publisher'?<button className="text-btn" onClick={onSettings}>查看发布设置<ChevronRight size={14}/></button>:<button className="text-btn model-config-link" onClick={onSettings}><i className={(agent.id==='ingestion'?config.knowledgeModel:config.model)?'live-dot':'idle-dot'}/>{(agent.id==='ingestion'?config.knowledgeModel:config.model)?'模型已配置 · 管理':'等待模型配置 · 去配置'}<ChevronRight size={14}/></button>}</footer>
   {agent.id!=='ingestion'&&agent.id!=='research'&&detail&&<div className="agent-spec" id={'agent-spec-'+agent.id} hidden={!expanded[agent.id]}><div className="agent-spec-grid"><section><h3>输入</h3><ul>{detail.input.map(x=><li key={x}>{x}</li>)}</ul></section><section><h3>输出</h3><ul>{detail.output.map(x=><li key={x}>{x}</li>)}</ul></section></div><p className="agent-rule-summary"><b>规则摘要：</b>{detail.rule}</p><section className="agent-code"><h3>执行规则</h3><pre>{detail.code}</pre>
     <h3>实现代码 · {implementation[agent.id].file}</h3><pre tabIndex={0}>{implementation[agent.id].source}</pre></section><small>内容来自当前工作区执行规则；任务实际输入和输出以该任务的执行记录为准。</small></div>}
  </section>})}</div>
  {dialogAgent&&<KnowledgeAgentDialog research={dialogAgent==='research'} onClose={()=>setDialogAgent(null)}/>}
  <div className="section-title"><h2>固定工作流</h2><span>每一步都保留人工确认</span></div>
  {[
   ['知识入库Flow','Markdown资料形成可调用知识','上传资料','Agent整理','结果确认','正式入库'],
   ['SEO文章生产Flow','从关键词、Sources到可审核文稿','输入关键词与选题','确认Sources','选择标题并生成','人工审核与导出'],
  ].map((flow,index)=><section className="panel flow-card" key={flow[0]}>
   <div><span className="flow-icon"><Workflow size={22}/></span><div><h2>{flow[0]}</h2><p>{flow[1]}</p></div><button onClick={()=>onNavigate(index===0?'library':'content')}>开始任务<ArrowRight size={14}/></button></div>
   <div className="flow-visual">{flow.slice(2).map((step,stepIndex)=><div key={step}><span>{String(stepIndex+1).padStart(2,'0')}</span><b>{step}</b>{stepIndex<3&&<ArrowRight size={18}/>}</div>)}</div>
  </section>)}
  <p className="subtle">模型未配置时，Agent不会执行模型步骤；发布Agent当前仅生成交接包。</p>
 </>;
}
