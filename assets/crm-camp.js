// ── 체험단 발표 도우미: ① 명단(리뷰노트 엑셀 → TXT 양식 · 네이버 닉네임 · AI 특이사항) ② 점주 안내 멘트 ③ 일정 이미지 + 구글 캘린더 ④ 블로거 가이드 ──
// admin.html의 sb·el·me·toast·todayKst 사용. window.CRM_CAMP.open({ co, cycle, cfg }) / .pick(events, cfg)
// 저장: rounds(company_id, cycle_on, round_no, teams, review_weeks, deadline) + roster(nickname, name, phone, blog_url, note, ...)
// 브랜드 공통 블로거 가이드: crm_settings 'guide_brand:<브랜드>' · 지점 특이사항: guidelines(kind '체험단') 최신
(function () {
  const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const DOWK = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => String(n).padStart(2, '0');
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8)}`;
  const mdw = (s) => `${md(s)}(${DOWK[parse(s).getDay()]})`;
  const kmd = (s) => `${+s.slice(5, 7)}월 ${+s.slice(8)}일`;
  const blogId = (u) => { const m = String(u || '').match(/blog\.naver\.com\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; };
  const brandOf = (co) => (co.brand || String(co.name || '').split(/\s+/)[0] || '').trim();
  const loadLib = (src) => new Promise((ok, ng) => { if (window.XLSX) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('엑셀 라이브러리를 불러오지 못했습니다')); document.head.appendChild(s); });
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(`${what} 복사됨`); } catch { toast('복사 실패 — 직접 선택해서 복사하세요'); } };
  const period = (cycle, cfg) => { const ann = addDays(cycle, cfg.off.발표 || 0), dl = addDays(cycle, cfg.off.마감 || 0); return { recruitFrom: cycle, recruitTo: ann, announce: ann, reviewFrom: addDays(ann, 1), reviewTo: addDays(dl, -1), deadline: dl }; };

  if (!document.getElementById('crm-camp-css')) {
    const st = document.createElement('style'); st.id = 'crm-camp-css';
    st.textContent = `
