# KB 统一用户名密码登录

当前腾讯云服务器采用[同一主域名按账号分流](single-origin-ubuntu.md)。本文保留原双域名部署方式供参考；不要把两种方式的配置混用。

入口属于 KB 仓库。两个仓库分别构建、分别部署：KB 账号进入 KB；PMI 账号从 KB 登录，经一次性签名凭证进入 pmi-kb。工作台不能由浏览器选择或用 URL 参数切换。

这是可选的独立 Cloudflare Workers 部署模式。默认仍是 ChatGPT/Sites 登录；不更改既有 Site 的身份、访问策略或 `.openai/hosting.json`。在 Sites 发布时继续使用平台登录，用户名密码模式应部署到自己管理的 Cloudflare Workers。此次 GitHub 提交不部署任何站点。

## 配置

| 配置 | KB | pmi-kb |
| --- | --- | --- |
| `STUDIO_AUTH_MODE` | `password` | `password` |
| `AUTH_WORKSPACE` | `kb` | `pmi` |
| `AUTH_KB_ORIGIN` | KB 的 HTTPS origin | 同左 |
| `AUTH_PMI_ORIGIN` | PMI 的 HTTPS origin | 同左 |
| `AUTH_HANDOFF_SECRET` | 随机生成的至少32字节密钥，以 base64url 配置 | 同一密钥 |
| `AUTH_ACCOUNTS_JSON` | 两个账号的 JSON 数组，作为 secret | 不配置 |
| `DB` / `BUCKET` | KB 独立 D1 / R2 | PMI 独立 D1 / R2 |

Origin 不含路径、查询参数；部署脚本要求不带结尾 `/`。两个站点必须是不同 origin。禁止共享 D1/R2。独立部署时不能照搬 Sites 的占位数据库 ID。原有模型配置、解析服务和发布配置的密钥也需要按原功能分别设置，不能靠复制源码复制运行数据。

### 创建账号

分别运行（替换用户名和邮箱；邮箱仅作账号展示，不会发送邮件）：

```sh
node scripts/create-login-account.mjs --workspace kb --username kb-admin --email kb-admin@example.com
node scripts/create-login-account.mjs --workspace pmi --username pmi-admin --email pmi-admin@example.com
```

脚本在终端无回显读取12–256位密码，只输出带随机盐的 PBKDF2-SHA256 哈希。将两个输出对象合成一个 JSON 数组，填入 **KB 的 `AUTH_ACCOUNTS_JSON` secret**。不要把密码、账号配置或交接密钥提交到 GitHub；不要把密码放在命令行参数中。用户名区分大小写。每个工作台恰好一个账号，`userId` 唯一且稳定，改用户名时保留 `userId`，避免已有资料归属变化。

`AUTH_HANDOFF_SECRET` 用密码管理器生成随机32字节以上的 base64url 值，并分别存入两个部署的 secrets。不要使用示例密码或默认密码。密码重置通过更新 KB 的账号 secret 完成；立即撤销已登录会话还需在对应数据库执行 `DELETE FROM studio_auth_sessions`。

## 独立部署步骤

1. 为 KB 和 PMI 各创建一个 Worker、D1 数据库和 R2 桶，确定两个 HTTPS origin。暂不开放未配置完成的部署。
2. 两个仓库安装依赖、运行 `npm run build`。分别在仓库目录执行下面的准备命令，替换 worker 名称、origin、数据库 UUID/名称和桶名称。PMI 仓库把 `--workspace kb` 改成 `--workspace pmi`，并使用 PMI 的名称与资源。

```sh
node scripts/prepare-password-deploy.mjs --workspace kb --name payo-kb --kb-origin https://kb.example.com --pmi-origin https://pmi.example.com --database-id YOUR_DATABASE_UUID --database-name kb-db --bucket kb-files
```

3. 使用生成的配置在两份独立数据库执行建表 SQL（新数据库先执行 `0000`；已有数据库只执行 `0001`）：

```sh
npx wrangler d1 execute DB --remote --config dist/server/wrangler.password.json --file drizzle/0000_mature_bug.sql
npx wrangler d1 execute DB --remote --config dist/server/wrangler.password.json --file drizzle/0001_password_auth.sql
```

4. 使用 Cloudflare secret 输入提示配置交接密钥，KB 额外配置账号 JSON，输入内容不应放在命令参数中：

```sh
npx wrangler secret put AUTH_HANDOFF_SECRET --config dist/server/wrangler.password.json
# 只在 KB 仓库执行：
npx wrangler secret put AUTH_ACCOUNTS_JSON --config dist/server/wrangler.password.json
```

5. 两边分别配置原有业务密钥，再执行 `npx wrangler deploy --config dist/server/wrangler.password.json`。如果使用自定义域名，须在 Cloudflare 中把对应域名路由至该 Worker，并核对 origin。每次重新构建后都重新运行准备脚本；生成配置在忽略的 `dist/` 内。
6. 用真实浏览器从 KB `/login` 验证两个账号。检查匿名访问 API 被拒绝、退出后不能继续访问、KB 账号不能进入 PMI，反之亦然。验收后再开放使用。

生成配置启用 `assets.run_worker_first`，静态资源也先经过登录校验；不得改成绕过 Worker 的静态托管。登录与业务响应禁用共享缓存。登录代码在 Worker 入口运行，涵盖页面、API、资源和非 GET 请求。

## 登录行为

- 会话为12小时的 host-only、Secure、HttpOnly、SameSite=Lax cookie。数据库只保存随机会话 token 的 SHA-256 哈希。
- PMI 交接使用60秒 HMAC 签名凭证，绑定 PMI origin 和工作台，用 POST 传递，数据库保证只使用一次，不进入 URL。
- 只有服务端验证后的会话能设置业务身份；外部传入的 `oai-authenticated-*` 身份头在密码模式下全部替换。
- 非 GET 业务请求要求同源 Origin。退出为确认页面加 POST，会删除服务端会话。PMI 退出后回到 KB 登录页。
- D1 原子计数限制每15分钟同账号10次、同 IP 50次登录尝试（含成功尝试）；错误统一，不透露用户名是否存在。计数和会话不依赖 Worker 进程内存。成功登录时清理过期记录。
- 该模式关闭 `/mcp`，不把浏览器会话当作 MCP 服务凭证。需要 MCP 时使用原有 Sites 登录部署。
- 未配置或配置错误会拒绝访问，不会降级为匿名或开发身份。部署时未启用密码模式则继续由原平台登录管理身份。
- 原有 Site/本地账号的数据不会自动迁移到新 `userId` 或新数据库；复制的是代码，不是线上资料或凭据。

## 验证

`npm run test:auth` 验证密码哈希、分流、一次性凭证、篡改与过期拒绝、伪造身份、跨工作台 cookie、登录限流、CSRF、退出撤销和默认平台登录兼容性。单元测试使用 Node SQLite 适配器执行真实 SQL；集成测试使用 Miniflare Workers/D1 跑两个账号登录、PMI 交接和真实业务 API。不连接生产数据库或模型。

参考：[Cloudflare Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、[D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)。
