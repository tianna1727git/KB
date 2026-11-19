#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi
python3 <<'PY'
from pathlib import Path
from datetime import datetime
import os,re,subprocess,time,urllib.request,urllib.error

root=Path('/home/ubuntu/payo-staging')
nginx=Path('/etc/nginx/sites-enabled/payo-staging').resolve(strict=True)
unit=Path('/etc/systemd/system/payo-stage-gateway.service')
dropin=Path('/etc/systemd/system/payo-stage-gateway.service.d/99-payo-upload-limit.conf')
expected=root/'kb/scripts/configure-payo-stage-upload-limits.sh'
if not expected.is_file() or not (root/'kb/lib/studio/upload-policy.mjs').is_file():
    raise SystemExit('请先部署新版 Payo Stage，确认上传规则及流式接口已构建。')
original=nginx.read_bytes()
text=original.decode()
names=re.findall(r'\bserver_name\s+([^;]+);',text)
if not names or any(name!='stage.tianna.net.cn' for row in names for name in row.split()):
    raise SystemExit('Nginx 文件并非独立 Stage 配置，未修改。')
if not unit.is_file() or '/home/ubuntu/payo-staging/' not in unit.read_text():
    raise SystemExit('未找到预期的 Stage 网关服务，未修改。')
envtext=(root/'secrets/gateway.env').read_text()
for key,value in [('GATEWAY_PORT','5186'),('KB_UPSTREAM','http://127.0.0.1:5184'),('PMI_UPSTREAM','http://127.0.0.1:5185'),('AUTH_PUBLIC_ORIGIN','https://stage.tianna.net.cn')]:
    match=re.search(r'^'+key+r'=(.*)$',envtext,re.M)
    if not match or match.group(1).strip().strip("\"'")!=value:
        raise SystemExit('Stage 网关参数与预期不一致，未修改。')
old_dropin=dropin.read_bytes() if dropin.exists() else None
if old_dropin is not None and b'# Managed Payo Stage upload limits' not in old_dropin:
    raise SystemExit('发现自定义的网关覆盖文件，未覆盖。')
if not re.search(r'\bclient_max_body_size\s+\S+;',text):
    raise SystemExit('未找到 Stage 上传限额，未修改。')
def raise_limit(m):
    value=m.group(1).lower()
    if not re.fullmatch(r'\d+[kmg]?',value):
        raise SystemExit('无法识别现有 Nginx 请求限额，未修改。')
    if value=='0':return m.group(0)
    scale={'k':1024,'m':1024**2,'g':1024**3}
    size=int(value[:-1])*scale[value[-1]] if value[-1].isalpha() else int(value)
    return 'client_max_body_size 201m;' if size<201*1024**2 else m.group(0)
text=re.sub(r'\bclient_max_body_size\s+(\S+);',raise_limit,text)
if 'proxy_request_buffering' not in text:
    text,count=re.subn(r'(proxy_pass\s+http://127\.0\.0\.1:5186;)',r'\1\n        proxy_request_buffering off;\n        client_body_timeout 300s;',text)
    if count!=1:raise SystemExit('Stage 代理入口与预期不一致，未修改。')
else:
    text=re.sub(r'\bproxy_request_buffering\s+\S+;','proxy_request_buffering off;',text)
backup=Path('/root/payo-stage-upload-limits-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
backup.mkdir(mode=0o700)
(backup/'nginx.conf').write_bytes(original)
if old_dropin is not None:(backup/'gateway-dropin.conf').write_bytes(old_dropin)
content='''# Managed Payo Stage upload limits
[Service]
WorkingDirectory=/home/ubuntu/payo-staging/kb
Environment=GATEWAY_KB_MAX_BODY_MB=201
ExecStart=
ExecStart=/usr/local/bin/node --env-file=/home/ubuntu/payo-staging/secrets/gateway.env /home/ubuntu/payo-staging/kb/server/gateway.mjs
'''
try:
    nginx.write_text(text)
    subprocess.run(['nginx','-t'],check=True)
    dropin.parent.mkdir(parents=True,exist_ok=True)
    dropin.write_text(content)
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','restart','payo-stage-gateway'],check=True)
    subprocess.run(['systemctl','reload','nginx'],check=True)
    for attempt in range(20):
        try:
            request=urllib.request.Request('http://127.0.0.1:5186/login',headers={'Host':'stage.tianna.net.cn'})
            with urllib.request.urlopen(request,timeout=2) as response:
                if response.status==200:break
        except (OSError,urllib.error.HTTPError):pass
        time.sleep(1)
    else:raise RuntimeError('Stage 登录网关健康检查未通过')
    subprocess.run(['curl','-fsS','--max-time','15','--resolve','stage.tianna.net.cn:443:127.0.0.1','-o','/dev/null','https://stage.tianna.net.cn/login'],check=True)
except Exception:
    nginx.write_bytes(original)
    if old_dropin is None:dropin.unlink(missing_ok=True)
    else:dropin.write_bytes(old_dropin)
    subprocess.run(['systemctl','daemon-reload'])
    subprocess.run(['systemctl','restart','payo-stage-gateway'])
    subprocess.run(['nginx','-t'])
    subprocess.run(['systemctl','reload','nginx'])
    raise SystemExit('配置未生效，已恢复原配置。备份：'+str(backup))
print('Stage 上传通道已更新：Payo 单文件 200 MB，单次最多 50 个文件。')
print('页数由 MinerU 检查，上限200页；TXT/Markdown 本地导入最大20 MB。')
print('Payo 大文件接口请求限额已设为201 MB；PMI 限额保留，正式环境未修改。')
print('配置备份：'+str(backup))
PY
