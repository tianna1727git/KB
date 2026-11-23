#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/payo-staging/kb
zipfile=$(find /home/ubuntu -maxdepth 5 -type f -name Payo-Markdown.zip -print -quit)
manifest=$(find /home/ubuntu -maxdepth 5 -type f -name 'ProductMarketingChina-SharePoint文件清单.md' -print -quit)
[[ -n "$zipfile" && -n "$manifest" ]] || { echo '没有找到ZIP或清单'; exit 1; }
pin=${1:?需要部署脚本版本}
git show "$pin:scripts/deploy-seo-payo-stage.sh" | bash
python3 scripts/import-payo-markdown.py --background "$zipfile" "$manifest"
