"""Import ProductMarketingChina Markdown using Payo Stage's authenticated APIs."""
import hashlib
import argparse, collections, csv, fcntl, getpass, http.cookiejar, json, os, sys, time
import re, unicodedata, urllib.error, urllib.parse, urllib.request, uuid, zipfile
from pathlib import Path

SITE = 'https://stage.tianna.net.cn'
MAX = 20 * 1024 * 1024
SCOPES = {'可对外分享':'public-share','可对外定向分享':'targeted-share','仅限内部':'internal','仅可演示 / 不可分享':'demo-only'}

def norm(name):
    return re.sub(r'[\W_]+','',unicodedata.normalize('NFKC',name).casefold())

def site_category(category, available):
    if category in available:
        return category
    aliases={'Product Guide':'ProductGuides','Product Brochure':'ProductBrochure','Products & Solutions':'ProductsSolutions'}
    return aliases.get(category) if aliases.get(category) in available else None

def member_path(member):
    if member.flag_bits & 0x800:
        return Path(member.filename)
    try:
        return Path(member.filename.encode('cp437').decode('utf8'))
    except UnicodeError:
        return Path(member.filename)

def read_manifest(path):
    rows=[]
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if not re.match(r'^\|\s*\d+\s*\|',line):
            continue
        fields=[v.strip() for v in re.split(r'(?<!\\)\|',line.strip('|'))]
        if len(fields)!=10 or fields[4] not in SCOPES:
            raise ValueError('清单字段或分享权限无法识别')
        rows.append({'原文件名称':fields[1],'原始分享权限':fields[4],'形式':fields[3]})
    if not rows:
        raise ValueError('清单中没有资料行')
    return rows

def unique_matches(rows,archive,catalog):
    stems=collections.defaultdict(list)
    paths=collections.defaultdict(list)
    for i,row in enumerate(rows):
        stems[norm(Path(row['原文件名称']).stem)].append(i)
    for member in archive.infolist():
        path=member_path(member)
        if path.suffix.lower() not in ('.md','.markdown') or any(x.startswith(('.', '__MACOSX')) for x in path.parts) or member.file_size>MAX:
            continue
        candidates=stems.get(norm(path.stem),[])
        source=catalog.get(path.name)
        if source and archive.read(member).decode('utf-8-sig').replace('\r\n','\n')!=source['markdown'].replace('\r\n','\n'):
            source=None
        if len(candidates)>1 and source:
            candidates=[i for i in candidates if Path(rows[i]['原文件名称']).suffix.lower()=='.'+str(source.get('sourceFormat','')).lower()]
        if len(candidates)==1:
            i=candidates[0]
            paths[i].append(member)
            rows[i]['category']=(source or {}).get('libraryCategory') or {'操作指南':'Product Guide','单页 / 海报':'Product Brochure','手册 / 多折页':'Product Brochure','报告 / 白皮书':'Whitepaper','FAQ / 客户异议处理':'FAQ','话术框架':'Templates & Tools'}.get(rows[i]['形式'])
    return paths

