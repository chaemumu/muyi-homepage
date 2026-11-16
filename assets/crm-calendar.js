// ── 캘린더: 체험단(모집 → 발표 → 마감 → 2차마감) · 계약(재계약 · 실행 소진) ──
// admin.html의 sb·el·admins·me·toast·todayKst·kstDay·openCompanyFromToday 사용. window.CRM_CALENDAR = { mount(box), todayCamp(), execAlerts() }
// 체험단 일정은 업체의 '매월 모집일'(companies.recruit_days)로 만들고, 완료·날짜 변경만 camp_tasks에 저장한다.
// 단계 간격(모집일 기준 +일)은 crm_settings.camp_offsets. 추적 시작일(camp_start) 이전 일정은 지난 미완료로 세지 않는다.
(function () {
  const BASE_STEPS = ['모집', '발표', '마감'];
  const STEPS = ['모집', '발표', '마감', '2차마감'];
  const STEP_COLOR = { 모집: '#1E10C7', 발표: '#7C3AED', 마감: '#EE4E00', '2차마감': '#DC2626' };
  const STEP_HINT = { 모집: '모집글 업로드 · 링크 취합', 발표: '선정 · 가이드라인 · 일정 안내', 마감: '마감 인원 확인 · 링크 취합', '2차마감': '부족 인원 마감 확인' };
  const DOW = ['월', '화', '수', '목', '금', '토', '일'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dayDiff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
  const monthOf = (s) => s.slice(0, 7);
  const addMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8)}`;

  if (!document.getElementById('crm-cal-css')) {
    const st = document.createElement('style'); st.id = 'crm-cal-css';
    st.textContent = `
.cal-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cal-seg{display:inline-flex;gap:2px;padding:3px;background:var(--muted);border-radius:10px}
.cal-seg button{height:32px;padding:0 14px;border:0;border-radius:8px;background:none;font-weight:600;font-size:13px;color:var(--t2)}
.cal-seg button.on{background:var(--surface);color:var(--t1);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cal-month{display:inline-flex;align-items:center;gap:4px;margin-left:auto}
.cal-month b{min-width:96px;text-align:center;font-size:15px;font-variant-numeric:tabular-nums}
.cal-month .icon-btn{width:30px;height:30px}
.cal-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--t3);align-items:center}
.cal-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:middle}
.cal-wrap{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px;align-items:start}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}
.cal-dow{padding:8px;font-size:11px;font-weight:600;color:var(--t3);border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--muted)}
.cal-day{min-height:118px;padding:6px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:3px;cursor:pointer;background:var(--surface);min-width:0}
.cal-day:hover{background:var(--surface-2)}
.cal-day.out{background:var(--muted);opacity:.55}
.cal-day.sel{box-shadow:inset 0 0 0 2px var(--accent)}
.cal-day .dn{font-size:12px;font-weight:700;color:var(--t2);display:flex;align-items:center;gap:4px}
.cal-day.today .dn b{background:var(--accent);color:#fff;border-radius:10px;padding:0 6px}
.cal-day .dn .late{margin-left:auto;font-size:10px;font-weight:700;color:var(--red)}
.chip-ev{display:flex;align-items:center;gap:4px;width:100%;min-width:0;height:22px;padding:0 6px;border-radius:6px;border:1px solid color-mix(in srgb,var(--c) 30%,var(--line));background:color-mix(in srgb,var(--c) 8%,var(--surface));font-size:11px;color:var(--t1);text-align:left;cursor:pointer}
.chip-ev .s{flex:none;font-weight:700;color:var(--c)}
.chip-ev .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip-ev.done{--c:var(--green)!important;background:color-mix(in srgb,var(--green) 14%,var(--surface));color:var(--t3)}
.chip-ev.done .n{text-decoration:line-through}
.chip-ev.late{border-color:var(--red);box-shadow:inset 3px 0 0 var(--red)}
.chip-ev.muted{opacity:.55}
.cal-more{font-size:11px;font-weight:600;color:var(--t3);padding:0 4px}
.cal-side{display:grid;gap:12px;position:sticky;top:12px}
.cal-side .card{overflow:hidden}
.cs-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.cs-h h3{font-size:14px;font-weight:700;margin-right:auto}
.cs-h .n{font-size:12px;font-weight:700;color:var(--t3)}
.cs-g{padding:6px 14px 2px;font-size:11px;font-weight:700;color:var(--t3);display:flex;gap:6px;align-items:center}
.cs-g i{width:8px;height:8px;border-radius:2px;background:var(--c)}
.cs-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 14px;border-bottom:1px solid var(--line-2);font-size:13px}
.cs-row:last-child{border-bottom:0}
.cs-row .ck{width:24px;height:24px;border-radius:7px;border:1.5px solid var(--line-strong);background:var(--surface);display:grid;place-items:center;font-size:13px;font-weight:800;color:#fff;cursor:pointer}
.cs-row.done .ck{background:var(--green);border-color:var(--green)}
.cs-row.done .nm{color:var(--t3);text-decoration:line-through}
.cs-row .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.cs-row small{display:block;font-size:11px;color:var(--t3);font-weight:500;text-decoration:none}
.cs-row .late{color:var(--red)}
.cs-row .acts{display:flex;gap:4px;align-items:center}
.cs-row .acts input{height:26px;width:118px;font-size:12px}
.cs-empty{padding:14px;font-size:12px;color:var(--t3);text-align:center}
.cs-set{display:grid;gap:8px;padding:12px 14px}
.cs-set label{display:flex;align-items:center;gap:8px;font-size:13px}
.cs-set label span{flex:1}
.cs-set input{width:70px;height:30px;text-align:right}
.rn-chip{--c:var(--amber)}
.rn-chip.hot{--c:var(--red)}
.rn-chip.cold{--c:var(--t4)}
.cnt{display:flex;align-items:center;gap:5px;width:100%;height:24px;padding:0 6px;border-radius:6px;border:1px solid color-mix(in srgb,var(--c) 30%,var(--line));background:color-mix(in srgb,var(--c) 8%,var(--surface));font-size:12px;cursor:pointer;text-align:left}
.cal-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cal-tools .cal-legend{flex:1;min-width:0}
.cnt b{color:var(--c);font-weight:700;white-space:nowrap;flex:none}
.cnt .n{margin-left:auto;font-weight:700;color:var(--t2);font-variant-numeric:tabular-nums}
.cnt .ck{width:14px;height:14px;border-radius:4px;border:1.5px solid color-mix(in srgb,var(--c) 50%,var(--line));display:grid;place-items:center;font-size:10px;font-weight:800;color:#fff;flex:none}
.cnt.done{border-color:color-mix(in srgb,var(--green) 40%,var(--line));background:color-mix(in srgb,var(--green) 10%,var(--surface))}
.cnt.done .ck{background:var(--green);border-color:var(--green)}
.cnt.late{box-shadow:inset 3px 0 0 var(--red);border-color:var(--red)}
.cs-late{display:flex;gap:8px;align-items:center;width:100%;padding:8px 14px;border:0;border-bottom:1px solid var(--line-2);background:none;text-align:left;font-size:13px;cursor:pointer}
.cs-late:hover{background:var(--surface-2)}
.cs-late b{color:var(--red);min-width:40px}
.cs-late .go{margin-left:auto;color:var(--t3);font-size:12px}
.pm-layer{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:60;display:grid;place-items:center;padding:16px}
.pm{background:var(--surface);border-radius:14px;width:min(720px,100%);max-height:calc(var(--vh, 100vh) - 32px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.pm-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
.pm-h h3{font-size:16px;font-weight:700}
.pm-b{overflow-y:auto;min-height:0;flex:1;padding:12px 20px 20px;display:grid;gap:6px;align-content:start}
.pm-f{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--line)}
.cp-h{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px}
.cp-h i{width:10px;height:10px;border-radius:3px;background:var(--c)}
.cp-h b{color:var(--c)}
.cp-h span{color:var(--t3);font-size:12px}
.cp-h .n{margin-left:auto;font-weight:700}
.cp-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.cp-row.done{background:color-mix(in srgb,var(--green) 6%,var(--surface));border-color:color-mix(in srgb,var(--green) 30%,var(--line))}
.cp-row.done .cp-nm b{color:var(--t3);text-decoration:line-through}
.cp-row.late{border-color:var(--red)}
.cp-ck{width:20px;height:20px;accent-color:var(--green);cursor:pointer}
.cp-nm{min-width:0}
.cp-nm b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-nm small{font-size:11px;color:var(--t3)}
.cp-nm small.late{color:var(--red)}
.cp-close{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--t2)}
.cp-close .fi{width:56px;height:28px;text-align:right}
.cp-acts{display:flex;gap:4px}
.cp-acts .fi{height:28px;width:130px}
@media (max-width:720px){.cp-row{grid-template-columns:22px minmax(0,1fr)}.cp-close,.cp-acts{grid-column:2}.cnt b{display:none}.cnt{height:18px;padding:0 3px;font-size:10px}.pm-layer{padding:0;place-items:stretch}.pm{width:100%;max-height:none;height:var(--vh,100vh);border-radius:0}}
@media (max-width:1100px){.cal-wrap{grid-template-columns:minmax(0,1fr)}.cal-side{position:static}}
@media (max-width:720px){.cal-day{min-height:64px;padding:3px}.chip-ev .n{display:none}.chip-ev{height:16px;padding:0 3px;font-size:9px}.cal-dow{padding:4px;text-align:center}}
`;
    document.head.appendChild(st);
  }

  const S = { box: null, tab: 'camp', month: null, sel: null, mine: false, cfg: null };
  const isMine = (c) => c.sales_owner === me || c.manager_owner === me || (admins[me] && (c.sales_owner_name === admins[me] || c.manager_owner_name === admins[me]));

  async function loadCfg() {
    if (S.cfg) return S.cfg;
    const { data } = await sb.from('crm_settings').select('key,value').in('key', ['camp_offsets', 'camp_start']);
    const m = Object.fromEntries((data || []).map((x) => [x.key, x.value]));
    let start = m.camp_start;
    if (!start) { start = todayKst(); await sb.from('crm_settings').upsert({ key: 'camp_start', value: start }); }
    const off = { 발표: 7, 마감: 21, '2차마감': 7, ...(m.camp_offsets || {}) }; delete off.노출보고;
    S.cfg = { off, start: String(start).replace(/"/g, '') };
    return S.cfg;
  }

  // ── 체험단 일정 만들기: [from, to] 사이에 날짜가 걸리는 단계 (모집·발표·마감은 모집일에서, 2차마감은 마감 인원 부족 시 저장된 행) ──
  async function campEvents(from, to) {
    const cfg = await loadCfg();
    const maxOff = Math.max(cfg.off.발표 || 0, (cfg.off.마감 || 0) + (cfg.off['2차마감'] || 0), 0);
    const [co, tk] = await Promise.all([
      sb.from('companies').select('id,name,brand,recruit_days,camp_teams,phone,store_phone,rep_name,sales_owner,manager_owner,sales_owner_name,manager_owner_name,service_type').eq('stage', '결제').eq('run_status', '진행 중').limit(2000),
      sb.from('camp_tasks').select('*').gte('cycle_on', addDays(from, -maxOff - 31)).lte('cycle_on', to).limit(5000),
    ]);
    const tasks = new Map((tk.data || []).map((t) => [`${t.company_id}|${t.cycle_on}|${t.step}`, t]));
    const camp = (co.data || []).filter((c) => (c.recruit_days || []).length);
    const byId = new Map((co.data || []).map((c) => [c.id, c]));
    const noDays = (co.data || []).filter((c) => !(c.recruit_days || []).length && c.service_type === '체험단 패키지');
    const ev = [];
    let m = addMonth(monthOf(addDays(from, -maxOff)), 0);
    const last = monthOf(to);
    for (; m <= last; m = addMonth(m, 1)) {
      const [y, mo] = m.split('-').map(Number), dim = new Date(y, mo, 0).getDate();
      for (const c of camp) for (const d of new Set(c.recruit_days.map((x) => Math.min(Number(x) || 1, dim)))) {
        const cycle = `${m}-${pad(d)}`;
        for (const step of BASE_STEPS) {
          const t = tasks.get(`${c.id}|${cycle}|${step}`);
          const due = t?.due_on || (step === '모집' ? cycle : addDays(cycle, cfg.off[step] || 0));
          if (due < from || due > to) continue;
          ev.push({ co: c, cycle, step, due, task: t, done: !!t?.done_at });
        }
      }
    }
    // 2차마감: 마감에서 인원이 모자라면 생긴 행
    (tk.data || []).filter((t) => t.step === '2차마감' && byId.has(t.company_id) && t.due_on >= from && t.due_on <= to)
      .forEach((t) => ev.push({ co: byId.get(t.company_id), cycle: t.cycle_on, step: '2차마감', due: t.due_on, task: t, done: !!t.done_at }));
    return { ev, noDays, cfg };
  }
  // 체험단 기간 (일정 이미지·구글 캘린더용): 모집일 ~ 발표 · 체험+리뷰 = 발표 다음날 ~ 마감 전날 · 마감
  function campPeriod(cycle, cfg) {
    const ann = addDays(cycle, cfg.off.발표 || 0), dl = addDays(cycle, cfg.off.마감 || 0);
    return { recruitFrom: cycle, recruitTo: ann, announce: ann, reviewFrom: addDays(ann, 1), reviewTo: addDays(dl, -1), deadline: dl };
  }
  async function saveTask(e, patch) {
    const row = { company_id: e.co.id, cycle_on: e.cycle, step: e.step, due_on: e.task?.due_on || null, done_at: e.task?.done_at || null, done_by: e.task?.done_by || null,
      target: e.task?.target ?? null, closed: e.task?.closed ?? null, ...patch };
    const { data, error } = await sb.from('camp_tasks').upsert(row, { onConflict: 'company_id,cycle_on,step' }).select().single();
    if (error) { toast('저장 실패: ' + error.message); return false; }
    e.task = data; e.done = !!data.done_at; return true;
  }
  const toggle = (e) => saveTask(e, { done_at: e.done ? null : new Date().toISOString(), done_by: e.done ? null : me });
  const moveDue = (e, due) => saveTask(e, { due_on: due || null });
  // 마감 인원 저장 → 다 찼으면 완료, 모자라면 +7일 2차마감(남은 인원) 생성·갱신
  async function saveClose(e, closed, target, cfg) {
    const full = target > 0 && closed >= target;
    if (!(await saveTask(e, { closed, target, done_at: full ? (e.task?.done_at || new Date().toISOString()) : null, done_by: full ? me : null }))) return false;
    if (e.step !== '마감') return true;
    const key = { company_id: e.co.id, cycle_on: e.cycle, step: '2차마감' };
    if (!full && target > 0) {
      const { error } = await sb.from('camp_tasks').upsert({ ...key, due_on: addDays(e.due, cfg.off['2차마감'] || 7), target: target - closed }, { onConflict: 'company_id,cycle_on,step' });
      if (error) { toast('2차 마감 생성 실패: ' + error.message); return false; }
    } else {
      await sb.from('camp_tasks').delete().eq('company_id', e.co.id).eq('cycle_on', e.cycle).eq('step', '2차마감').is('done_at', null);
    }
    return true;
  }
  const evState = (e, today, start) => e.done ? 'done' : e.due < today && e.due >= start ? 'late' : e.due < start ? 'muted' : '';

  function mount(box) {
    S.box = box;
    if (!S.month) { S.month = monthOf(todayKst()); S.sel = todayKst(); }
    try { const t = localStorage.getItem('crm-cal-tab'); if (t === 'camp' || t === 'contract') S.tab = t; S.mine = localStorage.getItem('crm-cal-mine') === '1'; } catch {}
    draw();
  }

  async function draw() {
    const seg = el('div', { className: 'cal-seg' }, [['camp', '체험단'], ['contract', '계약']].map(([k, t]) => el('button', { type: 'button', className: S.tab === k ? 'on' : '', text: t, onclick: () => { S.tab = k; try { localStorage.setItem('crm-cal-tab', k); } catch {} draw(); } })));
    const mine = el('button', { className: 'chip' + (S.mine ? ' on' : ''), type: 'button', text: '내 담당만', onclick: () => { S.mine = !S.mine; try { localStorage.setItem('crm-cal-mine', S.mine ? '1' : '0'); } catch {} draw(); } });
    const nav = el('div', { className: 'cal-month' }, [
      el('button', { className: 'btn sm', type: 'button', text: '오늘', onclick: () => { S.month = monthOf(todayKst()); S.sel = todayKst(); draw(); } }),
      el('button', { className: 'icon-btn', type: 'button', text: '‹', title: '이전 달', onclick: () => { S.month = addMonth(S.month, -1); draw(); } }),
      el('b', { text: S.month.replace('-', '. ') }),
      el('button', { className: 'icon-btn', type: 'button', text: '›', title: '다음 달', onclick: () => { S.month = addMonth(S.month, 1); draw(); } }),
    ]);
    const body = el('div', { className: 'stack' }, el('div', { className: 'hint', text: '불러오는 중…' }));
    S.box.replaceChildren(el('div', { className: 'cal-top' }, [seg, mine, nav]), body);
    try { body.replaceChildren(...(S.tab === 'camp' ? await campView() : await contractView())); }
    catch (e) { body.replaceChildren(el('div', { className: 'err', text: '불러오기 실패: ' + e.message })); }
  }

  // 달력 칸 (월요일 시작, 6주)
  function gridDays() {
    const first = parse(S.month + '-01'); const lead = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return iso(d); });
  }

  // ── 체험단 ──
  function popup(title, kids, foot) {
    const layer = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === layer) close(); } }, el('div', { className: 'pm cal-pm' }, [
      el('div', { className: 'pm-h' }, [el('h3', { text: title }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => close() })]),
      el('div', { className: 'pm-b' }, kids), foot ? el('div', { className: 'pm-f' }, foot) : null,
    ].filter(Boolean)));
    let changed = false;
    const onKey = (e) => { if (e.key === 'Escape' && document.body.lastElementChild === layer) close(); };
    const close = () => { document.removeEventListener('keydown', onKey); layer.remove(); if (changed) draw(); };
    document.addEventListener('keydown', onKey);
    document.body.append(layer);
    return { layer, close, mark: () => { changed = true; } };
  }
  async function campView() {
    const days = gridDays(); const today = todayKst();
    const { ev: all, noDays, cfg } = await campEvents(days[0], days[41]);
    const ev = S.mine ? all.filter((e) => isMine(e.co)) : all;
    const byDay = {}; ev.forEach((e) => { ((byDay[e.due] = byDay[e.due] || {})[e.step] = byDay[e.due][e.step] || []).push(e); });
    // 칸: 단계별 숫자만. 다 체크되면 ✓
    const stepBtn = (d, s, list) => {
      const done = list.filter((e) => e.done).length, allDone = done === list.length;
      const late = !allDone && d < today && d >= cfg.start;
      const b = el('button', { type: 'button', className: 'cnt' + (allDone ? ' done' : '') + (late ? ' late' : ''), title: `${s} ${list.length}곳 (${done} 완료) — 눌러서 보기` },
        [el('span', { className: 'ck', text: allDone ? '✓' : '' }), el('b', { text: s }), el('span', { className: 'n', text: allDone ? String(list.length) : `${done}/${list.length}` })]);
      b.style.setProperty('--c', STEP_COLOR[s]);
      b.onclick = (x) => { x.stopPropagation(); dayPopup(d, s); };
      return b;
    };
    const cells = days.map((d) => {
      const m = byDay[d] || {};
      return el('div', { className: 'cal-day' + (monthOf(d) !== S.month ? ' out' : '') + (d === today ? ' today' : ''), onclick: () => Object.keys(m).length && dayPopup(d) }, [
        el('div', { className: 'dn' }, el('b', { text: String(+d.slice(8)) })),
        ...STEPS.filter((s) => m[s]).map((s) => stepBtn(d, s, m[s])),
      ]);
    });
    const grid = el('div', { className: 'cal-grid' }, [...DOW.map((w) => el('div', { className: 'cal-dow', text: w })), ...cells]);

    // 팝업: 그날(또는 그 단계) 업체 목록 · 체크 · 마감 인원
    function dayPopup(d, only) {
      const m = byDay[d] || {};
      const P = popup(`${md(d)} ${only || '체험단 일정'}`, []);
      const body = P.layer.querySelector('.pm-b');
      const paint = () => body.replaceChildren(...STEPS.filter((s) => m[s] && (!only || s === only)).flatMap((s) => {
        const list = m[s].sort((a, b) => a.co.name.localeCompare(b.co.name));
        const h = el('div', { className: 'cp-h' }, [el('i'), el('b', { text: `${s} ${list.length}곳` }), el('span', { text: STEP_HINT[s] }), el('span', { className: 'n', text: `${list.filter((e) => e.done).length}/${list.length} 완료` })]);
        h.style.setProperty('--c', STEP_COLOR[s]);
        return [h, ...list.map((e) => row(e))];
      }));
      const row = (e) => {
        const st = evState(e, today, cfg.start);
        const ck = el('input', { type: 'checkbox', className: 'cp-ck', checked: e.done, title: '처리 완료' });
        const isClose = e.step === '마감' || e.step === '2차마감';
        const target = e.task?.target ?? (e.step === '마감' ? e.co.camp_teams : null);
        const kids = [ck, el('div', { className: 'cp-nm' }, [el('b', { text: e.co.name }), el('small', { className: st === 'late' ? 'late' : '', text: [e.done ? '완료' : st === 'late' ? `${dayDiff(today, e.due)}일 지남` : '대기', e.co.manager_owner_name || e.co.sales_owner_name || ''].filter(Boolean).join(' · ') })])];
        let closeBox = null;
        if (isClose) {
          const cIn = el('input', { className: 'fi', type: 'number', min: 0, value: e.task?.closed ?? '', placeholder: '0' });
          const tIn = el('input', { className: 'fi', type: 'number', min: 0, value: target ?? '', placeholder: '총' });
          const sv = el('button', { className: 'btn sm', type: 'button', text: '저장', onclick: async () => {
            const c = Number(cIn.value) || 0, t = Number(tIn.value) || 0;
            if (!t) { toast('총 인원을 넣어주세요'); return; }
            if (await saveClose(e, c, t, cfg)) { P.mark(); toast(c >= t ? `${e.co.name} 마감 완료 (${c}/${t})` : `${e.co.name} ${t - c}명 부족 → ${md(addDays(e.due, cfg.off['2차마감'] || 7))} 2차 마감 생성`); paint(); }
          } });
          closeBox = el('div', { className: 'cp-close' }, [cIn, el('span', { text: '/' }), tIn, el('span', { text: '명' }), sv]);
          kids.push(closeBox);
        }
        kids.push(el('div', { className: 'cp-acts' }, [
          e.step === '발표' ? el('button', { className: 'btn sm brand', type: 'button', text: '발표 도우미 ›', title: '명단 · 점주 안내 · 일정 이미지 · 가이드', onclick: () => { P.close(); openCamp({ co: e.co, cycle: e.cycle, cfg }); } }) : null,
          el('button', { className: 'btn sm ghost', type: 'button', text: '날짜', title: '이 일정만 날짜 옮기기', onclick: (x) => {
            const inp = el('input', { className: 'fi', type: 'date', value: e.due });
            inp.onchange = async () => { if (await moveDue(e, inp.value)) { P.mark(); toast(`${e.co.name} ${e.step} → ${md(inp.value)}`); P.close(); } };
            x.target.replaceWith(inp); inp.focus(); inp.showPicker?.();
          } }),
          el('button', { className: 'btn sm ghost', type: 'button', text: '업체', onclick: () => { P.close(); openCompanyFromToday(e.co.id); } }),
        ].filter(Boolean)));
        ck.onchange = async () => {
          ck.disabled = true;
          if (isClose && !e.done && !(e.task?.target)) { const t = Number(target) || 0; if (t && await saveClose(e, t, t, cfg)) { P.mark(); paint(); return; } }
          if (await toggle(e)) { P.mark(); paint(); } else ck.checked = e.done;
          ck.disabled = false;
        };
        return el('div', { className: 'cp-row' + (e.done ? ' done' : '') + (st === 'late' ? ' late' : '') }, kids);
      };
      paint();
    }

    // 오른쪽: 지난 미완료 · 모집일 미설정 · 설정
    const lateAll = ev.filter((e) => evState(e, today, cfg.start) === 'late');
    const lateByDay = {}; lateAll.forEach((e) => { (lateByDay[e.due] = lateByDay[e.due] || []).push(e); });
    const side = el('div', { className: 'cal-side' }, [
      el('div', { className: 'card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: '지난 미완료' }), el('span', { className: 'n late', text: lateAll.length })]),
        ...(lateAll.length ? Object.entries(lateByDay).sort((a, b) => a[0].localeCompare(b[0])).map(([d, l]) => el('button', { type: 'button', className: 'cs-late', onclick: () => dayPopup(d) }, [el('b', { text: md(d) }), el('span', { text: STEPS.map((s) => { const n = l.filter((e) => e.step === s).length; return n ? `${s} ${n}` : ''; }).filter(Boolean).join(' · ') }), el('span', { className: 'go', text: '열기 ›' })]))
          : [el('div', { className: 'cs-empty', text: '밀린 일정이 없습니다 👍' })])]),
      noDays.length ? el('div', { className: 'card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: '모집일 미설정 (체험단 진행 중)' }), el('span', { className: 'n', text: noDays.length })]),
        ...noDays.slice(0, 30).map((c) => { const inp = el('input', { className: 'fi', placeholder: '예: 1, 16', title: '매월 모집일 (쉼표로 여러 날)' });
          const save = el('button', { className: 'btn sm', type: 'button', text: '저장', onclick: async () => {
            const ds = [...new Set(inp.value.split(/[^\d]+/).map(Number).filter((x) => x >= 1 && x <= 31))].sort((a, b) => a - b);
            if (!ds.length) { toast('1~31 사이 날짜를 넣어주세요'); return; }
            const { error } = await sb.from('companies').update({ recruit_days: ds }).eq('id', c.id); if (error) { toast('저장 실패: ' + error.message); return; }
            toast(`${c.name} 매월 ${ds.join(', ')}일 모집`); draw(); } });
          return el('div', { className: 'cs-row' }, [el('span'), el('div', { className: 'nm', text: c.name }), el('div', { className: 'acts' }, [inp, save])]); })]) : null,
      settingsCard(cfg),
    ].filter(Boolean));
    const legend = el('div', { className: 'cal-legend' }, [...STEPS.map((s) => { const x = el('span', {}, [el('i'), `${s} (${s === '모집' ? '모집일' : s === '2차마감' ? '마감 +' + cfg.off['2차마감'] + '일 · 인원 부족 시' : '+' + cfg.off[s] + '일'})`]); x.firstChild.style.background = STEP_COLOR[s]; return x; }),
      el('span', { text: '· 숫자를 누르면 업체 목록 · 다 체크하면 ✓' })]);
    const annEv = ev.filter((e) => e.step === '발표' && monthOf(e.due) === S.month);
    const tools = el('div', { className: 'cal-tools' }, [legend, el('button', { className: 'btn primary', type: 'button', text: `명단 변환 · 발표 도우미${annEv.length ? ` (${annEv.length})` : ''}`, onclick: () => pickCamp(annEv, cfg) })]);
    return [tools, el('div', { className: 'cal-wrap' }, [el('div', { className: 'card' }, grid), side])];
  }
  const campLib = () => loadScript('/assets/crm-camp.js?v=1');
  const openCamp = (a) => campLib().then(() => window.CRM_CAMP.open(a)).catch((e) => toast('발표 도우미를 불러오지 못했습니다: ' + e.message));
  const pickCamp = (evs, cfg) => campLib().then(() => window.CRM_CAMP.pick(evs, cfg)).catch((e) => toast('발표 도우미를 불러오지 못했습니다: ' + e.message));
  function settingsCard(cfg) {
    const LBL = { 발표: '발표 = 모집일 +', 마감: '마감 = 모집일 +', '2차마감': '2차 마감 = 마감 +' };
    const F = Object.fromEntries(Object.keys(LBL).map((s) => [s, el('input', { className: 'fi', type: 'number', min: 0, value: cfg.off[s] })]));
    const d = el('details', {}, [el('summary', { className: 'cs-h', text: '⚙ 단계 간격 설정' }), el('div', { className: 'cs-set' }, [
      ...Object.entries(F).map(([s, inp]) => el('label', {}, [el('span', { text: LBL[s] }), inp, '일'])),
      el('div', { className: 'hint', text: '모든 업체에 같은 간격이 적용됩니다. 한 건만 옮길 땐 팝업의 [날짜]를 쓰세요.' }),
      el('button', { className: 'btn primary', type: 'button', text: '저장', onclick: async () => {
        const v = Object.fromEntries(Object.entries(F).map(([s, i]) => [s, Math.max(0, Number(i.value) || 0)]));
        const { error } = await sb.from('crm_settings').upsert({ key: 'camp_offsets', value: v, updated_at: new Date().toISOString() });
        if (error) { toast('저장 실패: ' + error.message); return; } S.cfg = null; toast('단계 간격 저장'); draw();
      } })])]);
    return el('div', { className: 'card' }, d);
  }

  // ── 계약: 재계약 달력 + 실행 소진 · 수량 입력 알림 ──
  async function execAlerts() {
    const { data: co } = await sb.from('companies').select('id,name,sales_owner,manager_owner,sales_owner_name,manager_owner_name,next_renew_due,run_status').eq('stage', '결제').eq('run_status', '진행 중').limit(2000);
    const ids = (co || []).map((c) => c.id);
    if (!ids.length) return { low: [], empty: [], stale: [], co: [] };
    const chunks = []; for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
    const [cts, dls] = await Promise.all([
      Promise.all(chunks.map((c) => sb.from('contracts').select('id,company_id,paid_at').in('company_id', c))),
      Promise.all(chunks.map((c) => sb.from('deliverables').select('id,company_id,contract_id,item,planned,done,updated_at').in('company_id', c).gt('planned', 0))),
    ]);
    const latest = {}; cts.flatMap((r) => r.data || []).forEach((c) => { const l = latest[c.company_id]; if (!l || String(c.paid_at || '') > String(l.paid_at || '')) latest[c.company_id] = c; });
    const byId = new Map((co || []).map((c) => [c.id, c]));
    const cur = dls.flatMap((r) => r.data || []).filter((d) => !latest[d.company_id] || !d.contract_id || d.contract_id === latest[d.company_id].id);
    const low = [], empty = [], lastTouch = {};
    cur.forEach((d) => {
      const left = (Number(d.planned) || 0) - (Number(d.done) || 0), c = byId.get(d.company_id);
      if (left <= 0) empty.push({ co: c, d, left }); else if (left <= Number(d.planned) * 0.2) low.push({ co: c, d, left });
      if (!lastTouch[d.company_id] || d.updated_at > lastTouch[d.company_id]) lastTouch[d.company_id] = d.updated_at;
    });
    const cut = new Date(Date.now() - 14 * 864e5).toISOString();
    const stale = Object.entries(lastTouch).filter(([, t]) => t < cut).map(([id, t]) => ({ co: byId.get(id), t }));
    return { low, empty, stale, co: co || [] };
  }
  async function contractView() {
    const days = gridDays(); const today = todayKst();
    const A = await execAlerts();
    const f = (l) => S.mine ? l.filter((x) => isMine(x.co || x)) : l;
    const co = f(A.co);
    const byDay = {}; co.filter((c) => c.next_renew_due && c.next_renew_due >= days[0] && c.next_renew_due <= days[41]).forEach((c) => { (byDay[c.next_renew_due] = byDay[c.next_renew_due] || []).push(c); });
    const chip = (c) => { const dd = dayDiff(c.next_renew_due, today); const b = el('button', { type: 'button', className: 'chip-ev rn-chip' + (dd <= 7 ? ' hot' : dd > 30 ? ' cold' : ''), title: `${c.name} 재계약 ${dd < 0 ? -dd + '일 지남' : 'D-' + dd} — 누르면 업체 열기`, onclick: (e) => { e.stopPropagation(); openCompanyFromToday(c.id); } }, [el('span', { className: 's', text: dd < 0 ? '지남' : 'D-' + dd }), el('span', { className: 'n', text: c.name })]); return b; };
    const cells = days.map((d) => { const list = (byDay[d] || []).sort((a, b) => a.name.localeCompare(b.name));
      return el('div', { className: 'cal-day' + (monthOf(d) !== S.month ? ' out' : '') + (d === today ? ' today' : '') }, [el('div', { className: 'dn' }, el('b', { text: String(+d.slice(8)) })), ...list.slice(0, 4).map(chip), list.length > 4 ? el('div', { className: 'cal-more', text: `+${list.length - 4}곳 더` }) : null].filter(Boolean)); });
    const grid = el('div', { className: 'cal-grid' }, [...DOW.map((w) => el('div', { className: 'cal-dow', text: w })), ...cells]);
    const soon = co.filter((c) => c.next_renew_due && dayDiff(c.next_renew_due, today) <= 30 && dayDiff(c.next_renew_due, today) >= -30).sort((a, b) => a.next_renew_due.localeCompare(b.next_renew_due));
    const sec = (title, n, rows, empty) => el('div', { className: 'card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: title }), el('span', { className: 'n', text: n })]), ...(rows.length ? rows : [el('div', { className: 'cs-empty', text: empty })])]);
    const line = (c, sub, cls = '') => el('div', { className: 'cs-row' }, [el('span'), el('div', { className: 'nm' }, [c.name, el('small', { className: cls, text: sub })]), el('div', { className: 'acts' }, el('button', { className: 'btn sm ghost', type: 'button', text: '업체', onclick: () => openCompanyFromToday(c.id) }))]);
    const low = f(A.low), empty = f(A.empty), stale = f(A.stale);
    const side = el('div', { className: 'cal-side' }, [
      sec('재계약 임박 (±30일)', soon.length, soon.slice(0, 40).map((c) => { const dd = dayDiff(c.next_renew_due, today); return line(c, `${md(c.next_renew_due)} · ${dd < 0 ? -dd + '일 지남' : 'D-' + dd} · ${c.manager_owner_name || c.sales_owner_name || '미배정'}`, dd <= 7 ? 'late' : ''); }), '30일 안에 재계약할 업체가 없습니다.'),
      sec('실행 소진 임박 (남은 수량 20% 이하)', low.length, low.slice(0, 40).map((x) => line(x.co, `${x.d.item} ${Number(x.left).toLocaleString()} / ${Number(x.d.planned).toLocaleString()} 남음 · 재계약 제안`)), '없습니다.'),
      sec('실행 소진 완료', empty.length, empty.slice(0, 40).map((x) => line(x.co, `${x.d.item} ${Number(x.d.done).toLocaleString()} / ${Number(x.d.planned).toLocaleString()} 완료`, 'late')), '없습니다.'),
      sec('실행 수량 입력 필요 (14일 넘게 안 고침)', stale.length, stale.slice(0, 40).map((x) => line(x.co, `마지막 수정 ${kstDay(x.t)}`)), '모든 업체 수량이 최신입니다.'),
    ]);
    const legend = el('div', { className: 'cal-legend' }, [el('span', {}, [el('i', { style: 'background:var(--t4)' }), 'D-31 이상']), el('span', {}, [el('i', { style: 'background:var(--amber)' }), 'D-30 ~ D-8']), el('span', {}, [el('i', { style: 'background:var(--red)' }), 'D-7 이내 · 지남']), el('span', { text: '· 업체를 누르면 상세가 열립니다' })]);
    return [legend, el('div', { className: 'cal-wrap' }, [el('div', { className: 'card' }, grid), side])];
  }

  // 오늘 할 일용: 오늘 + 지난 미완료 체험단 일정
  async function todayCamp() {
    const today = todayKst(); const cfg = await loadCfg();
    const { ev } = await campEvents(cfg.start < addDays(today, -60) ? addDays(today, -60) : cfg.start, today);
    return { ev: ev.filter((e) => !e.done), toggle };
  }

  window.CRM_CALENDAR = { mount, todayCamp, execAlerts };
})();
