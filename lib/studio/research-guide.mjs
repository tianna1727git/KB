export const researchDescription = '围绕输入关键词，结合百度长尾词挖掘、百度流量词、百度自然搜索结果，以及已接入网站、RSS和微信公众号近期内容，分析关键词簇、官网内链机会和最多5个新选题。接口未提供月均搜索量时明确标注缺失。';

export const researchInputs = '当前输入的关键词、目标读者和时间范围；百度长尾词挖掘、百度流量词和百度PC前50名返回的数据；已配置网站、RSS和微信公众号来源中可读取的近期文章；并单独提供标记为PMI官网的既有页面以评估内链。';
export const researchOutputs = '关键词需求摘要与关键词簇、百度自然结果观察、近期内容趋势、官网内链建议、待新增内容及最多5个选题方向。每项注明来源证据；未取得的指标明确标为未提供。';

export const researchRules = [
  ['先查关键词需求', '分别查询百度长尾词挖掘和百度流量词，获取种子词数据，各取第一页；百度长尾词挖掘用于扩展候选长尾词，百度流量词补充百度指数、PC/移动预估流量、竞价词数、SEM价格和难度。按关键词去重并保留接口来源和原始单位，不把不同字段相加。'],
  ['分析百度自然结果', '使用百度PC前50名查询种子词和最多3个优先长尾词（一次研究总计最多4个SERP查询）。根据RankStr、Title、Url、Description判断结果类型、常见意图和覆盖空缺；只拿到摘要时称为搜索结果摘要分析，不声称阅读全文。SiteCount是收录量，不是搜索量。'],
  ['整理关键词簇', '依据长尾词、词义、搜索意图和SERP结果形成主题一致的关键词簇。每簇给出核心词、相关词、各接口的可用指标及推荐理由；词面相似但意图不同的词分开。没有月均搜索量字段时，不得声称搜索量高或低。'],
  ['分别处理微信与网页信源', '微信文章只来自已配置公众号ID和we-mp-rss实际成功返回的文章，不区分订阅号/服务号；网站/RSS文章只来自启用来源，优先用RSS/Atom，其次读取配置站点并限于同域公开文章。按所选时间范围采用日期可核实的内容；失败来源、无日期文章、摘要与全文需区分，不能猜测或冒充已采集。'],
  ['识别官网内链与新增内容', '只把明确标记为PMI官网内容的页面用于内链建议。推荐内链必须来自输入的官网页面ID，并保留其标题和URL；没有匹配页面时说明未发现可核验内链，再提出新增页面主题。第三方网站和公众号用于观察受众问题与写作角度，不得误认为官网内容或自动当成正式引用。'],
  ['依据证据形成选题', '结合关键词簇、SERP覆盖、近期微信/网页主题、真实提供的阅读或流量数据、官网页面和读者问题排序。每个方向写清读者问题、主关键词、角度、来源依据、内链页面ID或新增内容建议。证据只能使用输入中提供的文章ID、baidu.keyword、baidu.serp；无这些证据时可引用keyword.input，但必须标为未验证假设。'],
  ['区分事实、估算与缺口', '百度指数、PC/移动预估流量、竞价数据、SERP排名、阅读量和真实网页流量分别标注，不换算成月均搜索量。接口未提供、网页未返回或微信来源无阅读指标时标记“未提供”，不推测、不填零。'],
  ['尊重用户受众设定', '目标读者未指定时，不得自行假设其职业、行业或跨境卖家身份；只能依据关键词和信源推断内容问题，并将推断标为假设。目标读者已指定时，结论须与该设定一致。'],
  ['只推荐有依据的方向', '按需求信号、搜索结果内容缺口、近期来源表现、官网承接能力和目标读者匹配度综合排序，最多推荐5项；不把不同单位合成为伪精确分数。证据不足时减少方向并说明原因，不为凑数编造。'],
  ['保留来源与适用范围', '文章判断须保留来源名称、原始URL和发布日期；保留数据名称和查询日期。报告中不展示接口代号、服务商或调用实现细节。结论只适用于实际配置和读取的来源、地区、时间、条件及样本，不推广为全网热度。'],
];

export const researchRuleText = researchRules.map(([title, detail]) => `**${title}：**${detail}`).join('\n\n');

export function researchResultSchema() {
  return '{observations:string[], gaps:string[], angles:string[], keywordClusters:[{name:string, coreKeyword:string, relatedKeywords:string[], reason:string, evidence:string[]（只能填baidu.keyword）}], topics:[{title:string, readerProblem:string, angle:string, reason:string, recommendedKeyword:string, evidence:string[]（只能填文章id、baidu.keyword、baidu.serp或keyword.input）, demand:string, internalLinkArticleIds:string[]（只能填ownedWebsitePages中的ID）, newContentNeeded:string}], limitations:string[]}';
}

export function buildResearchPrompt({keyword, audience = '', days, demand, articles, ownedPages = [], knowledge = []}) {
  return {
    keyword,
    targetAudience: audience,
    timeRangeDays: days,
    baiduKeywordDemand: demand || {state: 'unavailable', note: '未取得百度数据'},
    recentSourceArticles: articles,
    ownedWebsitePages: ownedPages,
    evidenceIds: [...articles.map(article => article.id).filter(Boolean), ...(demand?.keywords?.length ? ['baidu.keyword'] : []), ...(demand?.serp?.results?.length ? ['baidu.serp'] : []), 'keyword.input'],
    internalLinkPageIds: ownedPages.map(article => article.id).filter(Boolean),
    availableKnowledge: knowledge,
    constraints: researchRules.map(([title, detail]) => `${title}：${detail}`),
    output: researchResultSchema(),
  };
}
