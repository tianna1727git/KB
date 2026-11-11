export const TITLE_FORMAT = '仅返回JSON：{"titles":[{"title":"标题","angle":"一句话说明写作角度","materialRefs":["M1"]}]}。恰好3个不同标题；每个标题必须由materials中的内容支撑，materialRefs只能选实际素材编号；标题自然包含关键词，保留必要适用范围，不编造数字或承诺。不生成大纲。避开previousTitles，给出不同角度。';
export function titleOptions(value, materials, previous = []) {
 const rows=value?.titles;
 if(!Array.isArray(rows)||rows.length!==3)throw Error('请重试：标题推荐需要返回3个选项');
 const refs=new Set(materials.map(m=>m.materialRef));const seen=new Set(previous.map(x=>x.title.trim()));
 return rows.map((r,i)=>{
  if(!r||typeof r.title!=='string'||!r.title.trim()||r.title.length>200||typeof r.angle!=='string'||r.angle.length>500||!Array.isArray(r.materialRefs)||!r.materialRefs.length||r.materialRefs.some(v=>!refs.has(v)))throw Error('标题推荐缺少有效素材依据，请重试');
  const title=r.title.trim();if(seen.has(title))throw Error('标题重复，请换一组');seen.add(title);
  return {id:crypto.randomUUID(),title,angle:r.angle.trim(),materialRefs:[...new Set(r.materialRefs)]};
 });
}
