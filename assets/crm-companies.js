// ── 업체 DB: 가망 업체 / 계약 업체 목록 + 오른쪽 상세 패널 (② 단계: 조회 + 기본 정보·상태·담당 수정 + 상담 기록) ──
// admin.html의 sb·el·$·admins·me·toast·kst 사용. window.CRM_COMPANIES.mount(box, 'leads' | 'clients')
(function () {
  const PAGE = 100;
  const STAGE_COLOR = { 가망: '#71717A', 결정업체: '#1E10C7', 결제: '#16A34A', 뿌러짐: '#A1A1AA' };
  const RUN_COLOR = { '진행 중': '#16A34A', 홀딩: '#D97706', 계약종료: '#A1A1AA', 환불: '#DC2626', 양도: '#71717A' };
  const MODES = {
    leads: { title: '가망 업체', tabs: [['가망', '가망'], ['결정업체', '결정업체'], ['뿌러짐', '뿌러짐']], field: 'stage', base: (q) => q.neq('stage', '결제') },
    clients: { title: '계약 업체', tabs: [['진행 중', '진행 중'], ['홀딩', '홀딩'], ['계약종료', '계약종료'], ['환불', '환불']], field: 'run_status', base: (q) => q.eq('stage', '결제') },
  };
  const SORTS = {
    clients: [['last_paid_at', '최근 결제순', false], ['next_renew_due', '재계약 임박순', true], ['total_paid_won', '총 결제액순', false], ['name', '이름순', true]],
    leads: [['created_at', '최근 등록순', false], ['name', '이름순', true]],
  };
  const SOURCES = [['', '모든 출처'], ['notion', '노션'], ['excel', '엑셀'], ['expo', '박람회'], ['homepage', '홈페이지'], ['manual', '직접 등록']];
  const won = (n) => n == null ? '—' : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString()}만` : n.toLocaleString() + '원';
  const day = (d) => d ? String(d).slice(0, 10) : '—';
  const regionOf = (a) => { const t = String(a || '').replace(/["']/g, '').split(' ').filter(Boolean); return t.slice(0, 2).join(' '); };
  const dot = (text, color) => { const p = el('span', { className: 'pill', text: text || '—' }); if (color) p.style.setProperty('--c', color); return p; };
  const esc = (q) => q.replace(/[,()%*\\]/g, ' ').trim();

  // CSS (이 화면 전용)
  if (!document.getElementById('crm-co-css')) {
    const st = document.createElement('style'); st.id = 'crm-co-css';
    st.textContent = `
.co-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.co-filters select.fi{width:auto;height:28px;border-radius:14px;font-size:12px}
.co-tbl td.nm strong{color:var(--t1);font-weight:600}
.co-tbl td.nm .tag{margin-left:6px}
.co-tbl td.memo{max-width:260px;overflow:hidden;text-overflow:ellipsis}
.co-tbl tr.sel td{background:var(--muted)}
.co-tbl tr.sel td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
.co-more{display:flex;justify-content:center;padding:12px}
.co-flag{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;color:var(--amber)}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(620px,100%);background:var(--surface);border-left:1px solid var(--line-strong);box-shadow:-12px 0 32px rgba(0,0,0,.12);z-index:40;display:flex;flex-direction:column;animation:dIn .16s ease-out}
@keyframes dIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.dr-h{padding:16px 20px 0;display:grid;gap:6px;border-bottom:1px solid var(--line)}
.dr-top{display:flex;align-items:flex-start;gap:10px}
.dr-top h2{font-size:18px;font-weight:700;letter-spacing:-.02em;flex:1;min-width:0}
.dr-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--t3)}
.dr-tabs{display:flex;gap:2px;margin-top:8px}
.dr-tabs button{height:34px;padding:0 12px;border:0;background:none;color:var(--t3);font-weight:600;border-bottom:2px solid transparent}
.dr-tabs button.on{color:var(--t1);border-bottom-color:var(--accent)}
.dr-b{flex:1;overflow-y:auto;padding:16px 20px 32px;display:grid;gap:16px;align-content:start}
.dr-sec{display:grid;gap:8px}
.dr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dr-grid label.wide{grid-column:1/-1}
.dr-grid textarea.fi{min-height:70px}
.dr-empty{color:var(--t3);font-size:12px;padding:12px;border:1px dashed var(--line);border-radius:var(--r);text-align:center}
.dr-tbl{width:100%;border-collapse:collapse;font-size:12px}
.dr-tbl th{text-align:left;color:var(--t3);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--line)}
.dr-tbl td{padding:7px 8px;border-bottom:1px solid var(--line-2);color:var(--t2);vertical-align:top}
.dr-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}
.dr-tbl tr:last-child td{border-bottom:0}
.dr-note{white-space:pre-wrap;word-break:break-word;font-size:13px;color:var(--t1);background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:10px 12px}
.dr-ev{display:grid;gap:8px}
.dr-ev .bubble{max-width:none}
.dr-soon{font-size:12px;color:var(--t3)}
.bar{height:6px;background:var(--muted-2);border-radius:3px;overflow:hidden;min-width:60px}
.bar i{display:block;height:100%;background:var(--green)}
@media (max-width:720px){.dr-grid{grid-template-columns:1fr}}
.cell-sel{appearance:none;height:24px;padding:0 22px 0 18px;border:1px solid color-mix(in srgb,var(--c) 28%,var(--line));border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;
  color:color-mix(in srgb,var(--c) 70%,var(--t1));background:color-mix(in srgb,var(--c) 9%,var(--surface)) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%238A8A93' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 8px center;
  background-image:radial-gradient(circle at 9px 50%,var(--c) 3px,transparent 3.5px),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%238A8A93' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:0 0,right 8px center}
.cell-sel.plain{--c:var(--t4);padding-left:8px;border-color:transparent;background-color:transparent;color:var(--t1);font-weight:500;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%238A8A93' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-position:right 8px center}
.cell-sel:hover,.cell-sel:focus{border-color:var(--accent);outline:none}
.cell-sel.plain:hover{border-color:var(--line-strong);background-color:var(--surface)}
.btn.dirty{box-shadow:0 0 0 3px var(--accent-50)}
.dr-keys{display:flex;gap:10px;color:var(--t3);font-size:11px;padding:8px 20px;border-top:1px solid var(--line);background:var(--surface-2)}
.rd-head{display:flex;align-items:center;gap:8px}
.rd-head>div{margin-right:auto}
.rd-form{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
.rd-grid{grid-template-columns:repeat(3,1fr)}
.rd-list{display:grid;gap:6px}
.rd-row{display:grid;grid-template-columns:64px auto 1fr auto;gap:10px;align-items:center;width:100%;text-align:left;padding:9px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);cursor:pointer}
.rd-row:hover{border-color:var(--line-strong)}
.rd-row.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.rd-row.late{border-color:var(--red)}
.rd-post{font-size:12px;font-weight:600;color:var(--t2);font-variant-numeric:tabular-nums}
.rd-post.bad{color:var(--red)}
.rd-open{display:grid;gap:0}
.rd-body{display:grid;gap:10px;padding:10px 4px 4px}
.rd-url{height:28px;font-size:12px;min-width:160px}
.dr-tbl tr.late td{color:var(--red)}
.dr-tbl a{color:var(--accent);font-weight:600}
.dr-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px}
.dr-si{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:6px 10px;display:grid;gap:1px;min-width:0}
.dr-si small{font-size:11px;color:var(--t3)}
.dr-si b{font-size:13px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.dr-si.warn b{color:var(--red)}
.dr-si.ok b{color:var(--green)}
@media (max-width:720px){.dr-sum{grid-template-columns:1fr 1fr}}
.gk{display:flex;flex-wrap:wrap;gap:6px}
.gk button{height:30px;padding:0 10px;border:1px solid var(--line);border-radius:15px;background:var(--surface);font-weight:600;font-size:12px;color:var(--t2);display:inline-flex;gap:6px;align-items:center}
.gk button .n{font-size:11px;color:var(--t3);font-weight:500}
.gk button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.gk button.on .n{color:rgba(255,255,255,.8)}
.gd-text,.gd-preview{font-family:inherit;line-height:1.6;min-height:220px;white-space:pre-wrap}
.gd-preview{background:var(--surface-2)}
.gd-btns{display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
.gd-btns .sub{margin-right:auto}
.gd-hist summary{cursor:pointer;font-size:12px;color:var(--t2);font-weight:600;padding:6px 0}
.gd-v{border:1px solid var(--line);border-radius:var(--r);margin-top:8px;overflow:hidden}
.gd-vh{display:flex;gap:8px;align-items:center;padding:6px 10px;background:var(--surface-2);border-bottom:1px solid var(--line)}
.gd-vh .sub{margin-right:auto}
.gd-vh .btn{height:26px;font-size:12px}
.gd-pre{margin:0;padding:10px;white-space:pre-wrap;font-family:inherit;font-size:12px;color:var(--t2);max-height:200px;overflow:auto}
.ck-bar{height:6px;background:var(--muted-2);border-radius:3px;overflow:hidden}
.ck-bar i{display:block;height:100%;background:var(--green)}
.ck-list{display:grid;gap:4px}
.ck-btns{display:flex;gap:8px;flex-wrap:wrap}
.ck{display:grid;grid-template-columns:20px auto 1fr;gap:8px;align-items:center;font-size:13px;padding:6px 8px;border-radius:var(--r);background:var(--surface-2)}
.ck b{font-weight:600;color:var(--t1)}
.ck small{color:var(--t3);font-size:11px;text-align:right}
.ck-box{width:18px;height:18px;border:1.5px solid var(--line-strong);border-radius:5px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff}
.ck.ok .ck-box{background:var(--green);border-color:var(--green)}
.ck.ok b{color:var(--t3);text-decoration:line-through}
.pm-layer{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:60;display:grid;place-items:center;padding:16px}
.pm{background:var(--surface);border-radius:14px;width:min(720px,100%);max-height:calc(var(--vh, 100vh) - 32px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.pm-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
.pm-h h3{font-size:16px;font-weight:700}
.pm-b{overflow-y:auto;min-height:0;flex:1;padding:16px 20px;display:grid;gap:16px;align-content:start}
.pm-f{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--line)}
.pi-list{display:grid;grid-template-columns:1fr 1fr;gap:6px}
@media (max-width:720px){.pi-list{grid-template-columns:1fr}}
.pi{display:grid;grid-template-columns:1fr 90px 28px;gap:8px;align-items:center;padding:6px 8px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r)}
.pi b{font-size:13px;font-weight:600}
.pi .fi{height:30px}
`;
    document.head.appendChild(st);
  }

  let state = null; // { mode, tab, q, mine, review, source, rows, offset, done, openId }

  function mount(box, mode) {
    document.querySelector('.drawer')?.remove(); document.querySelector('.pm-layer')?.remove(); if (state) state.dirty = false;
    const M = MODES[mode];
    let savedSort = null; try { savedSort = localStorage.getItem('crm-sort-' + mode); } catch {}
    const sorts = SORTS[mode];
    state = { box, mode, tab: M.tabs[0][0], q: '', mine: false, review: false, source: '', rows: [], offset: 0, done: false, openId: null, counts: {},
      sort: sorts.some(([k]) => k === savedSort) ? savedSort : sorts[0][0] };
    const sortSel = el('select', { className: 'fi', title: '정렬', onchange: (e) => { state.sort = e.target.value; try { localStorage.setItem('crm-sort-' + mode, state.sort); } catch {} reload(); } },
      sorts.map(([k, t]) => el('option', { value: k, text: t, selected: k === state.sort })));
    const search = el('input', { className: 'fi', type: 'search', placeholder: '업체명·브랜드·연락처·주소 검색', oninput: debounce((e) => { state.q = e.target.value; reload(); }, 300) });
    const src = el('select', { className: 'fi', onchange: (e) => { state.source = e.target.value; reload(); } }, SOURCES.map(([v, t]) => el('option', { value: v, text: t })));
    const chip = (label, key) => el('button', { className: 'chip', type: 'button', text: label, onclick: (e) => { state[key] = !state[key]; e.target.classList.toggle('on', state[key]); reload(); } });
    state.tabsEl = el('div', { className: 'tabs' });
    state.descEl = el('span', { className: 'count' });
    state.listEl = el('tbody');
    state.moreEl = el('div', { className: 'co-more' });
    const isClients = mode === 'clients';
    box.replaceChildren(
      el('header', { className: 'topbar' }, [el('h1', { text: M.title }), state.descEl, el('label', { className: 'search' }, [el('span', { innerHTML: '<svg class="i"><use href="#i-search"/></svg>' }).firstChild, search])]),
      el('div', { className: 'pg' }, [
        state.tabsEl,
        el('div', { className: 'co-filters' }, [chip('내 담당', 'mine'), chip('확인 필요', 'review'), src, el('span', { className: 'ml-auto' }), sortSel]),
        el('div', { className: 'card' }, [el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl co-tbl' }, [
          el('thead', {}, el('tr', {}, (isClients ? ['업체', '지역', '연락처', '영업 담당', '상태', '최근 결제', '재계약 예정', '총 결제액'] : ['업체', '지역', '연락처', '영업 담당', '단계', '출처', '메모']).map((h) => el('th', { text: h })))),
          state.listEl]))]),
        state.moreEl,
      ]),
    );
    reload();
    if (window.__openCompany) { const id = window.__openCompany; delete window.__openCompany; open(id); }
  }

  function query(select, opts) {
    const M = MODES[state.mode];
    let q = M.base(sb.from('companies').select(select, opts));
    if (state.mine) q = q.or(`sales_owner.eq.${me},manager_owner.eq.${me}`);
    if (state.review) q = q.eq('needs_review', true);
    if (state.source) q = q.eq('lead_source', state.source);
    const s = esc(state.q);
    if (s) q = q.or(`name.ilike.*${s}*,brand.ilike.*${s}*,phone.ilike.*${s}*,address.ilike.*${s}*`);
    return q;
  }

  async function reload() {
    const M = MODES[state.mode];
    state.rows = []; state.offset = 0; state.done = false;
    state.listEl.replaceChildren(...Array.from({ length: 8 }, () => el('tr', {}, Array.from({ length: state.mode === 'clients' ? 8 : 7 }, (_, i) => el('td', {}, el('span', { className: 'skel', style: `width:${[70, 50, 60, 40, 46, 52, 48, 40][i]}%` }))))));
    // 탭별 건수
    const counts = await Promise.all(M.tabs.map(([v]) => query('id', { count: 'exact', head: true }).eq(M.field, v)));
    state.counts = Object.fromEntries(M.tabs.map(([v], i) => [v, counts[i].count || 0]));
    state.tabsEl.replaceChildren(...M.tabs.map(([v, label]) => {
      const b = el('button', { className: 'tab' + (state.tab === v ? ' on' : ''), type: 'button', onclick: () => { state.tab = v; reload(); } },
        [el('span', { className: 'dot' }), label, el('span', { className: 'n', text: (state.counts[v] || 0).toLocaleString() })]);
      b.style.setProperty('--c', (state.mode === 'clients' ? RUN_COLOR : STAGE_COLOR)[v]); return b;
    }));
    await more();
  }

  async function more() {
    const M = MODES[state.mode];
    state.moreEl.replaceChildren();
    const [, , asc] = SORTS[state.mode].find(([k]) => k === state.sort);
    let q = query('id,name,brand,address,phone,store_phone,sales_owner_name,stage,run_status,lead_source,notes,needs_review,tags,last_paid_at,next_renew_due,total_paid_won')
      .eq(M.field, state.tab).order(state.sort, { ascending: asc, nullsFirst: false });
    if (state.sort !== 'name') q = q.order('name');
    const { data, error } = await q.range(state.offset, state.offset + PAGE - 1);
    if (error) { state.listEl.replaceChildren(el('tr', {}, el('td', { colSpan: 8, className: 'empty', text: '불러오기 실패: ' + error.message }))); return; }
    data.forEach((r) => { r._ct = r.last_paid_at || r.next_renew_due || r.total_paid_won ? { paid: r.last_paid_at, renew: r.next_renew_due, sum: r.total_paid_won } : null; });
    state.rows.push(...data); state.offset += data.length; state.done = data.length < PAGE;
    const total = state.counts[state.tab] || 0;
    state.descEl.textContent = `${total.toLocaleString()}곳` + (state.rows.length < total ? ` · ${state.rows.length.toLocaleString()}곳 표시` : '');
    drawRows();
    if (!state.done) state.moreEl.replaceChildren(el('button', { className: 'btn', type: 'button', text: `100곳 더 보기 (${state.rows.length.toLocaleString()} / ${total.toLocaleString()})`, onclick: more }));
  }

  function drawRows() {
    const clients = state.mode === 'clients';
    const today = new Date().toISOString().slice(0, 10);
    if (!state.rows.length) { state.listEl.replaceChildren(el('tr', {}, el('td', { colSpan: 8, className: 'empty', text: '조건에 맞는 업체가 없습니다.' }))); return; }
    state.listEl.replaceChildren(...state.rows.map((r) => {
      const name = el('td', { className: 'nm' }, [el('strong', { text: r.name }), r.brand && r.brand !== r.name && el('span', { className: 'tag', text: r.brand }), r.needs_review && el('span', { className: 'co-flag', text: '확인 필요' })]);
      const cells = clients
        ? [name, el('td', { className: 'sub', text: regionOf(r.address) || '—' }), el('td', { text: r.phone || r.store_phone || '—' }), ownerCell(r),
          statusCell(r, 'run_status', ['진행 중', '홀딩', '계약종료', '환불', '양도'], RUN_COLOR), el('td', { className: 'sub', text: day(r._ct?.paid) }),
          el('td', { className: r._ct?.renew && r._ct.renew >= today && r._ct.renew <= addDaysIso(30) ? 'err' : 'sub', text: day(r._ct?.renew) }), el('td', { className: 'sub', text: r._ct ? won(r._ct.sum) : '—' })]
        : [name, el('td', { className: 'sub', text: regionOf(r.address) || '—' }), el('td', { text: r.phone || r.store_phone || '—' }), ownerCell(r),
          statusCell(r, 'stage', ['가망', '결정업체', '뿌러짐'], STAGE_COLOR), el('td', { className: 'sub', text: (SOURCES.find(([v]) => v === r.lead_source) || [, '—'])[1] }),
          el('td', { className: 'sub memo', text: (r.notes || '').replace(/\s+/g, ' ') || '—' })];
      return el('tr', { className: r.id === state.openId ? 'sel' : '', onclick: () => open(r.id) }, cells);
    }));
  }
  const addDaysIso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  // ── 상세 패널 ──
  let drawer = null;
  // 저장 안 한 변경이 있으면 닫기·이동 전에 확인
  function guard() { if (state?.dirty && !confirm('저장하지 않은 변경 내용이 있습니다. 버리고 이동할까요?')) return false; if (state) state.dirty = false; return true; }
  function close() {
    if (!guard()) return;
    drawer?.remove(); drawer = null; state.openId = null; state.dirty = false; drawRows();
    if (location.hash.startsWith('#co-')) history.replaceState(null, '', '#' + state.mode);
  }
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  document.addEventListener('keydown', (e) => {
    if (!drawer || document.querySelector('.pm-layer, .cmdk-layer')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); state.saveInfo?.(); return; }
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const i = state.rows.findIndex((r) => r.id === state.openId), n = (e.key === 'j' || e.key === 'ArrowDown') ? i + 1 : i - 1;
      if (state.rows[n]) { e.preventDefault(); open(state.rows[n].id, state.tabNow || 'info'); document.querySelector('.co-tbl tr.sel')?.scrollIntoView({ block: 'nearest' }); }
    }
  });
  // 표에서 바로 바꾸기: 상태 · 영업 담당 (상세를 열지 않고)
  async function quickUpdate(r, patch, label) {
    const { error } = await sb.from('companies').update(patch).eq('id', r.id);
    if (error) { toast('저장 실패: ' + error.message); return false; }
    Object.assign(r, patch);
    await sb.from('company_events').insert({ company_id: r.id, actor: me, kind: 'system', body: label });
    toast(label); return true;
  }
  function statusCell(r, field, options, colors) {
    const cur = r[field];
    const sel = el('select', { className: 'cell-sel', title: '눌러서 바로 변경', onclick: (e) => e.stopPropagation() }, options.map((v) => el('option', { value: v, text: v, selected: v === cur })));
    sel.style.setProperty('--c', colors[cur] || 'var(--t4)');
    sel.onchange = async () => { const v = sel.value; if (await quickUpdate(r, { [field]: v }, `${field === 'stage' ? '단계' : '계약 상태'}: ${cur || '—'} → ${v}`)) reload(); else sel.value = cur; };
    return el('td', {}, sel);
  }
  function ownerCell(r) {
    const sel = el('select', { className: 'cell-sel plain', title: '눌러서 담당 변경', onclick: (e) => e.stopPropagation() }, [
      el('option', { value: '', text: r.sales_owner_name && !r.sales_owner ? r.sales_owner_name : '미배정' }),
      ...Object.entries(admins).map(([id, n]) => el('option', { value: id, text: n, selected: id === r.sales_owner }))]);
    sel.onchange = async () => { const v = sel.value || null; if (!(await quickUpdate(r, { sales_owner: v, sales_owner_name: v ? admins[v] : null }, `영업 담당 → ${v ? admins[v] : '미배정'}`))) sel.value = r.sales_owner || ''; };
    return el('td', {}, sel);
  }

  async function open(id, tab = 'info') {
    if (drawer && state.openId !== id && !guard()) return;
    state.openId = id; state.dirty = false; state.saveInfo = null; state.tabNow = null; drawRows();
    if (location.hash !== '#co-' + id) history.replaceState(null, '', '#co-' + id);
    drawer?.remove(); state.dirty = false;
    drawer = el('aside', { className: 'drawer' }, el('div', { className: 'dr-b' }, [60, 90, 40, 75, 55, 85].map((w) => el('span', { className: 'skel', style: `width:${w}%;height:14px` }))));
    document.body.append(drawer);
    const [c, ct, dl, wk, rd, hd, gl, ev, dc, cd] = await Promise.all([
      sb.from('companies').select('*').eq('id', id).single(),
      sb.from('contracts').select('*').eq('company_id', id).order('paid_at', { ascending: false }),
      sb.from('deliverables').select('*').eq('company_id', id).order('created_at'),
      sb.from('work_logs').select('*').eq('company_id', id).order('scheduled_on', { ascending: false }),
      sb.from('rounds').select('*').eq('company_id', id).order('created_at'),
      sb.from('holds').select('*').eq('company_id', id).order('started_at', { ascending: false }),
      sb.from('guidelines').select('*').eq('company_id', id).order('created_at', { ascending: false }),
      sb.from('company_events').select('*').eq('company_id', id).order('created_at'),
      sb.from('documents').select('id,kind,title,created_at').eq('company_id', id),
      sb.rpc('masked_cards', { p_company: id }),
    ]);
    if (c.error || !c.data) { drawer.replaceChildren(el('div', { className: 'dr-b' }, el('div', { className: 'err', text: '업체를 불러오지 못했습니다' }))); return; }
    const co = c.data, D = { ct: ct.data || [], dl: dl.data || [], wk: wk.data || [], rd: rd.data || [], hd: hd.data || [], gl: gl.data || [], ev: ev.data || [], dc: dc.data || [], cd: cd.data || [] };
    const body = el('div', { className: 'dr-b' });
    const TABS = [['info', '정보·기록'], ['contract', `계약·실행 ${D.ct.length + D.dl.length ? '' : ''}`], ['camp', '체험단'], ['docs', '가이드라인·서류']];
    const tabsEl = el('div', { className: 'dr-tabs' });
    const show = (t) => { if (state.tabNow && state.tabNow !== t && !guard()) return; state.tabNow = t; [...tabsEl.children].forEach((b) => b.classList.toggle('on', b.dataset.t === t)); body.replaceChildren(...SECTIONS[t]().filter(Boolean)); };
    TABS.forEach(([k, l]) => { const b = el('button', { type: 'button', text: l.trim(), onclick: () => show(k) }); b.dataset.t = k; tabsEl.append(b); });
    const sum = D.ct.reduce((s, x) => s + (x.amount_won || 0), 0);
    drawer.replaceChildren(
      el('div', { className: 'dr-h' }, [
        el('div', { className: 'dr-top' }, [el('h2', { text: co.name }),
          el('button', { className: 'btn brand', type: 'button', text: co.stage === '결제' ? '재계약 등록' : '결제 등록', onclick: () => payModal(co, D) }),
          el('button', { className: 'icon-btn', type: 'button', title: '닫기 (Esc)', text: '✕', onclick: close })]),
        el('div', { className: 'dr-meta' }, [
          dot(co.stage, STAGE_COLOR[co.stage]), co.stage === '결제' && dot(co.run_status, RUN_COLOR[co.run_status]),
          co.brand && el('span', { className: 'tag', text: co.brand }), co.needs_review && el('span', { className: 'co-flag', text: `확인 필요 · ${co.review_reason || ''}` }),
          D.ct.length ? el('span', { text: `계약 ${D.ct.length}건 · 총 ${won(sum)}` }) : null,
          ...(co.tags || []).filter((t) => !['노션', '엑셀'].includes(t)).map((t) => el('span', { className: 'tag', text: t })),
        ].filter(Boolean)),
        summaryView(co, D),
        tabsEl,
      ]),
      body,
      el('div', { className: 'dr-keys' }, [el('span', {}, [el('kbd', { text: 'J' }), ' ', el('kbd', { text: 'K' }), ' 다음·이전 업체']), el('span', {}, [el('kbd', { text: 'Ctrl S' }), ' 저장']), el('span', {}, [el('kbd', { text: 'Esc' }), ' 닫기']), el('span', {}, [el('kbd', { text: 'Ctrl K' }), ' 검색'])]),
    );
    const SECTIONS = {
      info: () => [co.stage === '결제' ? checklistView(co, D) : null, infoForm(co), eventsView(co, D.ev)],
      contract: () => [contractsView(D.ct), deliverablesView(D.dl), worksView(D.wk), holdsView(D.hd)],
      camp: () => [roundsView(co, D)],
      docs: () => [guidesView(co, D), el('div', { className: 'dr-sec' }, [el('div', { className: 'sec-t', text: '서류 · 카드' }), el('div', { className: 'dr-empty', text: '사업자등록증·계약서 텍스트화, 카드 정보(대표만)는 다음 단계에서 추가됩니다.' })])],
    };
    show(tab);
  }

  // 상세 상단 한 줄 요약: 최근 결제 · 재계약 D-day · 남은 실행량 · 체크리스트
  function summaryView(co, D) {
    if (co.stage !== '결제') return el('div', { className: 'dr-sum' }, [
      sumItem('단계', co.stage), sumItem('영업 담당', co.sales_owner_name || '미배정'), sumItem('연락처', co.phone || co.store_phone || '—'), sumItem('최근 기록', D.ev.length ? kst(D.ev[D.ev.length - 1].created_at) : '없음')]);
    const last = D.ct[0];
    const renew = D.ct.map((c) => c.renew_due).filter(Boolean).sort().pop();
    const dd = renew ? Math.round((new Date(renew) - new Date(new Date().toISOString().slice(0, 10))) / 864e5) : null;
    const cur = D.dl.filter((d) => !last || d.contract_id === last.id || !d.contract_id);
    const left = cur.reduce((s, d) => s + Math.max(0, (Number(d.planned) || 0) - (Number(d.done) || 0)), 0);
    const ck = checks(co, D).filter(([, v]) => v !== null);
    return el('div', { className: 'dr-sum' }, [
      sumItem('최근 결제', last?.paid_at ? `${String(last.paid_at).slice(2, 10).replace(/-/g, '.')} · ${won(last.amount_won)}` : '—'),
      sumItem('재계약', renew ? (dd < 0 ? `${-dd}일 지남` : `D-${dd}`) : '—', dd != null && dd <= 30 ? 'warn' : ''),
      sumItem('남은 실행량', cur.length ? `${left.toLocaleString()}건 · ${cur.length}개 항목` : '—'),
      sumItem('체크리스트', `${ck.filter(([, v]) => v).length}/${ck.length}`, ck.every(([, v]) => v) ? 'ok' : ''),
    ]);
  }
  const sumItem = (k, v, cls = '') => el('div', { className: 'dr-si ' + cls }, [el('small', { text: k }), el('b', { text: v })]);

  const sec = (title, kids) => el('div', { className: 'dr-sec' }, [el('div', { className: 'sec-t', text: title }), ...[].concat(kids)]);
  const table = (head, rows, numCols = []) => rows.length ? el('table', { className: 'dr-tbl' }, [
    el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))),
    el('tbody', {}, rows.map((r) => el('tr', {}, r.map((v, i) => el('td', { className: numCols.includes(i) ? 'num' : '' }, v instanceof Node ? v : String(v ?? '—'))))))]) : el('div', { className: 'dr-empty', text: '기록이 없습니다.' });

  function infoForm(co) {
    const F = {};
    const input = (k, label, opts = {}) => { F[k] = el(opts.area ? 'textarea' : 'input', { className: 'fi', value: co[k] ?? '', ...(opts.type ? { type: opts.type } : {}) }); return el('label', { className: opts.wide ? 'wide' : '' }, [el('span', { className: 'lbl', text: label }), F[k]]); };
    const ownerSel = (k, nameKey, label) => {
      const cur = co[k] || '';
      const s = el('select', { className: 'fi' }, [el('option', { value: '', text: co[nameKey] && !co[k] ? `${co[nameKey]} (계정 없음)` : '미배정' }),
        ...Object.entries(admins).map(([id, n]) => el('option', { value: id, text: n, selected: id === cur }))]);
      F[k] = s; return el('label', {}, [el('span', { className: 'lbl', text: label }), s]);
    };
    F.stage = el('select', { className: 'fi' }, ['가망', '결정업체', '결제', '뿌러짐'].map((v) => el('option', { value: v, text: v, selected: co.stage === v })));
    F.run_status = el('select', { className: 'fi' }, [el('option', { value: '', text: '—' }), ...['진행 중', '홀딩', '계약종료', '환불', '양도'].map((v) => el('option', { value: v, text: v, selected: co.run_status === v }))]);
    const saveBtn = el('button', { className: 'btn primary', type: 'button', text: '저장', onclick: save });
    const markDirty = (e) => { if (!e.target.isConnected || !saveBtn.isConnected) return; state.dirty = true; saveBtn.textContent = '저장 (Ctrl+S)'; saveBtn.classList.add('dirty'); };
    queueMicrotask(() => Object.values(F).forEach((x) => { x.addEventListener('input', markDirty); x.addEventListener('change', markDirty); }));
    state.saveInfo = save;
    async function save() {
      const patch = {};
      ['name', 'brand', 'phone', 'store_phone', 'email', 'address', 'map_url', 'rep_name', 'rep_note', 'category', 'notes'].forEach((k) => { const v = F[k].value.trim() || null; if ((co[k] ?? null) !== v) patch[k] = v; });
      ['sales_owner', 'manager_owner'].forEach((k) => {
        const v = F[k].value || null; if ((co[k] ?? null) === v) return;
        patch[k] = v; const nk = k + '_name'; if (v) patch[nk] = admins[v]; else if (co[k]) patch[nk] = null; // 계정→미배정으로 바꾸면 이름도 비움
      });
      if (F.stage.value !== co.stage) patch.stage = F.stage.value;
      const run = patch.stage && patch.stage !== '결제' ? null : (F.run_status.value || (F.stage.value === '결제' ? '진행 중' : null));
      if ((co.run_status ?? null) !== run) patch.run_status = run;
      if (!Object.keys(patch).length) { state.dirty = false; toast('바뀐 내용이 없습니다'); return; }
      if (patch.name === null) { toast('업체명은 비울 수 없습니다'); return; }
      saveBtn.disabled = true;
      const { error } = await sb.from('companies').update(patch).eq('id', co.id);
      saveBtn.disabled = false;
      if (error) { toast('저장 실패: ' + error.message); return; }
      const what = Object.keys(patch).map((k) => ({ stage: '단계', run_status: '계약 상태', sales_owner: '영업 담당', manager_owner: '관리 담당' }[k])).filter(Boolean);
      await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: '정보 수정' + (what.length ? ': ' + [...new Set(what)].join(', ') : '') + (patch.stage ? ` → ${patch.stage}` : '') + (patch.run_status ? ` → ${patch.run_status}` : '') });
      state.dirty = false;
      toast('저장됨');
      if (patch.stage || 'run_status' in patch) reload();
      open(co.id, 'info');
    }
    return sec('기본 정보', [
      el('div', { className: 'dr-grid' }, [
        input('name', '업체명'), input('brand', '브랜드'),
        el('label', {}, [el('span', { className: 'lbl', text: '단계' }), F.stage]), el('label', {}, [el('span', { className: 'lbl', text: '계약 상태 (결제 업체)' }), F.run_status]),
        ownerSel('sales_owner', 'sales_owner_name', '영업 담당'), ownerSel('manager_owner', 'manager_owner_name', '관리 담당'),
        input('phone', '대표 연락처'), input('store_phone', '매장 연락처'),
        input('rep_name', '대표자'), input('rep_note', '대표 특징'),
        input('address', '주소', { wide: true }), input('map_url', '지도 링크', { wide: true }),
        input('category', '업종'), input('email', '이메일'),
        input('notes', '특이사항', { area: true, wide: true }),
      ]),
      el('div', { className: 'actions' }, [co.map_url ? el('a', { className: 'btn', href: co.map_url, target: '_blank', rel: 'noopener', text: '지도 열기' }) : el('span'), saveBtn]),
    ]);
  }
  function eventsView(co, evs) {
    const list = el('div', { className: 'dr-ev' }, evs.length ? evs.map((e) => e.kind === 'system'
      ? el('div', { className: 'sys', text: `${e.body} · ${admins[e.actor] || ''} ${kst(e.created_at)}` })
      : el('div', { className: 'msg' + (e.actor === me ? ' mine' : '') }, [el('div', { className: 'msg-meta' }, [el('b', { text: admins[e.actor] || '관리자' }), kst(e.created_at)]), el('div', { className: 'bubble', text: e.body })]))
      : [el('div', { className: 'dr-empty', text: '아직 기록이 없습니다. 통화·미팅 내용을 남겨보세요.' })]);
    const input = el('textarea', { className: 'fi', rows: 2, placeholder: '상담 내용 남기기 (Enter 저장 · Shift+Enter 줄바꿈)' });
    const send = async () => {
      const body = input.value.trim(); if (!body) return;
      input.disabled = true;
      const { error } = await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'note', body });
      input.disabled = false;
      if (error) { toast('기록 실패: ' + error.message); return; }
      open(co.id, 'info');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    return sec('상담 기록', [list, input]);
  }
  function contractsView(cts) {
    return sec(`계약 이력 ${cts.length}건`, table(['구분', '결제일', '금액', '기간', '재계약 예정', '결제·세금계산서', '메모'],
      cts.map((c) => [c.kind || '—', day(c.paid_at), won(c.amount_won), c.period_text || (c.period_months ? c.period_months + '개월' : '—'), day(c.renew_due),
        [c.pay_method, c.tax_invoice].filter(Boolean).join(' · ') || '—', c.memo || c.owner_name || '—']), [2]));
  }
  function deliverablesView(dls) {
    return sec(`실행 항목 ${dls.length}개`, table(['항목', '계약 수량', '요청', '완료', '잔여', '진행'],
      dls.map((d) => { const p = Number(d.planned) || 0, dn = Number(d.done) || 0; const bar = el('div', { className: 'bar' }, el('i')); bar.firstChild.style.width = p ? Math.min(100, dn / p * 100) + '%' : '0';
        return [d.item, d.planned ?? '—', d.requested ?? '—', dn, p ? Math.max(0, p - dn) : '—', bar]; }), [1, 2, 3, 4]));
  }
  function worksView(wks) {
    return sec(`작업 기록 ${wks.length}건`, table(['일정', '작업', '수량', '실행사', '상태', '완료일'],
      wks.slice(0, 50).map((w) => [day(w.scheduled_on), w.title || w.item || '—', w.qty || '—', w.vendor || '—', w.status || '—', day(w.done_on)])));
  }
  function holdsView(hds) {
    return hds.length ? sec(`홀딩 ${hds.length}건`, table(['시작일', '진행 회차', '총 회차', '사유'], hds.map((h) => [day(h.started_at), h.progress || '—', h.total_rounds || '—', h.reason || '—']))) : null;
  }
  // ── 체험단 회차 · 명단 ──
  // 명단 붙여넣기: 옥미정 명단.txt 형식(----------7---------- 몇 팀 : 5팀 / 리뷰기간 : 4주 / 리뷰노트 마감일 ~ 8월 22일 + 블로거 블록)을 그대로 받는다
  const ROUND_STATES = ['모집', '진행', '완료'];
  const ROUND_COLOR = { 모집: '#1E10C7', 진행: '#D97706', 완료: '#16A34A', 추가: '#7C3AED', 취소: '#A1A1AA', 홀딩: '#A1A1AA' };
  function parseRoster(text, baseYear) {
    const rounds = []; let cur = null;
    const lines = String(text).replace(/\r/g, '').split('\n');
    const flush = (block) => {
      const ls = block.map((x) => x.trim()).filter((x) => x && x !== '.');
      if (!ls.length) return;
      const urls = ls.filter((x) => /^https?:\/\//.test(x)), ph = ls.find((x) => /^0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}$/.test(x.replace(/\s/g, '')));
      const words = ls.filter((x) => !/^https?:\/\//.test(x) && x !== ph);
      if (!urls.length && !ph) return; // 블로거 블록이 아님 (메모 줄)
      const post = urls.find((u) => /\/\d{6,}/.test(u)) || null, blog = urls.find((u) => u !== post) || null;
      (cur || (cur = { label: null, people: [] }, rounds.push(cur), cur)).people.push({ nickname: words[0] || null, name: words[1] || null, phone: ph || null, blog_url: blog, post_url: post });
    };
    let block = [];
    for (const raw of lines) {
      const l = raw.trim();
      const h = l.match(/^-{3,}\s*(\d+(?:-\d+)?)\s*-{3,}(.*)$/);
      if (h) { flush(block); block = []; cur = { label: h[1], people: [] }; rounds.push(cur); const t = h[2].match(/(\d+)\s*팀/); if (t) cur.teams = +t[1]; continue; }
      const w = l.match(/리뷰\s*기간\s*:?\s*(\d+)\s*주/); if (w && cur) { cur.weeks = +w[1]; continue; }
      const d = l.match(/마감일?\s*~?\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/); if (d && cur) { cur.deadline = `${baseYear}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`; continue; }
      const t2 = l.match(/몇\s*팀\s*:?\s*(\d+)/); if (t2 && cur) { cur.teams = +t2[1]; continue; }
      if (!l || l === '.') { flush(block); block = []; } else block.push(l);
    }
    flush(block);
    return rounds.filter((r) => r.people.length || r.label);
  }
  let openRound = null;
  function roundsView(co, D) {
    const box = el('div', { className: 'dr-sec' });
    const today = new Date().toISOString().slice(0, 10);
    const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    const draw = async () => {
      const rds = [...D.rd].sort((a, b) => (a.round_no ?? 0) - (b.round_no ?? 0) || String(a.created_at).localeCompare(b.created_at));
      const ids = rds.map((r) => r.id);
      const { data: ros } = ids.length ? await sb.from('roster').select('*').in('round_id', ids).order('created_at') : { data: [] };
      const byRound = {}; (ros || []).forEach((p) => (byRound[p.round_id] = byRound[p.round_id] || []).push(p));
      const total = rds.find((r) => r.total_rounds)?.total_rounds || D.dl.find((d) => d.item === '체험단')?.planned || null;
      const doneN = rds.filter((r) => r.state === '완료').length;
      const head = el('div', { className: 'rd-head' }, [
        el('div', {}, [el('b', { text: `${doneN}${total ? ' / ' + total : ''}회차 완료` }), co.recruit_days?.length ? el('span', { className: 'sub', text: ` · 매월 ${co.recruit_days.join(', ')}일 모집` }) : null]),
        el('button', { className: 'btn', type: 'button', text: '명단 붙여넣기', onclick: () => pasteBox.hidden = !pasteBox.hidden }),
        el('button', { className: 'btn primary', type: 'button', text: '+ 회차 추가', onclick: () => addForm.hidden = !addForm.hidden }),
      ]);
      // 회차 추가
      const nextNo = (rds.reduce((m, r) => Math.max(m, r.round_no || 0), 0) || 0) + 1;
      const A = { no: el('input', { className: 'fi', type: 'number', value: nextNo }), on: el('input', { className: 'fi', type: 'date', value: today }), teams: el('input', { className: 'fi', type: 'number', value: 5 }),
        weeks: el('input', { className: 'fi', type: 'number', value: 4 }), deadline: el('input', { className: 'fi', type: 'date', value: addDays(today, 28) }), memo: el('input', { className: 'fi', placeholder: '예: 화요일 모집 체크 해제' }) };
      const syncDl = () => { if (A.on.value && A.weeks.value) A.deadline.value = addDays(A.on.value, Number(A.weeks.value) * 7); };
      A.on.oninput = syncDl; A.weeks.oninput = syncDl;
      const addForm = el('div', { className: 'rd-form', hidden: true }, [el('div', { className: 'dr-grid rd-grid' }, [lab('회차', A.no), lab('모집일', A.on), lab('팀 수', A.teams), lab('리뷰 기간(주)', A.weeks), lab('리뷰 마감일', A.deadline), lab('메모', A.memo)]),
        el('div', { className: 'gd-btns' }, [el('button', { className: 'btn primary', type: 'button', text: '회차 저장', onclick: async () => {
          const no = Number(A.no.value) || nextNo;
          const { data, error } = await sb.from('rounds').insert({ company_id: co.id, round_no: no, round_label: String(no), total_rounds: total, state: '모집', recruit_on: A.on.value || null, teams: Number(A.teams.value) || null,
            review_weeks: Number(A.weeks.value) || null, deadline: A.deadline.value || null, memo: A.memo.value.trim() || null }).select().single();
          if (error) { toast('저장 실패: ' + error.message); return; }
          D.rd.push(data); openRound = data.id;
          await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: `체험단 ${no}회차 등록 (모집일 ${A.on.value || '-'})` });
          toast(`${no}회차 등록`); draw();
        } })])]);
      // 명단 붙여넣기 (여러 회차 한 번에)
      const ta = el('textarea', { className: 'fi', rows: 8, placeholder: '----------7---------- 몇 팀 : 5팀\n리뷰기간 : 4주\n리뷰노트 마감일 ~ 8월 22일\n\n쪼꼬\n황재원\n010-0000-0000\nhttps://blog.naver.com/아이디\nhttps://blog.naver.com/아이디/포스팅번호' });
      const pasteBox = el('div', { className: 'rd-form', hidden: true }, [ta, el('div', { className: 'gd-btns' }, [el('span', { className: 'sub', text: '회차 머리줄(----------7----------)이 있으면 그 회차로, 없으면 펼친 회차에 넣습니다.' }),
        el('button', { className: 'btn primary', type: 'button', text: '명단 저장', onclick: async () => {
          const parsed = parseRoster(ta.value, today.slice(0, 4));
          if (!parsed.some((p) => p.people.length)) { toast('블로거 정보를 찾지 못했습니다 (연락처나 블로그 주소가 있는 블록)'); return; }
          let added = 0;
          for (const p of parsed) {
            let rd = p.label ? D.rd.find((r) => String(r.round_label) === p.label || String(r.round_no) === p.label) : D.rd.find((r) => r.id === openRound);
            if (!rd) {
              const no = p.label ? Number(String(p.label).split('-')[0]) : nextNo;
              const { data, error } = await sb.from('rounds').insert({ company_id: co.id, round_no: no, round_label: p.label || String(no), total_rounds: total, state: p.people.every((x) => x.post_url) ? '완료' : '진행',
                teams: p.teams || null, review_weeks: p.weeks || null, deadline: p.deadline || null }).select().single();
              if (error) { toast('회차 저장 실패: ' + error.message); return; }
              D.rd.push(data); rd = data;
            } else if (p.teams || p.weeks || p.deadline) {
              const patch = { teams: p.teams ?? rd.teams, review_weeks: p.weeks ?? rd.review_weeks, deadline: p.deadline ?? rd.deadline };
              await sb.from('rounds').update(patch).eq('id', rd.id); Object.assign(rd, patch);
            }
            if (p.people.length) { const { error } = await sb.from('roster').insert(p.people.map((x) => ({ round_id: rd.id, ...x }))); if (error) { toast('명단 저장 실패: ' + error.message); return; } added += p.people.length; }
          }
          await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: `체험단 명단 ${added}명 등록` });
          toast(`블로거 ${added}명 저장`); draw();
        } })])]);
      // 회차 목록
      const list = el('div', { className: 'rd-list' }, rds.length ? rds.map((r) => {
        const ppl = byRound[r.id] || [];
        const posted = ppl.filter((p) => p.post_url).length;
        const late = r.deadline && r.deadline < today && r.state !== '완료' && ppl.some((p) => !p.post_url);
        const pill = dot(r.state || '진행', ROUND_COLOR[r.state]);
        const row = el('button', { type: 'button', className: 'rd-row' + (openRound === r.id ? ' on' : '') + (late ? ' late' : ''), onclick: () => { openRound = openRound === r.id ? null : r.id; draw(); } }, [
          el('b', { text: `${r.round_label || r.round_no || '?'}회차` }), pill,
          el('span', { className: 'sub', text: [r.recruit_on && `모집 ${r.recruit_on.slice(5)}`, r.teams && `${r.teams}팀`, r.deadline && `마감 ${r.deadline.slice(5)}`].filter(Boolean).join(' · ') || (r.memo || '') }),
          el('span', { className: 'rd-post' + (late ? ' bad' : ''), text: ppl.length ? `포스팅 ${posted}/${ppl.length}` : '명단 없음' }),
        ]);
        if (openRound !== r.id) return row;
        const tbl = ppl.length ? el('table', { className: 'dr-tbl' }, [el('thead', {}, el('tr', {}, ['닉네임', '이름', '연락처', '블로그', '포스팅 링크', ''].map((h) => el('th', { text: h })))),
          el('tbody', {}, ppl.map((p) => {
            const inp = el('input', { className: 'fi rd-url', value: p.post_url || '', placeholder: '포스팅 링크 붙여넣기' });
            inp.onchange = async () => { const v = inp.value.trim() || null; const { error } = await sb.from('roster').update({ post_url: v }).eq('id', p.id); if (error) { toast('저장 실패'); return; } p.post_url = v; toast(v ? '포스팅 확인됨' : '링크 삭제'); draw(); };
            return el('tr', { className: !p.post_url && r.deadline && r.deadline < today ? 'late' : '' }, [
              el('td', { text: p.nickname || '—' }), el('td', { text: p.name || '—' }), el('td', { text: p.phone || '—' }),
              el('td', {}, p.blog_url ? el('a', { href: p.blog_url, target: '_blank', rel: 'noopener', text: '블로그' }) : '—'),
              el('td', {}, inp),
              el('td', {}, p.post_url ? el('a', { href: p.post_url, target: '_blank', rel: 'noopener', text: '열기' }) : el('span', { className: 'sub', text: r.deadline && r.deadline < today ? '마감 지남' : '대기' }))]);
          }))]) : el('div', { className: 'dr-empty', text: '명단이 없습니다. [명단 붙여넣기]로 블로거 정보를 넣으세요.' });
        const setState = (s) => async () => {
          const wasDone = r.state === '완료';
          const { error } = await sb.from('rounds').update({ state: s }).eq('id', r.id); if (error) { toast('저장 실패'); return; }
          r.state = s;
          const dlv = D.dl.find((d) => d.item === '체험단');
          if (dlv && (s === '완료') !== wasDone) { const done = Math.max(0, (Number(dlv.done) || 0) + (s === '완료' ? 1 : -1)); await sb.from('deliverables').update({ done }).eq('id', dlv.id); dlv.done = done; }
          await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: `체험단 ${r.round_label || r.round_no}회차 → ${s}` });
          toast(`${r.round_label || r.round_no}회차 ${s}`); draw();
        };
        return el('div', { className: 'rd-open' }, [row,
          el('div', { className: 'rd-body' }, [
            el('div', { className: 'seg-tabs' }, ROUND_STATES.map((s) => el('button', { type: 'button', className: r.state === s ? 'on' : '', text: s, onclick: setState(s) }))),
            r.memo ? el('div', { className: 'sub', text: r.memo }) : null, tbl].filter(Boolean))]);
      }) : [el('div', { className: 'dr-empty', text: '등록된 회차가 없습니다. [+ 회차 추가] 또는 [명단 붙여넣기]로 시작하세요.' })]);
      box.replaceChildren(el('div', { className: 'sec-t', text: '체험단 회차 · 명단' }), head, addForm, pasteBox, list);
    };
    draw();
    return box;
  }

  // ── 가이드라인 7종 (행 = 버전, 종류별 최신이 현재본) ──
  // 종합·모집글은 칸 입력 → 체험단 참고사항과 합쳐 보낼 문구 자동 조립. 나머지는 양식 텍스트를 채워 저장
  const GUIDE_KINDS = ['종합', '모집글', '체험단', '영수증', '배포', '플레이스', '인스타 타겟'];
  const GUIDE_HINT = { 종합: '선정된 블로거에게 보내는 안내', 모집글: '체험단 모집 공고', 체험단: '본문에 어필할 참고사항 (종합·모집글에 자동 포함)', 영수증: '영수증 리뷰', 배포: '블로그 배포(기자단)', 플레이스: '플레이스·SA 세팅 자료', '인스타 타겟': '인스타그램 타겟 광고' };
  const GUIDE_TEMPLATE = {
    체험단: '※참고사항\n(아래 내용들을 참고해, 본문 내에 지속적으로 어필해 주세요 !)\n\n1. \n2. \n3. \n4. \n5. \n\n- 체험 시 제공 가능한 메뉴\n1. \n2. \n\n- 블로그 글 작성 시 주의할 점\n1. \n\n- 블로그 글 작성 시 반드시 포함해야 할 부분\n1. \n\n- 블로그 하단 태그\n#\n\n- 영업시간\nOPEN :\nBreak time :\nCLOSE :',
    영수증: '★영수증리뷰 가이드★\n\n1. 업체에 대한 장점/어필 내용\n- \n\n2. 경쟁업체 와의 차이점\n- \n\n3. 리뷰 작성에 대한 유의사항\n- \n\n4. 기타 요청사항\n- ',
    배포: '※ 블로그 배포 가이드라인\n<기본 설명>\n - 실제로 체험하지 않고, 사진+가이드라인을 전달하여 포스팅을 올리는 방식입니다.\n - 기자단 캠페인은 최소 배포 단위가 10건입니다.\n\n<포스팅 사진 관련>\n - 1개의 포스팅 당 10장의 사진이 필요합니다.\n\n<포스팅 내용 관련>\n★ 체험단 가이드라인과 내용이 같으면 "체험단과 동일"로 적어주세요.\n\n - 업체의 특징 (10개 이상)\n 1. \n\n - 강조 / 필수 기재 사항\n 1. \n\n - 금지 단어 및 주의 사항\n 1. \n\n - 포스팅 하단 태그\n #',
    플레이스: '※ 네이버 플레이스 및 SA 광고 세팅 가이드라인\n\n 1. 네이버 아이디 : \n 2. 비밀번호 : \n\n 3. 네이버 광고 아이디 : \n 4. 네이버 광고 비밀번호 : \n 5. 기초 정보 외 수정, 등록할 사항 (텍스트, 이미지) : \n 6. 사업자 등록증 사본 : ',
    '인스타 타겟': '※ 인스타그램 타겟팅 광고 가이드라인\n\n<썸네일 이미지 관련>\n 1. 썸네일로 사용될 사진 (가장 매력적인 사진 3~5장)\n 2. 원하는 컬러톤 : \n 3. 썸네일 문구 (1문장 + 업체명) : \n\n<광고 피드의 텍스트 관련>\n - ',
  };
  const FORM_FIELDS = {
    종합: [['store', '업체명'], ['address', '업체 주소'], ['booking', '예약 번호'], ['price', '체험 금액'], ['kw1', '필수 키워드'], ['kw2', '선택 키워드'], ['note', '특이사항 (줄마다 하나)', true]],
    모집글: [['area', '지역 명칭'], ['sub', '부제목'], ['store', '업체명'], ['address', '업체 주소'], ['price', '체험 금액'], ['kw1', '필수 키워드'], ['kw2', '선택 키워드'], ['note', '특이사항 (줄마다 하나)', true]],
  };
  function assemble(kind, v, campBody) {
    const notes = String(v.note || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => (x.startsWith('-') ? x : '- ' + x)).join('\n');
    const camp = String(campBody || '').trim();
    if (kind === '종합') return [
      '안녕하세요 선정되신 것 축하드립니다!', '리뷰노트 선정 업체 참고사항 발송해 드립니다!', '', '＊참고사항', '',
      `업체명\t\t: ${v.store || ''}`, `업체 주소\t\t: ${v.address || ''}`, `예약 번호\t\t: ${v.booking || ''}`, `체험 금액\t\t: ${v.price || ''}`, '',
      `필수 키워드 : ${v.kw1 || ''}`, `선택 키워드 : ${v.kw2 || ''}`, '', '*특이사항 : ', notes, '', camp].join('\n').trim();
    return [`[지역 명칭]${v.area || ''}`, '', `부제목\t\t: ${v.sub || ''}`, `업체명\t\t: ${v.store || ''}`, `업체 주소\t\t: ${v.address || ''}`, `체험 금액\t\t: ${v.price || ''}`, '',
      `필수 키워드 : ${v.kw1 || ''}`, `선택 키워드 : ${v.kw2 || ''}`, '', '*특이사항 : ', notes, '', camp].join('\n').trim();
  }
  let guideKind = '종합';
  function guidesView(co, D) {
    const box = el('div', { className: 'dr-sec' });
    const draw = () => {
      const versions = D.gl.filter((g) => g.kind === guideKind);
      const cur = versions[0];
      const camp = D.gl.find((g) => g.kind === '체험단');
      const kinds = el('div', { className: 'gk' }, GUIDE_KINDS.map((k) => {
        const n = D.gl.filter((g) => g.kind === k).length;
        return el('button', { type: 'button', className: k === guideKind ? 'on' : '', onclick: () => { guideKind = k; draw(); } }, [k, el('span', { className: 'n', text: n ? 'v' + n : '—' })]);
      }));
      const status = el('div', { className: 'sub' }, cur ? `현재 v${versions.length} · ${kst(cur.created_at)} · ${admins[cur.created_by] || '관리자'}` : `아직 없음 · ${GUIDE_HINT[guideKind]}`);
      const save = async (body, fields) => {
        if (!String(body || '').trim()) { toast('내용을 입력하세요'); return; }
        if (cur && cur.body === body) { toast('바뀐 내용이 없습니다'); return; }
        const { data, error } = await sb.from('guidelines').insert({ company_id: co.id, kind: guideKind, body, fields: fields || null, created_by: me }).select().single();
        if (error) { toast('저장 실패: ' + error.message); return; }
        D.gl.unshift(data);
        await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: `가이드라인(${guideKind}) v${versions.length + 1} 저장` });
        toast(`${guideKind} v${versions.length + 1} 저장됨`); draw();
      };
      const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('복사됨 — 카톡·메일에 붙여넣으세요'); } catch { toast('복사 실패: 글을 직접 선택해 복사하세요'); } };
      let editor;
      if (FORM_FIELDS[guideKind]) {
        const v = { store: co.name, address: co.address || '', booking: co.store_phone || co.phone || '', ...(cur?.fields || {}) };
        const inputs = {};
        const preview = el('textarea', { className: 'fi gd-preview', readOnly: true, rows: 14 });
        const refresh = () => { Object.entries(inputs).forEach(([k, i]) => { v[k] = i.value; }); preview.value = assemble(guideKind, v, camp?.body); };
        const grid = el('div', { className: 'dr-grid' }, FORM_FIELDS[guideKind].map(([k, label, area]) => {
          inputs[k] = el(area ? 'textarea' : 'input', { className: 'fi', value: v[k] || '', oninput: refresh, ...(area ? { rows: 3 } : {}) });
          return el('label', { className: area ? 'wide' : '' }, [el('span', { className: 'lbl', text: label }), inputs[k]]);
        }));
        refresh();
        editor = [grid,
          el('div', { className: 'lbl', text: camp ? `보낼 문구 (체험단 참고사항 v${D.gl.filter((g) => g.kind === '체험단').length} 포함)` : '보낼 문구 (체험단 참고사항을 먼저 작성하면 아래에 자동으로 붙습니다)' }),
          preview,
          el('div', { className: 'gd-btns' }, [el('button', { className: 'btn', type: 'button', text: '📋 복사', onclick: () => copy(preview.value) }),
            el('button', { className: 'btn primary', type: 'button', text: '새 버전으로 저장', onclick: () => { refresh(); save(preview.value, { ...v }); } })])];
      } else {
        const ta = el('textarea', { className: 'fi gd-text', rows: 16, value: cur?.body ?? GUIDE_TEMPLATE[guideKind] ?? '' });
        editor = [ta, el('div', { className: 'gd-btns' }, [
          !cur && el('span', { className: 'sub', text: '기본 양식이 채워져 있습니다. 빈칸을 채워 저장하세요.' }),
          el('button', { className: 'btn', type: 'button', text: '📋 복사', onclick: () => copy(ta.value) }),
          el('button', { className: 'btn primary', type: 'button', text: '새 버전으로 저장', onclick: () => save(ta.value) })].filter(Boolean))];
      }
      const history = versions.length > 1 && el('details', { className: 'gd-hist' }, [el('summary', { text: `이전 버전 ${versions.length - 1}개 (날짜별 보관)` }),
        ...versions.slice(1).map((g, i) => el('div', { className: 'gd-v' }, [
          el('div', { className: 'gd-vh' }, [el('b', { text: `v${versions.length - 1 - i}` }), el('span', { className: 'sub', text: `${kst(g.created_at)} · ${admins[g.created_by] || '관리자'}` }),
            el('button', { className: 'btn', type: 'button', text: '복사', onclick: () => copy(g.body) }),
            el('button', { className: 'btn', type: 'button', text: '이 버전으로 되돌리기', onclick: () => save(g.body, g.fields) })]),
          el('pre', { className: 'gd-pre', text: g.body })]))]);
      box.replaceChildren(el('div', { className: 'sec-t', text: '가이드라인' }), kinds, status, ...editor, history || el('span'));
    };
    draw();
    return box;
  }

  // ── 결제 체크리스트 (데이터로 자동 판정) ──
  function checks(co, D) {
    const last = D.ct[0];
    const cash = /현금|계좌|이체/.test(last?.pay_method || '');
    const hasDoc = (re) => D.dc.some((d) => re.test(d.kind));
    return [
      ['카드 정보 입력', cash ? null : D.cd.length > 0, cash ? '현금 결제 — 해당 없음' : '결제 등록 때 입력'],
      ['견적서 업로드', hasDoc(/견적/), '서류 탭에서 텍스트로 저장'],
      ['계약서 업로드', hasDoc(/계약/), '서류 탭에서 텍스트로 저장'],
      ['모집글 가이드라인 작성', D.gl.some((g) => g.kind === '모집글' || g.kind === '종합'), '가이드라인 탭'],
      ['사업자등록증 업로드', cash ? hasDoc(/사업자/) : (hasDoc(/사업자/) || null), cash ? '현금 결제 시 필수' : '현금 결제 시 필수 (카드면 선택)'],
      ['세금계산서 발행', !last?.tax_invoice ? null : last.tax_invoice !== '발행 필요', last?.tax_invoice === '발행 완료' ? `발행 ${day(last.tax_invoice_at)}` : last?.tax_invoice || ''],
      ['인수인계 확인', !!last?.handover_at, last?.handover_at ? `${kst(last.handover_at)} 확인` : '관리 담당이 확인'],
    ];
  }
  function checklistView(co, D) {
    const list = checks(co, D).filter(([, v]) => v !== null);
    const done = list.filter(([, v]) => v).length;
    const last = D.ct[0];
    const items = el('div', { className: 'ck-list' }, list.map(([label, ok, hint]) => el('div', { className: 'ck' + (ok ? ' ok' : '') }, [el('span', { className: 'ck-box', text: ok ? '✓' : '' }), el('b', { text: label }), el('small', { text: hint })])));
    const taxBtn = last && last.tax_invoice === '발행 필요' && el('button', { className: 'btn', type: 'button', text: '세금계산서 발행 완료', onclick: async () => {
      const { error } = await sb.from('contracts').update({ tax_invoice: '발행 완료', tax_invoice_at: new Date().toISOString().slice(0, 10) }).eq('id', last.id);
      if (error) { toast('저장 실패: ' + error.message); return; }
      await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: '세금계산서 발행 완료' });
      toast('세금계산서 발행 완료'); open(co.id, 'info');
    } });
    const hand = last && !last.handover_at && el('button', { className: 'btn', type: 'button', text: '인수인계 확인 완료', onclick: async () => {
      const { error } = await sb.from('contracts').update({ handover_at: new Date().toISOString(), handover_by: me }).eq('id', last.id);
      if (error) { toast('저장 실패: ' + error.message); return; }
      await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: '인수인계 확인' });
      toast('인수인계 확인됨'); open(co.id, 'info');
    } });
    return sec(`결제 체크리스트 ${done}/${list.length}`, [el('div', { className: 'ck-bar' }, el('i', { style: `width:${list.length ? done / list.length * 100 : 0}%` })), items, (taxBtn || hand) && el('div', { className: 'ck-btns' }, [taxBtn, hand].filter(Boolean))].filter(Boolean));
  }

  // ── 결제 등록 / 재계약 등록 (결제양식) ──
  const ITEM_GROUPS = [
    ['체험단 패키지 기본', ['체험단', '영수증 리뷰', '기자단', '인스타 타겟', '플레이스 SA', 'SEO']],
    ['플레이스', ['저장', '트래픽', '길찾기', 'CPA']],
    ['네이버', ['SA (세팅)', 'SA (세팅&운영)', 'SEO (세팅&운영)', '배포 (AI)', '배포 (준최2)', '촬영 (배포용)', '촬영 (콘텐츠용)']],
    ['인스타그램', ['부스팅 (피드)', '부스팅 (릴스)', '릴그램 배포', '계정 자동화 운영', '파싱', '활성 팔로워 1000']],
    ['메타', ['메타 광고 세팅 및 운영', '메타 리타겟팅', '메타 DA 광고', '메타 캠페인 기획']],
    ['기타', ['당근비즈니스 세팅', '카카오채널 세팅', '유튜브 채널 운영', '홈페이지 관리', '종합 컨설팅', '기타']],
  ];
  const PKG_DEFAULT = ['체험단', '영수증 리뷰', '기자단', '인스타 타겟', '플레이스 SA', 'SEO'];
  function payModal(co, D) {
    const renew = co.stage === '결제';
    const today = new Date().toISOString().slice(0, 10);
    const addMonths = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setMonth(x.getMonth() + Number(n || 0)); return x.toISOString().slice(0, 10); };
    const f = (tag, props, kids) => el(tag, { className: 'fi', ...props }, kids || []);
    const F = {
      owner: f('select', {}), manager: f('select', {}),
      paid: f('input', { type: 'date', value: today }), months: f('input', { type: 'number', min: 1, value: 12 }), renew: f('input', { type: 'date' }),
      phone: f('input', { value: co.phone || '', placeholder: '010-0000-0000' }), email: f('input', { value: co.email || '', placeholder: '없으면 비워두세요' }),
      amount: f('input', { inputMode: 'numeric', placeholder: '1,584,000' }), price: f('select', {}, ['정상', '할인', '프로모션', '서비스'].map((v) => el('option', { value: v, text: v }))),
      product: f('input', { placeholder: '예: 체험단 패키지 15개월 (블15)' }),
      method: f('select', {}, ['카드', '카드 수기결제', '현금(계좌이체)'].map((v) => el('option', { value: v, text: v }))),
      tax: f('select', {}, ['발행 필요', '발행 완료', '해당 없음'].map((v) => el('option', { value: v, text: v }))),
      cardCo: f('input', { placeholder: '예: 신한' }), cardNo: f('input', { inputMode: 'numeric', placeholder: '0000-0000-0000-0000', autocomplete: 'off' }),
      cardExp: f('input', { placeholder: 'MM/YY', autocomplete: 'off' }), cardInst: f('input', { placeholder: '일시불 / 3개월' }),
      memo: f('textarea', { rows: 2, placeholder: '특이사항 (인수인계에 함께 표시)' }),
    };
    const ownerOpts = (sel, cur) => sel.replaceChildren(el('option', { value: '', text: '미배정' }), ...Object.entries(admins).map(([id, n]) => el('option', { value: id, text: n, selected: id === cur })));
    ownerOpts(F.owner, co.sales_owner || me); ownerOpts(F.manager, co.manager_owner || '');
    let roundsTouched = false;
    const syncRenew = () => { if (F.paid.value && F.months.value) F.renew.value = addMonths(F.paid.value, F.months.value); if (!roundsTouched && items.has('체험단')) { items.set('체험단', F.months.value); drawItems(); } };
    F.paid.oninput = syncRenew; F.months.oninput = syncRenew;
    F.amount.oninput = () => { const d = F.amount.value.replace(/\D/g, ''); F.amount.value = d ? Number(d).toLocaleString() : ''; };
    // 진행 항목: 기본 패키지 체크 + 수량
    const items = new Map();
    const itemsBox = el('div', { className: 'pi-list' });
    const drawItems = () => itemsBox.replaceChildren(...[...items.entries()].map(([name, qty]) => el('div', { className: 'pi' }, [
      el('b', { text: name }), (() => { const q = f('input', { type: 'number', min: 0, value: qty ?? '', placeholder: name === '체험단' ? '회차' : '수량' }); q.oninput = () => { items.set(name, q.value); if (name === '체험단') roundsTouched = true; }; return q; })(),
      el('button', { className: 'icon-btn', type: 'button', text: '✕', title: '빼기', onclick: () => { items.delete(name); drawItems(); } })])));
    PKG_DEFAULT.forEach((n) => items.set(n, n === '체험단' ? F.months.value : ''));
    const addSel = f('select', { onchange: (e) => { const v = e.target.value; if (v === '__custom') { const n = prompt('항목 이름'); if (n) items.set(n.trim(), ''); } else if (v) items.set(v, ''); e.target.value = ''; drawItems(); } },
      [el('option', { value: '', text: '+ 항목 추가' }), ...ITEM_GROUPS.map(([g, list]) => el('optgroup', { label: g }, list.map((n) => el('option', { value: n, text: n })))), el('option', { value: '__custom', text: '직접 입력…' })]);
    drawItems(); syncRenew();
    const cardBox = el('div', { className: 'dr-grid' }, [lab('카드사', F.cardCo), lab('카드번호 (대표만 전체 열람)', F.cardNo), lab('유효기간', F.cardExp), lab('할부', F.cardInst)]);
    const cashHint = el('div', { className: 'hint', text: '현금 결제는 사업자등록증 업로드가 필수입니다 (체크리스트에 표시).' });
    const syncMethod = () => { const cash = /현금/.test(F.method.value); cardBox.hidden = cash; cashHint.hidden = !cash; };
    F.method.onchange = syncMethod; syncMethod();
    const err = el('div', { className: 'err' });
    const saveBtn = el('button', { className: 'btn primary lg', type: 'button', text: renew ? '재계약 등록' : '결제 등록', onclick: save });
    const layer = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === layer) layer.remove(); } }, el('div', { className: 'pm' }, [
      el('div', { className: 'pm-h' }, [el('h3', { text: `${renew ? '재계약' : '결제'} 등록 · ${co.name}` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => layer.remove() })]),
      el('div', { className: 'pm-b' }, [
        sec('결제양식', el('div', { className: 'dr-grid' }, [lab('결제 담당 (가망 제공자)', F.owner), lab('관리 담당 (인수받을 사람)', F.manager),
          lab('결제일자', F.paid), lab('기간 (개월)', F.months), lab('재계약 예정일 (자동)', F.renew), lab('가격 구분', F.price),
          lab('결제금액 (원, VAT 포함)', F.amount), lab('상품', F.product), lab('대표 핸드폰번호', F.phone), lab('대표 이메일', F.email)])),
        sec('진행 항목', [itemsBox, addSel]),
        sec('결제 방식', [el('div', { className: 'dr-grid' }, [lab('결제 방식', F.method), lab('세금계산서', F.tax)]), cardBox, cashHint]),
        sec('특이사항', F.memo),
        el('div', { className: 'hint', text: `저장하면: 계약 이력 추가 · 진행 항목 생성 · ${renew ? '' : "업체가 '계약 업체(진행 중)'로 이동 · "}관리 담당에게 카카오워크 알림` }),
        err,
      ]),
      el('div', { className: 'pm-f' }, [el('button', { className: 'btn lg', type: 'button', text: '취소', onclick: () => layer.remove() }), saveBtn]),
    ]));
    document.body.append(layer); F.amount.focus();
    async function save() {
      err.textContent = '';
      const amount = Number(F.amount.value.replace(/\D/g, '')) || null;
      if (!F.paid.value) { err.textContent = '결제일자를 입력하세요'; return; }
      if (!amount) { err.textContent = '결제금액을 입력하세요'; return; }
      const cash = /현금/.test(F.method.value);
      const cardDigits = F.cardNo.value.replace(/\D/g, '');
      if (!cash && cardDigits && cardDigits.length < 15) { err.textContent = '카드번호 자리 수를 확인하세요'; return; }
      saveBtn.disabled = true; saveBtn.textContent = '저장 중…';
      try {
        const owner = F.owner.value || null, manager = F.manager.value || null;
        const { data: ct, error: e1 } = await sb.from('contracts').insert({
          company_id: co.id, kind: renew ? '재계약' : '신규계약', status: '진행 중', amount_won: amount, paid_at: F.paid.value, period_months: Number(F.months.value) || null,
          period_text: F.months.value ? F.months.value + '개월' : null, renew_due: F.renew.value || null, product: F.product.value.trim() || null, pay_method: F.method.value,
          tax_invoice: F.tax.value, tax_invoice_at: F.tax.value === '발행 완료' ? F.paid.value : null,
          owner_name: owner ? admins[owner] : null, memo: [F.price.value !== '정상' ? F.price.value : '', F.memo.value.trim()].filter(Boolean).join(' / ') || null,
        }).select().single();
        if (e1) throw new Error('계약 저장 실패: ' + e1.message);
        const rows = [...items.entries()].map(([item, q]) => ({ company_id: co.id, contract_id: ct.id, item, planned: q === '' ? null : Number(q), done: 0 }));
        if (rows.length) { const { error } = await sb.from('deliverables').insert(rows); if (error) throw new Error('진행 항목 저장 실패: ' + error.message); }
        if (!cash && cardDigits) { const { error } = await sb.from('payment_cards').insert({ company_id: co.id, contract_id: ct.id, card_company: F.cardCo.value.trim() || null, card_number: F.cardNo.value.trim(), expiry: F.cardExp.value.trim() || null, installments: F.cardInst.value.trim() || null }); if (error) throw new Error('카드 저장 실패: ' + error.message); }
        const patch = { stage: '결제', run_status: '진행 중', phone: F.phone.value.trim() || co.phone || null, email: F.email.value.trim() || co.email || null };
        if (owner) { patch.sales_owner = owner; patch.sales_owner_name = admins[owner]; }
        if (manager) { patch.manager_owner = manager; patch.manager_owner_name = admins[manager]; }
        const { error: e2 } = await sb.from('companies').update(patch).eq('id', co.id);
        if (e2) throw new Error('업체 저장 실패: ' + e2.message);
        await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: `${renew ? '재계약' : '결제'} 등록: ${amount.toLocaleString()}원 · ${F.months.value || '-'}개월 · ${F.method.value}${manager ? ' · 관리 ' + admins[manager] : ''}` });
        sb.functions.invoke('crm-notify', { body: { type: 'payment', contract_id: ct.id } }).then(({ error }) => { if (error) toast('카카오워크 알림 실패 — 담당자에게 직접 알려주세요'); });
        layer.remove(); toast(`${renew ? '재계약' : '결제'} 등록됨`); reload(); open(co.id, 'info');
      } catch (e) { err.textContent = e.message; saveBtn.disabled = false; saveBtn.textContent = renew ? '재계약 등록' : '결제 등록'; }
    }
  }
  const lab = (label, input) => el('label', {}, [el('span', { className: 'lbl', text: label }), input]);

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  window.CRM_COMPANIES = { mount, guard };
})();
