import {XMLParser} from 'fast-xml-parser';
import {convert} from 'html-to-text';
import {publicReferenceURL} from './usage-scope.mjs';
import {tokens,expand} from './knowledge.mjs';
const arr=value=>value==null?[]:Array.isArray(value)?value:[value];
const text=value=>String(typeof value==='object'?value?.['#text']||value?.['__cdata']||'':value||'');
const plain=value=>convert(text(value),{wordwrap:false,selectors:[{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}]}).trim();
export function articleDate(value){
 if(value===undefined||value===null||value==='')return null;let input=String(value).trim();if(!input)return null;
 const china=input.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
 if(china){const [,y,m,d,h='0',minute='0',sec='0']=china,year=Number(y),month=Number(m),day=Number(d);if(month<1||month>12||day<1||day>31||Number(h)>23||Number(minute)>59||Number(sec)>59)return null;const calendar=new Date(Date.UTC(year,month-1,day));if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return null;input=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${minute}:${sec.padStart(2,'0')}+08:00`;}
 const raw=/^\d{10,13}$/.test(input)?Number(input)*(input.length===10?1000:1):input,time=new Date(raw).getTime();return Number.isFinite(time)?new Date(time).toISOString():null;
}
const safeURL=(value,base)=>{try{return publicReferenceURL(new URL(String(value),base).href);}catch{return '';}};
export async function fetchPublicResource(value,fetcher=fetch){let url=publicReferenceURL(value);for(let i=0;i<4;i++){const r=await fetcher(url,{redirect:'manual',headers:{Accept:'text/html,application/rss+xml,application/atom+xml,application/xml,text/xml,application/json'},signal:AbortSignal.timeout(12000)});if([301,302,303,307,308].includes(r.status)){url=publicReferenceURL(new URL(r.headers.get('location'),url).href);continue;}if(!r.ok)throw Error('来源返回 HTTP '+r.status);if(Number(r.headers.get('content-length'))>2000000)throw Error('来源内容超过2 MB');const reader=r.body?.getReader();if(!reader)throw Error('来源正文为空');let size=0,body='';const decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2000000)throw Error('来源内容超过2 MB');body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}finally{await reader.cancel();}return {url,body,type:r.headers.get('content-type')||''};}throw Error('来源跳转次数过多');}
export function parseFeed(raw,base){if(!/<(?:rss|feed)(?:\s|\/?>)/i.test(raw))return null;if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('订阅源包含不支持的实体声明');const parsed=new XMLParser({ignoreAttributes:false,processEntities:false}).parse(raw);const rss=parsed.rss?.channel,atom=parsed.feed;if(!rss&&!atom)return null;return arr(rss?.item||atom?.entry).slice(0,100).map(item=>{const links=arr(item.link),link=links.find(v=>typeof v==='object'&&(!v['@_rel']||v['@_rel']==='alternate'))||links[0];return {title:plain(item.title).slice(0,300),url:safeURL(typeof link==='object'?link['@_href']:text(link),base),publishedAt:articleDate(item.pubDate||item.published||item['dc:date']),updatedAt:articleDate(item.updated||item['dcterms:modified']),content:plain(item['content:encoded']||item.content||item.description||item.summary).slice(0,18000)};}).filter(item=>item.title&&item.url);}
export function parsePage(raw,url){let data=[];for(const match of raw.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const flatten=value=>{for(const entry of arr(value)){if(entry&&typeof entry==='object'){data.push(entry);if(entry['@graph'])flatten(entry['@graph']);if(entry.mainEntity)flatten(entry.mainEntity);}}};flatten(JSON.parse(match[1]));}catch{}}
 const meta=name=>{for(const match of raw.matchAll(/<meta\b[^>]*>/gi)){const attrs=Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1].toLowerCase(),a[2]]));if(attrs.property===name||attrs.name===name)return attrs.content;}return '';};
 const article=data.find(v=>arr(v['@type']).some(t=>['Article','BlogPosting','NewsArticle','TechArticle'].includes(t)))||{};
 const wechat=new URL(url).hostname==='mp.weixin.qq.com',visibleTitle=wechat?raw.match(/<h[12]\b[^>]*id=["']activity-name["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]:'';
 const title=plain(article.headline||meta('og:title')||visibleTitle||raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).slice(0,300);
 const fieldDate=raw.match(/(?:["'](?:ct|createTime|create_time|publish_time|publishTime)["']|\b(?:ct|createTime|create_time|publish_time|publishTime))\s*[:=]\s*(["'])([^"']+)\1/)?.[2]||raw.match(/(?:["'](?:ct|create_time)["']|\b(?:ct|create_time))\s*[:=]\s*(\d{10,13})\b/)?.[1],visibleDate=wechat?raw.match(/<[^>]+id=["']publish_time["'][^>]*>([^<]+)</i)?.[1]:'';
 const publishedAt=articleDate(article.datePublished||meta('article:published_time')||meta('publish_time')||fieldDate||visibleDate);
 const updatedAt=articleDate(article.dateModified||meta('article:modified_time'));
 const main=raw.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||raw.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||raw;
 const selected=wechat&&/id=["']js_content["']/.test(raw)?convert(raw,{wordwrap:false,baseElements:{selectors:['#js_content'],returnDomByDefault:false},selectors:[{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}]}):'';
 const content=plain(selected||main.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')).slice(0,18000);
 return {title,url,publishedAt,updatedAt,content};
}
export function parseWechatAccount(raw,url){
 if(new URL(url).hostname!=='mp.weixin.qq.com')throw Error('请粘贴 mp.weixin.qq.com 的公众号文章链接');
 const field=name=>{const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return raw.match(new RegExp('(?:["\']'+safe+'["\']|\\b'+safe+')\\s*[:=]\\s*(["\'])([\\s\\S]*?)\\1'))?.[2]||'';};
 const meta=name=>{for(const m of raw.matchAll(/<meta\b[^>]*>/gi)){const a=Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(v=>[v[1].toLowerCase(),v[2]]));if(a.property===name||a.name===name)return a.content||'';}return '';};
 const name=plain(raw.match(/<[^>]+id=["']js_name["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]||field('nickname')).slice(0,100);
 const identifier=plain(field('user_name')||meta('twitter:creator')||meta('author')).slice(0,100);
 if(!name){const e=Error('未能从文章页面核实公众号名称；微信可能要求验证或文章已失效。识别未完成，不会猜测账号。');e.code='ACCOUNT_UNRESOLVED';throw e;}
 return {name,identifier,url,verifiedAt:new Date().toISOString()};
}
export async function resolveWechatSource(url,{fetcher=fetch}={}){if(new URL(publicReferenceURL(url)).hostname!=='mp.weixin.qq.com')throw Error('请粘贴 mp.weixin.qq.com 的公众号文章链接');let resource;try{resource=await fetchPublicResource(url,fetcher);}catch(e){throw Error('暂时无法读取微信文章，请稍后重试或确认原文可公开打开。原因：'+e.message);}return {account:parseWechatAccount(resource.body,resource.url),article:parsePage(resource.body,resource.url),trackingState:'unavailable',message:'已识别公众号；当前尚未接入可获取账号近期文章的采集服务，账号更新不可用。无需目标公众号管理员扫码或授权。'};}
export async function collectSource(source,{fetcher=fetch}={}){if(source.type==='wechat'&&!source.feedURL){if(!source.url)throw Error('请粘贴公众号文章链接；尚未接入账号采集服务（RSS），不会按名称猜测文章');const resolved=await resolveWechatSource(source.url,{fetcher}),e=Error(resolved.message);e.code='ACCOUNT_HISTORY_UNAVAILABLE';e.account=resolved.account;throw e;}const entry=source.feedURL||source.url;if(!entry)throw Error(source.type==='wechat'?'公众号需提供可读取的 RSS 订阅地址或文章链接；名称本身无法拉取历史文章':'请填写来源网址');const resource=await fetchPublicResource(entry,fetcher),feed=parseFeed(resource.body,resource.url);if(feed)return {items:feed,method:'RSS / Atom'};
 const feeds=[...resource.body.matchAll(/<link\b[^>]*>/gi)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1].toLowerCase(),a[2]]))).filter(a=>/alternate/.test(a.rel||'')&&/rss|atom/.test(a.type||''));
 if(feeds.length){const linked=await fetchPublicResource(safeURL(feeds[0].href,resource.url),fetcher),entries=parseFeed(linked.body,linked.url);if(entries)return {items:entries,method:'自动发现订阅源'};}
 if(source.type==='wechat')throw Error('订阅地址未返回有效 RSS / Atom，无法据此更新公众号近期文章');
 const first=parsePage(resource.body,resource.url),wechatPage=new URL(resource.url).hostname==='mp.weixin.qq.com';
 if(wechatPage&&!/id=["']js_content["']/.test(resource.body)&&/环境异常|访问过于频繁|完成验证|访问异常|请在微信|该内容已被发布者删除|此内容因违规无法查看|链接已过期|内容已被删除/.test(first.content||resource.body))throw Error('微信未返回文章正文，页面要求验证、链接失效或文章已删除。请先在微信确认原文可打开；订阅整个账号需配置RSS来源。');
 if((first.publishedAt||first.updatedAt)&&first.content.trim().length>=15)return {items:[first],method:wechatPage?'公众号单篇文章':'公开文章',coverage:wechatPage?'single_article':'article'};
 if(first.publishedAt||first.updatedAt)throw Error('已识别文章日期，但未取得有效正文，不能作为已读取的内容');
 if(source.type==='wechat')throw Error('公众号页面没有可核实的发布日期，或需要登录验证；请配置该账号的 RSS 地址');
 const urls=[...new Set([...resource.body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:safeURL(m[1],resource.url),title:plain(m[2])})).filter(a=>a.title.length>=5&&a.url&&new URL(a.url).origin===new URL(resource.url).origin&&a.url!==resource.url&&!/\/(?:login|signin|signup|register|privacy|terms|contact|careers)(?:\/|$)/i.test(new URL(a.url).pathname)).sort((a,b)=>(/blog|article|news|post/i.test(b.url)?20:0)+b.title.length/20-((/blog|article|news|post/i.test(a.url)?20:0)+a.title.length/20)).map(a=>a.url))].slice(0,8);
 const outcomes=await Promise.allSettled(urls.map(async link=>{const page=await fetchPublicResource(link,fetcher);return parsePage(page.body,page.url);}));return {items:outcomes.filter(v=>v.status==='fulfilled').map(v=>v.value),method:'网站文章链接（单次最多8篇）'};
}
export function matchInsights(q,items,days=14,stamp=Date.now()){if(![7,14].includes(Number(days)))throw Error('请选择近7天或14天');const query=String(q||'').trim().toLowerCase(),terms=[...new Set(tokens(expand(query)))],cutoff=stamp-Number(days)*86400000;return items.flatMap(item=>{const updated=articleDate(item.updatedAt),published=articleDate(item.publishedAt),date=updated&&(!published||updated>published)?updated:published;if(!date||Date.parse(date)<cutoff||Date.parse(date)>stamp+300000)return [];const haystack=(item.title+' '+item.content).toLowerCase(),matched=terms.filter(term=>haystack.includes(term)),direct=!!query&&haystack.includes(query);if(query&&!direct&&!matched.length)return [];return [{...item,date,matchKind:direct?'直接命中':'相近主题',matched:matched.slice(0,8),score:(direct?20:0)+matched.reduce((n,t)=>n+(item.title.toLowerCase().includes(t)?3:1),0),excerpt:item.content.slice(0,220)}];}).sort((a,b)=>b.score-a.score||b.date.localeCompare(a.date));}
export function insightSummary(q,items){
 const sources=new Set(items.map(a=>a.sourceId)),groups=[
  {id:'conditions',name:'资格与适用范围',pattern:/适用|资格|条件|限制|仅限/,angle:'适用条件、限制与常见误区'},
  {id:'cost',name:'费用与成本',pattern:/费用|费率|成本|手续费|定价/,angle:'费用口径与成本核对清单'},
  {id:'process',name:'操作与流程',pattern:/步骤|操作|教程|绑定|申请|设置/,angle:'从准备到操作的步骤指南'},
  {id:'markets',name:'地区与市场',pattern:/拉美|巴西|墨西哥|国家|地区|市场/,angle:'不同地区的条件与选择方法'},
  {id:'platforms',name:'平台与场景',pattern:/平台|Amazon|Shopee|eBay|TikTok|场景/i,angle:'不同平台与业务场景的选择'},
  {id:'tools',name:'工具与方法',pattern:/模板|工具|清单|计算|方法/,angle:'可执行的核对清单与实用方法'}
 ].map(group=>({...group,articles:items.filter(a=>group.pattern.test(a.title+' '+a.content))})).filter(group=>group.articles.length).sort((a,b)=>b.articles.length-a.articles.length);
 const topics=groups.slice(0,6).map(group=>({id:'topic:'+group.id,title:(q||'近期行业内容')+'：'+group.angle,angle:'从「'+group.name+'」切入，补充可核实的自身经验与公开依据',reason:'已读取的近期相关内容中有 '+group.articles.length+' 篇涉及该主题；这是编辑选题建议，不代表搜索量或流量预测',articleIds:group.articles.slice(0,3).map(a=>a.id),sourceTitle:group.articles[0].title}));
 if(!topics.length&&items.length)topics.push({id:'topic:overview',title:(q||'近期行业内容')+'：核心问题与实用解答',angle:'明确读者问题、核实事实并补充适用条件',reason:'基于当前来源中的近期内容形成编辑建议',articleIds:items.slice(0,3).map(a=>a.id),sourceTitle:items[0].title});
 const observations=items.length?['已配置来源中有 '+items.length+' 篇近期相关内容，覆盖 '+sources.size+' 个来源。',...groups.slice(0,3).map(group=>'「'+group.name+'」在 '+group.articles.length+' 篇已读取内容中被提及。')]:[];
 const gaps=[];if(items.length){for(const [pattern,label] of [[/步骤|操作|教程/,'可核实的操作步骤'],[/适用|资格|仅限|限制/,'具体适用条件与限制'],[/比较|对比|区别/,'不同选择的比较依据']])if(!items.some(a=>pattern.test(a.title+' '+a.content)))gaps.push('在本次已读取文本中未见明确的'+label+'，可将其作为补充方向；这不代表全网缺少相关内容。');if(!gaps.length)gaps.push('近期内容已涉及多种问题，建议进一步核对是否缺少地区边界、数据期间或可用工具，再确定补充角度。');}
 return {topics,observations,gaps,angles:groups.slice(0,3).map(group=>'围绕「'+group.name+'」补充适用边界、实施步骤或公开可查的案例，避免复述原文。'),method:'已配置来源内的关键词、别名与主题词匹配；洞察基于已读取文本，建议为编辑启发，不提供全网热度或搜索量。'};
}
