#!/usr/bin/env bash
# Edge Function 소스 ↔ Supabase (pacyhanuwuizcxwoggen)
#   scripts/fn.sh pull [함수…]     배포된 소스를 supabase/functions/ 로 내려받기 (인자 없으면 전부)
#   scripts/fn.sh deploy 함수…     저장소 파일로 배포 (verify_jwt는 supabase/config.toml)
#   scripts/fn.sh diff 함수        배포된 것과 저장소 파일 비교
# 필요: SUPABASE_ACCESS_TOKEN (클라우드 세션은 프록시가 넣어 줌 — 아무 값이나 두면 됨)
set -euo pipefail
cd "$(dirname "$0")/.."
REF=pacyhanuwuizcxwoggen
CLI="npx -y supabase@2.20.12"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_proxyinjected0000000000000000000000000000}"
cmd="${1:-}"; shift || true
all() { curl -fsS "https://api.supabase.com/v1/projects/$REF/functions" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(f=>f.slug).join(" ")))'; }
case "$cmd" in
  pull)   for f in ${@:-$(all)}; do $CLI functions download "$f" --project-ref "$REF" && echo "↓ $f"; done ;;
  deploy) [ $# -gt 0 ] || { echo "배포할 함수 이름을 적어주세요"; exit 1; }
          for f in "$@"; do $CLI functions deploy "$f" --project-ref "$REF" --use-api && echo "↑ $f"; done ;;
  diff)   f="${1:?함수 이름}"; tmp=$(mktemp -d); (cd "$tmp" && mkdir -p supabase && cp "$OLDPWD/supabase/config.toml" supabase/ && $CLI functions download "$f" --project-ref "$REF" >/dev/null); diff -ru "$tmp/supabase/functions/$f" "supabase/functions/$f" && echo "같음: $f"; rm -rf "$tmp" ;;
  *) sed -n '2,6p' "$0"; exit 1 ;;
esac
