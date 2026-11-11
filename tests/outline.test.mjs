import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOutline} from '../lib/studio/outline.mjs';
import {citationCheck} from '../lib/studio/knowledge.mjs';

test('valid Markdown survives absent optional fields without inventing content', () => {
  assert.deepEqual(normalizeOutline({outline:'## 条件\n原文[M1]'}, '收款'), {title:'收款',outline:'## 条件\n原文[M1]',missing:[]});
});
test('structured sections retain every point, qualification and source marker', () => {
  const r=normalizeOutline({title:'收款',outline:[{heading:'地区限制',points:['仅适用于原文地区[M1]'],sections:[{title:'时间',content:'截至2025年[S1]'}]}],missing:'待核对时效'});
  assert.match(r.outline,/## 地区限制/);assert.match(r.outline,/- 仅适用于原文地区\[M1\]/);assert.match(r.outline,/### 时间/);assert.match(r.outline,/截至2025年\[S1\]/);assert.deepEqual(r.missing,['待核对时效']);
  assert.throws(()=>citationCheck(r.outline,[],[{materialRef:'M1'}]));
});
test('empty, oversized and unknown structures fail instead of silently dropping content', () => {
  for(const outline of ['',[],{},null,42,{heading:'标题',unsupported:'条件'},'x'.repeat(10001)]) assert.throws(()=>normalizeOutline({outline},'收款'),/大纲生成结果不完整/);
  assert.throws(()=>normalizeOutline({outline:'有效',missing:[{}]},'收款'));
});
