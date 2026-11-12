// ── 가져오기 (대표 전용): 엑셀 총관리 + 노션 CSV(zip) → 업체 DB ──
// 규칙 (2026-11 확정)
// - 같은 업체: 이름(띄어쓰기 무시)이 같고, 둘 다 주소가 있을 때 시·군·구까지 같으면 합침. 다르면 별개 + '확인 필요'
// - 상태: 엑셀 결제일 vs 노션 입금일 중 최신 쪽. 엑셀 계약이 있으면 결제 업체(계약 상태는 엑셀 분류)
// - 노션 대량 등록분(담당 '채원 이' + 가망)은 미배정. 개인 DB·박람회·엑셀은 적힌 담당자 그대로(이름 기록)
// - 다시 실행해도 import_key로 중복 저장하지 않음 (이미 있는 업체는 덮어쓰지 않음)
// 화면/저장은 window.CRM_IMPORT.mount(container)로 시작. admin.html의 sb·el·$·admins·toast 사용
(function () {
  const LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  };
  const loadLib = (src) => new Promise((ok, ng) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('라이브러리를 불러오지 못했습니다: ' + src)); document.head.appendChild(s);
  });

  // ── 공통 정리 함수 ──
  const clean = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
  const keyOf = (name) => clean(name).replace(/\s+/g, '').replace(/[()（）\[\]·.,'"]/g, '').toLowerCase();
  const isAddr = (s) => /(시|군|구|도)\s/.test(s || '') && !/^https?:/i.test(s || '');
  // 지역 = 시·군·구 이름 (시·도 표기 차이 무시: '충청북도 청주시' = '충북 청주시' = '청주시')
  const SIDO = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|경상|전라|충청)|(도|특별시|광역시|특별자치시|특별자치도)$/;
  const region = (addr) => { const t = clean(addr).replace(/["']/g, '').split(' ').filter(Boolean); const i = SIDO.test(t[0] || '') ? 1 : 0; const r = t[i] || ''; return /(시|군|구)$/.test(r) ? r : ''; };
  const phone = (s) => { const d = clean(s).replace(/[^\d]/g, ''); if (d.length < 9) return clean(s) || null; return d.replace(/^(02|0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3'); };
  // 노션 사람 이름 '채원 이' → '이채원'. '워누'처럼 별명은 그대로
  const person = (s) => clean(s).split(',').map((x) => { const p = x.trim().split(' '); return p.length === 2 && p[1].length === 1 ? p[1] + p[0] : x.trim(); }).filter(Boolean).join(', ') || null;
  const ymd = (d) => d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null;
  // '2025년 9월 24일' / '2026/10/22' / '2026-11-03' / 엑셀 날짜 → 'YYYY-MM-DD'
  function date(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : ymd(v);
    if (typeof v === 'number') { if (v < 20000) return null; return ymd(new Date(Math.round((v - 25569) * 864e5))); }
    const s = String(v);
    let m = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || s.match(/(\d{4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})/);
    if (!m) return null;
    if (+m[1] < 2000) return null; // 엑셀 '1899-12-30' 같은 빈 날짜
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : null; };
  const months = (v) => { const n = num(v); return n == null ? null : n; };

  // ── CSV 파서 (따옴표·줄바꿈 포함) ──
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    const head = rows.shift() || [];
    return rows.filter((r) => r.some((x) => x !== '')).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
  }

  // 엑셀 시트 종류: 이름이 달라도 첫 줄 내용으로 알아본다
  function sheetKind(name, rows) {
    const n = clean(name).replace(/\s/g, '');
    const top = rows.slice(0, 4).map((r) => (r || []).map((v) => clean(v)).join('|')).join('\n');
    if (/총관리/.test(n) || (/업체명/.test(top) && /결제일자/.test(top) && /계약금액/.test(top))) return '총관리';
    if (/홀딩/.test(n) || /^홀딩\|진행회차/m.test(top)) return '홀딩업체';
    if (/특이/.test(n) || /업체명\|내용/.test(top)) return '특이업체';
    if (/달력/.test(n) || /모집달력/.test(top)) return '달력';
    return null;
  }
  // ── 파일 읽기: 엑셀 시트 / 노션 zip 안의 _all.csv ──
  async function readFiles(files) {
    const out = { excel: null, csv: {}, sheets: [] };
    for (const file of files) {
      if (/\.xlsx?$/i.test(file.name)) {
        await loadLib(LIBS.xlsx);
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        out.excel = out.excel || {};
        for (const n of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
          const kind = sheetKind(n, rows);
          out.sheets.push({ file: file.name, sheet: n, kind, head: (rows.find((r) => r && r.some((v) => v != null)) || []).filter((v) => v != null).slice(0, 8).join(' | '), rows: rows.length });
          if (kind && !out.excel[kind]) out.excel[kind] = rows; // 같은 종류 시트가 여러 개면 처음 것
        }
      } else if (/\.zip$/i.test(file.name)) {
        await loadLib(LIBS.jszip);
        await readZip(await JSZip.loadAsync(await file.arrayBuffer()), out);
      } else if (/\.csv$/i.test(file.name)) {
        addCsv(file.name, await file.text(), out);
      }
    }
    return out;
  }
  async function readZip(zip, out) {
    for (const f of Object.values(zip.files)) {
      if (f.dir) continue;
      if (/\.zip$/i.test(f.name)) await readZip(await JSZip.loadAsync(await f.async('arraybuffer')), out);
      else if (/\.csv$/i.test(f.name)) addCsv(f.name, await f.async('string'), out);
    }
  }
  // 노션은 같은 표를 'X.csv'(보이는 열)와 'X_all.csv'(전체 열)로 준다 → _all 우선
  function addCsv(name, text, out) {
    const base = name.split('/').pop();
    const kind =
      /영업리드_DB/.test(base) ? 'lead' :
      /고객사_DB/.test(base) ? 'customer' :
      /\(구\)\s*박람회_DB/.test(base) ? 'expoOld' :
      /박람회_DB/.test(base) ? 'expo' :
      /\(구\)\s*실무_DB/.test(base) ? 'workOld' :
      /실무_DB/.test(base) ? 'work' :
      /강성찬|최원우|오교진/.test(base) ? 'personal:' + base.match(/강성찬|최원우|오교진/)[0] :
      null;
    if (!kind) return;
    const all = /_all\.csv$/i.test(base);
    if (out.csv[kind] && out.csv[kind].all && !all) return;
    out.csv[kind] = { all, rows: parseCsv(text) };
  }

  // ── 합치기 ──
  function build(src, existing) {
    const companies = []; const byKey = new Map(); const review = [];
    const add = (c) => {
      const k = keyOf(c.name); if (!k) return null;
      const list = byKey.get(k) || [];
      const r = region(c.address);
      let hit = list.find((x) => !r || !region(x.address) || region(x.address) === r);
      if (hit) {
        for (const [f, v] of Object.entries(c)) {
          if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
          if (f === 'tags') hit.tags = [...new Set([...hit.tags, ...v])];
          else if (f === 'notes') hit.notes = hit.notes ? hit.notes + '\n' + v : v;
          else if (f === '_stageDate') { if (!hit._stageDate || v > hit._stageDate) { hit._stageDate = v; if (c.stage) hit.stage = c.stage; if (c.run_status !== undefined) hit.run_status = c.run_status; } }
          else if (f === 'stage' || f === 'run_status') { if (!hit._stageDate && !c._stageDate && f === 'stage' && rank(v) > rank(hit.stage)) hit.stage = v; }
          else if (hit[f] == null || hit[f] === '') hit[f] = v;
        }
        hit._sources.add(c._src);
        return hit;
      }
      const n = { tags: [], _sources: new Set([c._src]), ...c, name: clean(c.name), name_key: k };
      delete n._src;
      if (list.length) { n.needs_review = true; n.review_reason = `같은 이름 '${n.name}'이 다른 지역(${region(list[0].address)})에도 있음`; review.push(n); }
      n.import_key = list.length ? k + '#' + (r || list.length) : k;
      list.push(n); byKey.set(k, list); companies.push(n);
      return n;
    };
    const rank = (s) => ({ 뿌러짐: 0, 가망: 1, 결정업체: 2, 결제: 3 }[s] ?? 1);
    const ownerOf = (raw, stage) => { const p = person(raw); return p === '이채원' && stage === '가망' ? null : p; };

    // 1) 노션 영업리드 (URL 칸에 주소가 들어간 경우가 대부분)
    for (const r of src.csv.lead?.rows || []) {
      const u = clean(r['URL']); const stage = ['가망', '결정업체', '결제', '뿌러짐'].includes(r['세부상태']) ? r['세부상태'] : '가망';
      add({ _src: '노션 영업리드', name: r['프로젝트명'], address: isAddr(u) ? u : null, map_url: /^https?:/.test(u) ? u : null,
        phone: phone(r['전화번호']), sales_owner_name: ownerOf(r['담당자'], stage), stage, notes: clean(r['비고']) || null,
        _stageDate: date(r['입금일']), lead_source: 'notion', tags: ['노션'] });
    }
    // 2) 노션 고객사 (연락처·주소·지도·대표 특징·진행 상태)
    const custRun = { '진행 중': '진행 중', '진행 종료': '계약종료', '환불': '환불', '시작 전': '진행 중' };
    const notionPaid = [];
    for (const r of src.csv.customer?.rows || []) {
      const u = clean(r['URL']); const stage = ['가망', '결정업체', '결제', '뿌러짐'].includes(r['가망 상태']) ? r['가망 상태'] : '가망';
      const parent = clean(r['상위 항목']).replace(/\s*\(https?:[^)]*\)/g, '');
      const c = add({ _src: '노션 고객사', name: r['프로젝트명'], address: clean(r['지번 주소']) || (isAddr(u) ? u : null), map_url: /^https?:/.test(u) ? u : null,
        phone: phone(r['대표 연락처']), rep_note: clean(r['대표 특징']) || null, sales_owner_name: ownerOf(r['담당자'], stage),
        stage, run_status: stage === '결제' ? (custRun[r['진행 상태']] || '진행 중') : null, brand: parent || null,
        _stageDate: date(r['입금일']), lead_source: 'notion', tags: ['노션'] });
      if (c && stage === '결제') notionPaid.push({ c, r });
    }
    // 3) 노션 개인 DB (강성찬·최원우·오교진)
    for (const [k, v] of Object.entries(src.csv)) {
      if (!k.startsWith('personal:')) continue; const who = k.split(':')[1];
      for (const r of v.rows) {
        const u = clean(r['URL']); const stage = ['가망', '결정업체', '결제', '뿌러짐'].includes(r['세부상태']) ? r['세부상태'] : '가망';
        add({ _src: '노션 ' + who + ' DB', name: r['업체명'], address: clean(r['지번 주소']) || null, map_url: /^https?:/.test(u) ? u : null,
          phone: phone(r['대표 연락처']), store_phone: phone(r['매장 연락처']), rep_note: clean(r['대표 특징']) || null,
          sales_owner_name: who, stage, notes: clean(r['텍스트']) || null, lead_source: 'notion', tags: ['노션', who + ' DB'] });
      }
    }
    // 4) 박람회 (새·예전)
    for (const kind of ['expo', 'expoOld']) for (const r of src.csv[kind]?.rows || []) {
      const fair = clean(r['박람회'] || r['선택']); const seg = clean(r['고객'] || r['창업 여/부']);
      add({ _src: '노션 박람회', name: r['업체명'], phone: phone(r['전화번호']), rep_name: clean(r['성함']) || null,
        sales_owner_name: person(r['담당자']), stage: '가망', lead_source: 'expo', tags: ['박람회', fair, seg].filter(Boolean),
        notes: [fair && `박람회: ${fair}`, date(r['날짜']) && `상담일: ${date(r['날짜'])}`, clean(r['진행도']) && `진행도: ${clean(r['진행도'])}`].filter(Boolean).join(' · ') || null });
    }

    // 5) 엑셀 총관리 → 업체 + 계약(이력) + 실행 항목
    const contracts = [], deliverables = [], holds = [], rounds = [], works = [];
    const runOf = { 계약종료: '계약종료', 홀딩중: '홀딩', 홀딩: '홀딩', 신규계약: '진행 중', 재계약: '진행 중', 환불: '환불', '양도(신규)': '진행 중', '양도(기존)': '양도', 매출보장: '진행 중' };
    const sheet = src.excel?.['총관리'] || [];
    sheet.slice(1).forEach((r, i) => {
      if (!r || !clean(r[2]) || clean(r[0]) === '생성용') return;
      const paid = date(r[6]);
      const c = add({ _src: '엑셀 총관리', name: r[2], address: clean(r[3]) || null, rep_name: clean(r[4]) || null, stage: '결제',
        sales_owner_name: person(r[1]), _stageDate: paid || '0000', run_status: runOf[clean(r[0])] || '진행 중', lead_source: 'excel', tags: ['엑셀'] });
      if (!c) return;
      const amt = num(r[5]); const ck = `x:${c.import_key}:${paid || i}:${amt ?? ''}`;
      const ct = { _company: c, import_key: ck, kind: clean(r[0]) || null, status: clean(r[0]) || null,
        amount_won: amt == null ? null : Math.round(amt * 10000), paid_at: paid, period_months: months(r[7]), period_text: clean(r[7]) || null,
        extension_text: clean(r[8]) || null, renew_due: date(r[9]), final_renew_at: date(r[11]), renewed: clean(r[12]) || null,
        owner_name: person(r[1]), memo: [clean(r[10]) && `홀딩: ${clean(r[10])}`, clean(r[28]), clean(r[29]) && `재계약: ${clean(r[29])}`].filter(Boolean).join(' / ') || null };
      contracts.push(ct);
      // 실행 항목: [수량, 요청, 완료, 잔여] — 엑셀 열 순서
      [['기자단', 14, 15, 16], ['영수증', 18, 19, 20], ['인스타', 22, 23, 24], ['SEO', 26, null, 27]].forEach(([item, p, q, d]) => {
        const planned = num(r[p]), requested = q == null ? null : num(r[q]), done = num(r[d]);
        if (!planned && !requested && !done) return;
        deliverables.push({ _contract: ct, _company: c, import_key: ck + ':' + item, item, planned, requested, done: done || 0 });
      });
    });

    // 6) 노션에만 있는 결제 업체 → 계약 1건
    for (const { c, r } of notionPaid) {
      if (contracts.some((x) => x._company === c)) continue;
      contracts.push({ _company: c, import_key: `n:${c.import_key}:${date(r['입금일']) || ''}`, kind: '노션 결제', status: clean(r['진행 상태']) || null,
        amount_won: num(r['입금']) || null, paid_at: date(r['입금일']), renew_due: date(r['종료 예정일']), owner_name: person(r['담당자']), memo: clean(r['실비']) ? `실비 ${clean(r['실비'])}` : null });
    }

    // 7) 홀딩업체 시트: A~E = 업체·진행회차·총회차·시작일·사유 / G = 폐업 업체
    (src.excel?.['홀딩업체'] || []).slice(1).forEach((r, i) => {
      if (r && clean(r[0])) {
        const c = add({ _src: '엑셀 홀딩', name: r[0], stage: '결제', run_status: undefined, lead_source: 'excel', tags: ['엑셀'] });
        if (c) { if (!c.run_status) c.run_status = '홀딩'; holds.push({ _company: c, import_key: `h:${c.import_key}:${i}`, progress: clean(r[1]) || null, total_rounds: clean(r[2]) || null, started_at: date(r[3]), reason: clean(r[4]) || null }); }
      }
      if (r && clean(r[6])) { const c = add({ _src: '엑셀 폐업', name: r[6], stage: '결제', lead_source: 'excel', tags: ['폐업'] }); if (c && !c.tags.includes('폐업')) c.tags.push('폐업'); }
    });
    // 8) 특이업체 시트: B = 업체, C = 내용 → 특이사항
    (src.excel?.['특이업체'] || []).forEach((r) => {
      if (!r || !clean(r[1]) || clean(r[1]) === '업체명' || !clean(r[2])) return;
      const ended = /\(종료\)/.test(clean(r[1])); const name = clean(r[1]).replace(/\((종료|진행중)\)/g, '').trim();
      const c = add({ _src: '엑셀 특이업체', name, stage: '결제', lead_source: 'excel' });
      if (c && ended && !c.run_status) c.run_status = '계약종료';
      if (c) c.notes = c.notes ? c.notes + '\n' + clean(r[2]) : String(r[2]).trim();
    });
    // 9) 달력 시트: 날짜 칸 아래에 '업체 (9모/12회차)' → 회차 + 매월 모집일
    const cal = src.excel?.['달력'] || [];
    for (let y = 0; y < cal.length - 1; y++) {
      const days = cal[y] || [], cells = cal[y + 1] || [];
      if (!days.some((v) => typeof v === 'number')) continue;
      days.forEach((d, x) => {
        if (typeof d !== 'number' || !cells[x]) return;
        String(cells[x]).split('\n').map((s) => s.trim()).filter(Boolean).forEach((line, j) => {
          const m = line.match(/^(.+?)\s*\(([^)]*)\)\s*(.*)$/); if (!m) return;
          const c = add({ _src: '엑셀 달력', name: m[1].replace(/[\/·]+$/, ''), stage: '결제', lead_source: 'excel' }); if (!c) return;
          c.recruit_days = [...new Set([...(c.recruit_days || []), d])].sort((a, b) => a - b);
          const [cur, tot] = m[2].split('/'); const total = num((tot || '').replace(/회차?.*/, ''));
          const no = num((cur || '').match(/^\d+/)?.[0]);
          const state = /완/.test(cur) ? '완료' : /-\d|추가|</.test(cur) ? '추가' : /모/.test(cur) ? '모집' : '진행';
          rounds.push({ _company: c, import_key: `r:${c.import_key}:${d}:${j}`, round_label: clean(cur) || null, round_no: no, total_rounds: total, state,
            memo: [`매월 ${d}일 모집`, clean(m[3])].filter(Boolean).join(' · ') });
        });
      });
    }
    // 10) 노션 실무_DB (새·예전) → 작업 기록
    for (const kind of ['work', 'workOld']) (src.csv[kind]?.rows || []).forEach((r, i) => {
      const cname = clean(r['고객사']) || clean(r['고객사 연결']).replace(/\s*\(https?:[^)]*\)/g, ''); if (!cname) return;
      let c = companies.find((x) => x.name_key === keyOf(cname)) || companies.find((x) => x.brand && keyOf(x.brand) === keyOf(cname));
      if (!c) { c = add({ _src: '노션 실무', name: cname, stage: '결제', run_status: '진행 중', lead_source: 'notion', tags: ['노션'] }); c.needs_review = true; c.review_reason = '실무_DB에만 있는 고객사'; review.includes(c) || review.push(c); }
      works.push({ _company: c, import_key: `w:${kind}:${i}:${c.import_key}`, title: clean(r['작업내용']) || clean(r['상위 항목']).replace(/\s*\(https?:[^)]*\)/g, '') || null,
        item: clean(r['채널/품목']) || null, qty: clean(r['작업수량']) || null, vendor: clean(r['외주사']) || null, pm_name: person(r['PM']), status: clean(r['상태']) || null,
        scheduled_on: date(r['실무 일정']), done_on: date(r['완료일']), amount_won: num(r['결제금액']) || null });
    });

    // 브랜드: 같은 첫 단어로 시작하는 지점이 2곳 이상이면 브랜드로 묶음 (예: 복호두 ○○점)
    const first = new Map();
    companies.forEach((c) => { const w = c.name.split(' ')[0]; if (w.length >= 2) first.set(w, (first.get(w) || 0) + 1); });
    const GENERIC = new Set(['카페', '커피', '더', '우리', '원조', '진짜', '참', '왕']);
    companies.forEach((c) => { const w = c.name.split(' ')[0]; if (!c.brand && !GENERIC.has(w) && first.get(w) >= 2 && (c.name.includes(' ') || c.name === w)) c.brand = w; });
    companies.forEach((c) => { if (c.stage === '결제' && !c.run_status) c.run_status = '진행 중'; if (c.stage !== '결제') c.run_status = null; });
    // 이미 DB에 있는 업체는 건너뜀 (덮어쓰지 않음)
    const have = new Set(existing);
    return { companies, contracts, deliverables, holds, rounds, works, review, skip: companies.filter((c) => have.has(c.import_key)).length };
  }

  // ── 저장 ──
  async function save(res, onProgress) {
    const adminByName = Object.fromEntries(Object.entries(admins).map(([id, n]) => [n, id]));
    const master = Object.keys(admins).find((id) => adminRoles[id] === 'master');
    const uid = (n) => (n && (adminByName[n] || (n === '이채원' && master))) || null;
    const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    const idOf = new Map();
    const rowsC = res.companies.map((c) => ({
      name: c.name, name_key: c.name_key, brand: c.brand || null, address: c.address || null, phone: c.phone || null, store_phone: c.store_phone || null,
      map_url: c.map_url || null, rep_name: c.rep_name || null, rep_note: c.rep_note || null, sales_owner_name: c.sales_owner_name || null, sales_owner: uid(c.sales_owner_name),
      stage: c.stage || '가망', run_status: c.stage === '결제' ? (c.run_status || '진행 중') : null, lead_source: c.lead_source || null, tags: c.tags.filter(Boolean),
      notes: c.notes || null, recruit_days: c.recruit_days || null, needs_review: !!c.needs_review, review_reason: c.review_reason || null, import_key: c.import_key,
    }));
    let done = 0; const total = rowsC.length + res.contracts.length + res.deliverables.length + res.holds.length + res.rounds.length + res.works.length;
    const step = (n) => { done += n; onProgress(done, total); };
    for (const part of chunk(rowsC, 500)) {
      const { error } = await sb.from('companies').upsert(part, { onConflict: 'import_key', ignoreDuplicates: true });
      if (error) throw new Error('업체 저장 실패: ' + error.message);
      step(part.length);
    }
    for (const part of chunk(rowsC.map((r) => r.import_key), 300)) {
      const { data, error } = await sb.from('companies').select('id,import_key').in('import_key', part);
      if (error) throw new Error('업체 확인 실패: ' + error.message);
      data.forEach((r) => idOf.set(r.import_key, r.id));
    }
    const cid = (x) => idOf.get(x._company.import_key);
    const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
    const put = async (table, list, extra) => {
      const map = new Map();
      for (const part of chunk(list, 400)) {
        const rows = part.map((x) => ({ ...strip(x), company_id: cid(x), ...(extra ? extra(x) : {}) })).filter((r) => r.company_id);
        const { error } = await sb.from(table).upsert(rows, { onConflict: 'import_key', ignoreDuplicates: true });
        if (error) throw new Error(`${table} 저장 실패: ` + error.message);
        step(part.length);
      }
      return map;
    };
    await put('contracts', res.contracts);
    const ctId = new Map();
    for (const part of chunk(res.contracts.map((c) => c.import_key), 300)) {
      const { data } = await sb.from('contracts').select('id,import_key').in('import_key', part);
      (data || []).forEach((r) => ctId.set(r.import_key, r.id));
    }
    await put('deliverables', res.deliverables, (d) => ({ contract_id: ctId.get(d._contract.import_key) || null }));
    await put('holds', res.holds);
    await put('rounds', res.rounds);
    await put('work_logs', res.works);
  }

  // ── 화면 ──
  const LABEL = { lead: '노션 영업리드', customer: '노션 고객사', expo: '노션 박람회', expoOld: '노션 (구)박람회', work: '노션 실무', workOld: '노션 (구)실무' };
  let adminRoles = {};
  function mount(box) {
    const input = el('input', { type: 'file', multiple: true, accept: '.xlsx,.xls,.zip,.csv', className: 'fi', id: 'impFiles' });
    const out = el('div', { className: 'imp-out' });
    const run = el('button', { className: 'btn primary', type: 'button', text: '분석하기 (저장 안 함)', onclick: analyze });
    let result = null;
    async function analyze() {
      if (!input.files.length) { toast('파일을 먼저 선택하세요'); return; }
      run.disabled = true; out.replaceChildren(el('div', { className: 'hint', text: '파일을 읽고 합치는 중… (수천 건이면 10초쯤 걸려요)' }));
      try {
        const [src, ex, ad] = await Promise.all([readFiles([...input.files]),
          sb.from('companies').select('import_key').limit(20000), sb.from('admins').select('user_id,role')]);
        adminRoles = Object.fromEntries((ad.data || []).map((a) => [a.user_id, a.role]));
        result = build(src, (ex.data || []).map((r) => r.import_key));
        renderPreview(src);
      } catch (e) { out.replaceChildren(el('div', { className: 'err', text: '분석 실패: ' + e.message })); }
      run.disabled = false;
    }
    function renderPreview(src) {
      const r = result, cs = r.companies;
      const cnt = (f) => cs.filter(f).length;
      const srcCount = {}; cs.forEach((c) => c._sources.forEach((s) => { srcCount[s] = (srcCount[s] || 0) + 1; }));
      const merged = cnt((c) => c._sources.size > 1);
      const kpi = (l, v, sub) => el('div', { className: 'kpi' }, [el('div', { className: 'kpi-lbl', text: l }), el('div', { className: 'kpi-val', text: v.toLocaleString() }), el('div', { className: 'kpi-sub', text: sub })]);
      const tbl = (head, rows) => el('div', { className: 'card tbl-wrap' }, el('table', { className: 'tbl perf' }, [
        el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))), el('tbody', {}, rows.map((row) => el('tr', {}, row.map((v) => el('td', { text: v == null ? '—' : String(v) })))))]));
      const sample = cs.filter((c) => c.stage === '결제').slice(0, 8);
      const files = src.sheets.filter((x) => x.kind).map((x) => `엑셀 ${x.kind}(${x.file} › ${x.sheet})`).concat(Object.entries(src.csv).map(([k, v]) => `${LABEL[k] || ('노션 ' + k.split(':')[1] + ' DB')} ${v.rows.length.toLocaleString()}행`));
      const go = el('button', { className: 'btn primary lg', type: 'button', text: `저장하기 (업체 ${(cs.length - r.skip).toLocaleString()}곳)`, onclick: async () => {
        go.disabled = true; const bar = el('div', { className: 'hint', text: '저장 중…' }); go.after(bar);
        try { await save(r, (d, t) => { bar.textContent = `저장 중… ${d.toLocaleString()} / ${t.toLocaleString()}`; }); bar.textContent = '✅ 저장 완료. 같은 파일로 다시 실행해도 중복 저장되지 않습니다.'; toast('가져오기 완료'); }
        catch (e) { bar.className = 'err'; bar.textContent = e.message + ' — 다시 누르면 이어서 저장합니다(이미 저장된 건 건너뜀).'; go.disabled = false; }
      } });
      out.replaceChildren(...[
        el('div', { className: 'hint', text: '읽은 파일: ' + files.join(' · ') }),
        src.sheets.filter((x) => !x.kind).length ? el('div', { className: 'err', text: '인식 못한 엑셀 시트 (화면을 캡처해서 보내주세요): ' + src.sheets.filter((x) => !x.kind).map((x) => `${x.file} › ${x.sheet} [첫 줄: ${x.head || '비어 있음'}]`).join(' / ') }) : null,
        !src.excel ? el('div', { className: 'err', text: '엑셀 파일이 없습니다. 계약 업체는 엑셀 총관리에서 가져옵니다.' }) : null,
        el('div', { className: 'kpi-row' }, [
          kpi('업체 (합친 뒤)', cs.length, `여러 출처에서 합쳐진 업체 ${merged.toLocaleString()}곳`),
          kpi('결제 업체', cnt((c) => c.stage === '결제'), `진행 중 ${cnt((c) => c.stage === '결제' && c.run_status === '진행 중')} · 홀딩 ${cnt((c) => c.run_status === '홀딩')} · 종료 ${cnt((c) => c.run_status === '계약종료')} · 환불 ${cnt((c) => c.run_status === '환불')}`),
          kpi('가망 업체', cnt((c) => c.stage !== '결제'), `가망 ${cnt((c) => c.stage === '가망')} · 결정 ${cnt((c) => c.stage === '결정업체')} · 뿌러짐 ${cnt((c) => c.stage === '뿌러짐')}`),
          kpi('확인 필요', r.review.length, '같은 이름·다른 지역 등'),
        ]),
        el('div', { className: 'kpi-row' }, [
          kpi('계약 이력', r.contracts.length, '엑셀 행 + 노션 결제'),
          kpi('실행 항목', r.deliverables.length, '기자단·영수증·인스타·SEO'),
          kpi('체험단 회차', r.rounds.length, '달력 시트'),
          kpi('홀딩·작업 기록', r.holds.length + r.works.length, `홀딩 ${r.holds.length} · 작업 ${r.works.length}`),
        ]),
        r.skip ? el('div', { className: 'hint', text: `이미 저장된 업체 ${r.skip.toLocaleString()}곳은 건너뜁니다.` }) : null,
        el('div', { className: 'sec-t', text: '출처별 업체 수' }),
        tbl(['출처', '업체'], Object.entries(srcCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v.toLocaleString()])),
        el('div', { className: 'sec-t', text: '결제 업체 예시' }),
        tbl(['업체', '브랜드', '상태', '영업 담당', '계약 수', '주소'], sample.map((c) => [c.name, c.brand, c.run_status, c.sales_owner_name, r.contracts.filter((x) => x._company === c).length, c.address])),
        r.review.length ? el('div', { className: 'sec-t', text: `확인 필요 ${r.review.length}곳 (저장은 되고, 업체 화면에서 '확인 필요'로 표시)` }) : null,
        r.review.length ? tbl(['업체', '주소', '이유'], r.review.slice(0, 30).map((c) => [c.name, c.address, c.review_reason])) : null,
        go,
      ].filter(Boolean));
    }
    box.replaceChildren(
      el('div', { className: 'card imp-card' }, [
        el('div', { className: 'card-t' }, ['데이터 가져오기', el('small', { text: '엑셀 총관리(.xlsx)와 노션 내보내기(.zip 또는 .csv)를 한 번에 선택하세요' })]),
        el('div', { className: 'imp-body' }, [input, run,
          el('div', { className: 'sub', text: '먼저 분석 결과를 보여주고, [저장하기]를 눌러야 저장됩니다. 같은 파일을 다시 넣어도 중복으로 저장되지 않습니다.' })]),
      ]),
      out,
    );
  }
  window.CRM_IMPORT = { mount, _build: build, _readFiles: readFiles };
})();
