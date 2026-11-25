// ── 체험단 발표 도우미: ① 명단(리뷰노트 엑셀 → TXT 양식 · 네이버 닉네임 · AI 특이사항) ② 점주 안내 멘트 ③ 일정 이미지 + 구글 캘린더 ④ 블로거 가이드 ──
// admin.html의 sb·el·me·toast·todayKst 사용. window.CRM_CAMP.open({ co, cycle, cfg }) / .pick(events, cfg)
// 저장: rounds(company_id, cycle_on, round_no, teams, review_weeks, deadline) + roster(nickname, name, phone, blog_url, note, ...)
// 브랜드 공통 블로거 가이드: crm_settings 'guide_brand:<브랜드>' · 지점 특이사항: guidelines(kind '체험단') 최신
(function () {
  const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const DOWK = ['일', '월', '화', '수', '목', '금', '토'];
  const STEP_C = { 모집: '#3B6FC4', 발표: '#B7791F', 체험: '#3F9A76', 마감: '#D9572B', '2차마감': '#A23E62' }; // 차분한 톤, 색상(파랑·황토·초록·주황·자주)으로 구분
  const LOGO = '/assets/brand/muyi-logo-tagline.png';
  let logoImg = null; const logoReady = new Promise((ok) => { const i = new Image(); i.onload = () => { logoImg = i; ok(); }; i.onerror = () => ok(); i.src = LOGO; });
  const pad = (n) => String(n).padStart(2, '0');
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8)}`;
  const mdw = (s) => `${md(s)}(${DOWK[parse(s).getDay()]})`;
  const kstShort = (t) => { const d = new Date(new Date(t).getTime() + 9 * 3600e3), y = d.getUTCFullYear(); return `${y !== new Date().getFullYear() ? y + '. ' : ''}${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const kmd = (s) => `${+s.slice(5, 7)}월 ${+s.slice(8)}일`;
  const blogId = (u) => { const m = String(u || '').match(/blog\.naver\.com\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; };
  const brandOf = (co) => (co.brand || String(co.name || '').split(/\s+/)[0] || '').trim();
  const loadLib = (src) => new Promise((ok, ng) => { if (window.XLSX) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('엑셀 라이브러리를 불러오지 못했습니다')); document.head.appendChild(s); });
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(`${what} 복사됨`); } catch { toast('복사 실패 — 직접 선택해서 복사하세요'); } };
  // ── 리뷰노트 북마크 (1개로 전부): 리뷰노트에 로그인된 브라우저에서 누르면 선정 명단을 CRM에 바로 저장 ──
  //  · 체험단 진행(캠페인) 화면(주소에 캠페인 번호)에서만 동작 → 그 캠페인 명단만. 다른 화면이면 안내만 (2026-11-20~)
  //  · 리뷰노트 계정은 저장하지 않음 (그 브라우저 로그인으로 리뷰노트 자체 API 호출). CRM에는 개인 키로 Edge Function rn-import에 보냄
  //  · 이 함수는 리뷰노트 페이지 안에서 실행되므로 바깥 변수를 쓰지 않는다 (KEY·FN은 북마크를 만들 때 문자열로 바꿔 넣음)
  function rnGrab() {
    (async () => {
      const KEY = '__RN_KEY__', FN = '__RN_FN__';
      const box = (() => { let b = document.getElementById('muyi-rn'); if (!b) { b = document.createElement('div'); b.id = 'muyi-rn'; b.style.cssText = 'position:fixed;z-index:2147483647;right:16px;top:16px;width:380px;max-height:80vh;overflow:auto;padding:16px;border-radius:12px;background:#1E10C7;color:#fff;font:13px/1.55 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3)'; document.body.appendChild(b); } return b; })();
      const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const say = (h) => { box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px"><b>MUYI · 리뷰노트 명단</b><button data-x style="border:0;background:none;color:#fff;cursor:pointer;font-size:16px">✕</button></div>' + h; box.querySelector('[data-x]').onclick = () => box.remove(); };
      try {
        if (!/reviewnote/.test(location.hostname)) { say('리뷰노트(reviewnote.co.kr)에서 눌러주세요.'); return; }
        const tok = (() => { for (const st of [localStorage, sessionStorage]) for (let i = 0; i < st.length; i++) { const k = st.key(i), v = st.getItem(k) || ''; if (!/token|auth|jwt|session/i.test(k)) continue; try { const j = JSON.parse(v); const t = j && (j.accessToken || j.token || j.access_token || (j.state && (j.state.accessToken || j.state.token))); if (typeof t === 'string') return t; } catch (e) {} if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) return v; } return null; })();
        const get = async (u) => { let r = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json' } }); if ((r.status === 401 || r.status === 403) && tok) r = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json', Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error(r.status === 401 ? '리뷰노트 로그인이 필요합니다' : '리뷰노트 응답 ' + r.status); return r.json(); };
        const arr = (x) => Array.isArray(x) ? x : x && typeof x === 'object' ? (['objects', 'data', 'items', 'list', 'applies', 'selectedApplies', 'results', 'rows', 'campaigns'].map((k) => x[k]).find(Array.isArray) || Object.values(x).map(arr).find((a) => a && a.length) || []) : [];
        const titleOf = (c) => c && (c.title || c.name || c.campaignName || (c.campaign && (c.campaign.title || c.campaign.name))) || '';
        const dates = (o, out = [], d = 0) => { if (o && typeof o === 'object' && d < 3) Object.values(o).forEach((v) => { if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) out.push(v.slice(0, 10)); else dates(v, out, d + 1); }); return out; };
        // 캠페인 찾기 (2026-11-24~): 주소의 숫자가 API 캠페인 번호와 다를 수 있어서, 내 캠페인 목록(advertiserCampaigns)에서
        //  ① 주소 숫자와 같은 id ② 화면 글자에 제목이 들어 있는 캠페인 순으로 찾고, 그 캠페인 id로 선정 명단을 가져온다
        const nums = [...new Set((location.pathname + location.search + location.hash).match(/\d{4,}/g) || [])];
        const nm = (t) => String(t || '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();
        const kd = (v) => { if (/T\d{2}:\d{2}/.test(v)) { const d = new Date(v); if (!isNaN(d)) return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10); } return v.slice(0, 10); };
        const dmap = (o, pre = '', out = {}, d = 0) => { if (o && typeof o === 'object' && d < 3) for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) out[pre + k] = kd(v); else if (v && typeof v === 'object' && !Array.isArray(v)) dmap(v, pre + k + '.', out, d + 1); } return out; };
        say('캠페인 찾는 중…');
        const all = [], errs = [];
        // ① 주소 숫자 = 캠페인 번호인 화면(/users/campaigns/completed/1081407 등, 리뷰노트 자체가 /api/campaign?id=N · /api/campaign/N/selectedApplies 호출) → 바로 사용
        let hit = null, det0 = null;
        for (const n0 of nums) { try { const j = await get('/api/campaign?id=' + n0); const d = j && (j.data || j.campaign || j); if (d && typeof d === 'object' && (titleOf(d) || d.id)) { hit = { id: n0, title: titleOf(d), raw: {} }; det0 = d; break; } } catch (e) { if (/로그인/.test(e.message)) throw e; errs.push(n0 + ' ' + e.message); } }
        if (!hit) for (let page = 0; page < 15; page++) {
          let objs = [];
          try { objs = arr(await get('/api/v2/campaigns/advertiserCampaigns?page=' + page)); } catch (e) { if (/로그인/.test(e.message)) throw e; errs.push('목록 ' + e.message); break; }
          if (!objs.length) break;
          objs.forEach((c) => { const id = c.id || c.campaignId || (c.campaign && c.campaign.id); if (id) all.push({ id: String(id), title: titleOf(c), raw: c }); });
          if (all.some((c) => nums.includes(c.id))) break;
        }
        if (!hit) hit = all.find((c) => nums.includes(c.id));
        if (!hit) { const pg = nm((document.title || '') + ' ' + (document.body.innerText || '').slice(0, 4000)); hit = all.filter((c) => nm(c.title).length >= 4 && pg.includes(nm(c.title))).sort((a, b) => nm(b.title).length - nm(a.title).length)[0]; }
        if (!hit && nums.length) for (const n0 of nums) { try { const rs = arr(await get('/api/campaign/' + n0 + '/selectedApplies')); if (rs.length) { hit = { id: n0, title: document.title, raw: {} }; break; } } catch (e) { if (/로그인/.test(e.message)) throw e; errs.push(n0 + ' ' + e.message); } }
        if (!hit) {
          // 못 찾으면 최근 캠페인에서 고르기
          const recent = all.slice(0, 12);
          say('이 화면의 캠페인을 찾지 못했습니다. 아래에서 골라주세요.' + (errs.length ? `<br><small style="opacity:.7">${esc(errs.slice(0, 3).join(' · '))}</small>` : '') + '<div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">' + recent.map((c, i) => `<button data-p="${i}" style="text-align:left;border:0;border-radius:6px;padding:6px 8px;cursor:pointer">${esc(c.title || '캠페인 ' + c.id)}</button>`).join('') + '</div>');
          hit = await new Promise((ok) => box.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => ok(recent[+b.dataset.p])));
        }
        say('선정 명단 가져오는 중…');
        const c0 = det0 ? null : await get('/api/campaign?id=' + hit.id).catch(() => null);
        const det = det0 || (c0 && (c0.data || c0.campaign || c0));
        const list = [{ id: hit.id, title: hit.title || titleOf(det) || document.title, dates: { ...dmap(hit.raw), ...dmap(det || {}) } }];
        let n = 0; const camps = [];
        for (const c of list) {
          say(`선정 명단 가져오는 중… ${++n}/${list.length}<br><small>${esc(c.title)}</small>`);
          try {
            const rows = arr(await get('/api/campaign/' + c.id + '/selectedApplies'));
            // 취소한 블로거도 같이 (계약 종료 때 취소팀 계산용): 취소 목록 주소 후보를 차례로 시도, '취소/cancel' 상태인 행만 추가
            const keyOf = (r) => String(r.id || r.applyId || r.applicationId || JSON.stringify(r).slice(0, 160));
            const seen = new Set(rows.map(keyOf));
            for (const u of ['cancelApplies', 'canceledApplies', 'cancelledApplies', 'applies?status=CANCEL', 'applies?status=CANCELED']) {
              try { arr(await get('/api/campaign/' + c.id + '/' + u)).filter((r) => /취소|cancel/i.test(JSON.stringify(r))).forEach((r) => { const k = keyOf(r); if (!seen.has(k)) { seen.add(k); rows.push({ ...r, __cancel: true }); } }); } catch (e) { if (/로그인/.test(e.message)) throw e; }
            }
            if (rows.length) camps.push({ ...c, rows });
          } catch (e) { if (/로그인/.test(e.message)) throw e; errs.push('명단 ' + e.message); }
        }
        if (!camps.length) { say('이 캠페인에 선정된 블로거가 없습니다.' + (errs.length ? `<br><small style="opacity:.7">${esc(errs.slice(0, 3).join(' · '))}</small>` : '')); return; }
        const send = async (cs) => { const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY, campaigns: cs }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'CRM 응답 ' + r.status); return j.results || []; };
        say(`CRM에 저장 중… (${camps.length}개 캠페인 · 닉네임·특이사항 정리)`);
        let res = await send(camps);
        const LBL = { saved: ['저장', '#7CF2B0'], updated: ['갱신', '#7CF2B0'], same: ['이미 저장', '#cfd2ff'], pick: ['업체 선택', '#FFD27A'], no_cycle: ['모집일 없음', '#FFB4B4'], conflict: ['확인 필요', '#FFB4B4'], empty: ['명단 없음', '#cfd2ff'], error: ['실패', '#FFB4B4'] };
        const paint = () => {
          const ok = res.filter((r) => r.status === 'saved' || r.status === 'updated').length;
          say(`<div style="margin:6px 0 10px">${ok}개 저장 · 전체 ${res.length}개</div>` + res.map((r, i) => { const [t, c] = LBL[r.status] || [r.status, '#fff'];
            return `<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,.18)"><div><b style="color:${c}">${t}</b> ${esc(r.company || r.title)} <small style="opacity:.7">${r.count}명${r.cancelled ? ' · 취소 ' + r.cancelled : ''}${r.round_no ? ' · ' + r.round_no + '회차' : ''}</small></div>` + (r.applied ? `<div style="font-size:12px;opacity:.9">달력 반영: ${esc(r.applied)}</div>` : '')
              + (r.link ? `<a href="${esc(r.link)}" target="_blank" style="color:#fff;font-weight:700">CRM에서 점주 안내 열기 ›</a>` : `<small style="opacity:.8">${esc(r.msg || '')}</small>`)
              + (r.status === 'pick' && r.candidates && r.candidates.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + r.candidates.map((cd) => `<button data-i="${i}" data-co="${esc(cd.id)}" style="border:0;border-radius:6px;padding:3px 8px;cursor:pointer">${esc(cd.name)}</button>`).join('') + '</div>' : '') + '</div>'; }).join(''));
          box.querySelectorAll('[data-co]').forEach((b) => b.onclick = async () => { const i = +b.dataset.i, cp = camps.find((c) => c.id === res[i].id); b.textContent = '저장 중…'; try { const [r] = await send([{ ...cp, company_id: b.dataset.co }]); res[i] = r; } catch (e) { res[i] = { ...res[i], status: 'error', msg: e.message }; } paint(); });
        };
        paint();
      } catch (e) { say('<div style="margin-top:6px">' + esc(e.message) + '</div><small style="opacity:.8">리뷰노트에 로그인된 상태인지 확인해주세요.</small>'); }
    })();
  }
  const RN_FN = 'https://pacyhanuwuizcxwoggen.supabase.co/functions/v1/rn-import';
  const rnBookmark = (key) => 'javascript:' + encodeURIComponent('(' + rnGrab.toString().replace('__RN_KEY__', key).replace('__RN_FN__', RN_FN) + ')()');
  // 개인 키: 북마크 안에만 있고 DB에는 sha256만 (rn_keys). 다시 만들면 예전 북마크는 멈춤
  async function rnNewKey() {
    const key = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('rn_keys').upsert({ user_id: user.id, key_hash: hash, created_at: new Date().toISOString(), last_used_at: null });
    if (error) throw error;
    return key;
  }
  // 리뷰노트 응답 → 명단 행. 칸 이름이 바뀌어도 값 모양으로 찾는다 (이름·연락처·블로그·신청메시지·등급·방문수)
  function rnRows(rows) {
    const flat = (o, pre = '', out = {}, d = 0) => { if (o && typeof o === 'object' && d < 4) for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, pre + k + '.', out, d + 1); else out[pre + k] = v; } return out; };
    const str = (v) => (v == null ? '' : String(v)).trim();
    return rows.map((r) => {
      const f = Object.entries(flat(r)).map(([k, v]) => [k, str(v)]).filter(([, v]) => v);
      const by = (re, test) => (f.find(([k, v]) => re.test(k) && (!test || test(v))) || [])[1] || '';
      const phone = (f.find(([, v]) => /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(v)) || [])[1] || by(/phone|mobile|tel|연락/i);
      const blog = (f.find(([, v]) => /blog\.naver\.com|m\.blog\.naver/.test(v)) || [])[1] || by(/blog|channel|sns|url|link/i, (v) => /^https?:/.test(v));
      const name = by(/(^|\.)(realName|userName|name|이름|성함)$/i, (v) => !/^https?:/.test(v)) || by(/name/i, (v) => !/^https?:|campaign/i.test(v));
      const msg = f.filter(([k]) => /message|msg|comment|content|reason|introduce|신청/i.test(k)).map(([, v]) => v).sort((a, b) => b.length - a.length)[0] || '';
      const grade = by(/grade|level|rank|등급/i);
      const visits = Number(by(/visit|daily|today|방문/i).replace(/[^\d]/g, '')) || null;
      const off = !!r.__cancel || /취소|cancel/i.test(f.filter(([k]) => /status|state|상태/i.test(k)).map(([, v]) => v).join(' '));
      return { blog, name, phone: window.fmtPhone ? window.fmtPhone(phone) || '' : phone, msg, grade, visits, area: by(/address|addr|area|주소/i), score: by(/score|점수/i), nickname: by(/nick/i), note: '', post: by(/review.*url|post.*url|reviewUrl|postUrl/i, (v) => /^https?:/.test(v)), off };
    }).filter((r) => r.name || r.blog || r.phone);
  }
  // 발표일은 따로 정해짐(달력에서 고름) → 넘어오면 그 날짜, 마감은 넘어온 날짜 또는 발표 + (마감−발표) 간격
  const period = (cycle, cfg, o = {}) => { const ann = o.announce || addDays(cycle, cfg.off.발표 || 0), dl = o.deadline || addDays(ann, (cfg.off.마감 || 0) - (cfg.off.발표 || 0)); return { recruitFrom: cycle, recruitTo: ann, announce: ann, reviewFrom: addDays(ann, 1), reviewTo: addDays(dl, -1), deadline: dl }; };

  if (!document.getElementById('crm-camp-css')) {
    const st = document.createElement('style'); st.id = 'crm-camp-css';
    st.textContent = `
.ca-pm{width:min(1040px,100%)!important}
.ca-rdsel{width:auto!important;height:30px;font-size:12px;font-weight:700;color:var(--accent);border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
.ca-sname{width:auto!important;max-width:200px;height:28px;font-size:12px}
.ca-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
@media (max-width:720px){.ca-info{grid-template-columns:1fr}}
.ca-head{display:grid;gap:10px;padding:16px 20px;border-bottom:1px solid var(--line)}
.ca-title{display:flex;align-items:center;gap:10px}
.ca-title h3{font-size:18px;font-weight:800;letter-spacing:-.02em;margin-right:auto}
.ca-title .rd{font-size:12px;font-weight:700;color:#fff;background:var(--accent);border-radius:10px;padding:2px 9px}
.ca-tl{display:flex;flex-wrap:wrap;gap:6px}
.ca-tl span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:14px;background:color-mix(in srgb,var(--c) 10%,var(--surface));color:color-mix(in srgb,var(--c) 75%,var(--t1));border:1px solid color-mix(in srgb,var(--c) 25%,var(--line))}
.ca-tl span i{width:7px;height:7px;border-radius:50%;background:var(--c)}
.ca-steps{display:flex;gap:4px;padding:0 20px;border-bottom:1px solid var(--line);overflow-x:auto}
.ca-steps button{height:42px;padding:0 14px;border:0;background:none;font-weight:700;font-size:13px;color:var(--t3);border-bottom:2px solid transparent;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.ca-steps button .no{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;background:var(--muted);color:var(--t2)}
.ca-steps button.on{color:var(--t1);border-bottom-color:var(--accent)}
.ca-steps button.on .no{background:var(--accent);color:#fff}
.ca-steps button.ok .no{background:var(--green);color:#fff}
.ca-body{padding:16px 20px 20px;display:grid;gap:14px;overflow-y:auto;min-height:0;flex:1}
.ca-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.ca-drop{display:grid;place-items:center;gap:6px;padding:22px;border:2px dashed var(--line-strong);border-radius:12px;background:var(--surface-2);text-align:center;cursor:pointer;color:var(--t2);font-size:13px}
.ca-drop:hover,.ca-drop.over{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 5%,var(--surface))}
.ca-drop b{font-size:15px;color:var(--t1)}
.ca-tbl{width:100%;border-collapse:collapse;font-size:12px}
.ca-tbl th{position:sticky;top:0;background:var(--muted);text-align:left;font-weight:600;color:var(--t3);padding:7px 8px;border-bottom:1px solid var(--line-strong)}
.ca-tbl td{padding:6px 8px;border-bottom:1px solid var(--line-2);vertical-align:middle}
.ca-tbl tr.off td{opacity:.45;text-decoration:line-through}
.ca-tbl .nick input{width:110px;height:28px}
.ca-tbl .note input{width:100%;min-width:180px;height:28px}
.ca-tbl .cmsg{color:var(--t3);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ca-tbl .num{text-align:right;font-variant-numeric:tabular-nums}
.ca-scroll{max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px}
.ca-out{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.ca-box textarea{width:100%;min-height:220px;font-family:inherit;font-size:13px;line-height:1.55}
.ca-out textarea{width:100%;min-height:320px;font-family:inherit;font-size:13px;line-height:1.55;white-space:pre}
.ca-box{display:grid;gap:8px}
.ca-box .bar{display:flex;align-items:center;gap:8px}
.ca-box .bar b{font-size:13px;margin-right:auto}
.ca-img{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
.ca-img canvas{width:100%;height:auto;border-radius:12px;border:1px solid var(--line);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.ca-links{display:grid;gap:10px}
.ca-link{display:grid;gap:6px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
.ca-link b{font-size:13px}
.ca-link small{color:var(--t3);font-size:11px}
.ca-link .acts{display:flex;gap:6px}
.ca-hint{font-size:12px;color:var(--t3)}
.ca-prog{height:4px;border-radius:2px;background:var(--muted);overflow:hidden}
.ca-prog i{display:block;height:100%;background:var(--accent);transition:width .3s}
.ca-pick{display:grid;gap:6px}
.ca-st{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px}
.ca-st.ok{background:color-mix(in srgb,#10B981 15%,var(--surface));color:#047857}
.ca-st.no{background:color-mix(in srgb,#E11D48 12%,var(--surface));color:#BE123C}
.ca-st.off{background:var(--muted);color:var(--t3)}
.ca-empty{display:grid;justify-items:center;gap:8px;padding:28px 16px;text-align:center}
.ca-empty img{width:120px;height:auto}
.ca-empty b{font-size:16px}
.ca-empty span{font-size:13px;color:var(--t3);max-width:420px}
.ca-tbl a{color:var(--accent);font-weight:600}
.ca-pick button{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);text-align:left;cursor:pointer}
.ca-pick button:hover{border-color:var(--accent)}
.ca-pick button b{font-size:14px}
.ca-pick button span{margin-left:auto;font-size:12px;color:var(--t3)}
.ca-rn{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ca-rn-t{font-size:12px;color:var(--t3);white-space:nowrap}
.ca-rn .ca-paste{flex:1;min-width:240px;height:34px;border-style:dashed}
.ca-row .ca-rn{flex-wrap:nowrap}.ca-row .ca-rn .ca-paste{min-width:0;height:38px}.ca-row .ca-rn .btn{height:38px;white-space:nowrap}
.rn-pm{width:min(640px,100%)!important;height:auto!important}
.rn-how ol{margin:0;padding-left:20px;display:grid;gap:10px}
.rn-how li b{display:block;font-size:13.5px}
.rn-how li small{display:block;color:var(--t3);font-size:12px;line-height:1.5}
.rn-drag{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:14px;border:1px dashed var(--line-strong);border-radius:12px;background:var(--surface-2)}
.rn-bm{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:18px;background:var(--accent);color:#fff!important;font-weight:800;text-decoration:none;cursor:grab}
.rn-drag span{font-size:12.5px;color:var(--t2)}
.rn-how .bar{display:flex;justify-content:flex-end}
.ca-pm{--ph:min(860px,calc(var(--vh,100vh) - 32px));height:var(--ph)}
.ca-body{scrollbar-gutter:stable;overflow-anchor:none}
.ca-panel{display:grid;gap:12px;align-content:start;min-width:0}
.ca-panel[hidden]{display:none}
.ca-foot{display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--line);background:var(--surface);border-radius:0 0 14px 14px;min-height:60px}
.ca-foot .sp{flex:1}
.ca-cnt{font-size:13px;white-space:nowrap}
.ca-row{grid-template-columns:minmax(150px,210px) 84px 104px minmax(0,1fr);align-items:end}
.ca-f{display:grid;gap:4px;min-width:0}
.ca-drop.mini{padding:0 14px;height:38px;border-width:1px;border-style:dashed;grid-auto-flow:column;justify-content:start;font-size:12px}
.ca-drop.mini b{font-size:13px;font-weight:600;color:var(--t2)}
.ca-drop.mini span{display:none}
.ca-det summary{cursor:pointer;font-size:12px;font-weight:600;color:var(--t2);padding:4px 0}
textarea.ca-txt{width:100%;min-height:200px;margin-top:8px;font-family:inherit;font-size:12px;line-height:1.5;white-space:pre}
.ca-two{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:18px;align-items:start}
.ca-col{display:flex;flex-direction:column;gap:10px;min-width:0}
.ca-sec{display:flex;align-items:center;gap:8px;min-height:30px}
.ca-sec b{font-size:13px;margin-right:auto}
.ca-sec .ca-when{font-size:11px;color:var(--t3);white-space:nowrap}
.ca-sec b:has(+.ca-when){margin-right:0}
.ca-sec .ca-when{margin-right:auto}
.ca-hpm{width:min(720px,100%)!important;height:auto!important;max-height:calc(var(--vh,100vh) - 32px)}
.ca-hist{display:grid;gap:6px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
.ca-hist pre{margin:0;max-height:180px;overflow:auto;white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.55;color:var(--t2)}
textarea.ca-msg{width:100%;height:calc(var(--ph) - 300px);min-height:260px;resize:none;font-family:inherit;font-size:13px;line-height:1.6;white-space:pre-wrap}
textarea.ca-g{width:100%;min-height:220px;font-family:inherit;font-size:13px;line-height:1.55}
textarea.ca-g.sm{min-height:100px}
.ca-send{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}
.ca-send>div{display:grid;gap:4px;justify-items:start;min-width:0}
.ca-send b{font-size:13px}
.ca-send small{font-size:12px;color:var(--t3);line-height:1.45}
.ca-send.ca-v{display:grid;gap:8px;justify-items:start;align-content:start}
.ca-imgp>.ca-col,.ca-two>.ca-col{align-self:start}
.ca-send .acts{display:flex;gap:6px;flex-wrap:wrap}
.ca-thumb{width:80px;aspect-ratio:1080/1350;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:copy;flex:none;background:#fff}
.ca-ico{width:80px;display:grid;place-items:center;font-size:24px;flex:none}
.ca-imgp{grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}
.ca-imgbox{display:grid;place-items:center;background:var(--surface-2);border-radius:12px;padding:12px}
.ca-big{height:calc(var(--ph) - 270px);max-width:100%;aspect-ratio:1080/1350;object-fit:contain;border-radius:10px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.1)}
.ca-tbl .cphone{white-space:nowrap}
.ca-ver{padding:8px 10px;border-radius:10px;background:var(--accent-50)}
.ca-ver>b{margin-right:0!important}
.ca-kw{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);font-size:13px}
.ca-kw span{display:inline-flex;gap:6px;align-items:baseline}.ca-kw b{font-size:11px;font-weight:800;color:var(--accent);background:var(--accent-50);border-radius:5px;padding:1px 6px}
.ca-kw .btn{margin-left:auto}
.fx-memo{min-height:60px!important}
.fx-man{min-height:110px!important}
.rt-pm{width:min(1100px,100%)!important}
.rt-pm2{width:min(640px,100%)!important}
.gv-pm{width:min(1000px,100%)!important}
.rt-in{min-height:420px!important;font:12px/1.5 ui-monospace,monospace}
.rt-pv{display:flex;flex-direction:column;gap:6px;max-height:460px;overflow:auto}
.rt-r{border:1px solid var(--line);border-radius:8px;padding:6px 10px}
.rt-r summary{cursor:pointer}
.rt-r.off{opacity:.55}
.fx-pm{--ph:auto;height:auto!important;max-height:calc(var(--vh,100vh) - 32px)}
.pm-layer.has-memo{display:flex;align-items:center;justify-content:center;gap:12px}
.pm-layer.has-memo>.pm{flex:0 1 auto;min-width:0}
.memo-side{flex:none;width:260px;align-self:center;max-height:min(520px,calc(var(--vh,100vh) - 32px));display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:var(--surface);box-shadow:0 20px 60px rgba(0,0,0,.25)}
.memo-side .ca-sec{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.memo-side .ca-sec b{font-size:13px}
.memo-ta{flex:1;height:auto;min-height:220px;resize:vertical;font-size:13px;line-height:1.55}
@media (max-width:900px){.pm-layer.has-memo{flex-direction:column;align-items:stretch;gap:0}.pm-layer.has-memo>.pm{width:100%!important;max-width:100%;height:auto!important;flex:1 1 auto;min-height:0;max-height:none}.memo-side{width:auto;border-radius:0;box-shadow:none;border-top:1px solid var(--line);max-height:180px}.memo-ta{min-height:70px}}
.ca-dup{display:inline-block;margin-left:4px;padding:0 5px;border-radius:4px;background:color-mix(in srgb,#D9572B 14%,var(--surface));color:#C2410C;font-size:10.5px;font-weight:800;white-space:nowrap;cursor:help;vertical-align:middle}
.ca-tbl td.nick{white-space:nowrap}.ca-tbl td.nick .fi{display:inline-block;width:calc(100% - 52px);min-width:80px}
.ra-pm{width:min(860px,100%)!important}
.ra-list{display:flex;flex-direction:column;gap:14px}
.ra-g{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.ra-g.cur{border-color:var(--accent)}
.ra-h{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);font-size:13px}.ra-h span{color:var(--t3);font-size:12px}.ra-h .btn{margin-left:auto}
.ra-g .ca-tbl{margin:0}.ra-g .ca-tbl td{padding:6px 12px}
.rc-guide .gv{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.gv .ca-sec{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gv .ca-sec .fi{width:auto;min-width:0;max-width:100%;height:32px}.gv-out{width:100%;box-sizing:border-box}.gv .sp{flex:1}
.gv-out{height:280px;font-size:12.5px;background:var(--surface-2)}
.fx-rsn{display:flex;flex-wrap:wrap;gap:6px}
.fx-chip{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.fx-hist{display:grid;gap:8px;max-height:280px;overflow:auto}
.fx-item{display:grid;gap:4px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);font-size:12.5px}
.fx-item small{color:var(--t3)}
.fx-item.done{opacity:.6}
.fx-item .acts{display:flex;gap:6px;justify-content:flex-end}
@media (max-width:900px){.ca-row{grid-template-columns:1fr 1fr 1fr}.ca-row .grow{grid-column:1/-1}.ca-out,.ca-img,.ca-two,.ca-imgp{grid-template-columns:1fr}.ca-big{height:auto;width:100%}textarea.ca-msg{height:360px}.ca-pm{height:auto}}
`;
    document.head.appendChild(st);
  }

  function layer(kids) {
    // 바깥 클릭으로 닫지 않음 (글자를 끌어 선택하다 창 밖에서 놓으면 닫히던 문제) — ✕ 또는 Esc(입력 중이 아닐 때)
    const L = el('div', { className: 'pm-layer' }, el('div', { className: 'pm ca-pm' }, kids));
    const onKey = (e) => { if (e.key !== 'Escape' || document.body.lastElementChild !== L) return; if (e.isTrusted && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) { document.activeElement.blur(); return; } close(); };
    const close = () => { document.removeEventListener('keydown', onKey); L.remove(); };
    document.addEventListener('keydown', onKey); document.body.append(L);
    return { L, close };
  }

  // 리뷰노트 북마크 설치 안내 (개인 키가 든 북마크를 만들어 줌)
  async function rnInstall() {
    const holder = el('div', { className: 'rn-drag' }, el('span', { text: '북마크 만드는 중…' }));
    const { data: cur } = await sb.from('rn_keys').select('created_at,last_used_at').maybeSingle();
    const make = async () => {
      try { const key = await rnNewKey(); const href = rnBookmark(key);
        const a = el('a', { className: 'rn-bm', href, text: '📋 리뷰노트 → MUYI', title: '이 버튼을 북마크바로 끌어다 놓으세요', onclick: (e) => { e.preventDefault(); toast('여기서 누르는 게 아니라, 북마크바로 끌어다 놓으세요'); } });
        holder.replaceChildren(a, el('span', { text: '← 이 버튼을 마우스로 잡아 북마크바에 놓으세요 (북마크는 이것 하나면 됩니다)' }), el('button', { className: 'btn sm', type: 'button', text: '주소 복사', onclick: () => copy(href, '북마크 주소') }));
      } catch (e) { holder.replaceChildren(el('span', { text: '북마크를 만들지 못했습니다: ' + e.message })); }
    };
    const step = (t, sub) => el('li', {}, [el('b', { text: t }), sub ? el('small', { text: sub }) : null].filter(Boolean));
    const P = layer([el('div', { className: 'pm-h' }, [el('h3', { text: '리뷰노트 명단 → CRM 자동 저장 · 북마크 설치' }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]),
      el('div', { className: 'ca-body rn-how' }, [
        holder,
        cur ? el('div', { className: 'ca-hint', text: `이미 만든 북마크가 있습니다 (${String(cur.created_at).slice(0, 10)} 생성${cur.last_used_at ? ' · 마지막 사용 ' + String(cur.last_used_at).slice(0, 10) : ''}). 새로 만들면 예전 북마크는 더 이상 작동하지 않습니다.` }) : null,
        el('ol', {}, [
          step('북마크바 켜기', '크롬: Ctrl + Shift + B (맥 ⌘ + Shift + B)'),
          step('위 파란 버튼을 북마크바로 끌어다 놓기 (딱 1개)', '끌기가 안 되면 [주소 복사] → 북마크바 우클릭 → 페이지 추가 → 이름 "리뷰노트 → MUYI", URL에 붙여넣기'),
          step('리뷰노트에 로그인한 상태에서, 체험단 진행(캠페인) 화면을 열고 북마크 누르기', '그 캠페인의 선정 명단만 가져옵니다 (다른 화면에서 누르면 안내만 뜸)'),
          step('오른쪽 위에 캠페인별 결과가 뜹니다', '저장 → [CRM에서 점주 안내 열기] · 업체를 못 찾으면 버튼으로 골라 저장 · 이미 저장한 캠페인은 다시 눌러도 겹치지 않음(인원이 바뀌면 갱신)'),
          step('CRM에서는 명단·닉네임·특이사항이 이미 들어가 있음', '점주 안내 멘트·일정표·캘린더 링크만 복사해서 보내면 끝. 발표일이 비어 있던 회차는 저장한 날이 발표일이 됩니다'),
        ]),
        el('div', { className: 'ca-hint', text: '리뷰노트 아이디·비밀번호는 저장하지 않습니다. 북마크에는 본인 전용 키가 들어 있어 명단 저장만 할 수 있고, 저장 기록은 본인 이름으로 남습니다. 북마크를 다른 사람에게 주지 마세요.' }),
      ].filter(Boolean))]);
    P.L.firstChild.classList.add('rn-pm');
    if (cur) holder.replaceChildren(el('button', { className: 'btn primary', type: 'button', text: '내 북마크 새로 만들기', onclick: make }), el('span', { text: '북마크바에 이미 있으면 그대로 쓰면 됩니다' }));
    else make();
  }
  // 업체 고르기 (달력 우상단 [명단 변환])
  // 캠페인 제목 ↔ 업체 맞추기: 공백·기호 빼고 업체명이 제목에 들어 있으면 강하게, 지점명만 맞으면 약하게
  const norm = (t) => String(t || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();
  const matchScore = (co, title) => { const T = norm(title), n = norm(co.name), br = norm(String(co.name || '').replace(co.brand || String(co.name).split(/\s+/)[0], '')); if (!T || !n) return 0; if (T.includes(n)) return 3; if (br.length >= 2 && T.includes(br) && (!co.brand || T.includes(norm(co.brand)))) return 2; if (br.length >= 2 && T.includes(br)) return 1; return 0; };
  function pick(events, cfg, rn) {
    const list = events.slice().sort((a, b) => (rn ? matchScore(b.co, rn.title) - matchScore(a.co, rn.title) : 0) || String(a.due || '9').localeCompare(String(b.due || '9')) || a.co.name.localeCompare(b.co.name));
    if (rn) { // 같은 업체 여러 회차면 오늘과 가장 가까운 발표 회차로
      const today = todayKst(), far = (e) => e.due ? Math.abs(parse(e.due) - parse(today)) : 9e15;
      const top = list.filter((e) => matchScore(e.co, rn.title) === 3);
      if (top.length && new Set(top.map((e) => e.co.id)).size === 1) { const e = top.sort((a, b) => far(a) - far(b))[0]; open({ co: e.co, cycle: e.cycle, cfg, announce: e.due, deadline: e.dl, rn }); return; }
    }
    const q = el('input', { className: 'fi', type: 'search', placeholder: '업체명 검색' });
    const box = el('div', { className: 'ca-pick' });
    const paint = () => { const s = q.value.trim(); box.replaceChildren(...(list.filter((e) => !s || e.co.name.includes(s)).slice(0, 60).map((e) => el('button', { type: 'button', onclick: () => { P.close(); open({ co: e.co, cycle: e.cycle, cfg, announce: e.due, deadline: e.dl, rn }); } }, [el('b', { text: e.co.name }), el('span', { text: `${e.due ? '발표 ' + mdw(e.due) : '발표일 미정'}${e.done ? ' · 완료' : ''}` })]))) || []); if (!box.childElementCount) box.append(el('div', { className: 'ca-hint', text: '이 달에 발표할 업체가 없습니다.' })); };
    q.oninput = paint;
    const P = layer([el('div', { className: 'pm-h' }, [el('h3', { text: rn ? `어느 업체 명단인가요? · ${rn.title || '캠페인 ' + rn.id}` : '명단 변환 · 업체 선택' }), rn ? null : el('button', { className: 'btn sm', type: 'button', text: '예전 명단 텍스트 넣기', title: '모든 계약 업체(종료 포함)에서 골라 예전 명단 텍스트를 회차별로 저장', onclick: () => { P.close(); txtPick(); } }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })].filter(Boolean)), el('div', { className: 'ca-body' }, [rn ? el('div', { className: 'ca-hint', text: `리뷰노트 명단 ${rn.rows.length}명 — 업체를 고르면 바로 채워집니다 (제목이 비슷한 업체가 위에)` }) : null, q, box].filter(Boolean))]);
    paint(); q.focus();
  }

  // 블로거 가이드 글: 업체 정보 + 키워드 + 확인 사항(지점 특이사항 → 브랜드 공통) — 상세 ④ 탭과 모집 팝업 보기 공통
  function composeGuide({ co, address, info, storeGuide, brandGuide }) {
    const st = String(storeGuide || '').trim();
    // 지점 특이사항이 없으면 '~확인 사항' 머리와 '☆ 지점별 특이사항~' 자리 표시를 빼고 브랜드 공통만 (2026-11-25~)
    const chk = brandGuide && brandGuide.includes('☆ 지점별 특이사항~')
      ? (st ? brandGuide.replace('☆ 지점별 특이사항~', `☆ 지점별 특이사항~\n${st}`) : brandGuide.replace(/[ \t]*☆ 지점별 특이사항~[ \t]*\n?/, ''))
      : [st, brandGuide].filter(Boolean).join('\n\n');
    return [
      `안녕하세요 블로거님, 무이(MUYI) 선정 명단 공유드립니다😊`,
      `선정 업체 참고사항 발송해 드립니다!`, '',
      `업체명\t\t: ${co.name}`,
      `업체 주소\t\t: ${address || ''}`,
      `예약 번호\t\t: ${co.store_phone || co.phone || ''}`,
      `체험 금액\t\t: ${info.price || ''}`, '',
      `필수 키워드 : ${info.must || ''}`,
      `선택 키워드 : ${info.opt || ''}`, '',
      ...(st ? ['~확인 사항'] : []),
      chk,
    ].join('\n').trimEnd();
  }
  // 모집 팝업용 가이드 보기: 저장된 버전을 고르면 그 버전 가이드 전체 + 드롭다운 '＋ 가이드 추가' (2026-11-25~)
  //  추가 = 발표 상세 ④ [버전 저장]과 같은 형식(guidelines 체험단 행: body=지점 특이사항, fields={title, price, must, opt, brand}) → 발표 상세 ④ 버전 목록에 그대로 나옴
  async function guideView(co) {
    const box = el('div', { className: 'gv' });
    const load = async (pick) => {
      const [gl, gb, ex] = await Promise.all([
        sb.from('guidelines').select('body,fields,created_at').eq('company_id', co.id).eq('kind', '체험단').order('created_at', { ascending: false }).limit(200),
        sb.from('crm_settings').select('value').eq('key', 'guide_brand:' + brandOf(co)).maybeSingle(),
        sb.from('companies').select('address,camp_info,phone,store_phone').eq('id', co.id).maybeSingle(),
      ]);
      const vers = new Map(); (gl.data || []).forEach((g) => { const t = g.fields?.title || '기본'; if (!vers.has(t)) vers.set(t, g); });
      const c = { ...co, ...(ex.data || {}) }, base = { price: '', must: '', opt: '', ...(ex.data?.camp_info || {}) }, brand0 = typeof gb.data?.value === 'string' ? gb.data.value : '';
      const cur = (t) => { const g = vers.get(t), f = g?.fields || {}; return { title: g ? t : '', price: f.price ?? base.price, must: f.must ?? base.must, opt: f.opt ?? base.opt, store: g?.body || '', brand: f.brand ?? brand0 }; };
      const out = el('textarea', { className: 'fi ca-msg gv-out', readOnly: true });
      const sel = el('select', { className: 'fi', title: '저장된 가이드 버전 · 맨 아래 ＋ 가이드 추가' }, [
        ...(vers.size ? [...vers.keys()].map((t) => el('option', { value: t, text: t, selected: t === pick })) : [el('option', { value: '', text: '저장된 버전 없음 (현재 정보)' })]),
        el('option', { value: '__add', text: '＋ 가이드 추가' })]);
      let last = sel.value;
      const paint = () => { const v = cur(sel.value); out.value = composeGuide({ co: c, address: c.address, info: v, storeGuide: v.store, brandGuide: v.brand }); };
      sel.onchange = () => { if (sel.value === '__add') { sel.value = last; edit(cur(last)); return; } last = sel.value; paint(); };
      // 가이드 추가 창: 지금 고른 버전 내용을 채워서 시작 → 이름 + 금액·키워드·특이사항·브랜드 공통 → 미리보기 → 저장
      const edit = (v0) => {
        const f = { title: el('input', { className: 'fi', placeholder: '버전 이름 (예: 기본, 주말 예약 불가, 크리스마스)' }), price: el('input', { className: 'fi', value: v0.price || '', placeholder: '체험 금액 (예: 5만원 상당)' }),
          must: el('input', { className: 'fi', value: v0.must || '', placeholder: '필수 키워드' }), opt: el('input', { className: 'fi', value: v0.opt || '', placeholder: '선택 키워드' }),
          store: el('textarea', { className: 'fi ca-g sm', value: v0.store || '', placeholder: '지점 특이사항 (이 지점만)' }), brand: el('textarea', { className: 'fi ca-g sm', value: v0.brand || '', placeholder: `${brandOf(co)} 브랜드 공통 확인 사항` }) };
        const pv = el('textarea', { className: 'fi ca-msg gv-out', readOnly: true });
        const val = () => ({ price: f.price.value.trim(), must: f.must.value.trim(), opt: f.opt.value.trim(), store: f.store.value.trim(), brand: f.brand.value.trim() });
        const re = () => { const v = val(); pv.value = composeGuide({ co: c, address: c.address, info: v, storeGuide: v.store, brandGuide: v.brand }); };
        Object.values(f).forEach((x) => { x.oninput = re; }); re();
        const lab = (t, x) => el('label', { className: 'ca-f' }, [el('span', { className: 'lbl', text: t }), x]);
        const save = el('button', { className: 'btn primary', type: 'button', text: '가이드 저장', onclick: async () => {
          const t = f.title.value.trim(); if (!t) { toast('버전 이름을 넣어주세요'); f.title.focus(); return; }
          if (vers.has(t) && !confirm(`'${t}' 버전이 이미 있습니다. 새 내용으로 저장할까요? (이전 내용은 보관)`)) return;
          const v = val(); save.disabled = true;
          const { error } = await sb.from('guidelines').insert({ company_id: co.id, kind: '체험단', body: v.store, fields: { title: t, price: v.price, must: v.must, opt: v.opt, brand: v.brand }, created_by: me });
          if (error) { toast('저장 실패: ' + error.message); save.disabled = false; return; }
          // 발표 상세 ④와 같게: 업체 금액·키워드 현재본 + 브랜드 공통 현재본도 갱신
          await sb.from('companies').update({ camp_info: { ...(ex.data?.camp_info || {}), price: v.price, must: v.must, opt: v.opt } }).eq('id', co.id);
          if (v.brand !== brand0) await sb.from('crm_settings').upsert({ key: 'guide_brand:' + brandOf(co), value: v.brand, updated_at: new Date().toISOString(), updated_by: me });
          toast(`가이드 '${t}' 저장 — 발표 상세 ④ 블로거 가이드에서도 바로 씀`); E.close(); load(t);
        } });
        const E = layer([el('div', { className: 'pm-h' }, [el('h3', { text: `${co.name} · 블로거 가이드 추가` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => E.close() })]),
          el('div', { className: 'ca-body ca-two' }, [el('div', { className: 'ca-col' }, [lab('버전 이름', f.title), lab('체험 금액', f.price), lab('필수 키워드', f.must), lab('선택 키워드', f.opt), lab('지점 특이사항', f.store), lab('브랜드 공통', f.brand)]),
            el('div', { className: 'ca-col' }, [el('b', { text: '미리보기' }), pv])]),
          el('div', { className: 'ca-foot' }, [el('span', { className: 'ca-hint', text: `'${v0.title || '현재 정보'}' 내용으로 채워 시작 · 저장하면 발표 상세 ④에도 같은 버전` }), el('span', { className: 'sp' }), save])]);
        E.L.firstChild.classList.add('gv-pm'); f.title.focus();
      };
      paint();
      box.replaceChildren(el('div', { className: 'ca-sec' }, [el('b', { text: '블로거 가이드' }), sel, el('span', { className: 'sp' }), el('button', { className: 'btn sm', type: 'button', text: '가이드 복사', onclick: () => copy(out.value, '가이드') })]), out);
    };
    await load();
    return box;
  }
  // 업체 메모 (업체 전체 1개, companies.camp_memo): 캘린더의 모든 팝업 옆에 같은 메모 — 입력하면 자동 저장
  async function memoSide(layerEl, co) {
    if (!layerEl?.isConnected || layerEl.querySelector('.memo-side')) return;
    const { data } = await sb.from('companies').select('camp_memo,camp_memo_at,camp_memo_by').eq('id', co.id).maybeSingle();
    if (!layerEl.isConnected) return;
    const ta = el('textarea', { className: 'fi memo-ta', value: data?.camp_memo || '', placeholder: '이 업체 메모 (모든 회차·팝업 공통)\n예: 사장님 오전 통화 X, 주차 2대' });
    const st = el('small', { className: 'ca-when' });
    const when = (at, by) => { st.textContent = at ? `수정 ${kstShort(at)}${by && admins[by] ? ' · ' + admins[by] : ''}` : '아직 메모 없음'; };
    when(data?.camp_memo_at, data?.camp_memo_by);
    let t = null, last = ta.value;
    const save = async () => { clearTimeout(t); const v = ta.value.trim(); if (v === last.trim()) return; const at = new Date().toISOString();
      const { error } = await sb.from('companies').update({ camp_memo: v || null, camp_memo_at: at, camp_memo_by: me }).eq('id', co.id);
      if (error) { st.textContent = '저장 실패: ' + error.message; return; } last = ta.value; when(at, me); };
    ta.oninput = () => { st.textContent = '입력 중…'; clearTimeout(t); t = setTimeout(save, 900); };
    ta.onblur = save;
    layerEl.classList.add('has-memo');
    layerEl.append(el('aside', { className: 'memo-side', onclick: (e) => e.stopPropagation() }, [el('div', { className: 'ca-sec' }, [el('b', { text: '업체 메모' }), el('small', { className: 'ca-when', text: co.name })]), ta, st]));
  }
  // 전체 회차 명단: 이 업체 모든 회차(rounds) 명단 + 검색(닉네임·이름·전화·블로그)
  async function rosterAll(co, { cycle } = {}) {
    const { data: rds0 } = await sb.from('rounds').select('id,cycle_on,round_no,round_label,import_key,rn_campaign_id').eq('company_id', co.id).order('cycle_on', { ascending: false, nullsFirst: false }).limit(200);
    // 모집일 있는 회차(최근 순) 다음에, 텍스트로 넣은 옛 회차(나중 계약·회차 순)
    const rds = (rds0 || []).slice().sort((a, b) => (a.cycle_on || b.cycle_on) ? String(b.cycle_on || '').localeCompare(String(a.cycle_on || '')) : String(b.import_key || '').localeCompare(String(a.import_key || '')));
    const ids = rds.map((r) => r.id);
    const ros = ids.length ? ((await sb.from('roster').select('round_id,nickname,name,phone,blog_url,post_url,cancelled,done').in('round_id', ids).order('created_at').limit(3000)).data || []) : [];
    const groups = rds.map((r) => ({ r, rows: ros.filter((x) => x.round_id === r.id) })).filter((g) => g.rows.length);
    const q = el('input', { className: 'fi', type: 'search', placeholder: '이름 · 닉네임 · 전화 · 블로그 검색' });
    const cnt = el('b', { className: 'ca-cnt' });
    const box = el('div', { className: 'ra-list' });
    const nrm = (v) => String(v || '').toLowerCase().replace(/[\s-]/g, '');
    const paint = () => {
      const k = nrm(q.value); let n = 0;
      box.replaceChildren(...groups.map((g) => {
        const rows = g.rows.filter((x) => !k || [x.nickname, x.name, x.phone, x.blog_url].some((v) => nrm(v).includes(k)));
        n += rows.length; if (!rows.length) return null;
        return el('div', { className: 'ra-g' + (g.r.cycle_on === cycle ? ' cur' : '') }, [
          el('div', { className: 'ra-h' }, [el('b', { text: g.r.round_label && /재계약|회차|^\d+-\d+$/.test(g.r.round_label) ? g.r.round_label : g.r.round_no ? `${g.r.round_no}회차` : '회차 없음' }), el('span', { text: `${g.r.cycle_on ? '모집 ' + md(g.r.cycle_on) : '모집일 없음'} · ${g.rows.filter((x) => !x.cancelled).length}명${g.r.cycle_on === cycle ? ' · 지금 연 회차' : ''}` }),
            el('button', { className: 'btn sm ghost', type: 'button', text: '번호 복사', onclick: () => copy(rows.filter((x) => !x.cancelled && x.phone).map((x) => x.phone).join(', '), `${g.r.round_no || ''}회차 번호`) })]),
          el('table', { className: 'ca-tbl' }, el('tbody', {}, rows.map((x) => el('tr', { className: x.cancelled ? 'off' : '' }, [el('td', { className: 'nick', text: x.nickname || '' }), el('td', { text: x.name || '' }), el('td', { className: 'cphone', text: x.phone || '' }),
            el('td', {}, x.blog_url ? el('a', { href: x.blog_url, target: '_blank', rel: 'noopener', text: blogId(x.blog_url) || '블로그' }) : ''), el('td', {}, x.post_url ? el('a', { href: x.post_url, target: '_blank', rel: 'noopener', text: '글 보기' }) : x.cancelled ? '취소' : (x.done ? '완료' : ''))])))),
        ]);
      }).filter(Boolean));
      if (!box.childElementCount) box.append(empty('idea', groups.length ? '검색 결과가 없어요' : '저장된 명단이 없어요', groups.length ? '' : '발표 상세 ① 명단에서 저장하면 회차별로 쌓입니다.'));
      cnt.textContent = `${groups.length}개 회차 · ${k ? '검색 ' + n + '명' : '전체 ' + ros.length + '명'}`;
    };
    q.oninput = paint;
    const txtBtn = el('button', { className: 'btn sm', type: 'button', text: '명단 텍스트 넣기', title: '예전 명단 텍스트(회차별)를 붙여넣어 한 번에 저장', onclick: () => { L.close(); rosterText(co, { cycle }); } });
    const L = layer([el('div', { className: 'pm-h' }, [el('h3', { text: `${co.name} · 전체 회차 명단` }), txtBtn, el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => L.close() })]), el('div', { className: 'ca-body' }, [el('div', { className: 'ca-sec' }, [q, cnt]), box])]);
    L.L.firstChild.classList.add('ra-pm');
    paint(); q.focus();
  }
  // ── 예전 명단 텍스트 → 회차별 명단 (2026-11-25~). 업체 하나의 텍스트 파일 = 모든 회차:
  //  'N회차' 줄 = 회차 시작 · 회차 번호가 다시 작아지면(재계약 후 1회차) 새 계약 · 블로거 = 닉네임 / 이름 / 전화 / 블로그 링크(+ 글 링크) 줄
  //  저장 = rounds(cycle_on 없음, round_label '3회차'·'재계약 1회차', import_key 'txt:계약:회차') + roster. 이미 넣은 회차(import_key 같음)는 건너뜀
  const isUrl = (x) => /^https?:\/\//.test(x);
  const isPostUrl = (x) => /blog\.naver\.com\/[^/?#]+\/\d{6,}|logNo=\d+/.test(x);
  const isPhone = (x) => /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(x);
  // 회차 머리: '------1-----'(하이픈 사이 번호) 또는 'N회차' 줄 · 머리 바로 아래 날짜 줄 = 그 회차 마감일
  //  '재계약' 줄(또는 번호가 다시 작아짐) = 새 계약 → 1회차부터 다시. 이름: 지난 계약 회차 = 'N-계약차수'(1-1, 2-1 …) · 마지막 계약 = 'N회차' (2026-11-25~)
  // 줄 정리: 보이지 않는 문자 제거 + 하이픈 비슷한 문자(－ – — ― ─ ━ ㅡ = ~ _) 허용 + '-----' / '1' / '-----' 처럼 세 줄로 된 머리도 한 줄로 (2026-11-25~)
  const DASH = '[-－‐‑‒–—―─━ㅡ=~_]';
  const reHdr = new RegExp(`^${DASH}{2,}\\s*(\\d{1,3})\\s*(?:회차|회|차)?\\s*(.*?)\\s*${DASH}{2,}\\s*(.*)$`), reDashOnly = new RegExp(`^${DASH}{3,}$`), reHdr2 = new RegExp(`^${DASH}{2,}\\s*(\\d{1,3})\\s*(?:회차|회|차)?\\s*(.*)$|^(\\d{1,3})\\s*(?:회차|회|차)?\\s*(.*?)\\s*${DASH}{2,}$`);
  const linesOf = (txt) => {
    const L = String(txt || '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\u00a0/g, ' ').split(/\r?\n/).flatMap((l) => { if (!l.includes('\t')) return [l]; const c = l.split('\t').map((x) => x.trim()).filter(Boolean); return c.some((x) => isPhone(x) || isUrl(x)) ? c : c.slice(0, 1); }).map((l) => l.trim()); // 엑셀 칸(탭): 전화·링크가 있으면 칸마다 줄로, 아니면 첫 칸만(뒤 '미제출' 등 상태 버림)
    const out = [];
    for (let i = 0; i < L.length; i++) {
      const nx = (j) => { while (j < L.length && !L[j]) j++; return j; };
      if (reDashOnly.test(L[i])) { const j = nx(i + 1), m = (L[j] || '').match(/^(\d{1,3})\s*(?:회차|회|차)?$/); if (m) { const k = nx(j + 1); out.push(`--${m[1]}--`); i = reDashOnly.test(L[k] || '') ? k : j; continue; } }
      out.push(L[i]);
    }
    return out;
  };
  const hdrOf = (y) => { const m = y.match(reHdr); if (m) { const rest = `${m[2] || ''} ${m[3] || ''}`.trim(); return { no: +m[1], renew: /재계약/.test(rest), date: rest ? mdOf(rest) : null }; }
    const h2 = !isUrl(y) && y.length <= 40 && y.match(reHdr2); if (h2) { const no = +(h2[1] || h2[3]), rest = h2[2] || h2[4] || ''; if (!/\d{3,}/.test(rest)) return { no, renew: /재계약/.test(rest), date: rest ? mdOf(rest) : null }; } // 한쪽에만 하이픈 ('------1', '1회차-----')
    const n = !isUrl(y) && !isPhone(y) && y.length <= 40 && y.match(/(\d+)\s*회차/); return n ? { no: +n[1], renew: /재계약/.test(y) } : null; };
  // 날짜 {Y?, mo, d} — 연도 없는 날짜는 회차 순서로 연도를 정함(마지막 회차부터 거꾸로, 뒤 회차보다 늦지 않게 · 맨 끝은 오늘+60일 이내)
  const mdOf = (y) => {
    if (isUrl(y) || isPhone(y) || y.length > 40) return null;
    const m = y.match(/(?:(20\d{2})\s*[.\-/년]\s*)?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/); if (!m) return null;
    const mo = +m[2], d = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { Y: m[1] ? +m[1] : null, mo, d };
  };
  const dateOf = (y) => (/마감|^\D{0,6}\d/.test(y) ? mdOf(y) : null);
  const isoOf = (Y, v) => `${Y}-${String(v.mo).padStart(2, '0')}-${String(v.d).padStart(2, '0')}`;
  const META = /^(몇\s*팀|팀\s*수|모집\s*(인원|팀)|리뷰\s*기간|체험\s*기간|인원)\s*[:：]/; // 회차 정보 줄 (명단 아님)
  function parseRosterText(txt) {
    const out = [], warn = []; let contract = 1, last = 0, R0 = null, cur = null;
    const flush = () => { if (cur && (cur.nickname || cur.phone || cur.blog_url)) R0.rows.push(cur); cur = null; };
    for (const raw of linesOf(txt)) {
      const y = raw.trim(); if (!y) continue;
      const h = hdrOf(y);
      if (h) { if (R0) flush(); if (h.renew && R0) { contract++; last = 0; } else if (h.renew && !R0) contract = 2; else if (R0 && h.no <= last) contract++;
        last = h.no; R0 = { contract, no: h.no, rows: [], deadline: h.date || null }; out.push(R0); continue; }
      const x = y.replace(/^[-*•·]\s*/, '');
      if (/재계약/.test(x) && x.length <= 20) { if (R0) { flush(); contract++; last = 0; } else contract = 2; continue; } // '재계약' 구분 줄 → 다음부터 1회차
      if (!R0) { warn.push(x); continue; }
      if (META.test(x)) continue;
      if (/마감/.test(x) && mdOf(x)) { if (!R0.deadline) R0.deadline = mdOf(x); continue; } // '리뷰노트 마감일 ~ 12월 26일' = 그 회차 마감일
      if (!R0.rows.length && !cur && !R0.deadline) { const d = dateOf(x); if (d) { R0.deadline = d; continue; } } // 회차 머리 바로 아래 날짜 = 마감일
      if (isUrl(x)) {
        const prev = R0.rows[R0.rows.length - 1];
        if (isPostUrl(x) && !cur && prev && !prev.post_url) { prev.post_url = x; continue; }
        cur = cur || {}; if (isPostUrl(x) && cur.blog_url) cur.post_url = x; else cur.blog_url = x; flush(); continue;
      }
      if (isPhone(x)) { cur = cur || {}; if (cur.phone) { flush(); cur = {}; } cur.phone = x.replace(/[\s.]/g, '-'); continue; }
      cur = cur || {}; if (cur.phone || (cur.nickname && cur.name)) { flush(); cur = {}; }
      if (!cur.nickname) cur.nickname = x; else cur.name = x;
    }
    if (R0) flush();
    let cap = addDays(todayKst(), 60);
    for (let i = out.length - 1; i >= 0; i--) { const v = out[i].deadline; if (!v) continue; let Y = v.Y || +cap.slice(0, 4); if (!v.Y) while (isoOf(Y, v) > cap) Y--; out[i].deadline = isoOf(Y, v); if (out[i].deadline < cap) cap = out[i].deadline; }
    const maxC = Math.max(1, ...out.map((r) => r.contract));
    out.forEach((r) => { r.last = r.contract === maxC; r.label = r.last ? `${r.no}회차` : `${r.no}-${r.contract}`; r.key = `txt:${String(r.contract).padStart(2, '0')}:${String(r.no).padStart(3, '0')}`; });
    return { rounds: out.filter((r) => r.rows.length), empty: out.filter((r) => !r.rows.length), warn, contracts: maxC };
  }
  const hasHdr = (t) => linesOf(t).some((l) => hdrOf(l));
  // 텍스트 회차 저장(공통): rounds(모집일 없음, round_label·deadline, import_key txt:업체id:계약:회차) + roster. 이미 있는 회차(같은 import_key)는 건너뜀
  //  replace: true = 이 업체의 텍스트 회차(모집일 없음)를 모두 지우고 새로 넣음(덮어쓰기, 2026-11-25~ 발표 상세 [텍스트로 넣기])
  async function saveTxtRounds(co, rounds, { replace = false } = {}) {
    if (replace) { const { error } = await sb.from('rounds').delete().eq('company_id', co.id).is('cycle_on', null).like('import_key', `txt:${co.id}:%`); if (error) throw new Error('기존 회차 지우기 실패: ' + error.message); }
    const { data: have } = replace ? { data: [] } : await sb.from('rounds').select('import_key').eq('company_id', co.id).like('import_key', `txt:${co.id}:%`);
    const had = new Set((have || []).map((r) => r.import_key)); let n = 0, m = 0, skip = 0;
    for (const r of rounds) {
      const key = `txt:${co.id}:${r.key.slice(4)}`; if (had.has(key)) { skip++; continue; }
      const { data: rd, error } = await sb.from('rounds').insert({ company_id: co.id, round_no: r.no, round_label: r.label, state: '완료', teams: r.rows.length, deadline: r.deadline || null, import_key: key, memo: '명단 텍스트로 넣음' }).select('id').single();
      if (error) throw new Error(`${r.label}: ${error.message} (${n}개 회차까지 저장됨)`);
      const { error: e2 } = await sb.from('roster').insert(r.rows.map((x) => ({ round_id: rd.id, nickname: x.nickname || null, name: x.name || null, phone: x.phone || null, blog_url: x.blog_url || null, post_url: x.post_url || null, done: !!x.post_url })));
      if (e2) throw new Error(`${r.label} 명단: ${e2.message}`); had.add(key); n++; m += r.rows.length;
    }
    return { n, m, skip };
  }
  // 예전 명단 텍스트 넣기 — 업체 고르기 (계약 업체 전체, 종료 포함): 넣은 회차 수 표시
  async function txtPick() {
    const [{ data: cos }, { data: rk }] = await Promise.all([sb.from('companies').select('id,name,brand,run_status').eq('stage', '결제').order('name').limit(3000), sb.from('rounds').select('company_id').like('import_key', 'txt:%').limit(5000)]);
    const done = new Map(); (rk || []).forEach((r) => done.set(r.company_id, (done.get(r.company_id) || 0) + 1));
    const q = el('input', { className: 'fi', type: 'search', placeholder: '업체명 검색' }), box = el('div', { className: 'ca-pick' });
    const paint = () => { const k = q.value.trim(); box.replaceChildren(...(cos || []).filter((c) => !k || c.name.includes(k)).slice(0, 80).map((c) => el('button', { type: 'button', onclick: () => { P.close(); rosterText(c); } }, [el('b', { text: c.name }), el('span', { text: ` ${c.run_status || ''}${done.get(c.id) ? ' · 텍스트 ' + done.get(c.id) + '개 회차 넣음' : ''}` })]))); };
    q.oninput = paint;
    const P = layer([el('div', { className: 'pm-h' }, [el('h3', { text: '예전 명단 텍스트 넣기 · 업체 선택' }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]), el('div', { className: 'ca-body' }, [q, box])]);
    paint(); q.focus();
  }
  async function rosterText(co, { cycle } = {}) {
    const { data: have } = await sb.from('rounds').select('import_key').eq('company_id', co.id).like('import_key', `txt:${co.id}:%`); // import_key는 전체에서 유일 → 업체 id 포함
    const had = new Set((have || []).map((r) => r.import_key));
    const ta = el('textarea', { className: 'fi ca-g rt-in', placeholder: '명단 텍스트 파일 내용을 그대로 붙여넣으세요\n\n1회차\n닉네임\n이름\n010-0000-0000\nhttps://blog.naver.com/아이디\n…\n\n재계약\n1회차\n…' });
    const pv = el('div', { className: 'rt-pv' }), sum = el('b', { className: 'ca-cnt' });
    let P0 = { rounds: [] };
    const paint = () => {
      P0 = parseRosterText(ta.value); P0.rounds.forEach((r) => { r.key = `txt:${co.id}:${r.key.slice(4)}`; });
      const nNew = P0.rounds.filter((r) => !had.has(r.key));
      sum.textContent = P0.rounds.length ? `${P0.rounds.length}개 회차 · ${P0.rounds.reduce((a, r) => a + r.rows.length, 0)}명 (새로 ${nNew.length}개 회차)` : '';
      pv.replaceChildren(...(P0.rounds.length ? P0.rounds.map((r) => el('details', { className: 'rt-r' + (had.has(r.key) ? ' off' : '') }, [
        el('summary', {}, [el('b', { text: r.label }), el('span', { text: ` ${r.rows.length}명` + (r.deadline ? ` · 마감 ${md(r.deadline)}` : '') + (had.has(r.key) ? ' · 이미 넣음(건너뜀)' : '') + (r.rows.some((x) => !x.phone) ? ` · 전화 없는 ${r.rows.filter((x) => !x.phone).length}명` : '') })]),
        el('table', { className: 'ca-tbl' }, el('tbody', {}, r.rows.map((x) => el('tr', {}, [el('td', { className: 'nick', text: x.nickname || '' }), el('td', { text: x.name || '' }), el('td', { className: 'cphone', text: x.phone || '—' }), el('td', { text: x.blog_url ? blogId(x.blog_url) || x.blog_url : '' }), el('td', { text: x.post_url ? '글 ✓' : '' })])))),
      ])) : [el('div', { className: 'ca-hint', text: ta.value.trim() ? "'N회차' 줄을 찾지 못했습니다. 회차마다 '1회차'처럼 적힌 줄이 있어야 합니다." : '붙여넣으면 여기서 회차별로 나눠 보여줍니다.' })]),
        ...(P0.empty.length ? [el('div', { className: 'ca-hint', text: `명단이 없는 회차: ${P0.empty.map((r) => r.label).join(', ')}` })] : []),
        ...(P0.warn.length ? [el('div', { className: 'ca-hint', text: `첫 회차 위 내용 ${P0.warn.length}줄은 건너뜀` })] : []));
    };
    ta.oninput = paint;
    const save = async (b) => {
      if (!P0.rounds.some((r) => !had.has(r.key))) { toast('새로 넣을 회차가 없습니다'); return; }
      b.disabled = true;
      try { const { n, m } = await saveTxtRounds(co, P0.rounds); toast(`${co.name} ${n}개 회차 · ${m}명 저장`); P.close(); rosterAll(co, { cycle }); }
      catch (e) { toast('저장 실패: ' + e.message); paint(); b.disabled = false; }
    };
    const sv = el('button', { className: 'btn primary', type: 'button', text: '회차별로 저장' }); sv.onclick = () => save(sv);
    const P = layer([el('div', { className: 'pm-h' }, [el('h3', { text: `${co.name} · 명단 텍스트 넣기` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]),
      el('div', { className: 'ca-body ca-two' }, [el('div', { className: 'ca-col' }, [el('div', { className: 'ca-hint', text: "텍스트 파일 내용을 그대로 붙여넣기 → 오른쪽에서 회차별로 확인 → 저장. '------1-----' 또는 'N회차' 줄 = 회차, 바로 아래 날짜 = 마감일. '재계약' 줄부터 다시 1회차(지난 계약 회차는 1-1, 2-1 …). 이미 넣은 회차는 건너뜀" }), ta]),
        el('div', { className: 'ca-col' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '미리보기' }), sum]), pv])]),
      el('div', { className: 'ca-foot' }, [el('span', { className: 'sp' }), sv])]);
    P.L.firstChild.classList.add('rt-pm');
    paint(); ta.focus();
  }
  // 같은 브랜드 전체 지점 명단에서 같은 블로그(블로그 아이디) 찾기 → Map(blogId → [{ name, round_no, cycle_on }])
  async function brandDups(co, exceptRound) {
    const br = brandOf(co); if (!br) return new Map();
    const { data: cos } = await sb.from('companies').select('id,name,brand').eq('stage', '결제').limit(3000);
    const mine = (cos || []).filter((c) => brandOf(c) === br);
    const cIds = mine.map((c) => c.id); if (!cIds.length) return new Map();
    const rds = []; for (let i = 0; i < cIds.length; i += 150) rds.push(...(((await sb.from('rounds').select('id,company_id,round_no,cycle_on').in('company_id', cIds.slice(i, i + 150))).data) || []));
    const rIds = rds.filter((r) => r.id !== exceptRound).map((r) => r.id); if (!rIds.length) return new Map();
    const ros = []; for (let i = 0; i < rIds.length; i += 150) ros.push(...(((await sb.from('roster').select('round_id,blog_url').in('round_id', rIds.slice(i, i + 150)).limit(5000)).data) || []));
    const rBy = new Map(rds.map((r) => [r.id, r])), cBy = new Map(mine.map((c) => [c.id, c])), out = new Map();
    ros.forEach((x) => { const id = blogId(x.blog_url); if (!id) return; const r = rBy.get(x.round_id); if (!out.has(id)) out.set(id, []); out.get(id).push({ name: cBy.get(r.company_id)?.name || '', round_no: r.round_no, cycle_on: r.cycle_on }); });
    return out;
  }
  async function open({ co, cycle, cfg, announce, deadline, rn, extra, rno, rnoNone }) {
    const p = period(cycle, cfg, { announce, deadline });
    const [rd, gl, gb] = await Promise.all([
      sb.from('rounds').select('*').eq('company_id', co.id).eq('cycle_on', cycle).maybeSingle(),
      sb.from('guidelines').select('body,fields,created_at,created_by').eq('company_id', co.id).eq('kind', '체험단').order('created_at', { ascending: false }).limit(200),
      sb.from('crm_settings').select('value,updated_at,updated_by').eq('key', 'guide_brand:' + brandOf(co)).maybeSingle(),
    ]);
    // 이 회차(모집일)에 저장된 명단만 보여준다. 북마크 명단이 다른 모집일에 붙어 있으면 [북마크 명단 불러오기]로 직접 고름 (자동으로 가까운 것 불러오던 기능 삭제 — 다른 회차 명단이 뜨던 원인)
    let round = rd.data, moved = null;
    const today = todayKst();
    const [ros, exQ, lbQ] = await Promise.all([
      round ? sb.from('roster').select('*').eq('round_id', round.id).order('created_at').then((r) => r.data || []) : Promise.resolve([]),
      sb.from('companies').select('address,camp_round_done,camp_round_cycle,camp_info').eq('id', co.id).maybeSingle(),
      sb.from('camp_tasks').select('label').eq('company_id', co.id).eq('cycle_on', cycle).eq('step', '모집').maybeSingle(),
    ]);
    const lbNo = /^\d+$/.test(lbQ.data?.label || '') ? +lbQ.data.label : null;
    const ex = exQ.data || {};
    // 회차 = 모집 달력과 같은 번호 (달력에서 넘겨받음). 메시지(점주 안내·완료 보고·일정표·캘린더)에는 +1
    const roundNo0 = lbNo || (rnoNone ? null : rno) || round?.round_no || (ex.camp_round_cycle === cycle ? ex.camp_round_done : null) || null;
    const info = { price: '', must: '', opt: '', ...(ex.camp_info || {}) };
    // 지점 특이사항: 이름을 붙여 여러 개 (guidelines.fields.title). 이름별 최신이 현재 내용
    const notes = new Map(); (gl.data || []).forEach((g) => { const t = g.fields?.title || '기본'; if (!notes.has(t)) notes.set(t, g); });
    const S = {
      roundNo: roundNo0, teams: round?.teams || co.camp_teams || 10, weeks: round?.review_weeks || 4,
      rows: ros.map((r) => ({ id: r.id, nickname: r.nickname || '', name: r.name || '', phone: r.phone || '', blog: r.blog_url || '', post: r.post_url || '', note: r.note || '', grade: r.grade || '', visits: r.visits, msg: '', off: r.cancelled, done: !!r.done })),
      tab: ros.length ? 'owner' : 'list', saved: !!ros.length, ownerEdited: false, imgDirty: true, dup: new Map(),
      storeTitle: (gl.data?.[0]?.fields?.title) || '기본', storeGuide: gl.data?.[0]?.body || '', brandGuide: typeof gb.data?.value === 'string' ? gb.data.value : '',
    };
    const mno = () => (S.roundNo || 0) + 1; // 메시지 회차
    const live = () => S.rows.filter((r) => !r.off);
    // 같은 브랜드 다른 지점·회차에도 있는 블로거 (블로그 아이디 기준)
    const dupB = (r) => { const l = S.dup.get(blogId(r.blog)); return l?.length ? el('span', { className: 'ca-dup', text: `중복 ${l.length}`, title: '같은 브랜드에서 이미 선정된 블로거\n' + l.map((x) => `· ${x.name} ${x.round_no ? x.round_no + '회차' : ''}${x.cycle_on ? ' (모집 ' + md(x.cycle_on) + ')' : ''}`).join('\n') }) : null; };
    const complete = (r) => !!(r.done || r.post); // 완료 = 체크했거나 글 링크가 있음
    const phonesOf = (list) => list.map((r) => r.phone).filter(Boolean).join(', ');
    const chip = (k, t) => { const s = el('span', {}, [el('i'), t]); s.style.setProperty('--c', STEP_C[k]); return s; };
    const opts = (from, sel, fmt) => Array.from({ length: Math.max(21, (sel || 0) + 1) - from }, (_, i) => el('option', { value: from + i, text: fmt(from + i), selected: from + i === sel }));
    const rnoOpts = () => [el('option', { value: '', text: '회차 없음', selected: !S.roundNo }), ...opts(1, S.roundNo, (n) => `${n}회차`)];
    // 우상단 회차 = 지금 진행 중인 이 회차의 번호 설정 (② 점주 안내 등 메시지용, +1). 이동은 하지 않음 — 다른 회차로 이동은 명단 탭 '회차 명단' (2026-11-25~ 분리)
    async function setRound(v) {
      const n = v ? +v : null;
      S.roundNo = n; rdBadge.replaceChildren(...rnoOpts()); F.no.replaceChildren(...rlOpts());
      if (S.ownerEdited) ownerT.value = ownerT.value.replace(/\d+회차 마감일은/, `${mno()}회차 마감일은`);
      changed(); try { paintCheck(); } catch { /* 아직 탭 준비 전 */ }
      const lb = n ? String(n) : '-';
      const { data: t } = await sb.from('camp_tasks').select('id').eq('company_id', co.id).eq('cycle_on', cycle).eq('step', '모집').maybeSingle();
      const r1 = await (t ? sb.from('camp_tasks').update({ label: lb }).eq('id', t.id) : sb.from('camp_tasks').insert({ company_id: co.id, cycle_on: cycle, step: '모집', due_on: cycle, label: lb }));
      if (r1.error) { toast('회차 저장 실패: ' + r1.error.message); return; }
      lbQ.data = { label: lb };
      if (n && round?.id && !moved && !S.view) await sb.from('rounds').update({ round_no: n, round_label: lb }).eq('id', round.id); // 불러온 행은 [저장] 때 이 회차로 옮김
      if (n && (!ex.camp_round_cycle || ex.camp_round_cycle <= cycle)) { await sb.from('companies').update({ camp_round_done: n, camp_round_cycle: cycle }).eq('id', co.id); ex.camp_round_done = n; ex.camp_round_cycle = cycle; } // 다음 회차 자동 번호의 기준점
      window.CRM_CALENDAR?.refresh?.();
      toast(n ? `${n}회차로 저장 · 메시지는 ${mno()}회차` : '회차 없음');
    }
    const rdBadge = el('select', { className: 'fi ca-rdsel', title: '진행 중인 회차 설정 (모집 달력과 같은 번호) · 점주 안내 등 메시지에는 +1 · 다른 회차로 이동은 명단 탭 \'회차 명단\'' }, rnoOpts());
    rdBadge.onchange = () => setRound(rdBadge.value);
    const allBtn = el('button', { className: 'btn sm', type: 'button', text: '전체 회차 명단', title: '이 업체의 모든 회차 명단 (이름·전화·블로그 검색)', onclick: () => rosterAll(co, { cycle }) });
    const head = el('div', { className: 'ca-head' }, [
      el('div', { className: 'ca-title' }, [el('h3', { text: co.name }), rdBadge, el('div', { className: 'ca-extra' }, [allBtn, ...(extra || [])]), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]),
      el('div', { className: 'ca-tl' }, [chip('모집', `모집 ${mdw(p.recruitFrom)} ~ ${mdw(p.recruitTo)}`), chip('발표', `발표 ${mdw(p.announce)}`), chip('체험', `체험+리뷰 ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`), chip('마감', `마감 ${mdw(p.deadline)} ♥`)]),
    ]);

    // ── 내보낼 글 ──
    const person = (r) => [(r.nickname || r.name) + (r.off ? ' (취소)' : ''), r.name, r.phone, r.blog];
    const rosterTxt = () => S.rows.flatMap((r) => [...person(r), '']).join('\n').trimEnd();
    const ownerMsg = () => [
      `안녕하세요 사장님, 무이(MUYI) 선정 명단 공유드립니다😊`,
      `${mno()}회차 마감일은 [ ${kmd(p.deadline)}] 입니다.`, '',
      ...live().flatMap((r) => [...person(r), '']),
    ].join('\n').trimEnd();
    // 블로거 가이드 (샘플): 업체 정보 + 키워드 + 확인 사항(지점 특이사항 → 브랜드 공통)
    const guideTxt = () => composeGuide({ co, address: ex.address, info, storeGuide: S.storeGuide, brandGuide: S.brandGuide });
    // 구글 캘린더: 체험+리뷰 시작 ~ 마감일까지 한 일정 (설명에 기간·마감 모두)
    const gcalUrl = () => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`[무이 체험단] ${co.name} 체험·리뷰 (마감 ${md(p.deadline)})`)}&dates=${p.reviewFrom.replace(/-/g, '')}/${addDays(p.deadline, 1).replace(/-/g, '')}&details=${encodeURIComponent([`${co.name} ${mno()}회차 체험단`, `· 체험+리뷰 기간: ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`, `· 리뷰 마감: ${mdw(p.deadline)} ♥`, `· 선정 블로거 ${live().length || S.teams}명`, '', '마감일에 무이가 등록 현황을 확인해 드립니다.'].join('\n'))}`;

    async function saveRoster() {
      // 회차 명단에서 고른 다른 회차(모집일 없는 예전 회차) 보기 중 → 그 회차 행에 저장 (이 모집일 회차·달력은 안 건드림)
      if (S.view) {
        let r = S.view.row;
        if (!r) { const { data, error } = await sb.from('rounds').insert({ company_id: co.id, round_no: S.view.no, round_label: `${S.view.no}회차`, state: '완료', teams: S.rows.length || null, import_key: `txt:${co.id}:01:${String(S.view.no).padStart(3, '0')}`, memo: '명단 탭에서 넣음' }).select().single(); if (error) throw error; r = data; S.view.row = r; }
        const { error: e1 } = await sb.from('roster').delete().eq('round_id', r.id); if (e1) throw e1;
        if (S.rows.length) { const { data: ins, error: e2 } = await sb.from('roster').insert(S.rows.map((x) => ({ round_id: r.id, nickname: x.nickname || null, name: x.name || null, phone: x.phone || null, blog_url: x.blog || null, post_url: x.post || null, note: x.note || null, grade: x.grade || null, visits: x.visits ?? null, cancelled: !!x.off, done: !!x.done }))).select('id'); if (e2) throw e2; (ins || []).forEach((d, i) => { if (S.rows[i]) S.rows[i].id = d.id; }); }
        S.saved = true; loadRL(); return;
      }
      const row = { company_id: co.id, cycle_on: cycle, round_no: S.roundNo || null, round_label: /재계약/.test(round?.round_label || '') && round?.round_no === S.roundNo ? round.round_label : S.roundNo ? String(S.roundNo) : null, teams: S.teams, review_weeks: S.weeks, recruit_on: cycle, deadline: p.deadline, state: '진행' };
      let r = round;
      if (moved && rd.data && rd.data.id !== r?.id) await sb.from('rounds').delete().eq('id', rd.data.id); // 이 회차의 빈 회차 행 → 불러온 북마크 명단으로 대체
      if (r) { const { data, error } = await sb.from('rounds').update(row).eq('id', r.id).select().single(); if (error) throw error; r = data; moved = null; } // cycle_on도 이 회차로 (북마크 명단 연결)
      else { const { data, error } = await sb.from('rounds').insert(row).select().single(); if (error) throw error; r = data; }
      round = r;
      const { error: e1 } = await sb.from('roster').delete().eq('round_id', r.id); if (e1) throw e1;
      if (S.rows.length) {
        const { data: ins, error: e2 } = await sb.from('roster').insert(S.rows.map((x) => ({ round_id: r.id, nickname: x.nickname || null, name: x.name || null, phone: x.phone || null, blog_url: x.blog || null, post_url: x.post || null, note: x.note || null, grade: x.grade || null, visits: x.visits ?? null, cancelled: !!x.off, done: !!x.done }))).select('id');
        if (e2) throw e2; (ins || []).forEach((d, i) => { if (S.rows[i]) S.rows[i].id = d.id; });
      }
      S.saved = true;
      // 모집 달력 칩에도 이 회차 번호 (회차 없음 '-'으로 정해둔 건 그대로)
      if (S.roundNo && lbQ.data?.label !== String(S.roundNo)) {
        const lb = String(S.roundNo), { data: t } = await sb.from('camp_tasks').select('id').eq('company_id', co.id).eq('cycle_on', cycle).eq('step', '모집').maybeSingle();
        await (t ? sb.from('camp_tasks').update({ label: lb }).eq('id', t.id) : sb.from('camp_tasks').insert({ company_id: co.id, cycle_on: cycle, step: '모집', due_on: cycle, label: lb })).then(() => {}, () => {});
        lbQ.data = { label: lb };
      }
    }

    // ── 이미지: 캔버스 → <img>(길게 눌러/우클릭 복사 가능) + 클립보드 복사 ──
    const cv = el('canvas', { width: 1080, height: 1350 });
    const imgs = [];
    let blobP = null;
    const refreshImg = () => { if (!S.imgDirty) return; S.imgDirty = false; draw(cv); const u = cv.toDataURL('image/png'); imgs.forEach((i) => { i.src = u; }); blobP = new Promise((ok) => cv.toBlob(ok, 'image/png')); };
    logoReady.then(() => { S.imgDirty = true; if (imgs.some((i) => i.isConnected)) refreshImg(); });
    const imgEl = (cls) => { const i = el('img', { className: cls, alt: `${co.name} 일정표` }); imgs.push(i); return i; };
    const copyImg = async () => {
      refreshImg();
      try {
        if (!window.ClipboardItem) throw 0;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
        toast('일정표 복사됨 — 카톡 대화창에 Ctrl+V');
      } catch { toast('복사가 막혀 있어요 — 이미지를 우클릭(폰은 길게 눌러) [이미지 복사]를 눌러 주세요'); }
    };

    // ── 탭 패널: 한 번만 만들고 보이기/숨기기 (전환 시 화면 이동·재계산 없음) ──
    const TABS = [['list', '명단'], ['owner', '점주 안내'], ['image', '일정표 · 캘린더'], ['guide', '블로거 가이드'], ['check', '명단 체크리스트'], ['remind', '재촉 문자']];
    const stepsEl = el('div', { className: 'ca-steps', role: 'tablist' });
    const body = el('div', { className: 'ca-body' });
    const foot = el('div', { className: 'ca-foot' });
    const panels = {}, foots = {};

    // ① 명단
    const num = (v, min = 1) => Math.max(min, Number(v) || min);
    // 명단 탭 '회차 명단' (2026-11-25~): 전체 회차(1~N)를 드롭다운 — 고르면 그 회차로 이동
    //  모집일 회차가 있으면 그 회차 상세 · 예전 텍스트 회차면 그 명단 보기 · 명단이 없는 회차는 이동만(빈 명단, 여기서 넣으면 그 회차로 저장)
    //  보기 중 [저장] = 그 회차 행(모집일 없음)에만 저장, 이 모집일 회차·달력은 그대로. '이 회차' = 돌아가기. 회차 번호 지정은 우상단
    const RL = { rs: [], cnt: new Map(), cyc: new Map() };
    const rlName = (r) => r.round_label && /재계약|^\d+-\d+$/.test(r.round_label) ? r.round_label : r.round_no ? `${r.round_no}회차` : '회차 없음';
    const ctr = (r) => +((String(r.import_key || '').match(/:(\d{2}):\d{3}$/) || [])[1] || 0);
    const lastC = () => Math.max(1, ...RL.rs.filter((r) => !r.cycle_on).map(ctr));
    const txtOf = (n) => RL.rs.filter((r) => !r.cycle_on && r.round_no === n && ctr(r) === lastC())[0];
    const datedOf = (n) => RL.rs.filter((r) => r.cycle_on && r.cycle_on !== cycle && r.round_no === n).sort((a, b) => String(b.cycle_on).localeCompare(String(a.cycle_on)))[0];
    const rlOpts = () => {
      const nums = RL.rs.map((r) => r.round_no || 0).concat([...RL.cyc.keys()]);
      const max = Math.max(20, S.roundNo || 0, ...nums);
      const cur = el('option', { value: 'cur', text: `이 회차${S.roundNo ? ' · ' + S.roundNo + '회차' : ''} (모집 ${md(cycle)}) · ${S.view ? '' : S.rows.length + '명'}`.replace(/ · $/, ''), selected: !S.view });
      const out = [cur];
      for (let n = 1; n <= max; n++) {
        if (n === S.roundNo && !S.view) continue;
        const d = datedOf(n), t = txtOf(n), c = RL.cyc.get(n);
        const k = d && RL.cnt.get(d.id) ? ` · 모집 ${md(d.cycle_on)} · ${RL.cnt.get(d.id)}명` : t && RL.cnt.get(t.id) ? ` · 예전 텍스트 · ${RL.cnt.get(t.id)}명` : (d || c) ? ` · 모집 ${md((d || {}).cycle_on || c)} · 명단 없음` : ' · 명단 없음';
        out.push(el('option', { value: 'n:' + n, text: `${n}회차${k}`, selected: S.view?.no === n && !S.view.id }));
      }
      RL.rs.filter((r) => !r.cycle_on && ctr(r) && ctr(r) !== lastC() && RL.cnt.get(r.id)).sort((a, b) => String(b.import_key).localeCompare(String(a.import_key)))
        .forEach((r) => out.push(el('option', { value: 'id:' + r.id, text: `${rlName(r)} · 지난 계약 · ${RL.cnt.get(r.id)}명`, selected: S.view?.id === r.id })));
      return out;
    };
    async function loadRL() {
      const [{ data: rs }, { data: tk }] = await Promise.all([sb.from('rounds').select('id,round_no,round_label,cycle_on,import_key,teams').eq('company_id', co.id).limit(400), sb.from('camp_tasks').select('cycle_on,label').eq('company_id', co.id).eq('step', '모집').not('label', 'is', null).limit(400)]);
      RL.rs = rs || []; RL.cnt = new Map(); RL.cyc = new Map();
      (tk || []).forEach((t) => { if (/^\d+$/.test(t.label) && t.cycle_on !== cycle) { const n = +t.label; if (!RL.cyc.has(n) || t.cycle_on > RL.cyc.get(n)) RL.cyc.set(n, t.cycle_on); } });
      const ids = RL.rs.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 150) (((await sb.from('roster').select('round_id').in('round_id', ids.slice(i, i + 150)).limit(5000)).data) || []).forEach((x) => RL.cnt.set(x.round_id, (RL.cnt.get(x.round_id) || 0) + 1));
      F.no.replaceChildren(...rlOpts());
    }
    const F = { no: el('select', { className: 'fi', title: '회차를 고르면 그 회차 명단으로 이동 (회차 번호 지정은 우상단)' }), teams: el('input', { className: 'fi', type: 'number', min: 1, value: S.teams }), weeks: el('input', { className: 'fi', type: 'number', min: 1, value: S.weeks }) };
    const openCycle = async (cy, n) => {
      const { data: ts } = await sb.from('camp_tasks').select('step,due_on').eq('company_id', co.id).eq('cycle_on', cy).in('step', ['발표', '마감']);
      const due = (st) => (ts || []).find((t) => t.step === st)?.due_on || undefined;
      P.close(); open({ co, cycle: cy, cfg, announce: due('발표'), deadline: due('마감'), rno: n || undefined, extra });
    };
    // 다른 회차 보기: 그 회차 명단만 (없으면 빈 명단)
    const viewRound = async (row, n) => {
      if (S.rows.length && !S.saved && !S.view && !confirm('저장하지 않은 명단이 있습니다. 다른 회차로 이동할까요?')) { F.no.replaceChildren(...rlOpts()); return; }
      const ro = row ? ((await sb.from('roster').select('*').eq('round_id', row.id).order('created_at')).data || []) : [];
      S.view = { no: row?.round_no || n, id: row && ctr(row) !== lastC() ? row.id : null, row: row || null };
      S.rows = ro.map((x) => ({ id: x.id, nickname: x.nickname || '', name: x.name || '', phone: x.phone || '', blog: x.blog_url || '', post: x.post_url || '', note: x.note || '', grade: x.grade || '', visits: x.visits, msg: '', off: x.cancelled, done: !!x.done }));
      S.saved = true; S.ownerEdited = false; paintRows(); paintSteps(); go('list'); F.no.replaceChildren(...rlOpts());
      status.textContent = `${row ? rlName(row) : n + '회차'} 명단 보기 — ${S.rows.length ? S.rows.length + '명' : '명단 없음 · [텍스트로 넣기]나 엑셀로 넣고 [저장]하면 이 회차 명단으로 저장'} · '이 회차'를 고르면 돌아감`;
    };
    F.no.onchange = async () => {
      const v = F.no.value;
      if (v === 'cur') { if (S.view) openCycle(cycle, S.roundNo); return; }
      if (v.startsWith('id:')) { const r = RL.rs.find((x) => x.id === v.slice(3)); if (r) viewRound(r); return; }
      const n = +v.slice(2), d = datedOf(n), t = txtOf(n), c = RL.cyc.get(n);
      if (d && RL.cnt.get(d.id)) return openCycle(d.cycle_on, n); // 그 모집일 회차 상세
      if (t && RL.cnt.get(t.id)) return viewRound(t);             // 예전 텍스트 명단
      if (d || c) return openCycle((d || {}).cycle_on || c, n);   // 명단 없는 모집일 회차 → 이동만
      viewRound(t || null, n);                                     // 모집일도 명단도 없는 회차 → 빈 명단
    };
    loadRL();
    F.teams.oninput = () => { S.teams = num(F.teams.value); changed(); }; F.weeks.oninput = () => { S.weeks = num(F.weeks.value); changed(); };
    const file = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', hidden: true });
    const prog = el('div', { className: 'ca-prog', hidden: true }, el('i'));
    const status = el('div', { className: 'ca-hint' });
    // 엑셀 끌어다 놓기 칸은 없앰(2026-11-25~) — 명단은 리뷰노트 북마크 붙여넣기 · [텍스트로 넣기]로
    file.onchange = () => { if (file.files[0]) ingest(file.files[0]); file.value = ''; };
    const tbody = el('tbody');
    const txt = el('textarea', { className: 'fi ca-txt', readOnly: true });
    const cnt = el('b', { className: 'ca-cnt' });
    const tableWrap = el('div', { className: 'ca-scroll' }, el('table', { className: 'ca-tbl' }, [el('thead', {}, el('tr', {}, ['', '#', '닉네임', '이름', '연락처', '일 방문', '특이사항', '신청메시지'].map((h) => el('th', { text: h })))), tbody]));
    const listEmpty = empty('idea', '명단을 붙여넣거나 [텍스트로 넣기]로 넣으면 명단이 바로 만들어져요', '만든 명단은 점주 안내 멘트에 자동으로 들어갑니다.');
    const paintRows = () => {
      tbody.replaceChildren(...S.rows.map((r, i) => {
        const nk = el('input', { className: 'fi', value: r.nickname, placeholder: '닉네임' }); nk.oninput = () => { r.nickname = nk.value; changed(); };
        const nt = el('input', { className: 'fi', value: r.note, placeholder: '특이사항' }); nt.oninput = () => { r.note = nt.value; changed(); };
        const on = el('input', { type: 'checkbox', checked: !r.off, title: '선정 (끄면 취소)' }); on.onchange = () => { r.off = !on.checked; on.closest('tr').classList.toggle('off', r.off); changed(); };
        return el('tr', { className: r.off ? 'off' : '' }, [el('td', {}, on), el('td', { className: 'num', text: i + 1 }), el('td', { className: 'nick' }, [nk, dupB(r)].filter(Boolean)), el('td', { text: r.name }), el('td', { className: 'cphone', text: r.phone }), el('td', { className: 'num', text: r.visits ?? '' }), el('td', { className: 'note' }, nt), el('td', { className: 'cmsg', text: r.msg, title: r.msg })]);
      }));
      const has = !!S.rows.length;
      tableWrap.hidden = !has; txtWrap.hidden = !has; listEmpty.hidden = has;
      changed();
    };
    // 명단이 바뀌면 TXT·점주 멘트·이미지·캘린더가 같이 따라간다 (점주 멘트를 직접 고쳤으면 유지)
    const changed = () => {
      txt.value = rosterTxt();
      cnt.textContent = S.rows.length ? `선정 ${live().length}명${S.rows.length - live().length ? ` · 취소 ${S.rows.length - live().length}` : ''} / 모집 ${S.teams}팀` : '명단 없음';
      if (!S.ownerEdited) ownerT.value = ownerMsg();
      ownerHint.hidden = !!S.rows.length;
      guideOut.value = guideTxt();
      S.imgDirty = true; if (S.tab === 'image' || S.tab === 'owner') refreshImg();
    };
    async function ingest(f) {
      status.textContent = f.rn ? `리뷰노트 명단 읽는 중… (${f.rn.title || '캠페인 ' + f.rn.id})` : '엑셀 읽는 중…'; prog.hidden = false; prog.firstChild.style.width = '15%';
      try {
        if (f.rn) { S.rows = rnRows(f.rn.rows); if (!S.rows.length) throw new Error('붙여넣은 명단에서 이름·연락처·블로그를 찾지 못했습니다'); }
        else {
        await loadLib(XLSX_SRC);
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const pk = (o, ...ks) => { for (const k of ks) { const hit = Object.keys(o).find((h) => h.replace(/\s/g, '') === k.replace(/\s/g, '')); if (hit && String(o[hit]).trim()) return String(o[hit]).trim(); } return ''; };
        S.rows = raw.map((o) => ({ blog: pk(o, '계정url', '블로그', 'url'), name: pk(o, '이름', '성함'), phone: pk(o, '연락처', '전화번호'), msg: pk(o, '신청메시지', '신청 메시지'), grade: pk(o, '등급'), visits: Number(pk(o, '일 방문', '일방문').replace(/[^\d]/g, '')) || null, area: pk(o, '주소'), score: pk(o, '노출점수'), nickname: '', note: '', post: '', off: false, done: false })).filter((r) => r.name || r.blog);
        if (!S.rows.length) throw new Error('명단을 찾지 못했습니다 (이름·계정url 칸 확인)');
        }
        S.ownerEdited = false; S.saved = false; paintSteps();
        paintRows(); prog.firstChild.style.width = '35%'; status.textContent = `${S.rows.length}명 읽음 · 네이버 닉네임 가져오는 중…`;
        const ids = [...new Set(S.rows.map((r) => blogId(r.blog)).filter(Boolean))];
        const nk = await sb.functions.invoke('camp-assist', { body: { action: 'nick', ids } });
        if (!nk.error) S.rows.forEach((r) => { const id = blogId(r.blog); if (id && nk.data.nick[id]) r.nickname = nk.data.nick[id]; });
        paintRows(); prog.firstChild.style.width = '65%'; status.textContent = 'AI가 신청메시지에서 특이사항 정리 중…';
        const nt = await sb.functions.invoke('camp-assist', { body: { action: 'notes', company: co.name, rows: S.rows.map((r, i) => ({ i, msg: r.msg, grade: r.grade, visits: r.visits, area: r.area, score: r.score })) } });
        if (!nt.error) S.rows.forEach((r, i) => { if (nt.data.notes[i]) r.note = nt.data.notes[i]; });
        paintRows(); prog.firstChild.style.width = '100%';
        status.textContent = `${S.rows.length}명 · 닉네임 ${S.rows.filter((r) => r.nickname).length}명${nk.error ? ' (닉네임 실패 — 직접 입력)' : ''} · 특이사항 ${S.rows.filter((r) => r.note).length}건${nt.error ? ' (AI 실패 — 직접 입력)' : ''} — 점주 안내에도 들어갔어요. 확인 후 저장하세요.`;
        setTimeout(() => { prog.hidden = true; }, 800);
      } catch (e) { status.textContent = '실패: ' + e.message; prog.hidden = true; }
    }
    const lab = (t, x) => el('label', { className: 'ca-f' }, [el('span', { className: 'lbl', text: t }), x]);
    const txtWrap = el('details', { className: 'ca-det' }, [el('summary', { text: '관리팀 TXT 미리보기' }), txt]);
    // 리뷰노트 북마크로 복사한 명단 붙여넣기 (이 창이 열려 있으면 어디서든 Ctrl+V)
    const takePaste = (txt) => { if (!/^MUYI-RN:/.test(txt || '')) return false; try { const rn = JSON.parse(txt.slice(8)); ingest({ rn }); return true; } catch { toast('붙여넣은 내용을 읽지 못했습니다 — 북마크를 다시 눌러 복사해주세요'); return true; } };
    const pasteIn = el('input', { className: 'fi ca-paste', placeholder: '리뷰노트 북마크 명단 붙여넣기 (Ctrl+V)' });
    pasteIn.addEventListener('paste', (e) => { if (takePaste(e.clipboardData.getData('text'))) { e.preventDefault(); pasteIn.value = ''; } });
    const onDocPaste = (e) => { if (!P.L.isConnected) { document.removeEventListener('paste', onDocPaste); return; } if (S.tab !== 'list' || e.target === pasteIn) return; if (takePaste(e.clipboardData?.getData('text'))) e.preventDefault(); };
    document.addEventListener('paste', onDocPaste);
    const rnHow = el('button', { className: 'btn sm ghost', type: 'button', text: '리뷰노트 북마크 설치', onclick: () => rnInstall() });
    // 다른 회차 행(북마크 명단·텍스트로 넣은 예전 명단)을 이 회차로 불러오기 — [저장]하면 그 행이 이 모집일 회차가 됨
    function loadRound(r, ro, from) {
      round = r; moved = from; S.teams = r.teams || S.teams; F.teams.value = S.teams;
      if (from === 'txt' && r.round_no && !S.roundNo) { S.roundNo = r.round_no; rdBadge.replaceChildren(...rnoOpts()); } // 예전 텍스트 회차 번호를 이 회차 번호로 (저장 때 모집 칩에도)
      S.rows = (ro || []).map((x) => ({ id: x.id, nickname: x.nickname || '', name: x.name || '', phone: x.phone || '', blog: x.blog_url || '', post: x.post_url || '', note: x.note || '', grade: x.grade || '', visits: x.visits, msg: '', off: x.cancelled, done: !!x.done }));
      S.saved = false; S.ownerEdited = false; paintRows(); paintSteps(); go('list');
      if (from === 'txt') toast(`${r.round_label || r.round_no + '회차'} 명단 ${S.rows.length}명 불러옴 — [저장]하면 이 회차에 연결됩니다`);
    }
    // 명단 텍스트로 넣기 (2026-11-25~): 닉네임/이름/전화/블로그 줄. 업체 텍스트 파일 전체를 붙여넣으면 회차를 골라서
    // 명단 텍스트로 넣기: 회차 머리('------1-----'·'N회차')가 있으면 회차별로 나눠 각 회차에 저장, 없으면 이 화면 명단으로 (2026-11-25~)
    //  지금 회차(마지막 계약 · 우상단 번호와 같은 회차)는 이 모집일 회차에 저장, 나머지는 텍스트 회차(모집일 없음)로. 전에 있던 텍스트 회차·이 회차 명단은 지우고 덮어씀(2026-11-25~)
    function txtIn() {
      const ta = el('textarea', { className: 'fi ca-g rt-in', placeholder: '명단 텍스트 붙여넣기\n\n------1-----\n마감 3/5\n닉네임\n이름\n010-0000-0000\nhttps://blog.naver.com/아이디\n…\n\n재계약\n------1-----\n…\n\n(회차 머리가 없으면 이 화면 명단으로 넣음)' });
      const pv = el('div', { className: 'rt-pv' }), info = el('div', { className: 'ca-hint' });
      let P1 = { rounds: [] }, multi = false;
      const isCur = (r) => r.last && S.roundNo && r.no === S.roundNo && !S.view;
      const parse = () => {
        const t = ta.value; multi = hasHdr(t); P1 = parseRosterText(multi ? t : '------1-----\n' + t);
        ok.textContent = multi ? '회차별로 저장' : '이 명단으로 넣기';
        if (!multi) { const r = P1.rounds[0]; pv.replaceChildren(); info.textContent = r ? `${r.rows.length}명 · ${r.rows.slice(0, 4).map((x) => x.nickname || x.name).join(', ')}${r.rows.length > 4 ? ' …' : ''}${r.rows.some((x) => !x.phone) ? ` · 전화 없는 ${r.rows.filter((x) => !x.phone).length}명` : ''}` : '닉네임 / 이름 / 전화 / 블로그 줄을 찾지 못했습니다'; return; }
        info.textContent = `${P1.rounds.length}개 회차 · ${P1.rounds.reduce((a, r) => a + r.rows.length, 0)}명${P1.contracts > 1 ? ` · 계약 ${P1.contracts}번(재계약 ${P1.contracts - 1})` : ''}${P1.empty.length ? ` · 명단 없는 회차 ${P1.empty.map((r) => r.label).join(', ')}` : ''}`;
        pv.replaceChildren(...P1.rounds.map((r) => el('details', { className: 'rt-r' }, [
          el('summary', {}, [el('b', { text: r.label }), el('span', { text: ` ${r.rows.length}명${r.deadline ? ' · 마감 ' + md(r.deadline) : ''}${isCur(r) ? ' · 이 회차(모집 ' + md(cycle) + ')에 저장' : ''}` })]),
          el('table', { className: 'ca-tbl' }, el('tbody', {}, r.rows.map((x) => el('tr', {}, [el('td', { className: 'nick', text: x.nickname || '' }), el('td', { text: x.name || '' }), el('td', { className: 'cphone', text: x.phone || '—' }), el('td', { text: x.blog_url ? blogId(x.blog_url) || x.blog_url : '' }), el('td', { text: x.post_url ? '글 ✓' : '' })])))),
        ])));
      };
      const toRows = (r) => r.rows.map((x) => ({ nickname: x.nickname || '', name: x.name || '', phone: x.phone || '', blog: x.blog_url || '', post: x.post_url || '', note: '', grade: '', visits: null, msg: '', off: false, done: !!x.post_url }));
      const ok = el('button', { className: 'btn primary', type: 'button', text: '이 명단으로 넣기', onclick: async () => {
        if (!multi) {
          const r = P1.rounds[0]; if (!r?.rows.length) { toast('명단을 찾지 못했습니다'); return; }
          if (S.rows.length && !confirm(`지금 명단 ${S.rows.length}명을 텍스트 명단 ${r.rows.length}명으로 바꿀까요?`)) return;
          S.rows = toRows(r); S.saved = false; S.ownerEdited = false; M.close(); paintRows(); paintSteps(); toast(`${S.rows.length}명 넣음 — [저장]을 눌러야 저장됩니다`); return;
        }
        if (!P1.rounds.length) { toast('회차별 명단을 찾지 못했습니다'); return; }
        const mine = P1.rounds.find(isCur), rest = P1.rounds.filter((r) => r !== mine);
        const old = RL.rs.filter((r) => !r.cycle_on && String(r.import_key || '').startsWith(`txt:${co.id}:`)).length;
        if ((old || (mine && S.rows.length)) && !confirm(`전에 있던 명단을 지우고 이 텍스트로 덮어씁니다.\n· 예전 텍스트 회차 ${old}개 → 새 ${rest.length}개 회차${mine ? `\n· 이 회차(${mine.label}) 명단 ${S.rows.length}명 → ${mine.rows.length}명` : ''}\n계속할까요?`)) return;
        ok.disabled = true;
        try {
          if (mine) { S.rows = toRows(mine); S.ownerEdited = false; await saveRoster(); }
          const { n, m, skip } = await saveTxtRounds(co, rest, { replace: true });
          M.close(); paintRows(); paintSteps(); loadRL();
          toast(`${n}개 회차 · ${m}명 저장${mine ? ` · 이 회차 ${mine.rows.length}명` : ''}${skip ? ` · 이미 있던 ${skip}개 회차는 건너뜀` : ''}`);
        } catch (e) { toast('저장 실패: ' + e.message); ok.disabled = false; }
      } });
      ta.oninput = parse;
      const M = layer([el('div', { className: 'pm-h' }, [el('h3', { text: `${co.name} · 명단 텍스트로 넣기` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => M.close() })]),
        el('div', { className: 'ca-body ca-two' }, [el('div', { className: 'ca-col' }, [ta]), el('div', { className: 'ca-col' }, [info, pv])]), el('div', { className: 'ca-foot' }, [el('span', { className: 'ca-hint', text: "'------1-----' = 회차 · 바로 아래 날짜 = 마감일 · '재계약' 아래부터 다시 1회차(지난 계약은 1-1, 2-1 …) · 저장하면 전에 있던 명단은 지우고 덮어씀" }), el('span', { className: 'sp' }), ok])]);
      M.L.firstChild.classList.add('rt-pm'); parse(); ta.focus();
    }
    const txtBtn = el('button', { className: 'btn sm', type: 'button', text: '텍스트로 넣기', title: '닉네임/이름/전화/블로그 줄로 된 명단 텍스트 붙여넣기', onclick: txtIn });
    // 북마크로 가져온 명단이 다른 모집일 회차에 저장돼 있을 때: 직접 골라 이 회차로 불러오기 (저장하면 이 회차로 옮겨짐)
    const rnPick = el('button', { className: 'btn sm', type: 'button', hidden: true });
    async function rnNear() {
      const { data } = await sb.from('rounds').select('id,cycle_on,round_no,rn_campaign_id,teams').eq('company_id', co.id).not('rn_campaign_id', 'is', null).gte('cycle_on', addDays(cycle, -60)).lte('cycle_on', addDays(cycle, 60)).neq('cycle_on', cycle).order('cycle_on', { ascending: false }).limit(10);
      const list = data || []; if (!list.length || !P.L.isConnected) return;
      rnPick.hidden = false; rnPick.textContent = `북마크 명단 불러오기 (${list.length})`;
      rnPick.onclick = () => {
        const M = layer([el('div', { className: 'pm-h' }, [el('h3', { text: '다른 모집일에 저장된 북마크 명단' }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => M.close() })]),
          el('div', { className: 'ca-body' }, [el('div', { className: 'ca-hint', text: `고른 명단을 이 회차(모집 ${md(cycle)})로 불러옵니다. [저장]하면 그 명단이 이 회차로 옮겨집니다.` }),
            el('div', { className: 'ca-pick' }, list.map((r) => el('button', { type: 'button', onclick: async () => {
              const { data: ro } = await sb.from('roster').select('*').eq('round_id', r.id).order('created_at');
              loadRound(r, ro, r.cycle_on); M.close(); rnPick.hidden = true;
              toast(`모집 ${md(r.cycle_on)} 회차 북마크 명단 ${S.rows.length}명 불러옴 — 저장하면 이 회차로 옮겨집니다`);
            } }, [el('b', { text: `모집 ${mdw(r.cycle_on)}` }), el('span', { text: `${r.round_no ? r.round_no + '회차 · ' : ''}리뷰노트 캠페인 ${r.rn_campaign_id}` })])))])]);
      };
    }
    panels.list = el('div', { className: 'ca-panel' }, [
      el('div', { className: 'ca-row' }, [lab('회차 명단', F.no), lab('모집 팀', F.teams), lab('리뷰 기간(주)', F.weeks), el('div', { className: 'ca-f grow' }, [el('span', { className: 'lbl', text: '명단 넣기' }), el('div', { className: 'ca-rn' }, [pasteIn, txtBtn, rnPick])])]),
      prog, status, listEmpty, tableWrap, txtWrap,
    ]);
    const saveBtn = el('button', { className: 'btn brand', type: 'button', text: '저장하고 점주 안내 ›', onclick: async () => {
      if (!S.rows.length) { toast('명단이 비어 있습니다'); return; }
      saveBtn.disabled = true; try { await saveRoster(); toast(`${co.name} ${S.roundNo ? S.roundNo + '회차 ' : ''}명단 저장`); go('owner'); } catch (e) { toast('저장 실패: ' + e.message); } saveBtn.disabled = false;
    } });
    foots.list = [cnt, rnHow, el('span', { className: 'sp' }), el('button', { className: 'btn', type: 'button', text: 'TXT 복사', onclick: () => S.rows.length ? copy(rosterTxt(), '명단') : toast('명단이 비어 있습니다') }), saveBtn];

    // ② 점주 안내 (멘트 + 함께 보낼 일정표·캘린더를 한 화면에)
    const ownerT = el('textarea', { className: 'fi ca-msg' });
    ownerT.oninput = () => { S.ownerEdited = true; };
    const ownerHint = el('div', { className: 'ca-hint', text: '명단 탭에서 명단을 넣으면 블로거 명단이 이 멘트에 자동으로 들어갑니다.' });
    const phone = co.phone || co.store_phone;
    const thumb = imgEl('ca-thumb'); thumb.title = '누르면 복사'; thumb.onclick = copyImg;
    panels.owner = el('div', { className: 'ca-panel ca-two' }, [
      el('div', { className: 'ca-col' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '점주님께 보낼 멘트' }), el('button', { className: 'btn sm ghost', type: 'button', text: '전체 회차 명단 보기', title: '이 업체 모든 회차 명단 · 이름 검색', onclick: () => rosterAll(co, { cycle }) })]), ownerHint, ownerT]),
      el('div', { className: 'ca-col' }, [
        el('div', { className: 'ca-sec' }, [el('b', { text: '함께 보낼 것' })]),
        el('div', { className: 'ca-send' }, [thumb, el('div', {}, [el('b', { text: '일정표 이미지' }), el('small', { text: '복사 → 카톡에 붙여넣기' }), el('button', { className: 'btn sm primary', type: 'button', text: '이미지 복사', onclick: copyImg })])]),
        el('div', { className: 'ca-send' }, [el('div', { className: 'ca-ico', text: '📅' }), el('div', {}, [el('b', { text: '구글 캘린더' }), el('small', { text: `${mdw(p.reviewFrom)} ~ ${mdw(p.deadline)} 한 번에 추가` }), el('button', { className: 'btn sm', type: 'button', text: '링크 복사', onclick: () => copy(gcalUrl(), '캘린더 링크') })])]),
        el('div', { className: 'ca-send' }, [el('div', { className: 'ca-ico', text: '📞' }), el('div', {}, [el('b', { text: '점주 연락처' }), el('small', { text: phone || '등록된 연락처 없음' }), phone ? el('a', { className: 'btn sm', href: `sms:${phone.replace(/[^\d]/g, '')}`, text: '문자 앱 열기' }) : null].filter(Boolean))]),
      ]),
    ]);
    foots.owner = [el('span', { className: 'ca-hint', text: '멘트는 직접 고쳐도 됩니다' }), el('span', { className: 'sp' }), el('button', { className: 'btn primary', type: 'button', text: '멘트 복사', onclick: () => copy(ownerT.value, '멘트') })];

    // ③ 일정표 · 캘린더
    const big = imgEl('ca-big');
    panels.image = el('div', { className: 'ca-panel ca-imgp' }, [
      el('div', { className: 'ca-imgbox' }, big),
      el('div', { className: 'ca-col' }, [
        el('div', { className: 'ca-send ca-v' }, [el('b', { text: '일정표 이미지' }), el('small', { text: '[이미지 복사] 후 카톡 대화창에 붙여넣기. 안 되면 이미지를 우클릭(폰은 길게 눌러) 복사하세요.' }), el('button', { className: 'btn primary', type: 'button', text: '이미지 복사', onclick: copyImg })]),
        el('div', { className: 'ca-send ca-v' }, [el('b', { text: '구글 캘린더 (한 링크)' }), el('small', { text: `체험+리뷰 ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)} · 마감 ${mdw(p.deadline)} — 기간과 마감일이 한 일정으로 들어갑니다` }),
          el('div', { className: 'acts' }, [el('button', { className: 'btn', type: 'button', text: '링크 복사', onclick: () => copy(gcalUrl(), '캘린더 링크') }), el('a', { className: 'btn ghost', href: '#', target: '_blank', rel: 'noopener', text: '미리 열어보기', onclick: (e) => { e.currentTarget.href = gcalUrl(); } })])]),
      ]),
    ]);
    foots.image = [el('span', { className: 'sp' }), el('button', { className: 'btn', type: 'button', text: '캘린더 링크 복사', onclick: () => copy(gcalUrl(), '캘린더 링크') }), el('button', { className: 'btn primary', type: 'button', text: '이미지 복사', onclick: copyImg })];

    // ④ 블로거 가이드
    const bg = el('textarea', { className: 'fi ca-g', value: S.brandGuide, placeholder: `${brandOf(co)} 공통 가이드 (같은 브랜드 모든 지점에 적용)` });
    const sg = el('textarea', { className: 'fi ca-g sm', value: S.storeGuide, placeholder: '이 지점만의 특이사항 (예: 주차 가능, 월요일 휴무)' });
    const sName = el('select', { className: 'fi ca-sname', title: '저장해 둔 특이사항 고르기' });
    const paintNames = () => sName.replaceChildren(...[...notes.keys()].map((t) => el('option', { value: t, text: t, selected: t === S.storeTitle })), el('option', { value: '__new', text: '+ 새 버전' }));
    paintNames();
    sName.onchange = () => {
      if (sName.value === '__new') { const t = (prompt('새 버전 이름 (예: 주말 예약 불가, 크리스마스)') || '').trim(); if (!t) { paintNames(); return; } S.storeTitle = t; notes.set(t, null); S.storeGuide = ''; paintNames(); }
      else {
        S.storeTitle = sName.value; const g = notes.get(S.storeTitle); S.storeGuide = g?.body || '';
        // 버전 = 체험 금액·키워드·지점 특이사항·브랜드 공통 한 묶음 (2026-11-24~ 저장분부터 금액·키워드·공통 포함)
        const f = g?.fields || {};
        ['price', 'must', 'opt'].forEach((k) => { if (f[k] != null) { info[k] = f[k]; infoF[k].value = f[k]; infoDirty = true; } });
        if (f.brand != null) { S.brandGuide = f.brand; bg.value = f.brand; }
        saveInfo();
      }
      sg.value = S.storeGuide; guideOut.value = guideTxt(); meta.store = { at: notes.get(S.storeTitle)?.created_at, by: notes.get(S.storeTitle)?.created_by }; paintMeta();
    };
    const iF = (k, ph) => { const i = el('input', { className: 'fi', value: info[k] || '', placeholder: ph }); i.oninput = () => { info[k] = i.value; guideOut.value = guideTxt(); infoDirty = true; }; return i; };
    let infoDirty = false;
    const infoF = { price: iF('price', '예: 2인 세트 39,000원'), must: iF('must', '예: 가좌역 맛집, 복호두'), opt: iF('opt', '예: 마포 디저트, 호두과자') };
    const saveInfo = async () => { if (!infoDirty) return; const { error } = await sb.from('companies').update({ camp_info: info }).eq('id', co.id); if (error) { toast('업체 정보 저장 실패: ' + error.message); return; } infoDirty = false; toast('체험 금액 · 키워드 저장'); };
    Object.values(infoF).forEach((i) => i.addEventListener('change', saveInfo));
    const guideOut = el('textarea', { className: 'fi ca-msg', readOnly: true });
    bg.oninput = () => { S.brandGuide = bg.value; guideOut.value = guideTxt(); }; sg.oninput = () => { S.storeGuide = sg.value; guideOut.value = guideTxt(); };
    // 수정일 + 이전 버전 (브랜드 공통: guide_history 트리거 보관 · 지점: guidelines 저장 이력)
    const when = (t, by) => t ? `수정 ${kstShort(t)}${by && admins[by] ? ' · ' + admins[by] : ''}` : '아직 저장 안 됨';
    const meta = { brand: { at: gb.data?.updated_at, by: gb.data?.updated_by }, store: { at: gl.data?.[0]?.created_at, by: gl.data?.[0]?.created_by } };
    const metaB = el('small', { className: 'ca-when' }), metaS = el('small', { className: 'ca-when' });
    const paintMeta = () => { metaB.textContent = when(meta.brand.at, meta.brand.by); metaS.textContent = when(meta.store.at, meta.store.by); };
    paintMeta();
    const history = async (kind) => {
      const rows = kind === 'brand'
        ? ((await sb.from('guide_history').select('body,saved_at,saved_by,archived_at').eq('brand', brandOf(co)).order('archived_at', { ascending: false }).limit(30)).data || []).map((h) => ({ body: h.body, at: h.saved_at || h.archived_at, by: h.saved_by }))
        : ((await sb.from('guidelines').select('body,fields,created_at,created_by').eq('company_id', co.id).eq('kind', '체험단').order('created_at', { ascending: false }).limit(200)).data || []).filter((h) => (h.fields?.title || '기본') === S.storeTitle).slice(1).map((h) => ({ body: h.body, at: h.created_at, by: h.created_by }));
      const target = kind === 'brand' ? bg : sg;
      const H = layer([el('div', { className: 'pm-h' }, [el('h3', { text: `${kind === 'brand' ? brandOf(co) + ' 공통' : '지점 특이사항 · ' + S.storeTitle} · 이전 버전` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => H.close() })]),
        el('div', { className: 'ca-body' }, rows.length ? rows.map((h) => el('div', { className: 'ca-hist' }, [el('div', { className: 'ca-sec' }, [el('b', { text: when(h.at, h.by).replace('수정 ', '') }), el('button', { className: 'btn sm', type: 'button', text: '이 버전 불러오기', onclick: () => { target.value = h.body || ''; target.dispatchEvent(new Event('input')); H.close(); toast('불러옴 — [저장]을 눌러야 적용됩니다'); } })]), el('pre', { text: h.body || '(빈 내용)' })]))
          : [empty('ok', '보관된 이전 버전이 없어요', '저장할 때마다 바로 전 내용이 여기에 쌓입니다.')])]);
      H.L.firstChild.classList.add('ca-hpm');
    };
    const histBtn = (kind) => el('button', { className: 'btn sm ghost', type: 'button', text: '이전 버전', onclick: () => history(kind) });
    // 저장할 때 이름을 직접 정함 (같은 이름이면 그 특이사항의 새 버전, 이전 내용은 보관)
    const saveS = el('button', { className: 'btn sm primary', type: 'button', text: '버전 저장', title: '체험 금액·키워드·지점 특이사항·브랜드 공통을 한 버전으로 저장', onclick: async () => {
      const t = (prompt('버전 이름 (예: 기본, 주말 예약 불가, 크리스마스) — 같은 이름이면 새로 덮어쓰고 이전 내용은 보관', S.storeTitle) || '').trim();
      if (!t) return;
      const { data, error } = await sb.from('guidelines').insert({ company_id: co.id, kind: '체험단', body: S.storeGuide, fields: { title: t, price: info.price || '', must: info.must || '', opt: info.opt || '', brand: S.brandGuide || '' }, created_by: me }).select('body,fields,created_at,created_by').single();
      if (error) { toast('저장 실패: ' + error.message); return; }
      infoDirty = true; await saveInfo(); // 지금 업체 정보로도
      const at = new Date().toISOString();
      await sb.from('crm_settings').upsert({ key: 'guide_brand:' + brandOf(co), value: S.brandGuide, updated_at: at, updated_by: me }); // 브랜드 공통 현재본(같은 브랜드 다른 지점 기본값)
      S.storeTitle = t; notes.set(t, data); paintNames();
      meta.store = { at: data?.created_at || at, by: me }; meta.brand = { at, by: me }; paintMeta(); toast(`버전 '${t}' 저장 (금액·키워드·특이사항·공통)`);
    } });
    panels.guide = el('div', { className: 'ca-panel ca-two' }, [
      el('div', { className: 'ca-col' }, [
        el('div', { className: 'ca-sec ca-ver' }, [el('b', { text: '버전' }), sName, metaS, histBtn('store'), saveS]),
        el('div', { className: 'ca-sec' }, [el('b', { text: '업체 정보' }), el('small', { className: 'ca-when', text: '업체명·주소·예약 번호는 업체 정보에서 자동' })]),
        el('div', { className: 'ca-info' }, [el('label', {}, [el('span', { className: 'lbl', text: '체험 금액' }), infoF.price]), el('label', {}, [el('span', { className: 'lbl', text: '필수 키워드' }), infoF.must]), el('label', {}, [el('span', { className: 'lbl', text: '선택 키워드' }), infoF.opt])]),
        el('div', { className: 'ca-sec' }, [el('b', { text: '지점 특이사항' })]), sg,
        el('div', { className: 'ca-sec' }, [el('b', { text: `${brandOf(co)} 공통` }), metaB, histBtn('brand')]), bg]),
      el('div', { className: 'ca-col' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '블로거에게 보낼 가이드' }), el('small', { className: 'ca-when', text: '업체 정보 + 지점 특이사항 + 공통 자동 조합' })]), guideOut]),
    ]);
    const copyAll = () => { const l = live().filter((r) => r.phone); if (!l.length) { toast('명단에 번호가 없습니다 (명단 탭에서 저장)'); return; } copy(phonesOf(l), `체험단 ${l.length}명 번호`); };
    foots.guide = [el('span', { className: 'sp' }), el('button', { className: 'btn', type: 'button', text: '체험단 번호 복사', onclick: copyAll }), el('button', { className: 'btn primary', type: 'button', text: '가이드 복사', onclick: () => copy(guideOut.value, '가이드') })];

    // ⑤ 명단 체크리스트: 완료 체크 · 글 링크 · 점주 완료 보고 · 번호 복사 (바로 저장, ⑥ 재촉 문자와 연동)
    const ckBody = el('tbody'), ckSum = el('b', { className: 'ca-cnt' });
    const reportT = el('textarea', { className: 'fi ca-g' });
    const reportTxt = () => {
      // 블로거마다: 닉네임(이름) / 전화번호 / 리뷰 링크 — 맨 아래 '감사합니다:)'
      const ok = live().filter(complete);
      return [`안녕하세요 사장님, 무이(MUYI)입니다😊`, `${co.name} ${mno()}회차 체험단 리뷰 현황 공유드립니다.`, '',
        ...ok.flatMap((r) => [`${r.nickname || r.name}${r.nickname && r.name ? `(${r.name})` : ''}`, r.phone || '', r.post || r.blog || '', '']),
        '감사합니다:)'].join('\n');
    };
    const putRow = async (r, patch) => {
      if (!r.id) { toast('명단을 먼저 저장하세요 (명단 탭)'); return false; }
      const { error } = await sb.from('roster').update(patch).eq('id', r.id);
      if (error) { toast('저장 실패: ' + error.message); return false; } return true;
    };
    const paintCheck = () => {
      const l = live(), n = l.filter(complete).length;
      const cn = S.rows.length - l.length; ckSum.textContent = S.rows.length ? `완료 ${n} / ${l.length}명${l.length - n ? ` · 미완료 ${l.length - n}명` : ' · 전원 완료 🎉'}${cn ? ` · 취소 ${cn}명` : ''}` : '명단 없음';
      ckBody.replaceChildren(...S.rows.map((r, i) => {
        const cb = el('input', { type: 'checkbox', checked: complete(r), disabled: r.off || !r.id, title: '완료 체크' });
        cb.onchange = async () => {
          if (cb.checked) { if (await putRow(r, { done: true })) r.done = true; }
          else { if (r.post && !confirm(`${r.nickname || r.name} 글 링크도 지우고 미완료로 바꿀까요?`)) { cb.checked = true; return; } if (await putRow(r, { done: false, post_url: null })) { r.done = false; r.post = ''; } }
          paintCheck(); paintRem();
        };
        const lk = el('input', { className: 'fi', value: r.post || '', placeholder: '글 링크 붙여넣기 (넣으면 완료)', disabled: r.off || !r.id });
        lk.onchange = async () => { const v = lk.value.trim(); if (await putRow(r, { post_url: v || null, done: v ? true : r.done })) { r.post = v; if (v) r.done = true; } paintCheck(); paintRem(); };
        const st = r.off ? ['취소', 'off'] : complete(r) ? ['완료', 'ok'] : ['미완료', 'no'];
        return el('tr', { className: r.off ? 'off' : '' }, [el('td', {}, cb), el('td', { className: 'num', text: i + 1 }), el('td', {}, el('span', { className: 'ca-st ' + st[1], text: st[0] })), el('td', {}, [r.nickname || '', dupB(r)].filter(Boolean)), el('td', { text: r.name }), el('td', { className: 'cphone', text: r.phone }),
          el('td', { className: 'note' }, lk), el('td', {}, r.post ? el('a', { href: r.post, target: '_blank', rel: 'noopener', text: '글 보기' }) : r.blog ? el('a', { href: r.blog, target: '_blank', rel: 'noopener', text: '블로그' }) : '')]);
      }));
      reportT.value = reportTxt(); paintKw();
      ckEmpty.hidden = !!S.rows.length; ckWrap.hidden = !S.rows.length; ckHint.hidden = !S.rows.length || S.saved;
    };
    const ckEmpty = empty('idea', '명단이 없어요', '명단 탭에서 리뷰노트 명단을 저장하면 블로거별로 완료를 체크할 수 있어요.');
    const ckHint = el('div', { className: 'ca-hint', text: '명단을 저장해야 체크·링크가 저장됩니다 (명단 탭 → 저장)' });
    const ckWrap = el('div', { className: 'ca-scroll' }, el('table', { className: 'ca-tbl' }, [el('thead', {}, el('tr', {}, ['완료', '#', '상태', '닉네임', '이름', '연락처', '글 링크', ''].map((h) => el('th', { text: h })))), ckBody]));
    const copyRest = () => { const l = notPosted(); if (!l.length) { toast(S.rows.length ? '미완료 블로거가 없습니다 (전원 완료)' : '명단이 없습니다'); return; } copy(phonesOf(l), `미완료 ${l.length}명 번호`); };
    // 키워드 (마감 노출 현황 확인용) — 블로거 가이드의 필수·선택 키워드
    const kwBar = el('div', { className: 'ca-kw' });
    const paintKw = () => { const must = (info.must || '').trim(), opt = (info.opt || '').trim(); kwBar.replaceChildren(...(must || opt ? [must ? el('span', {}, [el('b', { text: '필수' }), must]) : null, opt ? el('span', {}, [el('b', { text: '선택' }), opt]) : null, el('button', { className: 'btn sm ghost', type: 'button', text: '키워드 복사', onclick: () => copy([must && '필수 키워드 : ' + must, opt && '선택 키워드 : ' + opt].filter(Boolean).join('\n'), '키워드') })].filter(Boolean) : [el('span', { className: 'ca-hint', text: '키워드 없음 — ④ 블로거 가이드에서 입력' })])); };
    panels.check = el('div', { className: 'ca-panel' }, [kwBar,
      el('div', { className: 'ca-sec' }, [ckSum, el('button', { className: 'btn sm', type: 'button', text: '전체 번호 복사', onclick: copyAll }), el('button', { className: 'btn sm', type: 'button', text: '미완료 번호 복사', onclick: copyRest })]),
      ckHint, ckEmpty, ckWrap,
      el('div', { className: 'ca-sec' }, [el('b', { text: '점주님께 보낼 완료 보고' }), el('button', { className: 'btn sm ghost', type: 'button', text: '다시 만들기', onclick: () => { reportT.value = reportTxt(); } })]), reportT,
    ]);
    foots.check = [el('span', { className: 'ca-hint', text: '체크·링크는 바로 저장 · 미완료 = ⑥ 재촉 문자 대상' }), el('span', { className: 'sp' }), el('button', { className: 'btn', type: 'button', text: '미완료 번호 복사', onclick: copyRest }), el('button', { className: 'btn primary', type: 'button', text: '완료 보고 복사', onclick: () => copy(reportT.value, '완료 보고') })];

    // ⑥ 재촉 문자: 기간 · 업체(직접 입력 + 자동 완성) → 문구 복사 (발송은 알리고 연동 후). 번호 = ⑤ 체크리스트 미완료
    const REM = [[7, '일주일 전'], [6, '6일 전'], [5, '5일 전'], [4, '4일 전'], [3, '3일 전'], [2, '2일 전'], [1, '내일 (1일 전)'], [0, '당일']];
    const left = Math.round((parse(p.deadline) - parse(today)) / 864e5);
    const rPer = el('select', { className: 'fi' }, REM.map(([n, t]) => el('option', { value: n, text: t, selected: n === (left >= 7 ? 7 : Math.max(0, left)) })));
    const rCo = el('input', { className: 'fi', value: co.name, placeholder: '업체명 입력 (자동 완성)', autocomplete: 'off' });
    const rList = el('datalist', { id: 'ca-co-' + Math.random().toString(36).slice(2, 8) }); rCo.setAttribute('list', rList.id);
    sb.from('companies').select('name,run_status').eq('stage', '결제').limit(3000).then(({ data }) => {
      rList.replaceChildren(...[...new Set([co.name, ...(data || []).sort((a, b) => (a.run_status !== '진행 중') - (b.run_status !== '진행 중') || a.name.localeCompare(b.name)).map((c) => c.name)])].map((v) => el('option', { value: v })));
    });
    const remindTxt = () => {
      const n = +rPer.value, nm = rCo.value.trim() || co.name;
      const head = n === 0 ? `오늘은 선정되신 [${nm}]체험단의 마감일입니다.` : n === 1 ? `내일은 선정되신 [${nm}]체험단의 마감일입니다.` : `오늘은 선정되신 [${nm}]체험단의 마감일 ${n === 7 ? '일주일' : n + '일'} 전입니다.`;
      return `안녕하세요 블로거님! ${head}\n\n기간 내에 체험 및 포스팅 완료해주시고, 이쪽으로 링크까지 한 번 더 보내주시면 감사하겠습니다 :)`;
    };
    const rOut = el('textarea', { className: 'fi ca-msg' });
    const rWho = el('div', { className: 'ca-hint' });
    const notPosted = () => live().filter((r) => !complete(r) && r.phone);
    const other = () => (rCo.value.trim() || co.name) !== co.name;
    const paintRem = () => { rOut.value = remindTxt(); const n = notPosted().length; rWho.textContent = other() ? '다른 업체를 적으면 문구만 바뀝니다 (번호는 그 업체 상세에서)' : S.rows.length ? `${co.name} 미완료 블로거 ${n}명 (⑤ 명단 체크리스트 기준) · 마감 ${mdw(p.deadline)}${left >= 0 ? ` (D-${left})` : ' (지남)'}` : '명단이 없어 보낼 번호가 없습니다 (명단 탭에서 저장)'; if (panels.check) paintCheck(); };
    rPer.onchange = paintRem; rCo.oninput = paintRem;
    panels.remind = el('div', { className: 'ca-panel ca-two' }, [
      el('div', { className: 'ca-col' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '재촉 문자 만들기' })]),
        el('label', {}, [el('span', { className: 'lbl', text: '기간 (마감일 기준)' }), rPer]),
        el('label', {}, [el('span', { className: 'lbl', text: '업체명' }), rCo, rList]), rWho,
        el('button', { className: 'btn', type: 'button', text: '글 안 올린 블로거 번호 복사', onclick: () => { if (other()) { toast('번호는 이 업체 명단만 복사됩니다 — 업체명을 되돌리거나 그 업체 상세에서 복사하세요'); return; } copyRest(); } })]),
      el('div', { className: 'ca-col' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '보낼 문구' }), el('small', { className: 'ca-when', text: '직접 고쳐도 됩니다' })]), rOut]),
    ]);
    foots.remind = [el('span', { className: 'ca-hint', text: '문자 발송은 알리고 연동 후 추가됩니다' }), el('span', { className: 'sp' }), el('button', { className: 'btn primary', type: 'button', text: '문구 복사', onclick: () => copy(rOut.value, '재촉 문자') })];
    paintRem();

    const paintSteps = () => stepsEl.replaceChildren(...TABS.map(([k, t], i) => el('button', { type: 'button', role: 'tab', className: (S.tab === k ? 'on' : '') + (k === 'list' && S.saved ? ' ok' : ''), onclick: () => go(k) }, [el('span', { className: 'no', text: k === 'list' && S.saved ? '✓' : String(i + 1) }), t])));
    function go(k) {
      S.tab = k; paintSteps();
      Object.entries(panels).forEach(([n, x]) => { x.hidden = n !== k; });
      foot.replaceChildren(...foots[k]);
      body.scrollTop = 0;
      if (k === 'image' || k === 'owner') refreshImg();
      if (k === 'remind' || k === 'check') paintRem();
    }
    body.append(...Object.values(panels));
    const P = layer([head, stepsEl, body, foot]);
    paintRows(); go(rn ? 'list' : S.tab);
    memoSide(P.L, co);
    brandDups(co, round?.id).then((m) => { S.dup = m; if (!P.L.isConnected || !m.size) return; paintRows(); try { paintCheck(); } catch {} }).catch(() => {});
    if (!S.saved) rnNear();
    if (rn) ingest({ rn });

    function draw(cv) {
      const x = cv.getContext('2d'), W = cv.width, H = cv.height;
      const F = (w, sz) => `${w} ${sz}px "Pretendard","Noto Sans KR",system-ui,sans-serif`;
      const BLUE = '#1E10C7', INK = '#14141B', SUB = '#6B6B76', LINE = '#E7E7EE';
      const tint = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      // 머리: 로고 + 업체명
      if (logoImg) { const lh = 66, lw = logoImg.width * (lh / logoImg.height); x.drawImage(logoImg, 64, 56, lw, lh); }
      else { x.fillStyle = BLUE; x.font = F(900, 48); x.fillText('muy!', 64, 108); }
      const badge = `체험단 ${mno()}회차 일정`; x.font = F(800, 22); const bw = x.measureText(badge).width + 40;
      rr(x, W - 64 - bw, 66, bw, 46, 23, tint('#1E10C7', 0.08)); x.fillStyle = BLUE; x.fillText(badge, W - 64 - bw + 20, 97);
      x.fillStyle = INK; fit(x, co.name, 64, 200, W - 128, 60, F, 900);
      x.fillStyle = SUB; x.font = F(600, 22); x.fillText(`선정 블로거 ${live().length || S.teams}명 · 리뷰 기간 ${S.weeks}주`, 64, 240);
      // 단계 타임라인 (4칸)
      const steps = [['모집', `${md(p.recruitFrom)} ~ ${md(p.recruitTo)}`, STEP_C.모집], ['발표', mdw(p.announce), STEP_C.발표], ['체험 + 리뷰', `${md(p.reviewFrom)} ~ ${md(p.reviewTo)}`, STEP_C.체험], ['리뷰 마감', mdw(p.deadline), STEP_C.마감]];
      const cw = (W - 128 - 30) / 4, ty = 282;
      steps.forEach(([t, v, c], i) => {
        const cx = 64 + i * (cw + 10);
        rr(x, cx, ty, cw, 124, 20, tint(c, 0.1));
        x.beginPath(); x.arc(cx + 30, ty + 36, 9, 0, Math.PI * 2); x.fillStyle = c; x.fill();
        x.fillStyle = c; x.font = F(800, 21); x.fillText(t + (i === 3 ? ' ♥' : ''), cx + 48, ty + 44);
        x.fillStyle = INK; fit(x, v, cx + 22, ty + 92, cw - 36, 27, F, 800);
        if (i < 3) { x.fillStyle = tint(c, 0.5); x.font = F(800, 22); x.fillText('›', cx + cw - 2, ty + 70); }
      });
      // 달력
      const months = []; let m = p.recruitFrom.slice(0, 7); const last = p.deadline.slice(0, 7);
      while (m <= last && months.length < 2) { months.push(m); const d = parse(m + '-01'); d.setMonth(d.getMonth() + 1); m = iso(d).slice(0, 7); }
      const top = 430, foot = 48, gap = 22, mh = (H - top - foot - gap * (months.length - 1)) / months.length;
      months.forEach((mm, i) => month(mm, 64, top + i * (mh + gap), W - 128, mh));
      function month(mm, X, Y, w, h) {
        const [yy, mo] = mm.split('-').map(Number); const lead = new Date(yy, mo - 1, 1).getDay(); const dim = new Date(yy, mo, 0).getDate();
        rr(x, X, Y, w, h, 24, '#F7F7FB');
        x.fillStyle = INK; x.font = F(900, 32); x.fillText(`${mo}월`, X + 28, Y + 52);
        const mw = x.measureText(`${mo}월`).width; x.fillStyle = SUB; x.font = F(600, 18); x.fillText(String(yy), X + 36 + mw, Y + 52);
        // 범례
        let lx = X + w - 28; [['마감', STEP_C.마감], ['체험+리뷰', STEP_C.체험], ['발표', STEP_C.발표], ['모집', STEP_C.모집]].forEach(([t, c]) => { x.font = F(700, 16); const tw = x.measureText(t).width; lx -= tw; x.fillStyle = SUB; x.fillText(t, lx, Y + 50); lx -= 22; rr(x, lx, Y + 36, 14, 14, 4, c); lx -= 18; });
        const gx = X + 18, gy = Y + 92, cwid = (w - 36) / 7, rows = Math.ceil((lead + dim) / 7), ch = (h - 110) / Math.max(rows, 5);
        x.font = F(700, 16); ['일', '월', '화', '수', '목', '금', '토'].forEach((d, k) => { x.fillStyle = k === 0 ? '#E11D48' : k === 6 ? BLUE : SUB; const tw = x.measureText(d).width; x.fillText(d, gx + k * cwid + (cwid - tw) / 2, gy); });
        for (let d = 1; d <= dim; d++) {
          const idx = lead + d - 1, r = Math.floor(idx / 7), c = idx % 7, s = `${mm}-${pad(d)}`;
          const cx = gx + c * cwid, cy = gy + 14 + r * ch;
          let fill = '#fff', fg = c === 0 ? '#E11D48' : INK, strong = false, tag = '';
          if (s >= p.recruitFrom && s < p.announce) { fill = tint(STEP_C.모집, 0.14); tag = s === p.recruitFrom ? '모집 시작' : ''; }
          if (s >= p.reviewFrom && s <= p.reviewTo) { fill = tint(STEP_C.체험, 0.16); tag = s === p.reviewFrom ? '체험 시작' : ''; }
          if (s === p.announce) { fill = STEP_C.발표; fg = '#fff'; strong = true; tag = '발표'; }
          if (s === p.deadline) { fill = STEP_C.마감; fg = '#fff'; strong = true; tag = '마감 ♥'; }
          rr(x, cx + 3, cy + 3, cwid - 6, ch - 6, 12, fill);
          x.fillStyle = fg; x.font = F(strong ? 900 : 700, 24); x.fillText(String(d), cx + 14, cy + 32);
          if (tag) { x.font = F(800, 13); x.fillStyle = strong ? '#fff' : (tag === '모집 시작' ? STEP_C.모집 : STEP_C.체험); const tw = x.measureText(tag).width; x.fillText(tag, cx + cwid - tw - 13, cy + ch - 13); }
        }
      }
    }
    function rr(x, X, Y, w, h, r, fill) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.fillStyle = fill; x.fill(); }
    function fit(x, t, X, Y, maxW, size, F, w) { let s = size; x.font = F(w, s); while (x.measureText(t).width > maxW && s > 14) { s -= 2; x.font = F(w, s); } x.fillText(t, X, Y); }
  }

  // ── 마감 확인: 명단 블로거의 블로그 RSS에서 업체명이 들어간 글을 찾아 링크 취합 → 마감 인원 반영 ──
  const CHAR = { idea: '/assets/brand/muyi-char-idea.webp', cry: '/assets/brand/muyi-char-cry.webp', ok: '/assets/brand/muyi-char.webp' };
  const empty = (img, title, sub, btn) => el('div', { className: 'ca-empty' }, [el('img', { src: CHAR[img], alt: '' }), el('b', { text: title }), sub ? el('span', { text: sub }) : null, btn || null].filter(Boolean));
  async function closeCheck({ co, cycle, cfg, step = '마감', onCount, announce, deadline }) {
    const p = period(cycle, cfg, { announce, deadline: step === '마감' ? deadline : undefined });
    const { data: round } = await sb.from('rounds').select('*').eq('company_id', co.id).eq('cycle_on', cycle).maybeSingle();
    const head = el('div', { className: 'ca-head' }, [
      el('div', { className: 'ca-title' }, [el('h3', { text: `${co.name} · ${step} 확인` }), round ? el('span', { className: 'rd', text: `${round.round_no}회차` }) : null, el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })].filter(Boolean)),
      el('div', { className: 'ca-tl' }, [(() => { const sp = el('span', {}, [el('i'), `체험+리뷰 ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`]); sp.style.setProperty('--c', STEP_C.체험); return sp; })(), (() => { const sp = el('span', {}, [el('i'), `리뷰 마감 ${mdw(p.deadline)} ♥`]); sp.style.setProperty('--c', STEP_C.마감); return sp; })()]),
    ]);
    const body = el('div', { className: 'ca-body' });
    const P = layer([head, body]);
    if (!round) { body.replaceChildren(empty('idea', '아직 저장된 명단이 없어요', '발표 도우미에서 리뷰노트 엑셀로 명단을 먼저 저장하면, 여기서 글 링크를 자동으로 모을 수 있어요.', el('button', { className: 'btn primary', type: 'button', text: '발표 도우미 열기', onclick: () => { P.close(); open({ co, cycle, cfg }); } }))); return; }
    const { data: ros } = await sb.from('roster').select('*').eq('round_id', round.id).order('created_at');
    const rows = (ros || []).map((r) => ({ ...r }));
    const status = el('div', { className: 'ca-hint' });
    const prog = el('div', { className: 'ca-prog', hidden: true }, el('i', { style: 'width:0' }));
    const tbody = el('tbody');
    const live = () => rows.filter((r) => !r.cancelled);
    const sum = el('b');
    const paint = () => {
      tbody.replaceChildren(...rows.map((r) => {
        const inp = el('input', { className: 'fi', value: r.post_url || '', placeholder: '글 링크 (자동 확인 또는 붙여넣기)' });
        inp.oninput = () => { r.post_url = inp.value.trim() || null; r._dirty = true; paintSum(); };
        const st = r.cancelled ? ['취소', 'off'] : r.post_url ? ['제출', 'ok'] : ['미제출', 'no'];
        return el('tr', { className: r.cancelled ? 'off' : '' }, [el('td', {}, el('span', { className: 'ca-st ' + st[1], text: st[0] })), el('td', { text: r.nickname || '' }), el('td', { text: r.name || '' }), el('td', { text: r.phone || '' }),
          el('td', {}, r.blog_url ? el('a', { href: r.blog_url, target: '_blank', rel: 'noopener', text: blogId(r.blog_url) || '블로그' }) : '—'), el('td', { className: 'note' }, inp), el('td', { className: 'ca-hint', text: r._title || '' })]);
      }));
      paintSum();
    };
    const paintSum = () => { const n = live().filter((r) => r.post_url).length; sum.textContent = `제출 ${n} / ${live().length}명${live().length - n ? ` · 미제출 ${live().length - n}명` : ' · 전원 제출 🎉'}`; };
    const keys = () => { const name = String(co.name || ''), brand = brandOf(co), branch = name.replace(brand, '').trim(); return [...new Set([name, name.replace(/\s+/g, ''), branch.length >= 2 ? (brand + branch) : '', branch.length >= 3 ? branch : ''].filter(Boolean))]; };
    async function check() {
      const todo = live().filter((r) => !r.post_url && blogId(r.blog_url));
      if (!todo.length) { status.textContent = '확인할 블로거가 없습니다 (이미 모두 링크가 있어요).'; return; }
      prog.hidden = false; prog.firstChild.style.width = '20%'; status.textContent = `${todo.length}명 블로그에서 "${keys()[0]}" 글 찾는 중…`;
      const { data, error } = await sb.functions.invoke('camp-assist', { body: { action: 'posts', ids: todo.map((r) => blogId(r.blog_url)), keywords: keys() } });
      prog.firstChild.style.width = '100%'; setTimeout(() => { prog.hidden = true; }, 600);
      if (error) { status.textContent = '자동 확인 실패 — 링크를 직접 붙여넣어 주세요.'; return; }
      const since = parse(addDays(p.reviewFrom, -3)).getTime();
      let found = 0;
      todo.forEach((r) => { const list = (data.posts[blogId(r.blog_url)] || []).filter((x) => !x.date || new Date(x.date).getTime() >= since); if (list[0]) { r.post_url = list[0].url; r._title = list[0].title; r._dirty = true; found++; } });
      status.textContent = `새로 찾은 글 ${found}건. 못 찾은 블로거는 비공개·최근 글 밖일 수 있어요 — 직접 확인 후 붙여넣어 주세요.`;
      paint();
    }
    async function save() {
      const dirty = rows.filter((r) => r._dirty);
      for (const r of dirty) { const { error } = await sb.from('roster').update({ post_url: r.post_url }).eq('id', r.id); if (error) { toast('저장 실패: ' + error.message); return false; } r._dirty = false; }
      return true;
    }
    const txt = () => rows.flatMap((r) => [(r.nickname || r.name) + (r.cancelled ? '\t\t\t취소' : r.post_url ? '' : '\t\t\t미제출'), r.name, r.phone, r.post_url || r.blog_url, '']).join('\n').trimEnd();
    paint();
    body.replaceChildren(
      el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [sum, el('button', { className: 'btn primary', type: 'button', text: '🔍 링크 자동 확인', onclick: check })]), prog, status]),
      el('div', { className: 'ca-scroll' }, el('table', { className: 'ca-tbl' }, [el('thead', {}, el('tr', {}, ['상태', '닉네임', '이름', '번호', '블로그', '글 링크', '찾은 글'].map((h) => el('th', { text: h })))), tbody])),
      el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [el('b', { text: '마감 명단 (닉네임 · 이름 · 번호 · 글 링크)' }),
        el('button', { className: 'btn', type: 'button', text: '명단 복사', onclick: () => copy(txt(), '마감 명단') }),
        el('button', { className: 'btn', type: 'button', text: '링크 저장', onclick: async () => { if (await save()) toast('글 링크 저장'); } }),
        onCount ? el('button', { className: 'btn brand', type: 'button', text: '저장 + 마감 인원 반영', onclick: async () => { if (!(await save())) return; const n = live().filter((r) => r.post_url).length; await onCount(n, round.teams || live().length); P.close(); } }) : null].filter(Boolean))]),
    );
  }

  // ── 2차마감 리뷰 수정 요청: 회차 → 블로거 → 수정 사유(여러 개) + 메모 → 문구·번호 복사, 기록 저장(review_fixes) ──
  const FIX_REASONS = ['하단 태그 누락', '생성형 이미지 사용', '타 지점 언급'];
  const josa = (w) => { const c = String(w || '').trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가'; };
  async function fixReq({ co, cycle, extra, task, onDelete }) {
    const { data: rds } = await sb.from('rounds').select('id,cycle_on,round_no').eq('company_id', co.id).order('cycle_on', { ascending: false }).limit(40);
    const rounds = (rds || []).filter((r) => r.cycle_on); // 모집일 없는 옛 회차는 제외 (팝업이 안 뜨던 원인)
    const S = { rid: (rounds.find((r) => r.cycle_on === cycle) || rounds.find((r) => r.cycle_on <= cycle) || rounds[0])?.id || '', rows: [], hist: [], who: '', reasons: new Set(), etc: '', memo: '', msgEdited: false };
    const rSel = el('select', { className: 'fi' }, rounds.length ? rounds.map((r) => el('option', { value: r.id, text: `${r.round_no || '?'}회차 · 모집 ${md(r.cycle_on)}`, selected: r.id === S.rid })) : [el('option', { value: '', text: '저장된 명단 없음' })]);
    const bSel = el('select', { className: 'fi' });
    const rsn = el('div', { className: 'fx-rsn' }, FIX_REASONS.map((t) => { const cb = el('input', { type: 'checkbox' }); cb.onchange = () => { cb.checked ? S.reasons.add(t) : S.reasons.delete(t); paintMsg(); }; return el('label', { className: 'chip fx-chip' }, [cb, t]); }));
    const etc = el('input', { className: 'fi', placeholder: '기타 사유 (직접 입력)' }); etc.oninput = () => { S.etc = etc.value.trim(); paintMsg(); };
    const memo = el('textarea', { className: 'fi ca-g sm', placeholder: '메모 (예: 본문 3번째 사진 AI 이미지)' }); memo.oninput = () => { S.memo = memo.value; };
    const msg = el('textarea', { className: 'fi ca-g' }); msg.oninput = () => { S.msgEdited = true; };
    // 명단이 없거나 명단에 없는 블로거 = 직접 입력 (2026-11-25~): 닉네임 / 이름 / 전화 / 블로그·글 링크를 한 칸에 붙여넣으면 줄마다 알아서 나눔
    const man = el('textarea', { className: 'fi ca-g sm fx-man', placeholder: '블로거 정보 붙여넣기 (줄마다)\n닉네임\n이름\n010-0000-0000\nhttps://blog.naver.com/아이디\n글 링크' });
    const manRow = () => { const ls = man.value.split(/\n+/).map((x) => x.trim()).filter(Boolean); const ph = ls.find((x) => /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(x)); const urls = ls.filter((x) => /^https?:/.test(x)); const tx = ls.filter((x) => x !== ph && !/^https?:/.test(x));
      const post = urls.find((u) => /blog\.naver\.com\/[^/?#]+\/\d+|logNo=\d+/.test(u)) || ''; return { id: 'manual', nickname: tx[0] || '', name: tx[1] || '', phone: ph || '', blog_url: urls.find((u) => u !== post) || '', post_url: post }; };
    man.oninput = () => { if (S.who === 'manual') paintWho(); };
    const who = () => S.who === 'manual' ? (manRow().nickname || manRow().phone ? manRow() : null) : S.rows.find((r) => r.id === S.who);
    const reasons = () => [...S.reasons, ...(S.etc ? [S.etc] : [])];
    const msgTxt = () => { const r = who(), rs = reasons(), t = rs.join(', ') || '(사유)'; return `안녕하세요 ${r ? r.nickname || r.name : '~'}님! [${co.name}] 의 리뷰 담당자입니다.\n\n작성해주신 리뷰의 내용 중 ${t}${rs.length ? josa(t) : '이'} 확인 되어 수정 요청드립니다:)`; };
    const paintMsg = () => { if (!S.msgEdited) msg.value = msgTxt(); };
    const info = el('div', { className: 'ca-hint' });
    const hist = el('div', { className: 'fx-hist' });
    const paintWho = () => { const r = who(); info.replaceChildren(...(r ? [`${r.name || ''} · ${r.phone || '번호 없음'}`, r.post_url ? el('a', { href: r.post_url, target: '_blank', rel: 'noopener', text: ' · 글 보기 ›' }) : ' · 글 링크 없음'] : [S.who === 'manual' ? '닉네임이나 전화번호를 넣어주세요' : '블로거를 고르세요'])); paintMsg(); };
    const paintHist = () => hist.replaceChildren(...(S.hist.length ? S.hist.map((h) => {
      const ok = el('button', { className: 'btn sm' + (h.fixed_at ? '' : ' primary'), type: 'button', text: h.fixed_at ? '✓ 수정 완료' : '수정 완료', onclick: async () => { const v = h.fixed_at ? null : new Date().toISOString(); const { error } = await sb.from('review_fixes').update({ fixed_at: v }).eq('id', h.id); if (error) { toast('저장 실패: ' + error.message); return; } h.fixed_at = v; paintHist(); } });
      const del = el('button', { className: 'btn sm ghost', type: 'button', text: '삭제', onclick: async () => { if (!confirm('이 수정 요청 기록을 지울까요?')) return; const { error } = await sb.from('review_fixes').delete().eq('id', h.id); if (error) { toast('삭제 실패: ' + error.message); return; } S.hist = S.hist.filter((x) => x !== h); paintHist(); } });
      return el('div', { className: 'fx-item' + (h.fixed_at ? ' done' : '') }, [el('div', {}, [el('b', { text: h.blogger || '-' }), el('small', { text: ` ${kstShort(h.created_at)}${h.created_by && admins[h.created_by] ? ' · ' + admins[h.created_by] : ''}` })]), el('div', { text: (h.reasons || []).join(', ') }), h.memo ? el('small', { text: h.memo }) : null, el('div', { className: 'acts' }, [ok, del])].filter(Boolean));
    }) : [el('div', { className: 'ca-hint', text: '이 회차에 저장된 수정 요청이 없습니다.' })]));
    const loadRound = async () => {
      const [ro, hs] = S.rid ? await Promise.all([sb.from('roster').select('*').eq('round_id', S.rid).order('created_at'), sb.from('review_fixes').select('*').eq('round_id', S.rid).order('created_at', { ascending: false })])
        : [{ data: [] }, await sb.from('review_fixes').select('*').eq('company_id', co.id).is('round_id', null).order('created_at', { ascending: false }).limit(30)]; // 명단 없는 회차 = 직접 입력한 요청
      S.rows = (ro.data || []).filter((r) => !r.cancelled); S.hist = hs.data || [];
      S.who = S.rows.some((r) => r.id === S.who) || (S.who === 'manual') ? S.who : (S.rows.length ? '' : 'manual');
      bSel.replaceChildren(el('option', { value: '', text: S.rows.length ? `블로거 선택 (${S.rows.length}명)` : '명단 없음' }), ...S.rows.map((r) => el('option', { value: r.id, text: `${r.nickname || r.name}${r.nickname && r.name ? ' · ' + r.name : ''}${S.hist.some((h) => h.roster_id === r.id && !h.fixed_at) ? ' (요청 중)' : ''}`, selected: r.id === S.who })),
        el('option', { value: 'manual', text: '✎ 직접 입력 (명단에 없음)', selected: S.who === 'manual' }));
      man.hidden = S.who !== 'manual';
      paintWho(); paintHist();
    };
    rSel.onchange = () => { S.rid = rSel.value; loadRound(); };
    bSel.onchange = () => { S.who = bSel.value; S.msgEdited = false; man.hidden = S.who !== 'manual'; if (S.who === 'manual') man.focus(); paintWho(); };
    const save = async () => {
      const r = who(); if (!r) { toast(S.who === 'manual' ? '블로거 닉네임이나 전화번호를 넣어주세요' : '블로거를 고르세요'); return; }
      if (!reasons().length) { toast('수정 사유를 고르세요'); return; }
      const { data, error } = await sb.from('review_fixes').insert({ company_id: co.id, round_id: S.rid || null, roster_id: r.id === 'manual' ? null : r.id, blogger: r.nickname || r.name || r.phone, phone: r.phone || null, reasons: reasons(), memo: [S.memo.trim(), r.id === 'manual' ? [r.name, r.blog_url, r.post_url].filter(Boolean).join(' · ') : ''].filter(Boolean).join('\n') || null, created_by: me }).select().single();
      if (error) { toast('저장 실패: ' + error.message); return; }
      S.hist.unshift(data); paintHist(); toast(`${data.blogger} 수정 요청 저장`);
    };
    const rd = rounds.find((r) => r.id === S.rid);
    const head = el('div', { className: 'ca-head' }, [el('div', { className: 'ca-title' }, [el('h3', { text: `${co.name} · 2차마감 리뷰 확인` }), (extra || []).length ? el('div', { className: 'ca-extra' }, extra) : '', el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]),
      el('div', { className: 'ca-hint', text: '태그 누락·생성형 이미지·타 지점 언급 등 리뷰를 다시 확인해 수정 요청을 보냅니다' + (rd ? '' : ' · 저장된 명단이 없으면 블로거를 직접 입력해 저장할 수 있습니다') })]);
    const lab = (t, x) => el('label', { className: 'ca-f' }, [el('span', { className: 'lbl', text: t }), x]);
    const body = el('div', { className: 'ca-body' }, el('div', { className: 'ca-panel ca-two' }, [
      el('div', { className: 'ca-col' }, [lab('체험단 회차', rSel), lab('블로거', bSel), man, info, el('span', { className: 'lbl', text: '수정 사유 (여러 개 선택)' }), rsn, etc, lab('메모', memo)]),
      el('div', { className: 'ca-col' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '보낼 문구' }), el('button', { className: 'btn sm ghost', type: 'button', text: '다시 만들기', onclick: () => { S.msgEdited = false; paintMsg(); } })]), msg,
        el('div', { className: 'ca-sec' }, [el('b', { text: '이 회차 수정 요청 기록' })]), hist]),
    ]));
    const foot = el('div', { className: 'ca-foot' }, [el('span', { className: 'sp' }),
      el('button', { className: 'btn', type: 'button', text: '번호 복사', onclick: () => { const r = who(); if (!r?.phone) { toast(r ? '번호가 없습니다' : '블로거를 고르세요'); return; } copy(r.phone, `${r.nickname || r.name} 번호`); } }),
      el('button', { className: 'btn', type: 'button', text: '문구 복사', onclick: () => copy(msg.value, '수정 요청 문구') }),
      el('button', { className: 'btn primary', type: 'button', text: '요청 저장', onclick: save })]);
    // 회차 메모 (이 2차마감 전체, camp_tasks 2차마감 memo) · [삭제]
    const cMemo = el('textarea', { className: 'fi ca-g sm fx-memo', value: task?.memo || '', placeholder: '이 회차 2차마감 메모 (예: 3명 수정 요청함, 금요일까지 재확인)' });
    cMemo.addEventListener('change', async () => { const { error } = await sb.from('camp_tasks').update({ memo: cMemo.value.trim() || null }).eq('company_id', co.id).eq('cycle_on', cycle).eq('step', '2차마감'); toast(error ? '메모 저장 실패: ' + error.message : '메모 저장'); });
    body.prepend(el('div', { className: 'ca-box' }, [el('div', { className: 'ca-sec' }, [el('b', { text: '회차 메모' }), el('small', { className: 'ca-when', text: '입력 후 칸 밖을 누르면 저장' })]), cMemo]));
    if (onDelete) head.querySelector('.ca-title').insertBefore(el('button', { className: 'btn sm rc-del', type: 'button', text: '삭제', onclick: async () => { if (!confirm(`${co.name} 2차마감을 삭제할까요?\n(수정 요청 기록·명단은 그대로)`)) return; if (await onDelete()) P.close(); } }), head.querySelector('.ca-title .icon-btn'));
    const P = layer([head, body, foot]);
    P.L.firstChild.classList.add('fx-pm');
    memoSide(P.L, co);
    paintMsg(); loadRound();
  }

  const parseRN = (txt) => { if (!/^MUYI-RN:/.test(txt || '')) return null; try { return JSON.parse(txt.slice(8)); } catch { return null; } };
  window.CRM_CAMP = { open, pick, period, closeCheck, parseRN, fixReq, guideView, memoSide, rosterAll };
})();
