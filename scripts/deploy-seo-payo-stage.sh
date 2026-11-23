#!/usr/bin/env bash
# Run as ubuntu on the existing Stage server. Never updates production or PMI.
set -Eeuo pipefail
trap 'printf "Deployment stopped at line %s: %s\n" "$LINENO" "$BASH_COMMAND" >&2' ERR
repo=/home/ubuntu/payo-staging/kb
service=payo-stage-kb
target=9b9c68b
[[ -d "$repo/.git" || -f "$repo/.git" ]] || { echo 'Stage checkout not found; no changes made.' >&2; exit 1; }
cd "$repo"
exec 9>/home/ubuntu/payo-staging/.seo-deploy.lock
flock -n 9 || { echo 'Another SEO deployment is running.' >&2; exit 1; }
[[ "$(systemctl show "$service" -p WorkingDirectory --value)" == "$repo" ]] || { echo 'Unexpected service directory; stopped.' >&2; exit 1; }
if ! git diff --quiet -- . ':!pnpm-workspace.yaml' || ! git diff --cached --quiet; then
  echo 'Local source changes found; preserved without overwriting. Changed filenames:' >&2
  git status --short
  exit 1
fi
test -s dist/server/wrangler.stage.json
test -d node_modules
sudo -v
git fetch origin feat/seo-keyword-research
git cat-file -e "$target^{commit}"
git merge-base --is-ancestor "$target" FETCH_HEAD
# Permit the server's local pnpm settings only when the feature has not changed
# the tracked version. Git switch will retain the local modification in place.
git diff --quiet HEAD "$target" -- pnpm-workspace.yaml || {
  echo 'Target changes pnpm-workspace.yaml; resolve the configuration before deployment.' >&2
  exit 1
}
previous=$(git rev-parse HEAD)
previous_ref=$(git symbolic-ref --short -q HEAD || true)
backup=$(mktemp -d /home/ubuntu/payo-staging/payo-seo-backup.XXXXXX)
build_dir="$backup/build"
restore_code=false
restore_dist=false
worktree=false
cleanup() {
  result=$?
  trap - EXIT
  if [[ "$result" != 0 ]]; then
    echo "Deployment failed. Backup: $backup" >&2
    if $restore_dist; then
      if [[ -e "$repo/dist" ]]; then mv "$repo/dist" "$backup/failed-dist"; fi
      mv "$backup/previous-dist" "$repo/dist"
    fi
    if $restore_code; then git -C "$repo" switch --detach "$previous"; fi
    if [[ -n "$previous_ref" ]] && $restore_code; then git -C "$repo" switch "$previous_ref"; fi
    if $restore_dist; then sudo systemctl restart "$service" || true; fi
  fi
  if $worktree; then git -C "$repo" worktree remove --force "$build_dir" || true; fi
  exit "$result"
}
trap cleanup EXIT
cp -p dist/server/wrangler.stage.json "$backup/wrangler.stage.json"
cp -p pnpm-workspace.yaml "$backup/pnpm-workspace.yaml"
git worktree add --detach "$build_dir" "$target"
worktree=true
cp -p "$backup/pnpm-workspace.yaml" "$build_dir/pnpm-workspace.yaml"
# This feature changes no dependency versions. Refuse reuse if lockfiles differ.
cmp pnpm-lock.yaml "$build_dir/pnpm-lock.yaml"
ln -s "$repo/node_modules" "$build_dir/node_modules"
(cd "$build_dir" && npm run build)
test -s "$build_dir/dist/server/index.js"
test -s "$build_dir/dist/server/__vite_rsc_assets_manifest.js"
test -d "$build_dir/dist/client"
python3 - "$backup/wrangler.stage.json" "$build_dir/dist/server/wrangler.stage.json" <<'PY'
import json, sys
from pathlib import Path
c = json.loads(Path(sys.argv[1]).read_text())
v = c.get('vars', {})
assert v.get('AUTH_WORKSPACE') == 'kb', 'Configuration does not target Payo'
assert v.get('STUDIO_AUTH_MODE') == 'gateway', 'Unexpected authentication mode'
assert v.get('AUTH_PUBLIC_ORIGIN', '').rstrip('/') == 'https://stage.tianna.net.cn', 'Unexpected origin'
assert c.get('main') in ('index.js', './index.js'), 'Unexpected worker entrypoint'
c['find_additional_modules'] = True
rules = c.setdefault('rules', [])
if not any(r.get('type') == 'ESModule' and '**/*.js' in r.get('globs', []) for r in rules):
    rules.append({'type': 'ESModule', 'globs': ['**/*.js', '**/*.mjs']})
Path(sys.argv[2]).write_text(json.dumps(c, indent=2) + '\n')
PY
git switch --detach "$target"
restore_code=true
mv "$repo/dist" "$backup/previous-dist"
restore_dist=true
mv "$build_dir/dist" "$repo/dist"
sudo systemctl restart "$service"
healthy=false
for attempt in {1..15}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 http://127.0.0.1:5184/api/studio/seoResearchSettings || true)
  if [[ "$code" == 401 ]] && systemctl is-active --quiet "$service"; then healthy=true; break; fi
  sleep 2
done
$healthy || { echo 'Local authenticated service did not become ready.' >&2; exit 1; }
sudo bash "$repo/scripts/configure-payo-stage-upload-limits.sh"
echo "Payo Stage deployed: $target"
echo "Rollback artifacts: $backup/previous-dist"
echo 'Refresh https://stage.tianna.net.cn/ and sign in to Payo. Real Baidu credentials still need verification.'
