export const OUTLINE_FORMAT = '返回JSON对象，示例：{"title":"文章标题","outline":"## 小节标题\\n- 写作要点[M1]","missing":[]}。outline必须是非空Markdown字符串，不是数组或对象；missing为信息缺口字符串数组，没有缺口时为[]。依据materials组织大纲，保留条件与时效；[M1]为内部溯源，[S1]仅用于已有公开证据，没有公开引用也继续组织大纲。';

// Normalize representation only; source/citation validation still runs afterwards.
export function normalizeOutline(value, fallbackTitle = '') {
  const invalid = reason => { throw Error('大纲生成结果不完整：' + reason + '，请重试生成'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('需要JSON对象');
  const render = (node, depth = 2) => {
    if (depth > 6) invalid('标题层级过深');
    if (typeof node === 'string') return node.trim();
    if (Array.isArray(node)) return node.map(x => render(x, depth)).join('\n\n');
    if (!node || typeof node !== 'object') invalid('大纲内容类型不支持');
    const allowed = ['heading', 'title', 'content', 'body', 'points', 'sections'];
    if (Object.keys(node).some(k => !allowed.includes(k))) invalid('大纲包含无法识别的字段');
    const parts = [];
    for (const key of ['heading', 'title', 'content', 'body']) {
      if (node[key] === undefined) continue;
      if (typeof node[key] !== 'string') invalid('段落或标题必须为文字');
      parts.push((key === 'heading' || key === 'title' ? '#'.repeat(depth) + ' ' : '') + node[key].trim());
    }
    if (node.points !== undefined) {
      if (!Array.isArray(node.points) || node.points.some(x => typeof x !== 'string')) invalid('写作要点必须为文字列表');
      parts.push(node.points.map(x => '- ' + x.trim()).join('\n'));
    }
    if (node.sections !== undefined) {
      if (!Array.isArray(node.sections)) invalid('章节必须为列表');
      parts.push(render(node.sections, depth + 1));
    }
    return parts.join('\n\n').trim();
  };
  const outline = render(value.outline);
  if (!outline) invalid('缺少大纲内容');
  if (outline.length > 10000) invalid('大纲超过长度上限');
  const title = value.title == null || value.title === '' ? fallbackTitle : value.title;
  if (typeof title !== 'string' || !title.trim()) invalid('缺少文章标题');
  let missing = value.missing ?? [];
  if (typeof missing === 'string') missing = missing.trim() ? [missing.trim()] : [];
  if (!Array.isArray(missing) || missing.some(x => typeof x !== 'string')) invalid('信息缺口必须为文字列表');
  return {title: title.trim().slice(0, 200), outline, missing: missing.slice(0, 30)};
}