class SameOrigin(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if urllib.parse.urlsplit(newurl).netloc != urllib.parse.urlsplit(SITE).netloc or not newurl.startswith(SITE+'/'):
            raise ValueError('已停止跨站跳转')
        return super().redirect_request(req,fp,code,msg,headers,newurl)

class Stage:
    def __init__(self):
        self.client=urllib.request.build_opener(SameOrigin(),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def send(self,path,body=None,ct=None):
        req=urllib.request.Request(SITE+path,data=body,headers={'Origin':SITE,**({'Content-Type':ct} if ct else {})})
        with self.client.open(req,timeout=320) as response:
            return response.read()
    def api(self,action,body=None):
        return json.loads(self.send('/api/studio/'+action,None if body is None else json.dumps(body).encode(),'application/json'))
    def login(self):
        creds=urllib.parse.urlencode({'username':input('Payo Stage用户名：').strip(),'password':getpass.getpass('Payo Stage密码（仅发送至Stage）：')}).encode()
        self.send('/auth/login',creds,'application/x-www-form-urlencoded')
        state=self.api('state')
        if not any('Payoneer' in a.get('role','') for a in state.get('agents',[])):
            raise ValueError('当前会话未识别为Payo工作区，已停止。')
    def upload(self,name,body,category,scope):
        boundary=uuid.uuid4().hex
        parts=[]
        for k,v in {'libraryCategory':category,'usageScope':scope,'consent':'false'}.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        safe=re.sub(r'[\x00-\x1f\x7f"\\/]','_',name)
        parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{safe}"\r\nContent-Type: text/markdown\r\n\r\n'.encode(),body,f'\r\n--{boundary}--\r\n'.encode()])
        result=json.loads(self.send('/api/studio/librarySubmit',b''.join(parts),'multipart/form-data; boundary='+boundary))
        f=self.api('library/'+result['file']['id'])
        if f.get('usageScope')!=scope or f.get('libraryCategory')!=category or f.get('name')!=safe:
            raise ValueError('已有同内容记录，名称、分类或权限不同，请核对')
        if f.get('conversionState')=='failed' or not f.get('markdown','').strip():
            raise ValueError('资料已提交但未获得可整理正文，请查看资料列表')
        return f

def sync_scopes(stage, rows, archive, matches):
    targets = {}
    for index, row in enumerate(rows):
        hits = matches[index]
        if len(hits) == 1:
            member = hits[0]
            key = (member_path(member).name, hashlib.sha256(archive.read(member)).hexdigest())
            targets[key] = SCOPES[row['原始分享权限']]
    changed = current = unmatched = 0
    for file in stage.api('library')['files']:
        hashes = (file.get('originalHash'), file.get('sha256'), file.get('hash'))
        scope = next((targets[(file['name'], h)] for h in hashes if (file['name'], h) in targets), None)
        if scope is None:
            unmatched += 1
            continue
        if file.get('usageScope') == scope:
            current += 1
            continue
        result = stage.api('libraryUsageUpdate', {'id': file['id'], 'usageScope': scope,
                           'usageRevision': file.get('usageRevision', 0)})
        if result.get('usageScope') != scope:
            raise ValueError('保存后权限不匹配：' + file['name'])
        changed += 1
    print(f'使用范围已更新{changed}份，已一致{current}份，未匹配的现有记录{unmatched}份。')

def organize(stage,file_id):
    j=stage.api('ingestionStart',{'id':file_id})
    if j['state'] in ('running','committing'):
        j=stage.api('ingestionJob?id='+urllib.parse.quote(j['id']))
    retried=False
    while True:
        retry=(not retried and j['state']=='failed' and any(reason in (j.get('error') or '') for reason in ('1–12条原文证据','前置条件、限制或公式必须逐字引用当前证据','时间信息必须有当前原文证据','上次步骤已中断')))
        if j['state']!='waiting' and not retry:
            break
        retried=retried or retry
        j=stage.api('ingestionRun',{'id':j['id'],'revision':j['revision'],'retry':retry})
    if j['state']!='succeeded':
        return '整理任务'+j['state']+' '+(j.get('error') or ''),0
    did=j.get('documentId')
    if not did:
        checks={x['itemId']:x for x in j.get('checks',[])}
        items=j.get('items',[])
        if not items or j.get('uncovered') or j.get('conflicts') or any(not checks.get(i['id'],{}).get('supported') or checks[i['id']].get('issues') for i in items):
            return '资料已导入，整理结果待复核',0
        did=stage.api('ingestionCommit',{'id':j['id'],'revision':j['revision'],'ids':[i['id'] for i in items],'reviewed':True})['document']['id']
    doc=stage.api('document/'+did)
    chunks=doc.get('chunks',[])
    if doc.get('state')!='ready':
        pending=[c['id'] for c in chunks if c['state']=='pending' and not c.get('risks')]
        if pending:
            stage.api('confirm',{'ids':pending})
        doc=stage.api('document/'+did)
        if doc['state']=='review' and doc.get('chunks') and all(c['state']=='approved' for c in doc['chunks']):
            stage.api('completeKnowledgeReview',{'id':did})
            doc=stage.api('document/'+did)
    return ('已入库' if doc['state']=='ready' else '切片已保存，待复核'),len(doc.get('chunks',[]))

def detach(logpath):
    sys.stdout.flush()
    sys.stderr.flush()
    with open(logpath,'a',encoding='utf-8') as log, open(os.devnull) as quiet:
        pid=os.fork()
        if pid:
            print(f'已启动后台导入，PID {pid}。查看进度：tail -f "{logpath}"')
            return False
        os.setsid()
        os.dup2(quiet.fileno(),0)
        os.dup2(log.fileno(),1)
        os.dup2(log.fileno(),2)
    return True

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('zip',nargs='?',help='原始Markdown ZIP路径')
    parser.add_argument('--sync-scopes',action='store_true',help='只按清单同步已有资料的使用范围')
    parser.add_argument('--background',action='store_true',help='登录后在后台继续处理')
    parser.add_argument('--preview',action='store_true',help='只核对文件匹配')
    parser.add_argument('manifest',help='SharePoint Markdown清单')
    args=parser.parse_args()
    path=Path(args.zip or input('原始ZIP路径：').strip().strip('"')).expanduser()
    if not args.preview:
        lock=path.with_suffix('.import.lock').open('a')
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('同一ZIP已有后台导入在运行。')
    rows=read_manifest(Path(args.manifest))
    catalog={x['name']:x for x in json.loads(Path('lib/studio/library-data.json').read_text())}
    with zipfile.ZipFile(path) as archive:
        matches=unique_matches(rows,archive,catalog)
        print(f'清单{len(rows)}份，唯一匹配正文{sum(len(v)==1 for v in matches.values())}份')
        stage=Stage()
        categories=set()
        if not args.preview:
            stage.login()
            if args.sync_scopes:
                sync_scopes(stage,rows,archive,matches)
                return
            categories={n['value'] for n in stage.api('materialCategories')['nodes']}
        output=path.with_name(path.stem+('-预检' if args.preview else '-入库结果')+'.csv')
        if args.background and not args.preview:
            logpath=path.with_suffix('.import.log').resolve()
            if not detach(logpath):
                return
            if output.exists():
                output.rename(output.with_name(output.stem+'-'+str(time.time_ns())+'.csv'))
        with output.open('w',encoding='utf-8-sig',newline='') as log:
            writer=csv.writer(log);writer.writerow(['原文件名称','原始分享权限','使用范围','ZIP正文','状态','资料ID','已保存切片数'])
            for n,r in enumerate(rows):
                name=r['原文件名称'];scope=SCOPES[r['原始分享权限']];hits=matches[n];fid='';count=0
                try:
                    if len(hits)!=1:status='需核对正文匹配'
                    elif hits[0].file_size>MAX:status='正文超过20MB'
                    elif args.preview:status='匹配成功'
                    else:
                        category=site_category(r.get('category'),categories)
                        if not category:raise ValueError('分类待确认')
                        body=archive.read(hits[0]);text=body.decode('utf-8-sig')
                        if not re.sub(r'!\[[^\]]*\]\([^\n]*?\)|^\s*#.*$','',text,flags=re.M).strip():raise ValueError('只有图片或标题，需原件解析')
                        f=stage.upload(member_path(hits[0]).name,body,category,scope);fid=f['id']
                        status,count=organize(stage,fid)
                except urllib.error.HTTPError as e:
                    if e.code in (401,403):raise
                    status=f'HTTP {e.code} '+e.read(500).decode(errors='replace')
                except (ValueError,KeyError,OSError,zipfile.BadZipFile) as e:status=str(e)
                writer.writerow([name,r['原始分享权限'],r['原始分享权限'].replace(' / ','／'),str(member_path(hits[0])) if len(hits)==1 else '',status,fid,count])
                log.flush()
                if not args.preview:print(n+1,name,status,flush=True)
        print('逐份结果保存于',output)
if __name__=='__main__':main()