.ca-pm{width:min(1040px,100%)!important}
.ca-head{display:grid;gap:10px;padding:16px 20px;border-bottom:1px solid var(--line)}
.ca-title{display:flex;align-items:center;gap:10px}
.ca-title h3{font-size:18px;font-weight:800;letter-spacing:-.02em;margin-right:auto}
.ca-title .rd{font-size:12px;font-weight:700;color:#fff;background:#1E10C7;border-radius:10px;padding:2px 9px}
.ca-tl{display:flex;flex-wrap:wrap;gap:6px}
.ca-tl span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:14px;background:color-mix(in srgb,var(--c) 10%,var(--surface));color:color-mix(in srgb,var(--c) 75%,var(--t1));border:1px solid color-mix(in srgb,var(--c) 25%,var(--line))}
.ca-tl span i{width:7px;height:7px;border-radius:50%;background:var(--c)}
.ca-steps{display:flex;gap:4px;padding:0 20px;border-bottom:1px solid var(--line);overflow-x:auto}
.ca-steps button{height:42px;padding:0 14px;border:0;background:none;font-weight:700;font-size:13px;color:var(--t3);border-bottom:2px solid transparent;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.ca-steps button .no{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;background:var(--muted);color:var(--t2)}
.ca-steps button.on{color:var(--t1);border-bottom-color:#1E10C7}
.ca-steps button.on .no{background:#1E10C7;color:#fff}
.ca-steps button.ok .no{background:var(--green);color:#fff}
.ca-body{padding:16px 20px 20px;display:grid;gap:14px;overflow-y:auto;min-height:0;flex:1}
.ca-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.ca-drop{display:grid;place-items:center;gap:6px;padding:22px;border:2px dashed var(--line-strong);border-radius:12px;background:var(--surface-2);text-align:center;cursor:pointer;color:var(--t2);font-size:13px}
.ca-drop:hover,.ca-drop.over{border-color:#1E10C7;background:color-mix(in srgb,#1E10C7 5%,var(--surface))}
.ca-drop b{font-size:15px;color:var(--t1)}
.ca-tbl{width:100%;border-collapse:collapse;font-size:12px}
.ca-tbl th{position:sticky;top:0;background:var(--muted);text-align:left;font-weight:600;color:var(--t3);padding:7px 8px;border-bottom:1px solid var(--line-strong)}
.ca-tbl td{padding:7px 8px;border-bottom:1px solid var(--line-2);vertical-align:top}
.ca-tbl tr.off td{opacity:.45;text-decoration:line-through}
.ca-tbl .nick input{width:110px;height:28px}
.ca-tbl .note input{width:100%;min-width:180px;height:28px}
.ca-tbl .msg{color:var(--t3);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
.ca-prog i{display:block;height:100%;background:#1E10C7;transition:width .3s}
.ca-pick{display:grid;gap:6px}
.ca-pick button{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);text-align:left;cursor:pointer}
.ca-pick button:hover{border-color:#1E10C7}
.ca-pick button b{font-size:14px}
.ca-pick button span{margin-left:auto;font-size:12px;color:var(--t3)}
@media (max-width:900px){.ca-row{grid-template-columns:1fr 1fr}.ca-out,.ca-img{grid-template-columns:1fr}}
`;
    document.head.appendChild(st);
  }

  function layer(kids) {
    const L = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === L) close(); } }, el('div', { className: 'pm ca-pm' }, kids));
    const onKey = (e) => { if (e.key === 'Escape' && document.body.lastElementChild === L) close(); };
    const close = () => { document.removeEventListener('keydown', onKey); L.remove(); };
    document.addEventListener('keydown', onKey); document.body.append(L);
    return { L, close };
  }

  // 업체 고르기 (달력 우상단 [명단 변환])
  function pick(events, cfg) {
    const list = events.slice().sort((a, b) => a.due.localeCompare(b.due) || a.co.name.localeCompare(b.co.name));
    const q = el('input', { className: 'fi', type: 'search', placeholder: '업체명 검색' });
    const box = el('div', { className: 'ca-pick' });
    const paint = () => { const s = q.value.trim(); box.replaceChildren(...(list.filter((e) => !s || e.co.name.includes(s)).slice(0, 60).map((e) => el('button', { type: 'button', onclick: () => { P.close(); open({ co: e.co, cycle: e.cycle, cfg }); } }, [el('b', { text: e.co.name }), el('span', { text: `발표 ${mdw(e.due)}${e.done ? ' · 완료' : ''}` })]))) || []); if (!box.childElementCount) box.append(el('div', { className: 'ca-hint', text: '이 달에 발표할 업체가 없습니다.' })); };
    q.oninput = paint;
    const P = layer([el('div', { className: 'pm-h' }, [el('h3', { text: '명단 변환 · 발표 업체 선택' }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]), el('div', { className: 'ca-body' }, [q, box])]);
    paint(); q.focus();
  }

  async function open({ co, cycle, cfg }) {
    const p = period(cycle, cfg);
    const [rd, rds, gl, gb] = await Promise.all([
      sb.from('rounds').select('*').eq('company_id', co.id).eq('cycle_on', cycle).maybeSingle(),
      sb.from('rounds').select('id', { count: 'exact', head: true }).eq('company_id', co.id),
      sb.from('guidelines').select('body,created_at').eq('company_id', co.id).eq('kind', '체험단').order('created_at', { ascending: false }).limit(1),
      sb.from('crm_settings').select('value').eq('key', 'guide_brand:' + brandOf(co)).maybeSingle(),
    ]);
    let round = rd.data;
    const ros = round ? (await sb.from('roster').select('*').eq('round_id', round.id).order('created_at')).data || [] : [];
    const S = {
      roundNo: round?.round_no || (rds.count || 0) + 1, teams: round?.teams || co.camp_teams || 10, weeks: round?.review_weeks || 4,
      rows: ros.map((r) => ({ nickname: r.nickname || '', name: r.name || '', phone: r.phone || '', blog: r.blog_url || '', post: r.post_url || '', note: r.note || '', grade: r.grade || '', visits: r.visits, msg: '', off: r.cancelled })),
      tab: ros.length ? 'owner' : 'list', saved: !!ros.length,
      storeGuide: gl.data?.[0]?.body || '', brandGuide: typeof gb.data?.value === 'string' ? gb.data.value : '',
    };
    const C = { 모집: '#1E10C7', 발표: '#7C3AED', 체험: '#2563EB', 마감: '#EE4E00' };
    const chip = (k, t) => { const s = el('span', {}, [el('i'), t]); s.style.setProperty('--c', C[k]); return s; };
    const head = el('div', { className: 'ca-head' }, [
      el('div', { className: 'ca-title' }, [el('h3', { text: co.name }), el('span', { className: 'rd', text: `${S.roundNo}회차` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => P.close() })]),
      el('div', { className: 'ca-tl' }, [chip('모집', `모집 ${mdw(p.recruitFrom)} ~ ${mdw(p.recruitTo)}`), chip('발표', `발표 ${mdw(p.announce)}`), chip('체험', `체험+리뷰 ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`), chip('마감', `리뷰 마감 ${mdw(p.deadline)} ♥`)]),
    ]);
    const stepsEl = el('div', { className: 'ca-steps' });
    const body = el('div', { className: 'ca-body' });
    const TABS = [['list', '명단 만들기'], ['owner', '점주 안내'], ['image', '일정 이미지 · 캘린더'], ['guide', '블로거 가이드']];
    const paintSteps = () => stepsEl.replaceChildren(...TABS.map(([k, t], i) => el('button', { type: 'button', className: (S.tab === k ? 'on' : '') + (k === 'list' && S.saved ? ' ok' : ''), onclick: () => { S.tab = k; render(); } }, [el('span', { className: 'no', text: k === 'list' && S.saved ? '✓' : String(i + 1) }), t])));
    const P = layer([head, stepsEl, body]);
    const live = () => S.rows.filter((r) => !r.off);

    // TXT 명단 (관리팀 양식)
    const rosterTxt = (withNote = true) => [
      `----------${S.roundNo}---------- 몇 팀 : ${S.teams}팀`, `리뷰기간 : ${S.weeks}주`, '', `리뷰노트 마감일 : ~ ${kmd(p.deadline)}`, '',
      ...S.rows.flatMap((r) => [r.nickname || '(닉네임)', r.name + (r.off ? '\t\t\t취소' : ''), r.phone, r.blog, ...(r.post ? [r.post] : []), ...(withNote && r.note && !r.off ? [`* ${r.note}`] : []), '']),
    ].join('\n');
    const ownerMsg = () => [
      `안녕하세요 사장님, 무이(MUYI)입니다 😊`,
      `${co.name} ${S.roundNo}회차 체험단 명단이 나와서 연락드립니다!`, '',
      `📅 일정`, `· 체험+리뷰 기간: ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`, `· 리뷰 마감: ${mdw(p.deadline)}`, '',
      `👥 선정 블로거 ${live().length}명`,
      ...live().map((r, i) => `${i + 1}. ${r.nickname || r.name} (${r.name}) ${r.phone}${r.note ? `\n   └ ${r.note}` : ''}`), '',
      `블로거분들이 예약 문의 시 "리뷰노트 체험단으로 선정된 OOO입니다"라고 연락드릴 예정이에요.`,
      `방문 시 '무이 체험단'이라고 말씀드리니 확인 부탁드립니다.`,
      `일정표 이미지와 캘린더 링크도 함께 보내드릴게요. 궁금하신 점은 언제든 편하게 연락 주세요. 감사합니다! 🙏`,
    ].join('\n');
    const guideTxt = () => [
      `[${co.name}] ${S.roundNo}회차 체험단 가이드`, '',
      `📅 체험+리뷰 기간: ${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`, `⏰ 리뷰 마감: ${mdw(p.deadline)} (마감일까지 꼭 등록 부탁드립니다)`, '',
      (S.brandGuide || '').replace('☆ 지점별 특이사항~', `☆ 지점별 특이사항~${S.storeGuide ? '\n' + S.storeGuide : ''}`),
      !S.brandGuide && S.storeGuide ? S.storeGuide : '',
    ].filter((x) => x !== '').join('\n');
    const gcal = (title, from, toIncl, details) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${from.replace(/-/g, '')}/${addDays(toIncl, 1).replace(/-/g, '')}&details=${encodeURIComponent(details)}`;
    const links = () => [
      ['체험+리뷰 기간', gcal(`[무이 체험단] ${co.name} 체험+리뷰 기간`, p.reviewFrom, p.reviewTo, `${S.roundNo}회차 · 블로거 ${live().length}명 방문·리뷰 기간\n리뷰 마감 ${mdw(p.deadline)}`)],
      ['리뷰 마감일', gcal(`[무이 체험단] ${co.name} 리뷰 마감`, p.deadline, p.deadline, `${S.roundNo}회차 리뷰 마감일 — 무이에서 등록 현황을 확인해 드립니다`)],
    ];

    async function saveRoster() {
      const row = { company_id: co.id, cycle_on: cycle, round_no: S.roundNo, round_label: String(S.roundNo), teams: S.teams, review_weeks: S.weeks, recruit_on: cycle, deadline: p.deadline, state: '진행' };
      let r = round;
      if (r) { const { data, error } = await sb.from('rounds').update(row).eq('id', r.id).select().single(); if (error) throw error; r = data; }
      else { const { data, error } = await sb.from('rounds').insert(row).select().single(); if (error) throw error; r = data; }
      round = r;
      const { error: e1 } = await sb.from('roster').delete().eq('round_id', r.id); if (e1) throw e1;
      if (S.rows.length) { const { error: e2 } = await sb.from('roster').insert(S.rows.map((x) => ({ round_id: r.id, nickname: x.nickname || null, name: x.name || null, phone: x.phone || null, blog_url: x.blog || null, post_url: x.post || null, note: x.note || null, grade: x.grade || null, visits: x.visits ?? null, cancelled: !!x.off }))); if (e2) throw e2; }
      S.saved = true;
    }

    // ① 명단 만들기
    function listView() {
      const num = (v, min = 1) => Math.max(min, Number(v) || min);
      const F = { no: el('input', { className: 'fi', type: 'number', min: 1, value: S.roundNo }), teams: el('input', { className: 'fi', type: 'number', min: 1, value: S.teams }), weeks: el('input', { className: 'fi', type: 'number', min: 1, value: S.weeks }) };
      F.no.oninput = () => { S.roundNo = num(F.no.value); head.querySelector('.rd').textContent = `${S.roundNo}회차`; txt.value = rosterTxt(); };
      F.teams.oninput = () => { S.teams = num(F.teams.value); txt.value = rosterTxt(); }; F.weeks.oninput = () => { S.weeks = num(F.weeks.value); txt.value = rosterTxt(); };
      const file = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', hidden: true });
      const prog = el('div', { className: 'ca-prog', hidden: true }, el('i', { style: 'width:0' }));
      const status = el('div', { className: 'ca-hint' });
      const drop = el('label', { className: 'ca-drop' }, [file, el('b', { text: '리뷰노트 신청자 엑셀(.xlsx · .csv)을 끌어다 놓거나 눌러서 선택' }), el('span', { text: '계정url · 이름 · 연락처 · 신청메시지 칸을 읽어 명단으로 바꿉니다. 닉네임은 블로그에서, 특이사항은 AI가 신청메시지를 읽고 채웁니다.' })]);
      ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
      drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) ingest(e.dataTransfer.files[0]); });
      file.onchange = () => file.files[0] && ingest(file.files[0]);
      const tbody = el('tbody');
      const txt = el('textarea', { className: 'fi', readOnly: true });
      const paintRows = () => {
        tbody.replaceChildren(...S.rows.map((r, i) => {
          const nk = el('input', { className: 'fi', value: r.nickname, placeholder: '닉네임' }); nk.oninput = () => { r.nickname = nk.value; txt.value = rosterTxt(); };
          const nt = el('input', { className: 'fi', value: r.note, placeholder: '특이사항 (AI)' }); nt.oninput = () => { r.note = nt.value; txt.value = rosterTxt(); };
          const on = el('input', { type: 'checkbox', checked: !r.off, title: '선정 (끄면 취소 표시)' }); on.onchange = () => { r.off = !on.checked; paintRows(); };
          return el('tr', { className: r.off ? 'off' : '' }, [el('td', {}, on), el('td', { className: 'num', text: i + 1 }), el('td', { className: 'nick' }, nk), el('td', { text: r.name }), el('td', { text: r.phone }), el('td', { className: 'num', text: r.visits ?? '' }), el('td', { text: r.grade }), el('td', { className: 'note' }, nt), el('td', { className: 'msg', text: r.msg, title: r.msg })]);
        }));
        txt.value = rosterTxt(); tableWrap.hidden = !S.rows.length;
        cnt.textContent = `선정 ${live().length}명${S.rows.length - live().length ? ` · 취소 ${S.rows.length - live().length}` : ''} / 모집 ${S.teams}팀`;
      };
      const cnt = el('b');
      const tableWrap = el('div', { className: 'ca-scroll' }, el('table', { className: 'ca-tbl' }, [el('thead', {}, el('tr', {}, ['선정', '#', '닉네임', '이름', '연락처', '일 방문', '등급', '특이사항', '신청메시지'].map((h) => el('th', { text: h })))), tbody]));
      async function ingest(f) {
        status.textContent = '엑셀 읽는 중…'; prog.hidden = false; prog.firstChild.style.width = '15%';
        try {
          await loadLib(XLSX_SRC);
          const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const pick = (o, ...ks) => { for (const k of ks) { const hit = Object.keys(o).find((h) => h.replace(/\s/g, '') === k.replace(/\s/g, '')); if (hit && String(o[hit]).trim()) return String(o[hit]).trim(); } return ''; };
          S.rows = raw.map((o) => ({ blog: pick(o, '계정url', '블로그', 'url'), name: pick(o, '이름', '성함'), phone: pick(o, '연락처', '전화번호'), msg: pick(o, '신청메시지', '신청 메시지'), grade: pick(o, '등급'), visits: Number(pick(o, '일 방문', '일방문').replace(/[^\d]/g, '')) || null, area: pick(o, '주소'), score: pick(o, '노출점수'), nickname: '', note: '', post: '', off: false })).filter((r) => r.name || r.blog);
          if (!S.rows.length) throw new Error('명단을 찾지 못했습니다 (이름·계정url 칸 확인)');
          paintRows(); prog.firstChild.style.width = '35%'; status.textContent = `${S.rows.length}명 읽음 · 네이버 닉네임 가져오는 중…`;
          const ids = [...new Set(S.rows.map((r) => blogId(r.blog)).filter(Boolean))];
          const nk = await sb.functions.invoke('camp-assist', { body: { action: 'nick', ids } });
          if (!nk.error) S.rows.forEach((r) => { const id = blogId(r.blog); if (id && nk.data.nick[id]) r.nickname = nk.data.nick[id]; });
          paintRows(); prog.firstChild.style.width = '65%'; status.textContent = 'AI가 신청메시지에서 특이사항 정리 중…';
          const nt = await sb.functions.invoke('camp-assist', { body: { action: 'notes', company: co.name, rows: S.rows.map((r, i) => ({ i, msg: r.msg, grade: r.grade, visits: r.visits, area: r.area, score: r.score })) } });
          if (!nt.error) S.rows.forEach((r, i) => { if (nt.data.notes[i]) r.note = nt.data.notes[i]; });
          paintRows(); prog.firstChild.style.width = '100%';
          status.textContent = `${S.rows.length}명 · 닉네임 ${S.rows.filter((r) => r.nickname).length}명 가져옴${nk.error ? ' (닉네임 실패 — 직접 입력)' : ''} · 특이사항 ${S.rows.filter((r) => r.note).length}건${nt.error ? ' (AI 실패 — 직접 입력)' : ''}. 확인 후 [명단 저장]을 누르세요.`;
          setTimeout(() => { prog.hidden = true; }, 800);
        } catch (e) { status.textContent = '실패: ' + e.message; prog.hidden = true; }
      }
      const save = el('button', { className: 'btn primary', type: 'button', text: '명단 저장', onclick: async () => {
        if (!S.rows.length) { toast('명단이 비어 있습니다'); return; }
        save.disabled = true; try { await saveRoster(); toast(`${co.name} ${S.roundNo}회차 명단 저장`); paintSteps(); } catch (e) { toast('저장 실패: ' + e.message); } save.disabled = false;
      } });
      paintRows();
      return [
        el('div', { className: 'ca-row' }, [lab('회차', F.no), lab('모집 팀 수', F.teams), lab('리뷰 기간 (주)', F.weeks), lab('리뷰 마감일', el('input', { className: 'fi', value: kmd(p.deadline), readOnly: true }))]),
        drop, prog, status,
        tableWrap,
        el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [cnt, el('button', { className: 'btn', type: 'button', text: 'TXT 복사', onclick: () => copy(rosterTxt(), '명단') }), save, el('button', { className: 'btn brand', type: 'button', text: '다음: 점주 안내 ›', onclick: () => { S.tab = 'owner'; render(); } })]), txt]),
      ].filter(Boolean);
    }
    const lab = (t, x) => el('label', {}, [el('span', { className: 'lbl', text: t }), x]);

    // ② 점주 안내
    function ownerView() {
      const t = el('textarea', { className: 'fi', value: ownerMsg() });
      const phone = co.phone || co.store_phone;
      return [
        !S.rows.length ? el('div', { className: 'ca-hint', text: '① 명단 만들기에서 엑셀을 먼저 넣으면 블로거 명단이 멘트에 들어갑니다.' }) : null,
        el('div', { className: 'ca-out' }, [
          el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [el('b', { text: '점주님께 보낼 멘트' }), el('button', { className: 'btn primary', type: 'button', text: '멘트 복사', onclick: () => copy(t.value, '멘트') })]), t]),
          el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [el('b', { text: '함께 보낼 것' })]),
            el('div', { className: 'ca-links' }, [
              el('div', { className: 'ca-link' }, [el('b', { text: '① 일정표 이미지' }), el('small', { text: '모집·발표·체험+리뷰·마감이 한눈에 보이는 이미지' }), el('div', { className: 'acts' }, el('button', { className: 'btn sm', type: 'button', text: '이미지 만들기 ›', onclick: () => { S.tab = 'image'; render(); } }))]),
              el('div', { className: 'ca-link' }, [el('b', { text: '② 구글 캘린더 링크' }), el('small', { text: '누르면 점주님 캘린더에 바로 추가됩니다' }), el('div', { className: 'acts' }, el('button', { className: 'btn sm', type: 'button', text: '링크 복사', onclick: () => copy(links().map(([k, u]) => `${k}: ${u}`).join('\n'), '캘린더 링크') }))]),
              el('div', { className: 'ca-link' }, [el('b', { text: '점주 연락처' }), el('small', { text: phone || '등록된 연락처가 없습니다' }), phone ? el('div', { className: 'acts' }, [el('a', { className: 'btn sm', href: `sms:${phone.replace(/[^\d]/g, '')}`, text: '문자 앱 열기' })]) : null].filter(Boolean)),
            ])]),
        ]),
      ].filter(Boolean);
    }

    // ③ 일정 이미지 · 구글 캘린더
    function imageView() {
      const cv = el('canvas', { width: 1080, height: 1350 });
      draw(cv);
      const dl = () => { const a = el('a', { href: cv.toDataURL('image/png'), download: `${co.name}_${S.roundNo}회차_일정.png` }); document.body.append(a); a.click(); a.remove(); };
      const cp = async () => { try { const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('이미지 복사됨 — 카톡에 붙여넣기'); } catch { toast('이 브라우저는 이미지 복사를 지원하지 않아요 — [PNG 저장]을 써주세요'); } };
      return [el('div', { className: 'ca-img' }, [cv, el('div', { className: 'ca-links' }, [
        el('div', { className: 'ca-link' }, [el('b', { text: '일정표 이미지' }), el('small', { text: '1080×1350 · 카톡·문자로 바로 보낼 수 있는 크기' }), el('div', { className: 'acts' }, [el('button', { className: 'btn primary sm', type: 'button', text: 'PNG 저장', onclick: dl }), el('button', { className: 'btn sm', type: 'button', text: '이미지 복사', onclick: cp })])]),
        ...links().map(([k, u]) => el('div', { className: 'ca-link' }, [el('b', { text: `구글 캘린더 · ${k}` }), el('small', { text: k === '리뷰 마감일' ? mdw(p.deadline) : `${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}` }), el('div', { className: 'acts' }, [el('a', { className: 'btn sm', href: u, target: '_blank', rel: 'noopener', text: '열어보기' }), el('button', { className: 'btn sm', type: 'button', text: '링크 복사', onclick: () => copy(u, '캘린더 링크') })])])),
      ])])];
    }
    function draw(cv) {
      const x = cv.getContext('2d'), W = cv.width, H = cv.height;
      const F = (w, s) => `${w} ${s}px "Pretendard","Noto Sans KR",system-ui,sans-serif`;
      const BLUE = '#1E10C7', ORANGE = '#EE4E00', PURPLE = '#7C3AED', REVIEW = '#3B82F6', INK = '#16161D', SUB = '#6B6B76';
      x.fillStyle = '#F4F5FA'; x.fillRect(0, 0, W, H);
      // 머리
      x.fillStyle = BLUE; x.fillRect(0, 0, W, 250);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(W - 80, 40, 220, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.font = F(900, 40); x.fillText('muy!', 64, 92);
      x.font = F(600, 22); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(`체험단 ${S.roundNo}회차 일정 안내`, 64, 138);
      x.font = F(800, 54); x.fillStyle = '#fff'; fit(x, co.name, 64, 205, W - 128, 54, F, 800);
      // 단계 카드 4개
      const steps = [['모집', `${mdw(p.recruitFrom)} ~ ${mdw(p.recruitTo)}`, BLUE], ['발표', mdw(p.announce), PURPLE], ['체험 + 리뷰', `${mdw(p.reviewFrom)} ~ ${mdw(p.reviewTo)}`, REVIEW], ['리뷰 마감 ♥', mdw(p.deadline), ORANGE]];
      const cw = (W - 128 - 36) / 4;
      steps.forEach(([t, v, c], i) => {
        const cx = 64 + i * (cw + 12), cy = 286;
        rr(x, cx, cy, cw, 120, 18, '#fff'); x.fillStyle = c; rr(x, cx, cy, cw, 8, 4, c);
        x.fillStyle = c; x.font = F(800, 22); x.fillText(t, cx + 18, cy + 50);
        x.fillStyle = INK; fit(x, v, cx + 18, cy + 90, cw - 30, 24, F, 700);
      });
      // 달력 (모집 시작 달 ~ 마감 달, 최대 2개)
      const months = []; let m = p.recruitFrom.slice(0, 7); const last = p.deadline.slice(0, 7);
      while (m <= last && months.length < 2) { months.push(m); const d = parse(m + '-01'); d.setMonth(d.getMonth() + 1); m = iso(d).slice(0, 7); }
      const top = 440, gap = 24, mh = (H - top - 110 - gap * (months.length - 1)) / months.length;
      months.forEach((mm, i) => month(x, mm, 64, top + i * (mh + gap), W - 128, mh));
      // 바닥 안내
      x.fillStyle = SUB; x.font = F(600, 20);
      const ft = '리뷰는 마감일까지 꼭 등록해 주세요 · 마감일에 무이가 등록 현황을 확인해 드립니다';
      x.fillText(ft, (W - x.measureText(ft).width) / 2, H - 56);
      function month(x, mm, X, Y, w, h) {
        const [yy, mo] = mm.split('-').map(Number); const first = new Date(yy, mo - 1, 1); const dim = new Date(yy, mo, 0).getDate(); const lead = first.getDay();
        rr(x, X, Y, w, h, 22, '#fff');
        x.fillStyle = INK; x.font = F(800, 30); x.fillText(`${mo}월`, X + 28, Y + 50); const mw = x.measureText(`${mo}월`).width; x.fillStyle = SUB; x.font = F(600, 18); x.fillText(String(yy), X + 28 + mw + 12, Y + 50);
        const gx = X + 20, gy = Y + 76, cwid = (w - 40) / 7, rows = Math.ceil((lead + dim) / 7), ch = (h - 96) / Math.max(rows, 5);
        x.font = F(700, 17); ['일', '월', '화', '수', '목', '금', '토'].forEach((d, k) => { x.fillStyle = k === 0 ? '#E11D48' : k === 6 ? BLUE : SUB; x.fillText(d, gx + k * cwid + cwid / 2 - 8, gy); });
        for (let d = 1; d <= dim; d++) {
          const idx = lead + d - 1, r = Math.floor(idx / 7), c = idx % 7, s = `${mm}-${pad(d)}`;
          const cx = gx + c * cwid, cy = gy + 14 + r * ch;
          let bg = null, fg = c === 0 ? '#E11D48' : INK, bold = 600;
          if (s >= p.recruitFrom && s < p.announce) bg = 'rgba(30,16,199,.12)';
          if (s >= p.reviewFrom && s <= p.reviewTo) bg = 'rgba(59,130,246,.16)';
          if (s === p.announce) { bg = PURPLE; fg = '#fff'; bold = 800; }
          if (s === p.deadline) { bg = ORANGE; fg = '#fff'; bold = 800; }
          if (bg) rr(x, cx + 3, cy + 3, cwid - 6, ch - 6, 12, bg);
          const ny = cy + Math.min(34, ch / 2 + 9);
          x.fillStyle = fg; x.font = F(bold, 24); x.fillText(String(d), cx + 14, ny);
          const tag = s === p.deadline ? '마감' : s === p.announce ? '발표' : s === p.recruitFrom ? '모집 시작' : s === p.reviewFrom ? '체험 시작' : '';
          if (tag) {
            x.font = F(800, 13); const tw = x.measureText(tag).width, tx = cx + cwid - tw - 14;
            x.fillStyle = s === p.deadline || s === p.announce ? '#fff' : s === p.recruitFrom ? BLUE : '#1D4ED8'; x.fillText(tag, tx, ny - 2);
            if (s === p.deadline) { x.font = F(800, 20); x.fillText('♥', cx + 14 + x.measureText(String(d)).width + 22, ny); }
          }
        }
      }
    }
    function rr(x, X, Y, w, h, r, fill) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.fillStyle = fill; x.fill(); }
    function fit(x, t, X, Y, maxW, size, F, w) { let s = size; x.font = F(w, s); while (x.measureText(t).width > maxW && s > 14) { s -= 2; x.font = F(w, s); } x.fillText(t, X, Y); }

    // ④ 블로거 가이드
    function guideView() {
      const bg = el('textarea', { className: 'fi', value: S.brandGuide, placeholder: `${brandOf(co)} 공통 가이드 (같은 브랜드 모든 지점에 적용)` });
      const sg = el('textarea', { className: 'fi', value: S.storeGuide, placeholder: '이 지점만의 특이사항 (예: 주차 가능, 월요일 휴무, 네이버 예약 가능)' });
      sg.style.minHeight = '120px';
      const out = el('textarea', { className: 'fi', readOnly: true, value: guideTxt() });
      bg.oninput = () => { S.brandGuide = bg.value; out.value = guideTxt(); }; sg.oninput = () => { S.storeGuide = sg.value; out.value = guideTxt(); };
      const saveB = el('button', { className: 'btn sm', type: 'button', text: '브랜드 공통 저장', onclick: async () => { const { error } = await sb.from('crm_settings').upsert({ key: 'guide_brand:' + brandOf(co), value: S.brandGuide, updated_at: new Date().toISOString() }); toast(error ? '저장 실패: ' + error.message : `${brandOf(co)} 공통 가이드 저장`); } });
      const saveS = el('button', { className: 'btn sm', type: 'button', text: '지점 특이사항 저장', onclick: async () => { const { error } = await sb.from('guidelines').insert({ company_id: co.id, kind: '체험단', body: S.storeGuide, created_by: me }); toast(error ? '저장 실패: ' + error.message : '지점 특이사항 저장 (가이드라인 이력에 남음)'); } });
      return [el('div', { className: 'ca-out' }, [
        el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [el('b', { text: `${brandOf(co)} 공통` }), saveB]), bg, el('div', { className: 'bar' }, [el('b', { text: '지점 특이사항' }), saveS]), sg]),
        el('div', { className: 'ca-box' }, [el('div', { className: 'bar' }, [el('b', { text: '블로거에게 보낼 가이드 (자동 조합)' }), el('button', { className: 'btn primary', type: 'button', text: '가이드 복사', onclick: () => copy(out.value, '가이드') })]), out]),
      ])];
    }

    function render() { paintSteps(); body.replaceChildren(...({ list: listView, owner: ownerView, image: imageView, guide: guideView }[S.tab])()); }
    render();
  }

  window.CRM_CAMP = { open, pick, period };
})();
