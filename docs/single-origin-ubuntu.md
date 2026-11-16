# 一个主域名，按账号展示不同工作台

统一网址为 `https://tianna.net.cn`。`Payo KB` 登录后请求进入 KB；`PMI KB` 登录后请求进入 PMI。两个账号登录都只重定向到 `/`，没有跨域跳转，不依赖子域名或浏览器传入的工作台选择。

## 结构

- Nginx 保留现有 HTTPS 证书，在最终验收后把主域名的请求转发到统一登录服务 `127.0.0.1:5176`。
- Node.js 登录服务使用独立 SQLite 保存会话和限流记录，根据已验证的会话选择后端。
- KB 和 PMI 各自运行于 `127.0.0.1:5174`、`127.0.0.1:5175`，仍分别使用原来的 `data/kb`、`data/pmi` 本地 D1/R2 数据，不迁移或共享业务数据。
- 浏览器会话 cookie 不转发到业务后端。每个内部请求使用30秒有效的 HMAC 身份断言，绑定工作台、用户、请求方法、路径及公开 origin。断言不会返回给浏览器。后端拒绝直接访问、伪造身份和发给另一个工作台的断言。
- 后端验签后把请求 URL 恢复为公开 HTTPS origin，使业务 API 的同源校验继续有效。它不信任客户端的转发协议或身份头。

这是基于目前服务器已有的 Wrangler/workerd 本地运行方式的自托管方案。Wrangler dev/local 仍属于开发运行时，不等同于 Cloudflare 托管生产服务；业务数据备份、主机更新、进程守护和容量监控由服务器部署负责。这里不把复制代码当作已有网站的数据迁移，也不停止旧网站服务。

## 准备目录

服务器使用 Node.js 24，目录布局如下：

```text
/home/ubuntu/payo-workspaces/
  kb/                         # 更新后重新构建的 KB
  pmi/                        # 更新后重新构建的 PMI（当前为 KB 源码副本）
  data/kb/                    # 已初始化的 KB 本地 D1/R2
  data/pmi/                   # 已初始化的 PMI 本地 D1/R2
  secrets/kb-account.json     # 已设置的 Payo KB 账号及密码哈希
  secrets/pmi-account.json    # 已设置的 PMI KB 账号及密码哈希
  secrets/kb.env              # 原双域名配置，保留用于回退
  secrets/pmi.env
```

先停止此前临时启动的新增 KB 测试服务，以释放5174端口。不要停止现有主域名网站的 `tianna-web`、采集或后台服务。把这次新增文件更新到两份源码目录，分别安装依赖（依赖未变化时可跳过）、构建。无需改动已经初始化的业务数据库。

## 一次性生成新配置

在 KB 目录执行：

```sh
node scripts/configure-single-origin.mjs --root "$HOME/payo-workspaces" --origin https://tianna.net.cn
```

脚本会校验两份已有账号文件，保留用户名、密码哈希、`userId` 和两套原有模型加密密钥；保留原数据库标识。新文件是：

- `secrets/gateway.env`：统一入口配置、账号数组、内部签名密钥，权限0600。
- `secrets/kb-gateway.env`、`secrets/pmi-gateway.env`：各后端的签名校验配置、原有模型加密密钥，权限0600。
- 两个构建目录中的 `dist/server/wrangler.gateway.json`：后端安全模式与受保护的静态资源。

首次生成不会覆盖已有配置或启动服务；重复执行会拒绝覆盖。以后重新构建会更新构建目录，此时执行 `node scripts/configure-single-origin.mjs --root "$HOME/payo-workspaces" --origin https://tianna.net.cn --refresh-build-config`，只恢复后端构建配置，不改动任何密钥或数据。不要重新生成内部密钥，导致三个服务密钥不一致。新配置不会读取原跨域登录 cookie，但之前设置的密码继续有效。

## 临时启动与本机验收

三个服务分别保持在三个终端运行：

```sh
# 终端1，在 KB 目录执行：
node scripts/start-local-workspace.mjs --root "$HOME/payo-workspaces" --workspace kb
```

```sh
# 终端2，在 PMI 目录执行：
node scripts/start-local-workspace.mjs --root "$HOME/payo-workspaces" --workspace pmi
```

```sh
# 终端3，在 KB 目录执行：
node --env-file="$HOME/payo-workspaces/secrets/gateway.env" server/gateway.mjs
```

后端使用仅绑定本机的 HTTP，公开访问由 Nginx HTTPS 终止。外部不要开放5174、5175、5176端口。Nginx 应覆盖 `X-Real-IP`；登录服务只信任本机反向代理提供的该字段来做 IP 限流，不用它判定用户身份。

在第四个终端执行：

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5176/login -H 'Host: tianna.net.cn'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5176/api/studio/state -H 'Host: tianna.net.cn'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5174/api/studio/state
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5175/api/studio/state
```

依次应为200、401、401、401。不要把密码写进 curl 命令或聊天；真实账号的端到端登录通过最终 HTTPS 页面验证。

## 进程守护与最终切换

临时验收通过后，先用独立的 systemd 服务托管这三个命令，服务用户使用有权读取上述目录的非 root 用户，固定工作目录，设置 `Restart=on-failure`、`RestartSec=5`、`UMask=0077`。Node 路径以服务器实际安装位置为准。三个服务使用独立名称，不能覆盖 `tianna-web.service`。Node 服务关闭后登录会话仍保存在 `data/auth/sessions.sqlite` 中。

切换前备份原 `/etc/nginx/sites-available/tianna-workbench`（先检查 sites-enabled 实际链接目标），保留证书配置、HTTP跳转和其他网站。仅将 `tianna.net.cn` 的 HTTPS location 改为：

```nginx
location / {
    proxy_pass http://127.0.0.1:5176;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 40m;
    proxy_read_timeout 300s;
}
```

网关仅接受 Host `tianna.net.cn`；`www.tianna.net.cn` 如仍使用，应由现有 Nginx 跳转至主域名，保留其现有证书处理。不要把配置替换为简化片段而丢失原 server 块。

运行 `sudo nginx -t`，只有成功后才执行 `sudo systemctl reload nginx`。原网站服务和数据保留，切换失败时恢复原 Nginx 备份并验证、reload，即可重新转发到原5173服务。

最终在 `https://tianna.net.cn` 分别登录两个账号，检查地址不变、业务页/API和上传都在对应工作台中；注销后再切换账号。确认资料、设置、任务隔离，且匿名接口返回401。再测试重启新增服务后数据仍存在。

## 备份与账号管理

备份 `secrets/`、`data/auth/` 及两个独立业务数据目录。SQLite 的 WAL 也属于运行数据；为获得一致备份，停新增服务后复制整个数据目录，或使用 SQLite 在线备份接口。不要复制正在写入中的单个数据库文件当作完整备份。原有网站的备份任务不能代替新目录备份。

用户改名时保留 `userId`。密码重置需更新网关账号配置，并重启网关；立即撤销登录则清理网关会话表。后端签名密钥轮换必须同时更新三个服务。所有 secret 文件保留在源码目录之外，不提交 GitHub。

`npm run test:gateway` 覆盖同域名账号分流、真实 Worker 业务 API、POST 内容透传、注销失效、匿名拒绝、伪造身份、请求路径/方法/工作台绑定、配置与数据标识保留。
