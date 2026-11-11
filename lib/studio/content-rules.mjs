// These rules were distilled from source reading during development; generation never fetches learning articles.
export const CONTENT_PLATFORMS=['官网'];
const reviewedAt='2026-11-11';
export const SEO_RULES={version:'website-seo-v4',platform:'官网',reviewedAt,sources:[
 {title:'12 SEO writing tips to earn visibility [2026]',url:'https://www.semrush.com/blog/seo-writing/',publishedAt:'2026-06-10',verification:'reviewed'},
 {title:'Keyword Density: What Is It & Does It Impact SEO?',url:'https://www.semrush.com/blog/keyword-density/',publishedAt:'2024-09-12',verification:'reviewed'},
 {title:'What Is a Title Tag? How to Optimize Your SEO Titles',url:'https://www.semrush.com/blog/title-tag/',publishedAt:'2026-02-24',verification:'reviewed'},
 {title:'What Is a Meta Description? (+ Examples & Tips)',url:'https://www.semrush.com/blog/meta-description/',publishedAt:'2025-05-15',verification:'reviewed'},
 {title:'What Is a Call to Action & How to Write a CTA That Converts',url:'https://www.semrush.com/blog/what-is-a-call-to-action/',publishedAt:'2024-05-27',verification:'reviewed'}
 ],rules:[
 '写作前明确一个主关键词、目标读者、搜索意图及选题价值。按解释、操作、比较或选择等意图决定内容格式。只有提供真实SERP或关键词工具数据时才讨论搜索量、难度、排名；否则把意图标为编辑判断，不假称做过实时SERP分析。',
 '围绕一个主关键词选取相关子问题、同义表达和长尾词。自然覆盖读者需要的概念，不追求关键词数量，不机械重复相同词组；不编造关键词搜索量或流量预测。',
 '先组织大纲：一个H1，H2回答核心子问题，H3支持对应H2。每节写明要解决的问题及可用素材，顺序从直接回答到条件、方法与下一步。不为凑字数增加章节，不要求所有文章都用同一框架。',
 'SEO标题准确概括内容、体现读者收益，主关键词自然出现一次并尽量靠前；避免夸张承诺与堆词。Title与H1表达同一主题，可以不同措辞；同一站点各篇标题与描述应有区分，不照搬竞争文章标题。',
 'Title展示长度可参考约550像素、50–60个拉丁字符，但不是搜索引擎硬上限，也不等于中文字符配额。中文以信息完整、简洁可读及实际搜索展示为准，不为凑长度截断意思。',
 'Meta Description用1–2句简洁概括文章回答的问题与价值，自然包含主关键词或近义表达，可采用明确行动动词；每篇独立撰写，不写正文未支持的利益或价格。不同设备、字宽及查询会影响展示，搜索引擎可能重写摘要；不设统一中文字符限额，不保证原文完整展示。',
 'TDK中的关键词列表用于编辑策划；不把meta keywords标签当成排名保证。slug简短、描述清楚，以连字符分隔单词；避免无必要的年份、日期和重复词，除非选题本身需要时间标识。',
 '主关键词自然布局在Title、H1、开篇、相关小标题、正文与描述中；辅助词对应具体子问题。关键词密度没有统一理想值，也不是单独的排名因子；出现次数与分词占比仅用于发现遗漏或过度重复，不设固定达标百分比，不强制每段或每个标题出现关键词。',
 '开篇尽快回答核心问题，避免空泛铺垫。正文采用短句、短段落、具体小标题；步骤用有序列表，并列条件用列表，真实的多方案比较可用表格。图表、示例和数据只在有来源或已授权素材时使用，不虚构图片、专家引语、原创实验或第一手经历。',
 '提供原创的组织、解释或有证据的经验，保留适用国家、账户条件、统计期间与限制；不要只改写近期相关文章。内容可依据materials中的写作素材；不要求每份素材都有公开引用。素材用[M1]标记供内部溯源；有合适的evidence公开来源时才使用[S1]。内部素材不可进入文章参考资料，不因缺少公开引用停止生产或删除素材。',
 '内链帮助读者继续完成相关问题，外链支撑引用；锚文本具体描述目标内容，不用含糊的“点击这里”，不为SEO堆放链接。只使用已核实的来源网址与允许的CTA网址，不自行补造站内路径、资源下载链接或其他页面。',
 'CTA应与读者当前问题、阅读进度及目标资源相关，采用明确行动词，说明点击后能得到什么；适合在相关章节完成后或文章结尾出现。不得虚构免费、稀缺、限时优惠、报名资格或收益承诺。',
 '本工作台CTA资源范围固定为Whitepaper、Events、Templates & Tools，最多两个；仅选择ctaCandidates中与主题相关的资源，无合适资源则不添加。Events必须有可核实且未到期的截止/结束时间，时效未知或已结束不得使用。此分类和数量约束来自本工作台业务要求。',
 '正文不手写CTA链接；返回ctaIds及可选ctaPlacements，每个位置的afterHeading必须逐字等于已有H2/H3标题，不包含#；空字符串表示结尾。系统核对来源、链接和时效后插入。资源只在说明用途所需的范围内展示，不把内部资料文件名写成文章参考来源。',
 'FAQ仅回答正文尚未清楚解决的真实补充问题，不机械添加，不重复正文。不要承诺FAQ、关键词或特定格式必然带来排名、富结果、收录或AI引用。',
 '发布前依次复核搜索意图与主题、标题层级、表达与重复、事实和公开引用、TDK与slug、链接与活动CTA时效。保留最终人工审核，不自动发布到官网CMS。输出排版文稿、HTML和Markdown；参考资料由系统按实际使用的公开来源统一生成。'
 ],template:'写作Brief：主关键词｜辅助词｜目标读者｜搜索意图（证据或编辑判断）｜选题价值\n发布字段：SEO Title｜Meta Description｜建议slug｜编辑用关键词列表\nH1：准确回应主题与读者问题\n开篇：直接回答 + 适用范围 + 阅读价值\nH2/H3：按搜索意图选择解释型、步骤型、比较型或选择指南结构；按实际来源使用素材溯源[M1]或公开引用[S1]\n关键条件/限制/误区：与对应结论或步骤同段呈现\n可选FAQ：只补充尚未解答的真实问题\n相关章节结束处/结尾：有合适且有效的资源时插入CTA\n参考资料：仅实际引用的公开来源\n交付：排版文稿｜HTML｜Markdown',
 outputContract:{title:'文章标题/H1',seoTitle:'独立SEO标题',metaDescription:'1–2句真实摘要',slug:'简洁URL路径建议',secondaryKeywords:'相关辅助词数组',markdown:'只有公开事实依据的正文，使用[S1]；不自写参考资料列表或CTA链接',ctaIds:'允许资源ID数组，最多2个',ctaPlacements:'可选位置数组：{id,afterHeading}；不提供则放结尾',missing:'已排除内容与其他信息缺口数组'}};
