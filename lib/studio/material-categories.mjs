import {LIBRARY_CATEGORIES} from './library-categories.mjs';
// Stable option values identify records; labels and parents may change independently.
const fieldId=uid=>'field:MaterialCategories:'+uid;
export const DEFAULT_MATERIAL_CATEGORIES={name:'资料分类',key:'MaterialCategories',type:'cascade',levels:3,nodes:LIBRARY_CATEGORIES.map(value=>({value,label:value,parent:null}))};
export function validateMaterialCategories(input){
 if(!input||input.key!=='MaterialCategories'||input.name!=='资料分类'||input.type!=='cascade')throw Error('字段名称、字段名和字段类型不可更改');
 if(!Number.isInteger(input.levels)||input.levels<1||input.levels>6)throw Error('级联层数须为 1–6 级');
 if(!Array.isArray(input.nodes)||!input.nodes.length||input.nodes.length>300)throw Error('请配置 1–300 个选项');
 const nodes=input.nodes.map(n=>{if(!n||typeof n.value!=='string'||!n.value.trim()||n.value!==n.value.trim()||n.value.length>160||['all','uncategorized','未分类','__proto__','constructor','prototype'].includes(n.value)||typeof n.label!=='string'||!n.label.trim()||n.label.trim().length>80||n.parent!==null&&typeof n.parent!=='string')throw Error('选项须有显示名称、唯一选项值及有效父级');return {value:n.value,label:n.label.trim(),parent:n.parent};});
 const values=new Map(nodes.map(n=>[n.value,n]));if(values.size!==nodes.length)throw Error('选项值必须全局唯一');
 for(const node of nodes){let current=node,seen=new Set(),depth=0;while(current){if(seen.has(current.value))throw Error('选项不能循环引用');seen.add(current.value);if(++depth>input.levels)throw Error('存在超出级联层数的选项，请先移除超出层级的选项并处理迁移');if(current.parent!==null&&!values.has(current.parent))throw Error('父级选项不存在');current=values.get(current.parent);}}
 return {name:'资料分类',key:'MaterialCategories',type:'cascade',levels:input.levels,nodes};
}
const indexes=new WeakMap();
function categoryIndex(config){let index=indexes.get(config);if(!index){index=new Map(config.nodes.map(n=>[n.value,n]));indexes.set(config,index);}return index;}
export function categoryPath(config,value){const byValue=categoryIndex(config),path=[],seen=new Set();let node=byValue.get(value);while(node&&!seen.has(node.value)){path.unshift(node);seen.add(node.value);node=byValue.get(node.parent);}return path;}
export function categoryLabel(config,value){return categoryPath(config,value).map(n=>n.label).join(' / ')||value||'未分类';}
export function categoryMatches(config,value,selected){return value===selected||categoryPath(config,value).some(n=>n.value===selected);}
export function categoryOptions(config){const result=[];function walk(parent){for(const node of config.nodes.filter(n=>n.parent===parent)){result.push({...node,path:categoryLabel(config,node.value)});walk(node.value);}}walk(null);return result;}
export async function readMaterialCategories(env,uid){if(!uid)throw Error('Missing field configuration owner');const row=await env.DB.prepare("SELECT payload,revision FROM studio_records WHERE id=? AND owner=? AND kind='fieldSettings'").bind(fieldId(uid),uid).first();return row?{...JSON.parse(row.payload),revision:row.revision}:{...DEFAULT_MATERIAL_CATEGORIES,revision:0};}
export async function validMaterialCategory(env,value,uid){const config=await readMaterialCategories(env,uid);return typeof value==='string'&&config.nodes.some(n=>n.value===value);}
const kinds="kind IN ('library','document','libraryMetadata','chunk')";
const valueExpr="json_extract(payload,'$.libraryCategory')";
export async function materialCategoriesAPI(req,env,{uid,fail,json}){
 const usage=async()=>{const rows=await env.DB.prepare(`SELECT ${valueExpr} AS value,count(*) AS count FROM studio_records WHERE owner=? AND ${kinds} AND ${valueExpr} IS NOT NULL AND ${valueExpr}!='' GROUP BY ${valueExpr}`).bind(uid).all();return rows.results;};
 if(req.method==='GET')return json({...await readMaterialCategories(env,uid),usage:await usage()});
 if(req.method!=='POST')fail('请求方法无效',405);
 const raw=await req.text();if(raw.length>200000)fail('字段配置过大');let body;try{body=JSON.parse(raw);}catch{fail('配置格式无效');}
 let config;try{config=validateMaterialCategories(body);}catch(e){fail(e.message);}
 if(!Number.isSafeInteger(body.revision)||body.revision<0)fail('配置版本无效');
 const current=await readMaterialCategories(env,uid);if(current.revision!==body.revision)fail('字段配置已更新，请刷新后重试',409);
 const migration=body.migrations||{};if(!migration||typeof migration!=='object'||Array.isArray(migration))fail('迁移配置无效');
 const allowed=new Set(config.nodes.map(n=>n.value)),pairs=Object.entries(migration);
 if(pairs.length>600)fail('迁移项过多');
 for(const [from,to] of pairs)if(allowed.has(from)||typeof to!=='string'||!allowed.has(to)||from===to)fail('迁移目标必须是保留的有效选项，不能迁移仍保留的选项');
 for(const entry of await usage())if(!allowed.has(entry.value)&&!Object.hasOwn(migration,entry.value))fail('选项“'+entry.value+'”存在历史数据，请先指定迁移目标',409);
 const time=new Date().toISOString(),payload=JSON.stringify(config);
 const statements=[env.DB.prepare("INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,'fieldSettings',?,'saved',1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=studio_records.revision+1,updated=excluded.updated WHERE studio_records.owner=excluded.owner AND studio_records.kind='fieldSettings' AND studio_records.revision=?").bind(fieldId(uid),uid,payload,time,time,body.revision),
 // Abort the whole batch on a concurrent settings edit or a newly referenced unmapped value.
 env.DB.prepare("INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) SELECT NULL,'guard',?,'saved',1,'{}',?,? WHERE changes()=0").bind(uid,time,time),
 env.DB.prepare(`INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) SELECT NULL,'guard',?,'saved',1,'{}',?,? WHERE EXISTS(SELECT 1 FROM studio_records WHERE owner=? AND ${kinds} AND ${valueExpr} IS NOT NULL AND ${valueExpr}!='' AND ${valueExpr} NOT IN (SELECT value FROM json_each(?)))`).bind(uid,time,time,uid,JSON.stringify([...allowed,...pairs.map(([from])=>from)]))];
 // Database guards prevent concurrent uploads or stale saves from restoring removed option values.
 for(const event of ['INSERT','UPDATE'])statements.push(env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS material_categories_${event.toLowerCase()} BEFORE ${event} ON studio_records WHEN NEW.kind IN ('library','document','libraryMetadata','chunk') AND json_extract(NEW.payload,'$.libraryCategory') IS NOT NULL AND json_extract(NEW.payload,'$.libraryCategory')!='' AND EXISTS(SELECT 1 FROM studio_records WHERE id='field:MaterialCategories:'||NEW.owner AND owner=NEW.owner AND kind='fieldSettings') AND NOT EXISTS(SELECT 1 FROM studio_records f,json_each(f.payload,'$.nodes') n WHERE f.id='field:MaterialCategories:'||NEW.owner AND f.owner=NEW.owner AND f.kind='fieldSettings' AND json_extract(n.value,'$.value')=json_extract(NEW.payload,'$.libraryCategory')) BEGIN SELECT RAISE(ABORT,'MATERIAL_CATEGORY_INVALID'); END`));
 if(pairs.length){const mapping=JSON.stringify(Object.fromEntries(pairs));statements.push(env.DB.prepare(`UPDATE studio_records SET payload=json_set(payload,'$.libraryCategory',(SELECT value FROM json_each(?) WHERE key=${valueExpr})),revision=revision+CASE WHEN kind='libraryMetadata' THEN 1 ELSE 0 END,updated=? WHERE owner=? AND ${kinds} AND ${valueExpr} IN (SELECT key FROM json_each(?))`).bind(mapping,time,uid,mapping));}
 try{await env.DB.batch(statements);}catch{fail('保存失败：配置或历史资料已变化，请刷新并检查迁移目标后重试',409);}
 return json({...await readMaterialCategories(env,uid),usage:await usage()});
}
