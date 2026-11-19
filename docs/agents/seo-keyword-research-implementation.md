# SEO关键词研究：百度第一阶段

入口在左侧菜单与 Agent 列表；工作台设置和研究页均可打开数据源配置。AI 分析复用当前账号已有模型配置。用户需求原文保存在 `seo-keyword-research.md`。

## 配置与运行

1. 当前账号先保存工作台模型配置。
2. 在百度商业开发者中心确认关键词规划师权限，从官方可视化调试工具取得实际请求的鉴权 `header` 对象，粘贴到数据源配置。不要填入整个请求或 `body`。本次两份 PDF 未包含通用鉴权说明，因此没有猜测鉴权字段。
3. 服务端必须配置已有的 `MODEL_SETTINGS_ENCRYPTION_KEY`（64 位十六进制），供 AES-GCM 加密保存账号凭据。配置保存不发起百度查询；首次真实查询成功才更新接口状态。
4. 选择百度、中国大陆全国、语言与设备，输入种子词开始研究。也可导入有来源的 UTF-8 CSV/JSON；使用 `keyword` 与 `search_volume` 列，未知值留空，快照日期未知也留空。

任务及默认范围保存在现有 D1 `studio_records` 表，无新增数据库迁移。百度响应在 R2 中脱敏保存。任务、凭据、响应下载与模型配置均按账号隔离；写操作沿用现有登录与同源校验。

## 指标与范围

- 拓词：`KRService/getKRByQuery`，读取 `PV/pcPV/mobilePV`。设备枚举 1 为计算机、2 为移动；广告竞争度 1 为低、3 为高。
- 流量：`PvSearchFunction/getPvSearch`，读取 `averageMonthPv/averageMonthPvPc/averageMonthPvMobile`。设备枚举 1 为移动、2 为计算机；`kwc` 1 为高、3 为低。
- 指导价为元，不称实际 CPC；广告竞争度不称 SEO KD。没有返回的数据保持缺失，零值单独展示。
- 最多保留 200 个候选词、拓展 2 轮。调用预算含百度及模型尝试；失败重试必须由用户继续，完成任务不会重复调用。
- AI 每批处理 25 个词，再综合全部词簇；数字与来源由程序保留，模型只补充定性判断。报告、完整 JSON 与关键词 CSV 可下载。
- Google/Bing 可选择但尚不能启动。未接入 SERP、域名排名、趋势或全文分析，报告明确为部分完成。没有创建文章或发布内容的副作用。

## 验证与发布

`npm run test:seo-keywords` 覆盖字段映射、缺失/零值、导入、输出约束、真实 D1/R2 路由、加密、账号隔离、预算、分批分析和导出；外部响应全部使用固定测试数据。`node tests/model-settings.integration.mjs` 验证已有模型配置回归；`npm run build` 验证构建。

尚未使用真实百度账号验证权限、额度或响应。功能分支只用于 Payo Stage 验收；未部署到 Stage 或生产。Stage 发布应保留服务端 `wrangler.stage.json`，核对构建的 RSC 模块齐全，仅更新 Payo 服务，不更新 PMI 或生产。
