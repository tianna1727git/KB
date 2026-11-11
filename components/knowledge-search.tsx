'use client';
import {useEffect,useRef,useState} from 'react';
import {Search,FileText,FolderOpen,ArrowRight,ExternalLink,ChevronDown,X,LoaderCircle,AlertTriangle,SlidersHorizontal} from 'lucide-react';
import {LIBRARY_CATEGORIES} from '../lib/studio/library-categories.mjs';
type R=Record<string,any>;
const plain=(text:string)=>String(text||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/<[^>]*>/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[#*_`|\\]/g,'').replace(/\s+/g,' ').trim();
function summaryText(item:R){let text=plain(item.statement||item.body);const title=plain(item.title);for(let i=0;i<2&&title&&text.toLowerCase().startsWith(title.toLowerCase());i++)text=text.slice(title.length).replace(/^[\s:：、.。-]+/,'');return text;}
function excerpt(item:R,terms:string[]){const text=summaryText(item),lower=text.toLowerCase(),match=terms.map(term=>lower.indexOf(term.toLowerCase())).find(index=>index>=0),start=match!==undefined&&match>70?match-45:0;return (start?'…':'')+text.slice(start,start+240)+(text.length>start+240?'…':'');}
function Highlight({text,terms}:{text:string,terms:string[]}){const words=[...new Set(terms.filter(Boolean))].sort((a,b)=>b.length-a.length);if(!words.length)return <>{text}</>;const escaped=words.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const parts=text.split(new RegExp('('+escaped.join('|')+')','gi'));return <>{parts.map((part,i)=>words.some(term=>term.toLowerCase()===part.toLowerCase())?<mark key={i}>{part}</mark>:part)}</>;}

export function KnowledgeSearch({categories,onDetail,onSource,refreshKey=0}:{categories:R[],onDetail:(id:string)=>void,onSource:(id:string)=>void,refreshKey?:number}){
 const [input,setInput]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[page,setPage]=useState(1),[includeContext,setIncludeContext]=useState(false),[result,setResult]=useState<R|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[collapsed,setCollapsed]=useState<string[]>([]),[expanded,setExpanded]=useState<string[]>([]),[filtersOpen,setFiltersOpen]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const controller=new AbortController();let alive=true;
  if(!query){setLoading(false);setResult(null);setError('');return()=>controller.abort();}
  setLoading(true);setError('');setResult(null);
  const params=new URLSearchParams({q:query,category,page:String(page),pageSize:'12',directOnly:String(!includeContext)});
  fetch('/api/studio/knowledge?'+params,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'检索失败，请重试');return data;}).then(data=>{if(alive)setResult(data);}).catch(reason=>{if(alive&&reason.name!=='AbortError')setError(reason.message);}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;controller.abort();};
 },[query,category,page,includeContext,retry,refreshKey]);
 function submit(){const value=input.trim();if(!value)return;setPage(1);setCollapsed([]);setExpanded([]);if(value===query)setRetry(n=>n+1);else setQuery(value);}
 function clear(){setInput('');setQuery('');setPage(1);setCategory('all');setCollapsed([]);inputRef.current?.focus();}
 const facets=result?.categories||categories,totalCategories=facets.reduce((sum:number,item:R)=>sum+item.count,0);
 const terms=[query,...result?.retrieval?.terms||[]].filter(Boolean);
 const counts=new Map(facets.map((item:R)=>[item.name,item.count]));
 const options=[...LIBRARY_CATEGORIES,...facets.map((item:R)=>item.name).filter((name:string)=>!LIBRARY_CATEGORIES.includes(name))].map(name=>({name,count:counts.get(name)||0}));
 function chooseCategory(name:string){setCategory(name);setPage(1);setCollapsed([]);setExpanded([]);setFiltersOpen(false);}
 const groups=new Map<string,R[]>();for(const item of result?.items||[]){const name=item.libraryCategory||'未分类';groups.set(name,[...(groups.get(name)||[]),item]);}
 return <section className="panel knowledge-discovery" aria-labelledby="knowledge-search-title">
  <header className="knowledge-discovery-header">
   <h2 id="knowledge-search-title">知识检索</h2>
   <form className="knowledge-query" role="search" onSubmit={event=>{event.preventDefault();submit();}}>
    <Search size={21} aria-hidden="true"/><input ref={inputRef} aria-label="知识检索关键词" placeholder="输入关键词" maxLength={500} value={input} onChange={event=>setInput(event.target.value)}/>
    {input&&<button type="button" className="knowledge-input-clear" aria-label="清空关键词" onClick={clear}><X size={16}/></button>}
    <button type="submit" className="primary" disabled={!input.trim()||loading}>{loading?<LoaderCircle size={17} className="spin"/>:<Search size={17}/>}搜索</button>
   </form>
   <p className="knowledge-search-hint">从来源资料中查找知识、操作步骤与适用条件</p>
  </header>
  <div className="knowledge-search-layout">
   <aside className="knowledge-facets" aria-label="资料分类">
    <div className="knowledge-facets-heading"><h3>资料分类</h3><button className="knowledge-mobile-filter" aria-label="展开或收起资料分类" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/>{filtersOpen?'收起':'筛选'}</button></div>
    <div className={'knowledge-facet-list'+(filtersOpen?' is-open':'')}>
     <button className={category==='all'?'active':''} aria-pressed={category==='all'} onClick={()=>chooseCategory('all')}><span>全部分类</span><b>{loading?'—':totalCategories}</b></button>
     {options.map(item=><button key={item.name} className={category===item.name?'active':''} aria-pressed={category===item.name} onClick={()=>chooseCategory(item.name)}><span>{item.name}</span><b>{loading?'—':item.count}</b></button>)}
     <small>沿用资料库分类<br/>数量为知识条目数</small>
    </div>
   </aside>
   <div className="knowledge-search-results" aria-busy={loading}>
    {!query?<div className="knowledge-search-start"><span className="knowledge-start-icon"><Search size={28}/></span><h3>从一个问题开始</h3><p>搜索后，按来源资料分类查看命中的知识与原文依据。</p><div>{['预约汇率','收款账户','跨境退税'].map(word=><button key={word} onClick={()=>{setInput(word);setQuery(word);setPage(1);}}>试试“{word}”<ArrowRight size={13}/></button>)}</div></div>:<>
     <div className="knowledge-results-toolbar"><div><h3>检索结果</h3><p role="status">{loading?'正在查找相关知识…':result?<>找到 <strong>{result.total}</strong> 条知识{result.sourceCount!==undefined&&<>，来自 {result.sourceCount} 份资料</>}</>:'检索未完成'}</p></div><button onClick={clear}><X size={14}/>清除检索</button></div>
     <div className="knowledge-results-options"><label className="knowledge-context-toggle"><input type="checkbox" checked={includeContext} onChange={event=>{setIncludeContext(event.target.checked);setPage(1);}}/>显示关联上下文</label><span>按相关度排序</span></div>
     {category!=='all'&&<div className="knowledge-active-filter"><span>资料分类</span><button onClick={()=>chooseCategory('all')}>{category}<X size={12}/></button></div>}
     {error&&<div className="banner error" role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>重试</button></div>}
     {loading&&<div className="knowledge-search-loading"><LoaderCircle size={24} className="spin"/><p>正在查找知识与来源…</p></div>}
     {!loading&&result?.total===0&&<div className="knowledge-search-start"><Search size={25}/><h3>暂无匹配的知识</h3><p>试试缩短关键词、切换资料分类，或显示关联上下文。</p>{category!=='all'&&<button onClick={()=>chooseCategory('all')}>查看全部分类</button>}</div>}
     {[...groups].map(([name,items])=><section className="knowledge-result-group" key={name}>
      <button className="knowledge-group-heading" aria-expanded={!collapsed.includes(name)} onClick={()=>setCollapsed(values=>values.includes(name)?values.filter(value=>value!==name):[...values,name])}><FolderOpen size={15}/><h3>{name}</h3><span>共 {result?.categories?.find((item:R)=>item.name===name)?.count||items.length} 条 · 本页 {items.length} 条</span><ChevronDown size={16} className={collapsed.includes(name)?'':'expanded'}/></button>
      {!collapsed.includes(name)&&items.map(item=>{
       const full=summaryText(item),preview=excerpt(item,terms),isExpanded=expanded.includes(item.id),tags=[...new Set([item.type,...item.platforms||[],...item.regions||[],...item.products||[]].filter(Boolean))].slice(0,4);
       return <article className="knowledge-search-card" key={item.id}>
        <div className="knowledge-result-source"><span className="knowledge-format-icon"><FileText size={16}/></span><button onClick={()=>onSource(item.docId)} title={item.sourceName}>{item.sourceName}</button><span className="knowledge-source-version">V{item.sourceVersion}</span><span className={'usage-badge '+(item.usageScope||'writing')}>{item.usageLabel||'写作素材'}</span><span className={'knowledge-status '+(item.available?(item.canCite?'verified':'internal'):item.state==='pending'?'review':'inactive')}><span aria-hidden="true"/>{item.availabilityReason}</span></div>
        <button className="knowledge-search-title" onClick={()=>onDetail(item.id)}><Highlight text={plain(item.title)} terms={terms}/></button>
        <p className={'knowledge-result-excerpt'+(isExpanded?' is-expanded':'')}><Highlight text={isExpanded?full:preview} terms={terms}/></p>
        <div className="knowledge-result-tags">{tags.map((tag,index)=><span key={index}>{tag}</span>)}{item.retrieval?.matchKind==='context'&&<span className="knowledge-context-tag">关联上下文</span>}{item.risks?.length>0&&<span className="knowledge-result-risk"><AlertTriangle size={12}/>{item.conflicts?.length?'存在待核对差异':'适用条件需核对'}</span>}</div>
        {item.temporal&&['expired','future','historical','unknown'].includes(item.temporal.state)&&<p className="knowledge-result-temporal">{item.temporal.label}</p>}
        <footer className="knowledge-result-actions"><div>{full.length>180&&<button aria-expanded={isExpanded} onClick={()=>setExpanded(values=>isExpanded?values.filter(id=>id!==item.id):[...values,item.id])}>{isExpanded?'收起摘要':'展开摘要'}<ChevronDown size={13} className={isExpanded?'expanded':''}/></button>}</div><div><button onClick={()=>onSource(item.docId)}>查看来源<ExternalLink size={13}/></button><button className="knowledge-open-result" onClick={()=>onDetail(item.id)}>查看全文<ArrowRight size={14}/></button></div></footer>
       </article>;
      })}
     </section>)}
     {!loading&&result&&result.total>0&&<footer className="knowledge-search-pagination"><span>每页 12 条 · 第 {result.page} / {result.pages} 页</span><div><button disabled={result.page<=1} onClick={()=>{setPage(result.page-1);setCollapsed([]);setExpanded([]);}}>上一页</button><button disabled={result.page>=result.pages} onClick={()=>{setPage(result.page+1);setCollapsed([]);setExpanded([]);}}>下一页</button></div></footer>}
    </>}
   </div>
  </div>
 </section>;
}
