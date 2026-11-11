---
name: zcms-upload-seo-blog
description: >-
  Upload SEO blog articles into Payoneer ZCMS database (blog table) on Stage or
  Publish. Use when the user asks to 上传博客, 录入 SEO 文章, create blog in ZCMS,
  import Feishu/飞书 wiki into blog, or fill ZCMS blog fields (slug, meta,
  coverImage, category, tags). Does not publish—hand off to zcms-publish-site.
---

# ZCMS SEO Blog 上传

把 SEO blog 文章录入 Payoneer ZCMS **数据库**（不是站点树页面）。发布走 [`zcms-publish-site`](../zcms-publish-site/SKILL.md)。

默认用 **agent-browser --headed**，便于用户处理 SSO / 核对表单。

## 环境

| 名称 | 数据库后台 | 前台 |
|------|------------|------|
| Stage | `https://stage.payoneer.cn/admin/database` | `https://stage.payoneer.cn` |
| Publish | `https://zcms.payoneer.cn` 下对应 database | `https://www.payoneer.cn` |

- **先 Stage 验证，再 Publish。** 未明确环境时先问用户。
- 入口路径：`/admin/database` → 左侧选 **`blog`**（勿点到 `blog_tag`；`find text "blog"` 易误匹配）。
- 前台 URL 形态：`/blogs/{slug}`（飞书文档里若写 `/resources/blog/...`，**只用 blog 后的 slug**）。

## 前置条件

1. `export PATH="$HOME/.local/bin:$PATH"`；headed 打开后台。
2. SSO：Payoneer Microsoft 登录；停在登录页时让用户完成。
3. 确认左侧在 **payoneer → blog**，再点 **添加新数据**。
4. 相关表：`blog_category`（如 跨境收付）、`blog_tag`（如 电汇收款）。

## 必填字段

| 字段 | 说明 |
|------|------|
| 标题 / title | 通常相同 |
| slug | 英文短横线；对应 `/blogs/{slug}` |
| desc | 摘要 |
| coverImage * | 素材库选择或 uploadImage；须与文内封面一致 |
| category * | 多选，如 `跨境收付` | 需要根据文章类型手动选择 |
| tags * | 多选，如 `电汇收款` | 需要根据文章类型手动选择 |
| authorName / authorIntro / authorAvatar * | 默认可复用 `Payoneer派安盈` / `Payoneer派安盈大中华区市场团队` + 已有头像 |
| publishTime * | 如 `2026-08-06 08:00` |
| readDuration * | 如 `10分钟` |
| content | **正文全文**（富文本） |

### 建议填写（SEO）

| 字段 | 说明 |
|------|------|
| metaTitle | 必须以 ` | Payoneer派安盈中国官网` 结尾（例：`标题 | Payoneer派安盈中国官网`） |
| metaDescription | 可与 desc 相同 |
| metaKeywords | 逗号/顿号分隔 |
| schema | JSON-LD；可用下方模板按 slug/title/desc 生成 |

### 可选

| 字段 | 说明 |
|------|------|
| subContent | 第二段正文；用户未要求时 **留空**，全文放 `content` |
| adB / adC / wpItem / isTop | 按用户指示；默认可不选 |

## 飞书文稿 → 字段映射

输入常为飞书 wiki（需扫码登录）。

1. headed 打开飞书链接；虚拟列表需 **滚动收集** `.page-block-children .block`。
2. 文首 SEO 表（关键词 / URL / Meta Title / Description / Keywords）→ 对应 meta / slug / desc。
3. URL 取 **`/blog/` 或 `/blogs/` 后的 slug**。
4. 文内大图（如 736×491）→ `coverImage`（下载后上传或素材库选同一文件）。
5. 正文从导语起至「参考数据」→ `content`（h2/h3/ul/p）；**不要**把 SEO 表写进正文。

## 操作流程

```
进度：
- [ ] 1. 确认环境 + SSO
- [ ] 2. 打开 database → blog → 添加新数据
- [ ] 3. 填文本 / SEO / schema
- [ ] 4. 选 category / tags
- [ ] 5. 上传 coverImage + authorAvatar
- [ ] 6. 写入完整 content（subContent 按约定）
- [ ] 7. 用户确认（需要时保持表单打开）
- [ ] 8. 关闭表单自动保存 → 等待 → 重开核对
- [ ] 9. （可选）衔接 zcms-publish-site
```

### 1–3 文本

