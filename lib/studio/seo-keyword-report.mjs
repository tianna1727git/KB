import {SEO_ENGINES,SEO_MARKETS,keywordStats,lookupLabel} from './seo-keywords.mjs';
const text=v=>String(v??'').replace(/[|\r\n]/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const table=(fields,rows)=>[fields.map(text).join(' | '),fields.map(()=>'---').join(' | '),...rows.map(row=>row.map(text).join(' | '))].map(row=>'| '+row+' |').join('\n');
export function keywordReport(job){const rows=job.rows||[],s=keywordStats(rows),c=job.config,analysis=job.analysis;const reasons=[...(job.notes||[]),'未接入目标市场自然搜索结果，词簇及页面方向为初步判断，未评定SEO难度。','未检查本站页面与排名，不提供已确认内容缺口或个性化排名结论。'];const status=!s.queried?'数据未接通':'部分完成';const top=[...rows].sort((a,b)=>(a.priority==='计划布局'?-1:0)-(b.priority==='计划布局'?-1:0)||(b.search_volume??-1)-(a.search_volume??-1)).slice(0,20);const seed=rows.find(r=>r.keyword_type==='seed');return `# ${text(job.seed)} SEO 关键词研究与机会分析报告

## 0. 研究口径与完成状态

- 搜索引擎：${SEO_ENGINES.find(e=>e.value===c.engine)?.label}；目标市场：${SEO_MARKETS.find(m=>m.value===c.market)?.label}；语言：${c.language}；设备：${c.device}
- 企业背景：${text(c.companyContext)||'未配置，未评定企业业务相关性'}
- 官网域名：${text(c.domain)||'未配置'}（未检查本站排名）
- 数据来源：${[...new Set(rows.map(r=>r.provider))].map(text).join('、')||'尚未获取'}
- 数据快照时间：${[...new Set(rows.map(r=>r.provider_snapshot_date).filter(Boolean))].join('、')||'数据快照时间未提供'}
- 查询时间：${text(rows.find(r=>r.retrieved_at)?.retrieved_at)||'未查询'}
- 完成状态：**${status}**；阶段：${job.stage}。接口是否返回指标与研究是否完整分别记录。

${reasons.map(r=>'- '+text(r)).join('\n')}

## 1. 核心结论

${(analysis?.conclusions?.length?analysis.conclusions:s.positive?['已获得部分关键词的正向搜索需求记录；需求规模见下表。','广告竞争度用于广告投放观察，不代表自然搜索排名难度。','仍需查询自然搜索结果并核对现有页面后确定执行优先级。']:['尚未获得可支撑正向搜索需求的记录。','零搜索量是数据源估计，不等于没有业务价值。','未验证的候选词和失败查询不作为已验证流量机会。']).map(x=>'- '+text(x)).join('\n')}

## 2. 种子关键词概览

${table(['关键词','月均搜索量','趋势及口径','KD','意图','CPC／币种','数据状态'],[[job.seed,seed?lookupLabel(seed):'待查询','该数据源未提供趋势','该数据源不支持',seed?.intent||'待分析','该接口返回指导价，并非实际CPC',seed?.lookup_status||'pending']])}

## 3. 长尾词与相关词明细

主报告展示不超过二十个代表词。完整数据见 CSV／JSON；空值与零值分别保留。

${table(['关键词','类型','月均搜索量','KD','意图','词簇','优先级','推荐依据'],top.map(r=>[r.keyword_original,{seed:'种子',related:'相关',long_tail:'长尾'}[r.keyword_type],lookupLabel(r),'不支持',r.intent||'待分析',analysis?.clusters.find(cl=>cl.id===r.cluster_id)?.name||'待聚类',r.priority,r.recommendation_reason||r.lookup_note||'尚未完成分析']))}

## 4. 关键词簇与需求洞察

${analysis?table(['词簇','代表词','包含词数','用户需求','候选页面类型','证据与机会'],analysis.clusters.map(cl=>[cl.name,rows.find(r=>r.id===cl.keywordIds[0])?.keyword_original,cl.keywordIds.length,cl.need,cl.pageType,cl.reason+'；'+cl.basis])):'尚未完成聚类。'}

词簇关键词可能有重叠需求；不将搜索量相加视为独立用户数、市场总量或预期流量。

## 5. 重点机会与内容建议

${analysis?.pages?.map(p=>{const cl=analysis.clusters.find(x=>x.id===p.clusterId);const members=rows.filter(r=>r.cluster_id===p.clusterId);return '### '+text(p.title)+'\n\n- 主目标词：'+text(members[0]?.keyword_original)+'\n- 辅助词：'+members.slice(1).map(r=>text(r.keyword_original)).join('、')+'\n- 用户需求：'+text(cl?.need)+'\n- 页面类型：'+text(p.pageType)+'\n- 数据／观察：'+text(p.reason)+'\n- 页面建议：'+p.points.map(text).join('；')+'\n- 下一步行动：'+text(p.nextAction)+'\n- 验证条件：'+p.status+'；需补充SERP与产品证据。';}).join('\n\n')||'尚未生成有依据的页面建议。'}

## 6. 下一步行动

${(analysis?.nextActions?.length?analysis.nextActions:['核对查询失败或缺少指标的关键词。','补充目标市场的自然搜索结果。','核对现有官网页面和已确认业务资料，再确定页面优先级。']).slice(0,5).map(x=>'- '+text(x)).join('\n')}

## 7. 方法与数据说明

- 候选数：${s.candidates}；有查询来源记录：${s.queried}；有搜索量：${s.withVolume}；正值：${s.positive}；零值：${s.zero}；暂无数据：${s.noData}；失败：${s.failed}；不支持：${s.unsupported}；待查询：${s.pending}。
- 调用次数：${job.calls||0} / ${c.requestBudget}（含模型尝试）；拓展轮数：${job.rounds||0} / ${c.expansionRounds}；达到上限不继续拓展。
- 模型用量：${job.usage?.total||0} Tokens，仅统计服务返回的 usage；失败调用仍可能计费。
- 同义词只做意图聚类，不因语义相似而删除独立关键词。
- 百度推荐接口使用 PV／pcPV／mobilePV，流量接口使用 averageMonthPv／averageMonthPvPc／averageMonthPvMobile；不使用含义不同的 pv、show、click 替代搜索量。
- 指导价为百度接口提供的广告指导价（元），不是实际CPC；广告竞争程度不是SEO KD。
- 数据源没有提供快照时间、趋势、SEO KD或实际CPC时不补造；未知值保持 null，绝不补为零。
- 已保存百度响应快照：${job.snapshots?.length||0} 份；用户导入数据标为用户提供。模型只能补充定性标签和页面方向，数字表格由程序生成。
- 未提供SERP查询能力、页面全文读取和域名排名工具；没有声称完成这些检查，也没有自动发布或创建文章任务。
`;
}
