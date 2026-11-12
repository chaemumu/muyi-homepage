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
`;
    document.head.appendChild(st);
  }

  let state = null; // { mode, tab, q, mine, review, source, rows, offset, done, openId }

  function mount(box, mode) {
    const M = MODES[mode];
    state = { box, mode, tab: M.tabs[0][0], q: '', mine: false, review: false, source: '', rows: [], offset: 0, done: false, openId: null, counts: {} };
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
        el('div', { className: 'co-filters' }, [chip('내 담당', 'mine'), chip('확인 필요', 'review'), src]),
        el('div', { className: 'card' }, [el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl co-tbl' }, [
          el('thead', {}, el('tr', {}, (isClients ? ['업체', '지역', '연락처', '영업 담당', '상태', '최근 결제', '재계약 예정', '총 결제액'] : ['업체', '지역', '연락처', '영업 담당', '단계', '출처', '메모']).map((h) => el('th', { text: h })))),
          state.listEl]))]),
        state.moreEl,
      ]),
    );
    reload();
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
    state.listEl.replaceChildren(el('tr', {}, el('td', { colSpan: 8, className: 'empty', text: '불러오는 중…' })));
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
    const { data, error } = await query('id,name,brand,address,phone,store_phone,sales_owner_name,stage,run_status,lead_source,notes,needs_review,tags')
      .eq(M.field, state.tab).order('name').range(state.offset, state.offset + PAGE - 1);
    if (error) { state.listEl.replaceChildren(el('tr', {}, el('td', { colSpan: 8, className: 'empty', text: '불러오기 실패: ' + error.message }))); return; }
    let ct = {};
    if (state.mode === 'clients' && data.length) {
      const r = await sb.from('contracts').select('company_id,paid_at,renew_due,amount_won').in('company_id', data.map((x) => x.id));
      (r.data || []).forEach((c) => {
        const o = ct[c.company_id] || (ct[c.company_id] = { paid: null, renew: null, sum: 0 });
        if (c.paid_at && (!o.paid || c.paid_at > o.paid)) o.paid = c.paid_at;
        if (c.renew_due && (!o.renew || c.renew_due > o.renew)) o.renew = c.renew_due;
        o.sum += c.amount_won || 0;
      });
    }
    data.forEach((r) => { r._ct = ct[r.id]; });
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
        ? [name, el('td', { className: 'sub', text: regionOf(r.address) || '—' }), el('td', { text: r.phone || r.store_phone || '—' }), el('td', { text: r.sales_owner_name || '—' }),
          el('td', {}, dot(r.run_status, RUN_COLOR[r.run_status])), el('td', { className: 'sub', text: day(r._ct?.paid) }),
          el('td', { className: r._ct?.renew && r._ct.renew >= today && r._ct.renew <= addDaysIso(30) ? 'err' : 'sub', text: day(r._ct?.renew) }), el('td', { className: 'sub', text: r._ct ? won(r._ct.sum) : '—' })]
        : [name, el('td', { className: 'sub', text: regionOf(r.address) || '—' }), el('td', { text: r.phone || r.store_phone || '—' }), el('td', { text: r.sales_owner_name || '미배정' }),
          el('td', {}, dot(r.stage, STAGE_COLOR[r.stage])), el('td', { className: 'sub', text: (SOURCES.find(([v]) => v === r.lead_source) || [, '—'])[1] }),
          el('td', { className: 'sub memo', text: (r.notes || '').replace(/\s+/g, ' ') || '—' })];
      return el('tr', { className: r.id === state.openId ? 'sel' : '', onclick: () => open(r.id) }, cells);
    }));
  }
  const addDaysIso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  // ── 상세 패널 ──
  let drawer = null;
  function close() { drawer?.remove(); drawer = null; state.openId = null; drawRows(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer) close(); });

  async function open(id, tab = 'info') {
    state.openId = id; drawRows();
    drawer?.remove();
    drawer = el('aside', { className: 'drawer' }, el('div', { className: 'dr-b' }, el('div', { className: 'hint', text: '불러오는 중…' })));
    document.body.append(drawer);
    const [c, ct, dl, wk, rd, hd, gl, ev] = await Promise.all([
      sb.from('companies').select('*').eq('id', id).single(),
      sb.from('contracts').select('*').eq('company_id', id).order('paid_at', { ascending: false }),
      sb.from('deliverables').select('*').eq('company_id', id).order('created_at'),
      sb.from('work_logs').select('*').eq('company_id', id).order('scheduled_on', { ascending: false }),
      sb.from('rounds').select('*').eq('company_id', id).order('created_at'),
      sb.from('holds').select('*').eq('company_id', id).order('started_at', { ascending: false }),
      sb.from('guidelines').select('kind,created_at').eq('company_id', id).order('created_at', { ascending: false }),
      sb.from('company_events').select('*').eq('company_id', id).order('created_at'),
    ]);
    if (c.error || !c.data) { drawer.replaceChildren(el('div', { className: 'dr-b' }, el('div', { className: 'err', text: '업체를 불러오지 못했습니다' }))); return; }
    const co = c.data, D = { ct: ct.data || [], dl: dl.data || [], wk: wk.data || [], rd: rd.data || [], hd: hd.data || [], gl: gl.data || [], ev: ev.data || [] };
    const body = el('div', { className: 'dr-b' });
    const TABS = [['info', '정보·기록'], ['contract', `계약·실행 ${D.ct.length + D.dl.length ? '' : ''}`], ['camp', '체험단'], ['docs', '가이드라인·서류']];
    const tabsEl = el('div', { className: 'dr-tabs' });
    const show = (t) => { [...tabsEl.children].forEach((b) => b.classList.toggle('on', b.dataset.t === t)); body.replaceChildren(...SECTIONS[t]().filter(Boolean)); };
    TABS.forEach(([k, l]) => { const b = el('button', { type: 'button', text: l.trim(), onclick: () => show(k) }); b.dataset.t = k; tabsEl.append(b); });
    const sum = D.ct.reduce((s, x) => s + (x.amount_won || 0), 0);
    drawer.replaceChildren(
      el('div', { className: 'dr-h' }, [
        el('div', { className: 'dr-top' }, [el('h2', { text: co.name }), el('button', { className: 'icon-btn', type: 'button', title: '닫기 (Esc)', text: '✕', onclick: close })]),
        el('div', { className: 'dr-meta' }, [
          dot(co.stage, STAGE_COLOR[co.stage]), co.stage === '결제' && dot(co.run_status, RUN_COLOR[co.run_status]),
          co.brand && el('span', { className: 'tag', text: co.brand }), co.needs_review && el('span', { className: 'co-flag', text: `확인 필요 · ${co.review_reason || ''}` }),
          D.ct.length ? el('span', { text: `계약 ${D.ct.length}건 · 총 ${won(sum)}` }) : null,
          ...(co.tags || []).filter((t) => !['노션', '엑셀'].includes(t)).map((t) => el('span', { className: 'tag', text: t })),
        ].filter(Boolean)),
        tabsEl,
      ]),
      body,
    );
    const SECTIONS = {
      info: () => [infoForm(co), eventsView(co, D.ev)],
      contract: () => [contractsView(D.ct), deliverablesView(D.dl), worksView(D.wk), holdsView(D.hd)],
      camp: () => [roundsView(co, D.rd)],
      docs: () => [guidesView(D.gl), el('div', { className: 'dr-sec' }, [el('div', { className: 'sec-t', text: '서류 · 카드' }), el('div', { className: 'dr-empty', text: '사업자등록증·계약서 텍스트화, 카드 정보(대표만)는 ③ 단계에서 추가됩니다.' })])],
    };
    show(tab);
  }

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
      if (!Object.keys(patch).length) { toast('바뀐 내용이 없습니다'); return; }
      if (patch.name === null) { toast('업체명은 비울 수 없습니다'); return; }
      saveBtn.disabled = true;
      const { error } = await sb.from('companies').update(patch).eq('id', co.id);
      saveBtn.disabled = false;
      if (error) { toast('저장 실패: ' + error.message); return; }
      const what = Object.keys(patch).map((k) => ({ stage: '단계', run_status: '계약 상태', sales_owner: '영업 담당', manager_owner: '관리 담당' }[k])).filter(Boolean);
      await sb.from('company_events').insert({ company_id: co.id, actor: me, kind: 'system', body: '정보 수정' + (what.length ? ': ' + [...new Set(what)].join(', ') : '') + (patch.stage ? ` → ${patch.stage}` : '') + (patch.run_status ? ` → ${patch.run_status}` : '') });
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
    return sec(`계약 이력 ${cts.length}건`, table(['구분', '결제일', '금액', '기간', '재계약 예정', '메모'],
      cts.map((c) => [c.kind || '—', day(c.paid_at), won(c.amount_won), c.period_text || (c.period_months ? c.period_months + '개월' : '—'), day(c.renew_due), c.memo || c.owner_name || '—']), [2]));
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
  function roundsView(co, rds) {
    return sec('체험단 회차', [
      co.recruit_days?.length ? el('div', { className: 'hint', text: `매월 ${co.recruit_days.join(', ')}일 모집` }) : null,
      table(['회차', '총 회차', '상태', '메모'], rds.map((r) => [r.round_label || r.round_no || '—', r.total_rounds ?? '—', r.state || '—', r.memo || '—'])),
      el('div', { className: 'dr-soon', text: '회차별 명단·포스팅 확인은 ③ 단계에서 추가됩니다.' }),
    ].filter(Boolean));
  }
  function guidesView(gls) {
    const KINDS = ['종합', '체험단', '모집글', '영수증', '배포', '플레이스', '인스타 타겟'];
    return sec('가이드라인', [
      table(['종류', '최신 버전', '버전 수'], KINDS.map((k) => { const v = gls.filter((g) => g.kind === k); return [k, v[0] ? kst(v[0].created_at) : '없음', v.length]; }), [2]),
      el('div', { className: 'dr-soon', text: '가이드라인 작성·버전 비교·[복사]는 ③ 단계에서 추가됩니다.' }),
    ]);
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  window.CRM_COMPANIES = { mount };
})();