用 placeholder 填充：`请输入标题` / `slug` / `title` / `desc` / `authorName` / `authorIntro` / `publishTime` / `readDuration` / `metaTitle` / `metaDescription` / `metaKeywords` / `schema`。

### 4 category / tags（易错）

控件是可滚动下拉，**不要**只靠 JS `click` 文案。

1. 对 `div.transition-width`（含「请选择category/tags」）做 **真实 mouse click** 展开。
2. category：`跨境收付` 可能在「资金管理」**上方**，需滚轮/上箭头露出后再点。
3. tags：选中后 chip 区应变为标签名（「请选择tags」消失）。
4. 关闭前确认表单片段中 **不再出现** `请选择category` / `请选择tags`。

### 5 图片（易错）

点「点击上传图片」/「替换图片」打开 **selectImageResource（素材库 / 外部链接）**，不是单纯系统文件框。

1. 优先在素材库选已有资源（如 `cover 736×491`、`author.svg`）。
2. 或点 **uploadImage** 后对 `input[type=file]` 设本地文件。
3. 成功后字段显示 **替换图片 / 删除**。
4. 用尺寸或文件 hash 核对 cover 与飞书图一致（曾误选过 JMIA 等小图）。

authorAvatar：可从已有 blog 记录复用（常见 `admin/api/asset/...` 方形头像）。

### 6 content（富文本格式硬约束）

**优先走 UI**：向第一个 `[contenteditable=true]` 写入结构化 HTML（`h2`/`h3`/`ul`/`ol`/`p`）。ZCMS 会按内部 HTML→JSON 规则转换，格式正确。第二个为 subContent；默认清空。

**禁止**把 TipTap / ProseMirror 标准 JSON 直接 POST/PATCH 进 `content` 字段。ZCMS 富文本是**自定义 schema**，与 TipTap 不兼容；写错后列表仍可见，但**一点开记录就「页面出错了」**（控制台常见 `toLowerCase` / `.map`）。

| TipTap（错误） | ZCMS（正确） |
|----------------|--------------|
| `marks: [{ "type": "bold" }]` | `marks: ["bold"]`（字符串；italic/underline/strike/code/superscript 同理） |
| `orderedList` / `bulletList` 用子节点数组 `content: [listItem…]` | 用 **`items: [listItem…]`**（渲染读 `t.items.map`，无 `items` 即崩） |
| 仅 `type: "doc"` | 须含 **`version: 1`** + `content: []` |

合法列表示意：

```json
{
  "type": "orderedList",
  "items": [
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "标题词", "marks": ["bold"] },
            { "type": "text", "text": "：后续说明。" }
          ]
        }
      ]
    }
  ]
}
```

API 写入时：

- `data` 键用**字段 id**（如 content 的 `cmpfnc71h01kv5tyvb2mzjf0r`），不要同时再写一份字段名键 `"content"`；双键且名键为 TipTap 格式时，打开仍可能崩。
- 修复坏稿：把 marks 改成字符串、列表 `content`→`items`，再 `PATCH .../records/{id}`，body `{ "data": { "<contentFieldId>": <doc> } }`（需 `x-timestamp` + `x-body-hash`）。PATCH 偶发 HTTP 500 但数据已写入时，以 GET 重开核对为准。
- 保存后若正文不完整：重开记录，把全文再写入 `content`，再保存。

### 7–8 保存与核对

**硬性：未填齐全部必填项前，禁止离开表单。**

- **禁止**点侧栏其他表、点列表其他记录、点页面空白、Esc、浏览器返回、切 tab 后误关等任何会关掉「创建新记录 / 编辑」面板的操作。
- 未齐必填就退出 → **无法保存 / 整单丢失**（关闭≠已保存成功）。
- 关闭前自检：无「请选择*」；`coverImage` / `authorAvatar` 等必填图均为「替换图片」（不是「点击上传图片」）；文本必填均有值。
- **仅当**必填全部满足后，才允许点表单右上角关闭控件（`rounded-full bg-white/60`）触发自动保存。

1. 关闭弹层右上角按钮 → 自动保存。
2. Toast 如「记录创建成功」；列表出现标题与更新时间。
3. **等待数秒至十几秒** 再点开；富文本可能延迟可见。
4. 重开核对：slug、category/tags、cover 尺寸、content 含主要章节与文末参考数据、subContent 符合约定。

编辑已有记录：列表点标题打开 → 改 → 关闭保存 → 同样等待后重开确认。

