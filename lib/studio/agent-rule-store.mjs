export async function readRules(db, owner, policy) {
  const row = await db.prepare("SELECT revision,payload FROM studio_records WHERE id=? AND owner=? AND kind=?").bind(policy.prefix+owner, owner, policy.kind).first();
  return {revision: row?.revision || 0, rules: row ? JSON.parse(row.payload).rules : policy.defaults};
}

export async function rulesAPI(req, env, {uid, fail, json}, policy) {
  if (req.method === 'GET') return json(await readRules(env.DB, uid, policy));
  if (req.method !== 'POST') fail('请求方法无效',405);
  const body = await req.json();
  let rules;
  try {rules = policy.validate(body.rules);} catch (e) {fail(e.message,400);}
  const time = new Date().toISOString(), id = policy.prefix+uid, payload = JSON.stringify({rules});
  const result = body.revision === 0
    ? await env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,'active',1,?,?,?)").bind(id,policy.kind,uid,payload,time,time).run()
    : await env.DB.prepare("UPDATE studio_records SET payload=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?").bind(payload,time,id,uid,body.revision).run();
  if (!result.meta.changes) fail('规则已更新，请重新打开并核对版本。',409);
  return json({revision: body.revision+1, rules});
}

