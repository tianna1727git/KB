import {categoryPolicyKey} from './organization-policy.mjs';
import * as store from './agent-rule-store.mjs';
import {CATEGORY_POLICIES} from './organization-policy.mjs';

export const defaultRules = {
  semanticUnit: '每片应独立说明一个主张、一组完整操作或一条带条件的数据。跨段跨页保留前提、步骤、单位、表头和脚注，逐处记录原文位置。页码缺失时保留标题与原文偏移，不推测页码。',
  audit: '操作步骤核对指南，费率与准入核对对应市场现行官方条款，行业数字核对原始报告。先比较产品、主体、市场、版本及有效期。仅在范围重叠且结论不一致时关联冲突；适用条件不明或解析模糊时记录位置和待复核原因。',
  categories: Object.fromEntries(Object.entries(CATEGORY_POLICIES).map(([name, policy]) => [name, policy.rule]))
};

export function validateRules(rules) {
  const text = value => typeof value === 'string' && value.trim() && value.length <= 2400;
  if (!rules || !text(rules.semanticUnit) || !text(rules.audit) ||
      !rules.categories || typeof rules.categories !== 'object' || Array.isArray(rules.categories) ||
      Object.keys(rules.categories).length > 64 ||
      Object.keys(defaultRules.categories).some(name => !Object.hasOwn(rules.categories, name)) ||
      Object.entries(rules.categories).some(([name, rule]) => !name.trim() || name.length > 200 || !text(rule))) {
    throw Error('请填写语义切片规则、复核规则和每个资料分类的规则。');
  }
  return {semanticUnit: rules.semanticUnit, audit: rules.audit, categories: rules.categories};
}

const policy={prefix:'ingestion-rules:',kind:'ingestionRules',defaults:defaultRules,validate:validateRules};
export const rulesAPI=(req,env,ctx)=>store.rulesAPI(req,env,ctx,policy);
export const readRules=(db,owner)=>store.readRules(db,owner,policy);

export async function applyRules(context, db, owner) {
  const {revision,rules} = await readRules(db, owner);
  const category = Object.hasOwn(rules.categories,context.libraryCategory)?context.libraryCategory:categoryPolicyKey(context.libraryCategory);
  return {...context, ruleVersion: '2026-11-23.'+revision, semanticUnit: rules.semanticUnit, auditRule: rules.audit,
    categoryNeedsReview: !Object.hasOwn(rules.categories,category),
    policy: {...context.policy, rule: Object.hasOwn(rules.categories,category) ? rules.categories[category] : '分类没有已配置的规则，标记为待用户确认。'}};
}
