# Payo 上传要求

2026-11-19 核对 MinerU 官方精准解析 V4 API：https://mineru.net/apiManage/docs 。使用 `/api/v4/file-urls/batch`，不使用免 Token 的 Agent 轻量解析接口。

- PDF、Doc/Docx、Ppt/Pptx、Xls/Xlsx、HTML，以及 PNG/JPG/JPEG/JP2/WebP/GIF/BMP：单文件最大 200 MB，文件页数上限 200 页，由 MinerU 检查。
- 上传队列最多 50 个未提交文件；前端按文件顺序请求，每次向 MinerU 申请一个上传链接，始终低于接口上限。官方概览写批量最多200个，但本地上传、URL批量接口细则均写单次最多50个，本实现采用具体接口细则。
- TXT/Markdown 是 Payo 保留的本地扩展格式，最大20 MB；小型HTML也在本地转换，大型HTML使用 MinerU-HTML。图片使用精准API的统一文件上限，不沿用轻量接口10 MB上限。
- 原件通过流式请求、增量SHA-256和R2写入保存，服务端核对实际字节与声明大小；不把200 MB原件全部读入内存。超限、错误格式、未授权及跨账号请求均拒绝；去重保留原件。
- 结果导入仍有本站独立限制：正文2 MB、结果ZIP20 MB、解压总量40 MB及单个结果条目10 MB。这些不是原件上传限制；结果无法导入时保留原件与解析任务，并显示错误。

部署脚本在更新Payo后，执行 `scripts/configure-payo-stage-upload-limits.sh`：只匹配Stage域名与既有回环端口，备份并调整Stage专用Nginx和网关覆盖配置，为Payo流式接口设置201 MB请求上限，其余接口仍为40 MB。PMI限额沿用其已有环境变量。检查失败恢复配置；不修改生产环境。

验证覆盖格式/边界、21 MB实际流式上传、200 MB完整数据流、原件哈希、去重、超限、网关41 MB流量、账号限额隔离、51个候选截至50个及浏览器上传交互；外部MinerU调用均使用固定测试响应，未消耗真实额度。
