#!/usr/bin/env node
// assets/crm-rounds.js(회차 번호 규칙)를 Edge Function rn-import 폴더로 복사 — 함수는 자기 폴더 파일만 배포되므로 복사본을 둔다
//   node scripts/sync-rounds.js   (tests/cases/rounds.js가 두 파일이 같은지 확인)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
fs.copyFileSync(path.join(ROOT, 'assets/crm-rounds.js'), path.join(ROOT, 'supabase/functions/rn-import/rounds.js'));
console.log('복사함: supabase/functions/rn-import/rounds.js');
