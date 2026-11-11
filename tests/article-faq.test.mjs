import {test} from 'node:test';
import assert from 'node:assert/strict';
import {faqCandidates,appendFAQ,validateFAQ} from '../lib/studio/article-faq.mjs';
const docs=[{id:'faq',libraryCategory:'FAQ',state:'ready',revision:1},{id:'other',libraryCategory:'Product Guide',state:'ready',revision:1}];
const chunks=['faq','other'].map(docId=>({id:docId,docId,docRevision:1,state:'approved',purpose:'fact',title:'注册需要什么材料？',body:'注册需要什么材料？\n\n请提供有效的身份证明文件。中国大陆个人客户需提供身份证正反面。',materialRef:'M1'}));
test('FAQ only uses available FAQ category slices and keyword matches',()=>{assert.equal(faqCandidates('注册',chunks,docs).length,1);assert.equal(faqCandidates('咖啡',chunks,docs).length,0);assert.equal(faqCandidates('注册',chunks,docs.map(d=>({...d,libraryCategory:'其他'}))).length,0);});
test('server appends grounded FAQ after CTA, strips invented FAQ and protects source text',()=>{const entries=faqCandidates('注册',chunks,docs);assert.equal(entries.length,1);const markdown=appendFAQ('# 标题\n\n## FAQ\n虚构答案\n\n## 下一步\nCTA',entries);assert.ok(!markdown.includes('虚构'));assert.ok(markdown.indexOf('CTA')<markdown.indexOf('常见问题'));validateFAQ({faqPolicyVersion:1,faqEntries:entries},markdown);assert.throws(()=>validateFAQ({faqPolicyVersion:1,faqEntries:entries},markdown.replace('有效','无效')));assert.equal(appendFAQ('# 标题\n\n## FAQ\n虚构',[]),'# 标题');});