export const PLATFORM_RULES={'官网':SEO_RULES};
export function writingContext(task){const rules=PLATFORM_RULES[task.platform]||SEO_RULES;return {platform:task.platform,platformRules:{version:rules.version,platform:rules.platform,rules:rules.rules,template:rules.template,outputContract:rules.outputContract},mainKeyword:task.keyword,secondaryKeywords:task.secondaryKeywords||[],selectedTopic:task.topic||task.keyword,ctaCandidates:task.ctaCandidates||[],insightContext:task.insightContext||[]};}
export function seoAudit(task,markdown){
 const keyword=String(task.keyword||'').trim(),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),plain=String(markdown||'').replace(/^#{1,6}\s+/gm,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\[[SM]\d+\]/g,''),count=value=>keyword?(String(value).match(new RegExp(escape(keyword),'gi'))||[]).length:0;
 let wordCount=0,wordMethod='词语分词';try{wordCount=[...new Intl.Segmenter('zh',{granularity:'word'}).segment(plain)].filter(part=>part.isWordLike).length;}catch{wordCount=(plain.match(/[A-Za-z0-9]+|[\u3400-\u9fff]/g)||[]).length;wordMethod='中文字符/拉丁词回退计数';}
 const h1s=[...String(markdown).matchAll(/^#\s+(.+)$/gm)].map(m=>m[1]),title=String(task.seoTitle||task.title||''),description=String(task.metaDescription||''),warnings=[];
 if(h1s.length!==1)warnings.push('正文应有且只有一个H1');if(!count(title))warnings.push('SEO标题未出现主关键词，请核对是否采用了合适近义表达');if(count(title)>1)warnings.push('SEO标题重复主关键词，请检查是否堆砌');if(!description.trim())warnings.push('尚未填写Meta Description');if(!count(plain.slice(0,200)))warnings.push('开篇未出现主关键词，请核对是否自然回答了核心问题');
 return {keyword,occurrences:count(plain),wordCount,wordMethod,density:wordCount?Number((count(plain)/wordCount*100).toFixed(2)):0,h1Count:h1s.length,hasTitleKeyword:!!count(title),hasDescriptionKeyword:!!count(description),hasH1Keyword:h1s.some(h=>count(h)>0),titleLength:[...title].length,descriptionLength:[...description].length,warnings,note:'分词占比＝主关键词出现次数÷分词词语数×100%；中文采用词语分词，只作重复检查，不设置理想密度或统一中文标题/描述长度。'};
}