### 9 列表顺序（默认规则）

**上传完成后必须调整顺序：越新发布时间，越靠前**（第一页第 1 条 = 最新）。系列文（如外汇前瞻 6–9 月）录入后若落在末页，须按发布时间重排到目标位置。`media_center` / `activity` 等同理。

API（需 `x-timestamp` + `x-body-hash`）：

```http
POST /api/database/{db}/table/{table}/records/reorder
{"recordId":"<id>","afterId":"<当前第1条id>"}
```

- 省略 `beforeId`、只带 `afterId` = 移到列表最前。
- 要得到 `[最新…最旧]`：按**从旧到新**依次把每条移到 index 0（先移最旧，最后移最新）。
- 例：要 `09,08,07,06` → 依次 reorder `06→07→08→09` 到最前。
- UI 拖拽与上述 API 等价；自动化优先用 signed POST。

## schema 模板

```json
{
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  "@id": "https://www.payoneer.cn/blogs/{slug}",
  "url": "https://www.payoneer.cn/blogs/{slug}",
  "name": "{title}",
  "description": "{desc}",
  "brand": { "@type": "Brand", "name": "Payoneer 派安盈" },
  "serviceType": "{主题简述}",
  "provider": { "@type": "FinancialService", "name": "Payoneer Inc." }
}
```

Stage 校验时 `@id`/`url` 可暂用生产域名（与现网条目一致），除非用户要求改 Stage 域名。

## agent-browser 要点

```bash
export PATH="$HOME/.local/bin:$PATH"
agent-browser --headed open "https://stage.payoneer.cn/admin/database"
```

- 侧栏点 **精确 ref** 的 `blog`，避免点到 `blog_tag`。
- category/tags/素材卡片：优先 **CDP/Playwright mouse click** + `getBoundingClientRect`。
- 飞书：滚动 `.bear-web-x-container`，增量收集 block。
- 多标签：ZCMS / 飞书分开；操作前 `tab` 确认当前页。
- **不要**对未保存表单乱按 Escape（会关表单且可能丢稿）。
- **未填齐必填前不要点表单外任何地方**（侧栏/列表/空白），否则关面板且无法保存。

## 常见坑

| 现象 | 原因 | 处理 |
|------|------|------|
| 关闭后列表没有新文 | 必填未齐被丢弃，或未齐就点表单外退出 | **先填齐必填**再关；关闭前确认无「请选择*」、两图均为「替换图片」；中途勿点侧栏/列表 |
| **一点开记录就「页面出错了」**（`toLowerCase` / `.map`） | `content` 写成 TipTap JSON：`marks` 为对象，或列表用 `content` 而非 `items` | 见上文「6 content」；改成字符串 marks + `items` 后 PATCH；**优先改走 contenteditable HTML**，勿直接灌 TipTap JSON |
| cover 是错图 | 素材库点错，或连续上传正文图后 cover 被最后一张覆盖 | 按尺寸/hash 与飞书核对后「替换图片」；多图上传结束须**再传一次 cover** 并确认 `coverImage.name=cover-*`、1280×720 |
| 正文缺后半 | 只写了 content 前半或误清空 sub 未合并 | 全文写入 content；sub 按约定留空 |
| 保存后看仍旧 | 富文本延迟 | 等待后重开再验 |
| category 下拉没有「引领者观」等 | blog 表 category 是**字段 options**，与 `blog_category` 表不同步 | 在 blog 表字段设置里给 category 补 option，不能只建 `blog_category` 行 |
| 点了 blog_tag | `find text blog` 误匹配 | 用 sidebar 精确 `blog` ref |
| 发错环境 | Stage/Publish 混淆 | 看 UAT vs PROD 与 URL |

## 与发布 skill 的边界

| 本 skill | zcms-publish-site |
|----------|-------------------|
| database → blog 录入/改稿 | 站点树「有更新」/批量发布 |
| 保存记录 | 立即发布（跳过审批） |
| Stage 录入验证 | Stage 发完再 Publish |

用户要「上传并发布」时：本 skill 完成录入 → 再调用 zcms-publish-site（blog 目录级联规则）。

## 示例触发语

- 「把这篇飞书 SEO 文章上传到 Stage ZCMS blog」
- 「录入博客：slug / category / tags / 封面」
- 「补全刚才那篇 blog 的 content 并保存」
- 「上传完先别关表单，我检查后再保存」
