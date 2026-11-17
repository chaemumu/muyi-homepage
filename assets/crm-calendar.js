// ── 캘린더: 체험단(모집 → 발표 → 마감 → 2차마감) · 계약(재계약 · 실행 소진) ──
// admin.html의 sb·el·admins·me·toast·todayKst·kstDay·openCompanyFromToday 사용. window.CRM_CALENDAR = { mount(box), todayCamp(), execAlerts() }
// 체험단 일정은 업체의 '매월 모집일'(companies.recruit_days)로 만들고, 완료·날짜 변경만 camp_tasks에 저장한다.
// 단계 간격(모집일 기준 +일)은 crm_settings.camp_offsets. 추적 시작일(camp_start) 이전 일정은 지난 미완료로 세지 않는다.
(function () {
  const BASE_STEPS = ['모집', '발표', '마감'];
  const STEPS = ['모집', '발표', '마감', '2차마감'];
  const STEP_COLOR = { 모집: '#3B6FC4', 발표: '#B7791F', 마감: '#D9572B', '2차마감': '#A23E62' }; // crm-camp.js STEP_C와 같은 색
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
  const mdw = (s) => `${md(s)}(${DOW_KO[new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8)).getDay()]})`;
  const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

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
.cal-wrap>.stack,.cal-wrap>.stack>.card{min-width:0}
.cg-wrap{overflow-x:auto}
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
.cal-more{font-size:11px;font-weight:600;color:var(--t3);padding:0 4px;border:0;background:none;text-align:left;cursor:pointer}
.cal-more:hover{color:var(--accent)}
.cal-side{display:grid;gap:12px;position:sticky;top:12px}
.cal-side .card{overflow:hidden}
.cs-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.cs-h h3{font-size:14px;font-weight:700;margin-right:auto}
.cs-h .n{font-size:12px;font-weight:700;color:var(--t3)}
.cs-g{padding:6px 14px 2px;font-size:11px;font-weight:700;color:var(--t3);display:flex;gap:6px;align-items:center}
.cs-g i{width:8px;height:8px;border-radius:2px;background:var(--c)}
.cs-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 14px;border-bottom:1px solid var(--line-2);font-size:13px}
.cs-row:last-child{border-bottom:0}
.cs-list{display:grid}
.cal-busy>.stack{opacity:.55;pointer-events:none;transition:opacity .15s}
.cs-list.open{max-height:420px;overflow-y:auto}
.cs-line{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;align-items:center;width:100%;padding:8px 14px;border:0;border-bottom:1px solid var(--line-2);background:none;text-align:left;cursor:pointer;font:inherit}
.cs-line:hover{background:var(--surface-2)}
.cs-line b{grid-column:1;font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-line small{grid-column:1;font-size:11px;color:var(--t3);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-line small.late{color:var(--red)}
.cs-line .go{grid-column:2;grid-row:1/3;color:var(--t4);font-size:16px}
.cs-more{width:100%;height:36px;border:0;background:none;font-size:12px;font-weight:700;color:var(--accent);cursor:pointer}
.cs-more:hover{background:var(--surface-2)}
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
.rn-chip{--c:var(--amber);height:auto;min-height:22px;flex-direction:column;align-items:flex-start;gap:0;padding:3px 6px;text-align:left}
.rn-chip .s{font-size:10px;line-height:1.3}
.rn-chip .n{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.3;font-size:11.5px;word-break:keep-all}
.rn-chip.hot{--c:var(--red)}
.rn-chip.cold{--c:var(--t4)}
.rn-chip.hold{--c:#B7791F}
.rn-chip.end{--c:var(--t4);opacity:.75}
.rn-chip.end .n{text-decoration:line-through}
.cnt{display:flex;align-items:center;gap:5px;width:100%;height:24px;padding:0 6px;border-radius:6px;border:1px solid color-mix(in srgb,var(--c) 30%,var(--line));background:color-mix(in srgb,var(--c) 8%,var(--surface));font-size:12px;cursor:pointer;text-align:left}
.cal-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cal-tools .cal-legend{flex:1;min-width:0}
.cal-tools .sp{flex:1}
.ct-hint{font-size:12px;color:var(--t3)}
.ct-grid{user-select:none}
.ct-grid.dragging .ct-bar{pointer-events:none}
.ct-grid.dragging{cursor:grabbing}
.ct-dows{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--line)}
.ct-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:26px repeat(4,23px) 1fr;min-height:128px;position:relative;border-bottom:1px solid var(--line)}
.ct-day{grid-row:1 / -1;border-right:1px solid var(--line);padding:6px;cursor:cell;display:flex;flex-direction:column;justify-content:space-between;background:var(--surface)}
.ct-day:nth-child(7){border-right:0}
.ct-day.out{background:var(--surface-2)}
.ct-day.out .dn b{color:var(--t4)}
.ct-day.today .dn b{background:var(--accent);color:#fff;border-radius:10px;padding:0 6px}
.ct-day .dn b{font-size:12px}
.ct-day.pick{background:color-mix(in srgb,var(--accent) 12%,var(--surface))}
.ct-day .cal-more{align-self:flex-start}
.ct-bar{position:relative;z-index:1;margin:1px 3px;height:21px;display:flex;align-items:center;gap:4px;min-width:0;padding:0 7px;border:0;border-radius:5px;background:color-mix(in srgb,var(--c) 16%,var(--surface));color:color-mix(in srgb,var(--c) 80%,var(--t1));font-size:11.5px;font-weight:600;text-align:left;cursor:grab;box-shadow:inset 3px 0 0 var(--c)}
.ct-bar:hover{background:color-mix(in srgb,var(--c) 26%,var(--surface))}
.ct-bar.cont-l{border-top-left-radius:0;border-bottom-left-radius:0;margin-left:0;box-shadow:none}
.ct-bar.cont-r{border-top-right-radius:0;border-bottom-right-radius:0;margin-right:0}
.ct-bar.done{opacity:.55}
.ct-bar.done .tt{text-decoration:line-through}
.ct-bar .st{flex:none;font-size:10px;font-weight:800;opacity:.85}
.ct-bar .tt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct-bar.list{width:100%;height:34px;margin:0 0 6px;font-size:13px;cursor:pointer}
.ct-stat{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:10px 14px;border-bottom:1px solid var(--line-2)}
.ct-stat div{display:grid;justify-items:center}
.ct-stat b{font-size:18px}
.ct-stat small{font-size:10.5px;color:var(--t3)}
.ct-pm{width:min(560px,100%)!important}
.ct-pm .pm-f .sp{flex:1}
.ct-pm .fs-btns .chip.on{border-color:var(--c,var(--accent));color:var(--c,var(--accent));background:color-mix(in srgb,var(--c,var(--accent)) 10%,var(--surface))}
.ct-form{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
@media (max-width:720px){.ct-week{grid-template-rows:22px repeat(4,18px) 1fr;min-height:110px}.ct-bar{font-size:10px;padding:0 4px}.ct-form{grid-template-columns:1fr 1fr}}
.cal-info{width:30px;height:30px;border-radius:50%;border:1px solid var(--line-strong);font:italic 700 14px Georgia,serif;color:var(--t2);background:var(--surface)}
.cal-info:hover{color:var(--accent);border-color:var(--accent)}
.ci-pm{width:min(640px,100%)!important}
.ci-sec{display:grid;gap:6px;padding:4px 0 10px}
.ci-sec b{font-size:13px}
.ci-sec ul{margin:0;padding-left:18px;display:grid;gap:4px;font-size:12.5px;color:var(--t2);line-height:1.5}
.ci-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;vertical-align:middle}
.cg-tbl td.today{color:var(--accent);font-weight:700}
.cg-tbl td.ok{color:var(--green)}
.cg-seg button{display:inline-flex;align-items:center;gap:6px}
.cg-seg button i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.cg-seg button .n{font-size:11px;font-weight:700;color:var(--t3)}
.cg-wrap{max-height:520px;overflow:auto}
.cg-tbl td{font-size:13px}
.cs-h h3{white-space:nowrap}
.cs-h select{width:auto;margin-left:auto}
.cg-tbl tr.click{cursor:pointer}
.cg-tbl tr.click:hover td{background:var(--muted)}
.cg-miss{font-size:11px;font-weight:700;color:#7C3AED;background:color-mix(in srgb,#7C3AED 10%,var(--surface));padding:2px 8px;border-radius:10px;white-space:nowrap}
.cs-char{display:grid;justify-items:center;gap:8px}
.cs-char img{width:84px;height:auto}
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
.cp-drag{cursor:grab;color:var(--t3);font-size:18px;line-height:1;user-select:none;padding:2px 3px;border-radius:4px}
.cp-drag:hover{background:var(--muted);color:var(--t1)}
.cp-drag:active{cursor:grabbing}
.pm-layer.dragging{pointer-events:none;background:transparent}
.pm-layer.dragging .pm{opacity:.18}
.cal-day.drop{outline:2px dashed var(--accent);outline-offset:-3px;background:color-mix(in srgb,var(--accent) 8%,var(--surface))}
.cal-day.flash{animation:calFlash 1.6s ease-out 2}
@keyframes calFlash{0%{box-shadow:inset 0 0 0 3px var(--accent)}100%{box-shadow:inset 0 0 0 3px transparent}}
.rn-chip[draggable=true]{cursor:grab}
.cp-lead{display:flex;gap:6px;align-items:center}
.cp-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
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

  const S = { box: null, tab: 'camp', month: null, sel: null, mine: false, cfg: null, drag: null };
  // 끌어다 놓기: 칸(cal-day)에 data-d 날짜 → S.drag(옮길 대상)를 그 날짜로. 팝업에서 끌면 팝업이 투명해져 아래 달력에 놓을 수 있다
  const dropZone = (cell, d, onDrop) => {
    cell.dataset.d = d;
    cell.addEventListener('dragover', (x) => { if (!S.drag) return; x.preventDefault(); x.dataTransfer.dropEffect = 'move'; cell.classList.add('drop'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop'));
    cell.addEventListener('drop', (x) => { x.preventDefault(); cell.classList.remove('drop'); const g = S.drag; S.drag = null; if (g) onDrop(g, d); });
  };
  const startDrag = (x, payload, layer) => {
    S.drag = payload; x.dataTransfer.effectAllowed = 'move'; try { x.dataTransfer.setData('text/plain', payload.label || ''); } catch {}
    if (layer) setTimeout(() => layer.classList.add('dragging'), 0);
  };
  const endDrag = (layer) => { layer?.classList.remove('dragging'); document.querySelectorAll('.cal-day.drop').forEach((c) => c.classList.remove('drop')); setTimeout(() => { S.drag = null; }, 50); };
  const flash = (dates) => setTimeout(() => dates.forEach((d) => S.box.querySelector(`.cal-day[data-d="${d}"]`)?.classList.add('flash')), 50);
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
  // 한 업체·한 회차의 단계 날짜 옮기기. withLater면 뒤 단계(발표·마감·2차마감 중 미완료)도 같은 일수만큼
  async function moveStep(e, to, withLater, cfg) {
    const delta = dayDiff(to, e.due); if (!delta) return true;
    const order = STEPS.indexOf(e.step);
    const { data: rows } = await sb.from('camp_tasks').select('*').eq('company_id', e.co.id).eq('cycle_on', e.cycle);
    const have = new Map((rows || []).map((t) => [t.step, t]));
    const steps = STEPS.filter((s, i) => i === order || (withLater && i > order && (BASE_STEPS.includes(s) || have.has(s))));
    for (const s of steps) {
      const t = have.get(s); if (s !== e.step && t?.done_at) continue;
      const cur = s === e.step ? e.due : (t?.due_on || (s === '모집' ? e.cycle : addDays(e.cycle, cfg.off[s] || 0)));
      const row = { company_id: e.co.id, cycle_on: e.cycle, step: s, due_on: addDays(cur, delta), done_at: t?.done_at || null, done_by: t?.done_by || null, target: t?.target ?? null, closed: t?.closed ?? null };
      const { error } = await sb.from('camp_tasks').upsert(row, { onConflict: 'company_id,cycle_on,step' });
      if (error) { toast('저장 실패: ' + error.message); return false; }
    }
    toast(`${e.co.name} ${steps.join('·')} ${delta > 0 ? '+' : ''}${delta}일 → ${md(to)}${steps.length > 1 ? ' 부터' : ''}`);
    return true;
  }
  const parseDays = (v) => [...new Set(String(v).split(/[^\d]+/).map(Number).filter((x) => x >= 1 && x <= 31))].sort((a, b) => a - b);
  async function saveDays(co, ds) {
    const { error } = await sb.from('companies').update({ recruit_days: ds.length ? ds : null }).eq('id', co.id);
    if (error) { toast('저장 실패: ' + error.message); return false; }
    const cfg = await loadCfg(), m = S.month;
    const dates = ds.flatMap((d) => { const c = `${m}-${pad(Math.min(d, new Date(+m.slice(0, 4), +m.slice(5), 0).getDate()))}`; return [['모집', c], ['발표', addDays(c, cfg.off.발표 || 0)], ['마감', addDays(c, cfg.off.마감 || 0)]]; });
    toast(ds.length ? `${co.name} 매월 ${ds.join(', ')}일 모집 → 이번 달 ${dates.map(([s, d]) => `${s} ${md(d)}`).join(' · ')} (칸 숫자에 포함)` : `${co.name} 모집일 해제`);
    await draw(); flash(dates.map(([, d]) => d));
    return true;
  }
  function editDays(co) {
    const inp = el('input', { className: 'fi', value: (co.recruit_days || []).join(', '), placeholder: '예: 1, 16' });
    const P = popup(`${co.name} · 매월 모집일`, [
      el('div', { className: 'hint', text: '매월 이 날짜에 모집 → 발표 → 마감 일정이 자동으로 생깁니다. 한 번만 날짜가 바뀌는 경우는 달력에서 끌어서 옮기세요.' }), inp,
    ], [el('button', { className: 'btn ghost', type: 'button', text: '모집일 해제', onclick: async () => { if (confirm(`${co.name}을 체험단 달력에서 뺄까요?`) && await saveDays(co, [])) P.close(); } }),
      el('button', { className: 'btn primary', type: 'button', text: '저장', onclick: async () => { const ds = parseDays(inp.value); if (!ds.length) { toast('1~31 사이 날짜를 넣어주세요'); return; } if (await saveDays(co, ds)) P.close(); } })]);
    inp.focus();
  }
  // ⓘ 사용법·기준: 열 때마다 현재 설정(단계 간격 등)으로 만든다 → 설정이 바뀌면 설명도 자동으로 바뀜
  async function showInfo() {
    const cfg = await loadCfg(), o = cfg.off;
    const sec = (t, items) => el('div', { className: 'ci-sec' }, [el('b', { text: t }), el('ul', {}, items.map((x) => el('li', {}, x)))]);
    const dot = (c, t) => { const i = el('span', { className: 'ci-dot' }); i.style.background = c; return el('span', {}, [i, t]); };
    popup('캘린더 사용법 · 기준', [
      sec('체험단 일정 (모든 업체 같은 간격)', [
        dot(STEP_COLOR.모집, `모집 — 매월 모집일 (업체마다 설정)`),
        dot(STEP_COLOR.발표, `발표 — 모집일 +${o.발표 || 0}일 · 선정 · 가이드라인 · 일정 안내`),
        dot(STEP_COLOR.마감, `마감 — 모집일 +${o.마감 || 0}일 ♥ · 마감 인원 확인 · 링크 취합`),
        dot(STEP_COLOR['2차마감'], `2차마감 — 마감 +${o['2차마감'] || 0}일 · 마감 인원이 모자랄 때만 자동 생성`),
        `체험+리뷰 기간 = 발표 다음날 ~ 마감 전날`,
        `간격은 오른쪽 [⚙ 단계 간격 설정]에서 바꾸며, 바꾸면 이 설명도 같이 바뀝니다`,
      ]),
      sec('체험단 쓰는 법', [
        '위 [모집·발표·마감·2차마감]을 누르면 그 단계만 달력과 아래 목록에 나옵니다 (다시 누르면 전체)',
        '칸의 숫자 = 완료/전체. 누르면 업체 목록 → 체크하면 완료, 다 체크되면 ✓',
        '날짜 바꾸기: 목록의 ⠿를 끌어 달력 날짜에 놓기 (또는 [날짜]) — 뒤 일정도 같이 옮길지 물어봅니다',
        '매월 모집일 자체를 바꾸기: 모집 목록의 [모집일] 또는 오른쪽 [모집일 미설정]',
        `지난 미완료는 추적 시작일(${cfg.start}) 이후 일정만 셉니다`,
      ]),
      sec('무이 콘텐츠 달력 (자체 마케팅 제작)', [
        '달력에서 날짜를 누르거나 여러 날을 끌어서 고르면 바로 등록 창 (구글 캘린더처럼)',
        '막대를 끌어 다른 날짜에 놓으면 기간 그대로 옮겨지고, 누르면 수정·삭제',
        `채널: ${CH.map(([k]) => k).join(' · ')} — 위 채널 탭을 누르면 그 채널만`,
        `진행 상태: ${CST.join(' → ')} (업로드 완료는 흐리게·취소선)`,
      ]),
      sec('계약 (재계약) 달력', [
        dot('var(--t4)', '재계약 D-31 이상'), dot('var(--amber)', 'D-30 ~ D-8'), dot('var(--red)', 'D-7 이내 · 지남'),
        dot('#B7791F', '홀딩'), dot('var(--t4)', '종료 · 환불 (취소선)'),
        '재계약일은 [결제 등록]·[재계약 등록] 시 결제일 + 기간으로 자동 계산, 업체 상세에서 직접 수정 가능',
        '칩을 끌어 다른 날짜에 놓으면 재계약일 변경',
        '그룹: 전체 · 진행 중 · 재계약 지남 · 홀딩 · 종료 · 정보 없음(재계약일·결제일 비어 있음)',
        '실행 소진: 남은 수량 20% 이하 = 임박, 0 = 완료 → 재계약 제안 · 수량 입력 14일 넘게 안 고치면 알림',
      ]),
    ]).layer.firstChild.classList.add('ci-pm');
  }
  async function dropCamp(e, d, cfg) {
    if (d === e.due) return;
    const later = STEPS.slice(STEPS.indexOf(e.step) + 1).filter((s) => BASE_STEPS.includes(s));
    const withLater = later.length ? confirm(`${e.co.name} ${e.step}: ${md(e.due)} → ${md(d)}\n\n뒤 일정(${later.join('·')})도 같은 날짜만큼 옮길까요?\n[확인] 같이 옮기기 · [취소] 이 일정만`) : false;
    if (await moveStep(e, d, withLater, cfg)) { await draw(); flash([d]); }
  }
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
    try { const t = localStorage.getItem('crm-cal-tab'); if (['camp', 'contract', 'content'].includes(t)) S.tab = t; S.mine = localStorage.getItem('crm-cal-mine') === '1'; } catch {}
    draw();
  }

  async function draw() {
    const seg = el('div', { className: 'cal-seg' }, [['camp', '체험단'], ['contract', '계약'], ['content', '무이 콘텐츠']].map(([k, t]) => el('button', { type: 'button', className: S.tab === k ? 'on' : '', text: t, onclick: () => { S.tab = k; try { localStorage.setItem('crm-cal-tab', k); } catch {} draw(); } })));
    const mine = el('button', { className: 'chip' + (S.mine ? ' on' : ''), type: 'button', text: '내 담당만', onclick: () => { S.mine = !S.mine; try { localStorage.setItem('crm-cal-mine', S.mine ? '1' : '0'); } catch {} draw(); } });
    const nav = el('div', { className: 'cal-month' }, [
      el('button', { className: 'btn sm', type: 'button', text: '오늘', onclick: () => { S.month = monthOf(todayKst()); S.sel = todayKst(); draw(); } }),
      el('button', { className: 'icon-btn', type: 'button', text: '‹', title: '이전 달', onclick: () => { S.month = addMonth(S.month, -1); draw(); } }),
      el('b', { text: S.month.replace('-', '. ') }),
      el('button', { className: 'icon-btn', type: 'button', text: '›', title: '다음 달', onclick: () => { S.month = addMonth(S.month, 1); draw(); } }),
    ]);
    // 다시 그릴 때 화면을 비우지 않는다: 새 내용이 준비되면 한 번에 교체 (깜빡임·스크롤 튐 방지)
    const info = el('button', { className: 'icon-btn cal-info', type: 'button', text: 'i', title: '캘린더 사용법 · 기준', onclick: () => showInfo() });
    const top = el('div', { className: 'cal-top' }, [seg, mine, info, nav]);
    const first = !S.box.querySelector('.cal-top');
    if (first) S.box.replaceChildren(top, el('div', { className: 'stack' }, el('div', { className: 'hint', text: '불러오는 중…' })));
    const tok = (S.drawTok = (S.drawTok || 0) + 1);
    S.box.classList.add('cal-busy');
    let kids;
    try { kids = S.tab === 'camp' ? await campView() : S.tab === 'contract' ? await contractView() : await contentView(); }
    catch (e) { kids = [el('div', { className: 'err', text: '불러오기 실패: ' + e.message })]; }
    if (tok !== S.drawTok) return; // 더 최신 draw가 있으면 버림
    S.box.classList.remove('cal-busy');
    const y = window.scrollY;
    S.box.replaceChildren(top, el('div', { className: 'stack' }, kids));
    window.scrollTo(0, y);
  }

  // ── 무이 콘텐츠 (자체 마케팅 제작 일정): 구글 캘린더처럼 날짜를 끌어 등록 · 막대를 끌어 옮기기 · 눌러서 수정 ──
  const CH = [['유튜브', '#E11D48'], ['인스타', '#C026D3'], ['숏폼·릴스', '#EA580C'], ['영상', '#2563EB'], ['블로그', '#16A34A'], ['기타', '#71717A']];
  const CH_C = Object.fromEntries(CH);
  const CST = ['기획', '촬영', '편집', '업로드 완료', '보류'];
  async function contentView() {
    const days = gridDays(), today = todayKst();
    const { data, error } = await sb.from('content_items').select('*').lte('starts_on', days[41]).gte('ends_on', days[0]).order('starts_on').limit(1000);
    if (error) throw error;
    const items = (S.mine ? (data || []).filter((x) => x.owner === me) : data || []).filter((x) => !S.cch || x.channel === S.cch);
    // 채널 필터 (누르면 그 채널만)
    const inMonth = (data || []).filter((x) => x.starts_on <= `${S.month}-31` && x.ends_on >= `${S.month}-01`);
    const chSeg = el('div', { className: 'cal-seg cg-seg' }, [['', '#1E10C7'], ...CH].map(([k, c]) => { const b = el('button', { type: 'button', className: (S.cch || '') === k ? 'on' : '', onclick: () => { S.cch = (S.cch || '') === k ? '' : k; draw(); } }, [el('i'), k || '전체', el('span', { className: 'n', text: (k ? inMonth.filter((x) => x.channel === k) : inMonth).length })]); b.style.setProperty('--c', c); return b; }));
    // 주 단위 줄: 막대가 여러 날에 걸쳐 이어짐 (겹치면 아래 줄로)
    let sel = null; // 끌어서 고르는 중인 범위 {a, b}
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const wd = days.slice(w * 7, w * 7 + 7);
      const segs = items.filter((x) => x.starts_on <= wd[6] && x.ends_on >= wd[0]).map((x) => ({ x, a: Math.max(0, wd.indexOf(x.starts_on < wd[0] ? wd[0] : x.starts_on)), b: wd.indexOf(x.ends_on > wd[6] ? wd[6] : x.ends_on) }))
        .sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a));
      const lanes = []; segs.forEach((g) => { let l = lanes.findIndex((end) => end < g.a); if (l < 0) { l = lanes.length; lanes.push(-1); } lanes[l] = g.b; g.l = l; });
      const MAXL = 4;
      const row = el('div', { className: 'ct-week' });
      wd.forEach((d, i) => {
        const more = segs.filter((g) => g.l >= MAXL && g.a <= i && g.b >= i).length;
        const c = el('div', { className: 'ct-day' + (monthOf(d) !== S.month ? ' out' : '') + (d === today ? ' today' : '') }, [el('div', { className: 'dn' }, el('b', { text: String(+d.slice(8)) })), more ? el('button', { type: 'button', className: 'cal-more', text: `+${more}개`, onclick: (e) => { e.stopPropagation(); dayList(d); } }) : null].filter(Boolean));
        c.style.gridColumn = `${i + 1}`; c.dataset.d = d;
        c.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('.ct-bar, .cal-more')) return; e.preventDefault(); sel = { a: d, b: d }; grid.classList.add('dragging'); paintSel(); });
        c.addEventListener('pointerenter', () => { if (sel) { sel.b = d; paintSel(); } if (mv) { mv.to = d; paintMove(); } });
        row.append(c);
      });
      segs.filter((g) => g.l < MAXL).forEach((g) => {
        const x = g.x, done = x.status === '업로드 완료';
        const bar = el('button', { type: 'button', className: 'ct-bar' + (done ? ' done' : '') + (x.starts_on < wd[0] ? ' cont-l' : '') + (x.ends_on > wd[6] ? ' cont-r' : ''), title: `${x.title} · ${x.channel || '채널 없음'} · ${x.status}\n${x.starts_on}${x.ends_on !== x.starts_on ? ' ~ ' + x.ends_on : ''}${x.owner_name ? ' · ' + x.owner_name : ''}\n끌어서 옮기기 · 눌러서 수정` },
          [el('span', { className: 'st', text: done ? '✓' : x.status === '기획' ? '' : x.status }), el('span', { className: 'tt', text: x.title })]);
        bar.style.gridColumn = `${g.a + 1} / ${g.b + 2}`; bar.style.gridRow = `${g.l + 2}`; bar.style.setProperty('--c', CH_C[x.channel] || '#71717A');
        bar.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); mv = { x0: e.clientX, y0: e.clientY, x, from: wd[Math.max(g.a, 0)], grab: null, to: null, moved: false }; const cell = row.children[g.a]; mv.grab = (() => { const r = bar.getBoundingClientRect(); const i = Math.min(6, Math.max(0, g.a + Math.floor((e.clientX - r.left) / (r.width / (g.b - g.a + 1))))); return wd[i]; })(); mv.to = mv.grab; });
        bar.addEventListener('click', (e) => { e.stopPropagation(); if (!mvJustMoved) itemModal(x); });
        row.append(bar);
      });
      weeks.push(row);
    }
    // 끌어서 범위 고르기 → 손 떼면 등록 창
    const allCells = () => [...grid.querySelectorAll('.ct-day')];
    function paintSel() { const [a, b] = sel ? [sel.a, sel.b].sort() : ['', '']; allCells().forEach((c) => c.classList.toggle('pick', !!sel && c.dataset.d >= a && c.dataset.d <= b)); }
    // 막대 옮기기
    let mv = null, mvJustMoved = false;
    function paintMove() { if (!mv) return; const delta = dayDiff(mv.to, mv.grab), a = addDays(mv.x.starts_on, delta), b = addDays(mv.x.ends_on, delta); if (delta) mv.moved = true; allCells().forEach((c) => c.classList.toggle('pick', mv.moved && c.dataset.d >= a && c.dataset.d <= b)); }
    const up = async () => {
      grid.classList.remove('dragging');
      if (sel) { const [a, b] = [sel.a, sel.b].sort(); sel = null; paintSel(); itemModal({ starts_on: a, ends_on: b }); return; }
      if (mv) {
        const m = mv; mv = null; allCells().forEach((c) => c.classList.remove('pick'));
        const delta = m.to ? dayDiff(m.to, m.grab) : 0;
        if (!m.moved || !delta) return;
        mvJustMoved = true; setTimeout(() => { mvJustMoved = false; }, 0);
        const patch = { starts_on: addDays(m.x.starts_on, delta), ends_on: addDays(m.x.ends_on, delta) };
        const { error } = await sb.from('content_items').update(patch).eq('id', m.x.id);
        if (error) { toast('저장 실패: ' + error.message); return; }
        toast(`${m.x.title} → ${md(patch.starts_on)}${patch.ends_on !== patch.starts_on ? ' ~ ' + md(patch.ends_on) : ''}`); draw();
      }
    };
    document.removeEventListener('pointerup', S.ctUp || (() => {})); S.ctUp = up; document.addEventListener('pointerup', up);
    // 막대를 4px 넘게 움직이면 그때부터 끌기 (그냥 누르면 수정 창)
    const moveStart = (e) => { if (mv && !grid.classList.contains('dragging') && Math.hypot(e.clientX - mv.x0, e.clientY - mv.y0) > 4) grid.classList.add('dragging'); };
    document.removeEventListener('pointermove', S.ctMove || (() => {})); S.ctMove = moveStart; document.addEventListener('pointermove', moveStart);
    const grid = el('div', { className: 'ct-grid' }, [el('div', { className: 'ct-dows' }, DOW.map((w) => el('div', { className: 'cal-dow', text: w }))), ...weeks]);
    function dayList(d) {
      const list = items.filter((x) => x.starts_on <= d && x.ends_on >= d);
      const P = popup(`${md(d)} 콘텐츠 ${list.length}개`, list.map((x) => { const b = el('button', { type: 'button', className: 'ct-bar list', onclick: () => { P.close(); itemModal(x); } }, [el('span', { className: 'st', text: x.status }), el('span', { className: 'tt', text: x.title })]); b.style.setProperty('--c', CH_C[x.channel] || '#71717A'); return b; }));
    }
    // 오른쪽: 이번 달 상태별
    const mine = inMonth.filter((x) => !S.cch || x.channel === S.cch);
    const side = el('div', { className: 'cal-side' }, [
      el('div', { className: 'card cs-card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: `${+S.month.slice(5)}월 콘텐츠` }), el('span', { className: 'n', text: mine.length })]),
        el('div', { className: 'ct-stat' }, CST.map((st) => el('div', {}, [el('b', { text: mine.filter((x) => x.status === st).length }), el('small', { text: st })]))),
        el('div', { className: 'cs-list' }, mine.filter((x) => x.status !== '업로드 완료').sort((a, b) => a.ends_on.localeCompare(b.ends_on)).slice(0, 12).map((x) => el('button', { type: 'button', className: 'cs-line', onclick: () => itemModal(x) }, [el('b', { text: x.title }), el('small', { className: x.ends_on < today ? 'late' : '', text: `${x.channel || '—'} · ${x.status} · ${x.ends_on < today ? '마감 지남 ' : ''}~${md(x.ends_on)}` }), el('span', { className: 'go', text: '›' })])))]),
      el('button', { className: 'btn primary', type: 'button', text: '+ 콘텐츠 추가', onclick: () => itemModal({ starts_on: today, ends_on: today }) }),
    ]);
    return [el('div', { className: 'cal-tools' }, [chSeg, el('span', { className: 'sp' }), el('span', { className: 'ct-hint', text: '날짜를 끌어서 등록 · 막대를 끌어서 옮기기' })]), el('div', { className: 'cal-wrap' }, [el('div', { className: 'card' }, grid), side])];
  }
  // 콘텐츠 등록·수정 창
  function itemModal(x) {
    const isNew = !x.id;
    const f = (tag, props, kids) => el(tag, { className: 'fi', ...props }, kids || []);
    const F = { title: f('input', { value: x.title || '', placeholder: '예: 체험단 브이로그 2편 · 릴스 3개' }), s: f('input', { type: 'date', value: x.starts_on }), e: f('input', { type: 'date', value: x.ends_on || x.starts_on }),
      owner: f('select', {}, [el('option', { value: '', text: '담당 없음' }), ...Object.entries(admins).map(([id, n]) => el('option', { value: id, text: n, selected: id === (isNew ? me : x.owner) }))]),
      link: f('input', { value: x.link || '', placeholder: '기획안·드라이브·업로드 링크' }), memo: f('textarea', { rows: 3, value: x.memo || '', placeholder: '메모 (컨셉·촬영 장소·필요한 것)' }) };
    let ch = x.channel || '', st = x.status || '기획';
    const chips = (list, get, set, colors) => { const box = el('div', { className: 'fs-btns' }); const paint = () => box.replaceChildren(...list.map((v) => { const b = el('button', { type: 'button', className: 'chip' + (get() === v ? ' on' : ''), text: v, onclick: () => { set(v); paint(); } }); if (colors) b.style.setProperty('--c', colors[v]); return b; })); paint(); return box; };
    F.s.oninput = () => { if (!F.e.value || F.e.value < F.s.value) F.e.value = F.s.value; };
    const L = (t, c) => el('label', {}, [el('span', { className: 'lbl', text: t }), c]);
    const err = el('div', { className: 'err' });
    const save = async () => {
      const title = F.title.value.trim(); if (!title) { err.textContent = '제목을 입력하세요'; return; }
      if (!F.s.value) { err.textContent = '시작일을 고르세요'; return; }
      const row = { title, channel: ch || null, status: st, starts_on: F.s.value, ends_on: F.e.value && F.e.value >= F.s.value ? F.e.value : F.s.value, owner: F.owner.value || null, owner_name: F.owner.value ? admins[F.owner.value] : null, link: F.link.value.trim() || null, memo: F.memo.value.trim() || null };
      const q = isNew ? sb.from('content_items').insert(row) : sb.from('content_items').update(row).eq('id', x.id);
      const { error } = await q; if (error) { err.textContent = '저장 실패: ' + error.message; return; }
      P.close(); toast(isNew ? `${title} 등록` : '저장됨'); draw();
    };
    const del = isNew ? null : el('button', { className: 'btn ghost', type: 'button', text: '삭제', onclick: async () => { if (!confirm(`${x.title} 삭제할까요?`)) return; const { error } = await sb.from('content_items').delete().eq('id', x.id); if (error) { toast('삭제 실패: ' + error.message); return; } P.close(); toast('삭제됨'); draw(); } });
    const P = popup(isNew ? '콘텐츠 추가' : '콘텐츠 수정', [
      L('제목', F.title),
      el('div', {}, [el('span', { className: 'lbl', text: '채널' }), chips(CH.map(([k]) => k), () => ch, (v) => { ch = ch === v ? '' : v; }, CH_C)]),
      el('div', {}, [el('span', { className: 'lbl', text: '진행 상태' }), chips(CST, () => st, (v) => { st = v; })]),
      el('div', { className: 'ct-form' }, [L('시작', F.s), L('끝', F.e), L('담당', F.owner)]),
      L('링크', F.link), L('메모', F.memo), err,
    ], [del, el('span', { className: 'sp' }), el('button', { className: 'btn primary', type: 'button', text: isNew ? '등록' : '저장', onclick: save })].filter(Boolean));
    P.layer.firstChild.classList.add('ct-pm');
    F.title.focus();
    F.title.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
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
    if (S.cstep === undefined) S.cstep = '';
    const shown = S.cstep ? ev.filter((e) => e.step === S.cstep) : ev;
    const byDay = {}; shown.forEach((e) => { ((byDay[e.due] = byDay[e.due] || {})[e.step] = byDay[e.due][e.step] || []).push(e); });
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
      const cell = el('div', { className: 'cal-day' + (monthOf(d) !== S.month ? ' out' : '') + (d === today ? ' today' : ''), onclick: () => Object.keys(m).length && dayPopup(d) }, [
        el('div', { className: 'dn' }, el('b', { text: String(+d.slice(8)) })),
        ...STEPS.filter((s) => m[s]).map((s) => stepBtn(d, s, m[s])),
      ]);
      dropZone(cell, d, (g) => { if (g.kind !== 'camp') return; g.close?.(); dropCamp(g.e, d, cfg); });
      return cell;
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
        const handle = el('span', { className: 'cp-drag', text: '⠿', title: '끌어서 달력의 다른 날짜에 놓기', draggable: true });
        handle.addEventListener('dragstart', (x) => startDrag(x, { kind: 'camp', e, label: e.co.name, close: P.close }, P.layer));
        handle.addEventListener('dragend', () => { if (P.layer.isConnected) endDrag(P.layer); });
        const kids = [el('div', { className: 'cp-lead' }, [handle, ck]), el('div', { className: 'cp-nm' }, [el('b', { text: e.co.name }), el('small', { className: st === 'late' ? 'late' : '', text: [e.done ? '완료' : st === 'late' ? `${dayDiff(today, e.due)}일 지남` : '대기', e.co.manager_owner_name || e.co.sales_owner_name || ''].filter(Boolean).join(' · ') })])];
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
          isClose ? el('button', { className: 'btn sm', type: 'button', text: '🔍 링크 확인', title: '블로거 글 링크 자동 취합 → 마감 인원 반영', onclick: () => { P.close(); campLib().then(() => window.CRM_CAMP.closeCheck({ co: e.co, cycle: e.cycle, cfg, step: e.step, onCount: async (n, t) => { if (await saveClose(e, n, t, cfg)) { toast(n >= t ? `${e.co.name} 마감 완료 (${n}/${t})` : `${e.co.name} ${t - n}명 부족 → 2차 마감 생성`); draw(); } } })); } }) : null,
          e.step === '발표' ? el('button', { className: 'btn sm brand', type: 'button', text: '명단 변환 ›', title: '명단 · 점주 안내 · 일정 이미지 · 가이드', onclick: () => { P.close(); openCamp({ co: e.co, cycle: e.cycle, cfg }); } }) : null,
          el('button', { className: 'btn sm ghost', type: 'button', text: '날짜', title: '이 일정만 날짜 옮기기', onclick: (x) => {
            const inp = el('input', { className: 'fi', type: 'date', value: e.due });
            inp.onchange = async () => { if (!inp.value) return; P.close(); await dropCamp(e, inp.value, cfg); };
            x.target.replaceWith(inp); inp.focus(); inp.showPicker?.();
          } }),
          e.step === '모집' ? el('button', { className: 'btn sm ghost', type: 'button', text: '모집일', title: '매월 모집일 바꾸기 (다음 달부터 계속 적용)', onclick: () => { P.close(); editDays(e.co); } }) : null,
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
            const ds = parseDays(inp.value);
            if (!ds.length) { toast('1~31 사이 날짜를 넣어주세요'); return; }
            save.disabled = true; await saveDays(c, ds); save.disabled = false; } });
          return el('div', { className: 'cs-row' }, [el('span'), el('div', { className: 'nm', text: c.name }), el('div', { className: 'acts' }, [inp, save])]); })]) : null,
      settingsCard(cfg),
    ].filter(Boolean));
    // 단계 선택: 누르면 그 단계만 달력·아래 목록에 (다시 누르거나 [전체]로 해제)
    const inMonth = ev.filter((e) => monthOf(e.due) === S.month);
    const stepSeg = el('div', { className: 'cal-seg cg-seg' }, [['', '전체', '#1E10C7'], ...STEPS.map((x) => [x, x, STEP_COLOR[x]])].map(([k, t, c]) => {
      const n = (k ? inMonth.filter((e) => e.step === k) : inMonth).length;
      const b = el('button', { type: 'button', className: S.cstep === k ? 'on' : '', onclick: () => { S.cstep = S.cstep === k ? '' : k; draw(); } }, [el('i'), t, el('span', { className: 'n', text: n })]);
      b.style.setProperty('--c', c); return b; }));
    const listRows = (S.cstep ? inMonth.filter((e) => e.step === S.cstep) : inMonth).sort((a, b) => a.due.localeCompare(b.due) || STEPS.indexOf(a.step) - STEPS.indexOf(b.step) || a.co.name.localeCompare(b.co.name));
    const stTxt = (e) => { const st = evState(e, today, cfg.start); return e.done ? ['완료', 'ok'] : st === 'late' ? [`${dayDiff(today, e.due)}일 지남`, 'err'] : e.due === today ? ['오늘', 'today'] : ['예정', 'sub']; };
    const list = el('div', { className: 'card' }, [
      el('div', { className: 'cs-h' }, [el('h3', { text: `${+S.month.slice(5)}월 ${S.cstep || '체험단 일정'} ${listRows.length}건` }), el('span', { className: 'n', text: `완료 ${listRows.filter((e) => e.done).length}` })]),
      listRows.length ? el('div', { className: 'tbl-wrap cg-wrap' }, el('table', { className: 'tbl cg-tbl' }, [
        el('thead', {}, el('tr', {}, ['날짜', '단계', '업체', '상태', '담당', ''].map((h) => el('th', { text: h })))),
        el('tbody', {}, listRows.slice(0, 400).map((e) => { const [t, cls] = stTxt(e); const pill = el('span', { className: 'pill', text: e.step }); pill.style.setProperty('--c', STEP_COLOR[e.step]);
          return el('tr', { className: 'click', onclick: () => dayPopup(e.due, e.step) }, [el('td', { className: 'sub', text: mdw(e.due) }), el('td', {}, pill), el('td', {}, el('b', { text: e.co.name })), el('td', { className: cls, text: t }), el('td', { className: 'sub', text: e.co.manager_owner_name || e.co.sales_owner_name || '미배정' }), el('td', {}, el('button', { className: 'btn sm ghost', type: 'button', text: '열기' }))]); })),
      ])) : el('div', { className: 'cs-empty cs-char' }, [el('img', { src: '/assets/brand/muyi-char-idea.webp', alt: '' }), '이 달에 해당하는 일정이 없습니다.']),
    ]);
    const annEv = ev.filter((e) => e.step === '발표' && monthOf(e.due) === S.month);
    const tools = el('div', { className: 'cal-tools' }, [stepSeg, el('span', { className: 'sp' }), el('button', { className: 'btn primary', type: 'button', text: `명단 변환${annEv.length ? ` (${annEv.length})` : ''}`, onclick: () => pickCamp(annEv, cfg) })]);
    return [tools, el('div', { className: 'cal-wrap' }, [el('div', { className: 'stack' }, [el('div', { className: 'card' }, grid), list]), side])];
  }
  const campLib = () => loadScript('/assets/crm-camp.js?v=4');
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
  // 계약 그룹: 진행 중 · 재계약 지남 · 홀딩 · 종료(계약종료·환불·양도) · 정보 없음(재계약일·결제일 비어 있음)
  const CGROUPS = [['all', '전체', '#1E10C7'], ['run', '진행 중', '#16A34A'], ['past', '재계약 지남', '#E11D48'], ['hold', '홀딩', '#D97706'], ['end', '종료', '#71717A'], ['none', '정보 없음', '#7C3AED']];
  const groupOf = (c, today) => {
    const g = ['all'];
    if (c.run_status === '진행 중') g.push(c.next_renew_due && c.next_renew_due < today ? 'past' : 'run');
    else if (c.run_status === '홀딩') g.push('hold');
    else g.push('end');
    if (!c.next_renew_due || !c.last_paid_at) g.push('none');
    return g;
  };
  async function contractView() {
    const days = gridDays(); const today = todayKst();
    if (!S.cc || Date.now() - S.cc.at > 60000) S.cc = { at: Date.now(), p: Promise.all([execAlerts(), sb.from('companies').select('id,name,run_status,service_type,next_renew_due,last_paid_at,total_paid_won,sales_owner,manager_owner,sales_owner_name,manager_owner_name').eq('stage', '결제').limit(3000)]) };
    const [A, all] = await S.cc.p.catch((e) => { S.cc = null; throw e; });
    const f = (l) => S.mine ? l.filter((x) => isMine(x.co || x)) : l;
    const cos = f(all.data || []);
    const groups = Object.fromEntries(CGROUPS.map(([k]) => [k, []])); cos.forEach((c) => groupOf(c, today).forEach((g) => groups[g].push(c)));
    if (!S.cgroup) S.cgroup = 'all';
    const cur = groups[S.cgroup];
    const seg = el('div', { className: 'cal-seg cg-seg' }, CGROUPS.map(([k, t, c]) => { const b = el('button', { type: 'button', className: S.cgroup === k ? 'on' : '', onclick: () => { S.cgroup = k; draw(); } }, [el('i'), t, el('span', { className: 'n', text: groups[k].length })]); b.style.setProperty('--c', c); return b; }));
    const byDay = {}; cur.filter((c) => c.next_renew_due && c.next_renew_due >= days[0] && c.next_renew_due <= days[41]).forEach((c) => { (byDay[c.next_renew_due] = byDay[c.next_renew_due] || []).push(c); });
    // 칩: 진행 중은 D-day 색, 홀딩·종료(계약종료·환불·양도)는 상태로 표시 (전체 탭에서 한눈에)
    const chip = (c) => { const dd = dayDiff(c.next_renew_due, today); const st = c.run_status === '진행 중' ? null : c.run_status;
      const tag = st ? (st === '홀딩' ? '홀딩' : st === '환불' ? '환불' : '종료') : dd < 0 ? '지남' : 'D-' + dd;
      const cls = st ? (st === '홀딩' ? ' hold' : ' end') : dd <= 7 ? ' hot' : dd > 30 ? ' cold' : '';
      const b = el('button', { type: 'button', draggable: true, className: 'chip-ev rn-chip' + cls, title: `${c.name} · ${st || '진행 중'} · 재계약 ${c.next_renew_due} (${dd < 0 ? -dd + '일 지남' : 'D-' + dd}) — 누르면 업체 열기 · 끌어서 다른 날짜로 옮기기`, onclick: (e) => { e.stopPropagation(); openCompanyFromToday(c.id); } }, [el('span', { className: 's', text: tag }), el('span', { className: 'n', text: c.name })]);
      b.addEventListener('dragstart', (x) => { x.stopPropagation(); startDrag(x, { kind: 'renew', c, label: c.name }, b.closest('.pm-layer')); });
      b.addEventListener('dragend', () => endDrag(b.closest('.pm-layer')));
      return b; };
    // 재계약일 옮기기 (끌어다 놓기)
    const dropRenew = async (c, d) => {
      if (d === c.next_renew_due) return;
      if (!confirm(`${c.name} 재계약일\n${c.next_renew_due} → ${d}\n\n바꿀까요?`)) return;
      const { error } = await sb.from('companies').update({ next_renew_due: d }).eq('id', c.id);
      if (error) { toast('저장 실패: ' + error.message); return; }
      document.querySelector('.pm-layer')?.remove();
      toast(`${c.name} 재계약일 → ${md(d)}`); S.cc = null; await draw(); flash([d]);
    };
    const pri = (c) => ({ '진행 중': 0, 홀딩: 1 })[c.run_status] ?? 2;
    const cells = days.map((d) => { const list = (byDay[d] || []).sort((a, b) => pri(a) - pri(b) || a.name.localeCompare(b.name));
      const cell = el('div', { className: 'cal-day' + (monthOf(d) !== S.month ? ' out' : '') + (d === today ? ' today' : '') }, [el('div', { className: 'dn' }, el('b', { text: String(+d.slice(8)) })), ...list.slice(0, 4).map(chip), list.length > 4 ? el('button', { type: 'button', className: 'cal-more', text: `+${list.length - 4}곳 더`, onclick: (e) => { e.stopPropagation(); popup(`${+d.slice(5, 7)}월 ${+d.slice(8)}일 재계약 ${list.length}곳`, list.map(chip)); } }) : null].filter(Boolean));
      dropZone(cell, d, (g) => g.kind === 'renew' && dropRenew(g.c, d));
      return cell; });
    const grid = el('div', { className: 'cal-grid' }, [...DOW.map((w) => el('div', { className: 'cal-dow', text: w })), ...cells]);
    // 그룹 목록 (정렬 · 빠진 정보 표시)
    const SORT = { renew: ['재계약일순', (a, b) => String(a.next_renew_due || '9999').localeCompare(String(b.next_renew_due || '9999'))], paid: ['최근 결제순', (a, b) => String(b.last_paid_at || '').localeCompare(String(a.last_paid_at || ''))], name: ['이름순', (a, b) => a.name.localeCompare(b.name)] };
    if (!S.csort) S.csort = 'renew';
    const sortSel = el('select', { className: 'fi', onchange: (e) => { S.csort = e.target.value; draw(); } }, Object.entries(SORT).map(([k, [t]]) => el('option', { value: k, text: t, selected: S.csort === k })));
    const miss = (c) => [!c.next_renew_due && '재계약일 없음', !c.last_paid_at && '결제일 없음', !(c.manager_owner_name || c.sales_owner_name) && '담당 없음'].filter(Boolean);
    const rows = cur.slice().sort(SORT[S.csort][1]);
    const RUNC = { '진행 중': '#16A34A', 홀딩: '#D97706', 계약종료: '#A1A1AA', 환불: '#DC2626', 양도: '#71717A' };
    const tbl = el('div', { className: 'card' }, [
      el('div', { className: 'cs-h' }, [el('h3', { text: `${CGROUPS.find(([k]) => k === S.cgroup)[1]} ${rows.length}곳` }), sortSel]),
      rows.length ? el('div', { className: 'tbl-wrap cg-wrap' }, el('table', { className: 'tbl cg-tbl' }, [
        el('thead', {}, el('tr', {}, ['업체', '상태', '구분', '담당', '최근 결제', '재계약', '확인할 것', ''].map((h) => el('th', { text: h })))),
        el('tbody', {}, rows.slice(0, 300).map((c) => { const dd = c.next_renew_due ? dayDiff(c.next_renew_due, today) : null; const m = miss(c); const st = el('span', { className: 'pill', text: c.run_status || '—' }); st.style.setProperty('--c', RUNC[c.run_status] || '#71717A');
          return el('tr', { className: 'click', onclick: () => openCompanyFromToday(c.id) }, [el('td', {}, el('b', { text: c.name })), el('td', {}, st), el('td', { className: 'sub', text: c.service_type || '—' }), el('td', { className: 'sub', text: c.manager_owner_name || c.sales_owner_name || '미배정' }),
            el('td', { className: 'sub', text: c.last_paid_at || '—' }), el('td', { className: dd != null && dd < 0 ? 'err' : 'sub', text: c.next_renew_due ? `${c.next_renew_due}${dd < 0 ? ` (${-dd}일 지남)` : dd <= 30 ? ` (D-${dd})` : ''}` : '—' }),
            el('td', {}, m.length ? el('span', { className: 'cg-miss', text: m.join(' · ') }) : el('span', { className: 'sub', text: '—' })), el('td', {}, el('button', { className: 'btn sm ghost', type: 'button', text: '열기' }))]); })),
      ])) : el('div', { className: 'cs-empty cs-char' }, [el('img', { src: '/assets/brand/muyi-char-idea.webp', alt: '' }), '이 그룹에 해당하는 업체가 없습니다.']),
    ]);
    const soon = cos.filter((c) => c.run_status === '진행 중' && c.next_renew_due && dayDiff(c.next_renew_due, today) <= 30 && dayDiff(c.next_renew_due, today) >= -30).sort((a, b) => a.next_renew_due.localeCompare(b.next_renew_due));
    // 옆 카드: 업체당 한 줄(항목 묶음), 줄 전체 클릭 → 업체, 5줄 넘으면 [더 보기]
    const sec = (key, title, items, emptyT) => {
      const open = S.secOpen?.[key]; const n = items.length;
      const more = n > 5 ? el('button', { className: 'cs-more', type: 'button', text: open ? '접기' : `${n - 5}곳 더 보기`, onclick: () => { S.secOpen = { ...S.secOpen, [key]: !open }; paintSide(); } }) : null;
      return el('div', { className: 'card cs-card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: title }), el('span', { className: 'n', text: n })]),
        ...(n ? [el('div', { className: 'cs-list' + (open ? ' open' : '') }, (open ? items : items.slice(0, 5)).map(([c, sub, cls]) => el('button', { type: 'button', className: 'cs-line', onclick: () => openCompanyFromToday(c.id) }, [el('b', { text: c.name }), el('small', { className: cls || '', text: sub }), el('span', { className: 'go', text: '›' })]))), more] : [el('div', { className: 'cs-empty', text: emptyT })]).filter(Boolean)]);
    };
    const byCo = (list, fmt) => { const m = new Map(); list.forEach((x) => { const k = x.co.id; if (!m.has(k)) m.set(k, { co: x.co, xs: [] }); m.get(k).xs.push(x); }); return [...m.values()].map(({ co, xs }) => [co, fmt(xs)]); };
    const low = f(A.low), empty = f(A.empty), stale = f(A.stale);
    const side = el('div', { className: 'cal-side' });
    const paintSide = () => side.replaceChildren(
      sec('soon', '재계약 임박 (±30일)', soon.map((c) => { const dd = dayDiff(c.next_renew_due, today); return [c, `${md(c.next_renew_due)} · ${dd < 0 ? -dd + '일 지남' : 'D-' + dd} · ${c.manager_owner_name || c.sales_owner_name || '미배정'}`, dd <= 7 ? 'late' : '']; }), '30일 안에 재계약할 업체가 없습니다.'),
      sec('low', '실행 소진 임박 (남은 20% 이하)', byCo(low, (xs) => xs.map((x) => `${x.d.item} ${Number(x.left).toLocaleString()}/${Number(x.d.planned).toLocaleString()} 남음`).join(' · ')), '없습니다.'),
      sec('empty', '실행 소진 완료 → 재계약 제안', byCo(empty, (xs) => `${xs.map((x) => x.d.item).join(' · ')} 완료`).map((r) => [...r, 'late']), '없습니다.'),
      sec('stale', '실행 수량 입력 필요 (14일)', stale.map((x) => [x.co, `마지막 수정 ${kstDay(x.t)}`]), '모든 업체 수량이 최신입니다.'),
    );
    paintSide();
    return [el('div', { className: 'cal-tools' }, [seg]), el('div', { className: 'cal-wrap' }, [el('div', { className: 'stack' }, [el('div', { className: 'card' }, grid), tbl]), side])];
  }

  // 오늘 할 일용: 오늘 + 지난 미완료 체험단 일정
  async function todayCamp() {
    const today = todayKst(); const cfg = await loadCfg();
    const { ev } = await campEvents(cfg.start < addDays(today, -60) ? addDays(today, -60) : cfg.start, today);
    return { ev: ev.filter((e) => !e.done), toggle };
  }

  window.CRM_CALENDAR = { mount, todayCamp, execAlerts };
})();
