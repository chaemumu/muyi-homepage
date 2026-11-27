#!/usr/bin/env node
// /assets 캐시 버전(?v=N) 검사 — /assets는 1년 캐시(immutable)라 파일을 고치고 v를 안 올리면 직원 화면에 예전 코드가 계속 뜬다.
//   node scripts/asset-versions.js          검사만 (tests/cases/versions.js가 같이 돌림)
//   node scripts/asset-versions.js --write  v를 올린 뒤 지금 내용을 기록 (tests/asset-versions.json)
// 규칙: ① 같은 파일은 어디서 부르든 같은 v  ② 기록된 v와 같은데 내용이 바뀌었으면 실패 → v 올리고 --write
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'tests', 'asset-versions.json');
const SKIP = new Set(['node_modules', '.git', 'supabase', 'tests', 'scripts', 'awesome-design-md-main', 'backup']);
const REF = /\/assets\/([A-Za-z0-9_./-]+\.(?:js|css))\?v=(\d+)/g;

function sources(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function scan() {
  const refs = new Map(); // 파일 → Map(v → [어디서])
  for (const f of sources()) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(REF)) {
      const file = 'assets/' + m[1];
      if (!refs.has(file)) refs.set(file, new Map());
      const vs = refs.get(file);
      if (!vs.has(m[2])) vs.set(m[2], []);
      vs.get(m[2]).push(path.relative(ROOT, f));
    }
  }
  return refs;
}

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 16);

function check({ write = false } = {}) {
  const refs = scan(), errors = [], now = {};
  const old = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  for (const [file, vs] of [...refs].sort()) {
    if (!fs.existsSync(path.join(ROOT, file))) { errors.push(`${file}: 파일 없음 (${[...vs.values()].flat().join(', ')})`); continue; }
    if (vs.size > 1) { errors.push(`${file}: 부르는 곳마다 v가 다름 — ${[...vs].map(([v, w]) => `v=${v} (${w.join(', ')})`).join(' / ')}`); continue; }
    const v = [...vs.keys()][0], h = hash(file);
    now[file] = { v: +v, hash: h };
    const was = old[file];
    if (write) continue;
    if (!was || was.v !== +v) errors.push(`${file}: v=${v} 기록 없음 — node scripts/asset-versions.js --write 로 기록`);
    else if (was.hash !== h) errors.push(`${file}: 내용이 바뀌었는데 v=${v} 그대로 — v를 올리고(${vs.get(v).join(', ')}) node scripts/asset-versions.js --write`);
  }
  if (write) fs.writeFileSync(MANIFEST, JSON.stringify(now, null, 2) + '\n');
  return errors;
}

module.exports = { check };

if (require.main === module) {
  const write = process.argv.includes('--write');
  const errors = check({ write });
  if (write) console.log(`기록함: ${path.relative(ROOT, MANIFEST)}`);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  if (!write) console.log('캐시 버전 OK');
}
