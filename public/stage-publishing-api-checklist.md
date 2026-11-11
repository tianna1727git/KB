# 内容发布 Agent：Stage API 接入清单

当前范围：仅录入 Stage 的 blog 数据并回读验证；不发布到生产官网。
工作台已准备：人工审核后的文稿交接、结构化字段、正文 HTML、公开引用、保存与下载交接包。连接状态为“待接入 Stage API”。

## 明天需要确认的信息

| 项目 | 需要提供的内容 |
|---|---|
| Stage 地址 | 完整 API 基础地址，明确连接测试环境。现有示例 zcms.payoneer.cn 尚未确认为 Stage，不用于写入。 |
| 数据库与表 | Stage database ID、blog table ID。现有 ID 仅作待核对示例，不默认用于 Stage。 |
| 鉴权 | Stage x-api-key 的获取方式、权限和有效期；若还需要签名，提供算法及请求头。密钥届时通过设置保存，不放在聊天或代码中。 |
| 创建示例 | 一份脱敏 POST 请求体和成功响应；说明 data 是否必须使用字段 ID，以及 recordId 的返回位置。 |
| 字段定义 | title、slug、desc、content、subContent、coverImage、category、tags、作者、发布时间、阅读时长和 SEO/schema 的字段 ID 与类型。 |
| 富文本 | content 的准确 API 格式与合法示例，尤其标题、列表、表格、链接与上标引用。不能默认使用 TipTap/ProseMirror JSON。 |
| 分类与标签 | 可选项查询接口及选项 ID/名称格式；不能直接复用知识库分类。 |
| 图片 | 素材查询/上传接口与 coverImage、authorAvatar 格式：URL、资源 ID 或对象；封面需与正文一致。 |
| 保存与验证 | 单条 GET 响应、延迟保存情况、slug 重复错误、失败响应；如何确认字段及正文完整保存。 |
| 排序 | 按发布时间排序的能力及 reorder 接口；是否支持幂等键，防止重试重复录入。 |
| 时间 | publishTime 格式与时区，当前交接包标记 Asia/Shanghai。 |

## 已提供的接口形态（环境待核对）

- `GET /table/{blogTableId}/records?page=1&limit=20`
- `POST /table/{blogTableId}/records`
- `GET /table/{blogTableId}/records/{recordId}`
- `PATCH /table/{blogTableId}/records/{recordId}`
- 鉴权示例：`x-api-key`。

不需要提供 DELETE 能力，本次流程不删除已有记录。

## 交接格式

`zcms-blog-handoff-v1`：source 为审核版本信息，target 固定 Stage/blog，fields 包含发布字段及完整正文 HTML，publicReferences 仅包含实际引用的公开来源。内部知识切片、文件名和 [M1] 等标记不会交接为公开引用。

这是 Agent 输入格式，尚不是 ZCMS 可直接 POST 的请求体。API 字段映射及富文本转换将在接口确认后接入。

## 验收

1. 补齐必填字段，使用 Stage Key 创建一条测试记录。
2. 依据 recordId 回读核对全部字段、全文、列表、图片和文末引用。
3. 在 Stage 后台重开记录，确认富文本无报错；按发布时间核对顺序。
4. 工作台记录外部 recordId、验证时间和明确结果；验证失败不标为成功。
