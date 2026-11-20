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
.cal-day.today{box-shadow:inset 0 0 0 2px var(--accent)}
.cal-day.today .dn b{color:var(--accent);font-weight:900}
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
.ct-day.today{box-shadow:inset 0 0 0 2px var(--accent)}
.ct-day.today .dn b{color:var(--accent);font-weight:900}
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
.cal-grid.camp .cal-day{cursor:default;gap:2px}
.cc{display:flex;align-items:center;min-width:0;height:21px;border-radius:5px;background:color-mix(in srgb,var(--c) 13%,var(--surface));box-shadow:inset 3px 0 0 var(--c);cursor:grab;flex:none}
.cc.dragging{opacity:.4}
.cc-n{flex:1;min-width:0;height:100%;padding:0 4px 0 7px;border:0;background:none;text-align:left;font-size:11.5px;font-weight:600;color:color-mix(in srgb,var(--c) 75%,var(--t1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.cc-x{flex:none;height:17px;min-width:17px;margin-right:2px;padding:0 3px;border:0;border-radius:4px;background:color-mix(in srgb,var(--c) 18%,var(--surface));font-size:10px;font-weight:800;color:color-mix(in srgb,var(--c) 80%,var(--t1));cursor:pointer;line-height:17px}
.cc-x:hover{background:var(--c);color:#fff}
@media (hover:hover){.cc-x{display:none}.cc:hover .cc-x{display:block}.cc:hover .cc-n{padding-right:2px}}
.cc.done{--c:var(--green);background:color-mix(in srgb,var(--green) 22%,var(--surface))}
.cc.done .cc-n::before{content:'✓ ';font-weight:800}
.cc.late .cc-n{text-decoration:underline wavy color-mix(in srgb,var(--red) 60%,transparent);text-underline-offset:3px}
.cc-more{border:0;background:none;padding:0 4px;text-align:left;font-size:11px;font-weight:700;color:var(--t3);cursor:pointer}
.cc-more:hover{color:var(--accent)}
.cal-grid.camp:not(.expand) .cal-day{max-height:118px;overflow:hidden}
.cal-grid.camp:not(.expand) .cal-day .cc:nth-of-type(n+6){display:none}
.cal-grid.camp.expand .cc-more{display:none}
.cs-pend{display:grid;grid-template-columns:auto minmax(0,1fr) 128px;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line-2);cursor:grab}
.cs-pend:last-child{border-bottom:0}
.cs-pend .nm{font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-pend small{display:block;font-size:11px;color:var(--t3);font-weight:500}
.cs-pend input{height:28px;font-size:12px}
.cs-hint{padding:8px 14px 0;font-size:11.5px}
.cg-tbl .btn.ok{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,var(--line))}
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
/* 업체명 칩: 색 없이 (2026-11-19) · 칸 표시: 빈 곳 클릭 = 분류 색 배경, 두 번 클릭 = 메모 */
.cc{--c:var(--t3);background:var(--surface);box-shadow:none;border:1px solid var(--line)}
.cc-n{color:var(--t1)}
.cc:hover{border-color:var(--accent)}
.cc.pend{border-style:dashed}
.rn-chip,.rn-chip.hot,.rn-chip.cold,.rn-chip.hold,.rn-chip.end{--c:var(--t3)}
.mk{cursor:cell}
.mk.mk-on,.cal-day.mk.mk-on:hover{background:color-mix(in srgb,var(--mk) 34%,var(--surface));box-shadow:inset 3px 0 0 var(--mk)}
.mk.mk-on .dn b{color:color-mix(in srgb,var(--mk) 70%,#000);font-weight:900}
.cal-day.today.mk-on,.ct-day.today.mk-on{box-shadow:inset 0 0 0 2px var(--accent),inset 5px 0 0 var(--mk)}
.mk-notes{display:flex;flex-direction:column;gap:2px;margin-top:auto;min-width:0}
.mk-note{height:20px;padding:0 6px;border:1px dashed var(--line-strong);border-radius:5px;background:var(--surface);font-size:11px;font-weight:600;color:var(--t1);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;flex:none}
.mk-note:hover{border-color:var(--accent)}
.mk-in{height:24px!important;font-size:12px;padding:0 6px!important;min-width:0}
.td-nav{display:inline-flex;align-items:center;gap:4px}
.td-nav b{min-width:110px;text-align:center;font-size:15px}
.td-wrap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:stretch}
.td-col{display:flex;flex-direction:column;min-height:460px;overflow:hidden}
.td-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.td-h i{width:10px;height:10px;border-radius:3px;background:var(--c)}
.td-h h3{font-size:15px;font-weight:800;margin-right:auto}
.td-h .n{font-size:13px;font-weight:700;color:var(--t3)}
.td-body{flex:1;display:flex;flex-direction:column;gap:6px;padding:10px;transition:background .15s}
.td-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--surface);text-align:left;cursor:pointer;font:inherit;flex:none}
.td-item:hover{border-color:var(--accent)}
.td-item b{font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-item small{grid-column:1/-1;font-size:11.5px;color:var(--t3)}
.td-tag{font-size:10.5px;font-weight:800;color:var(--c)}
.td-empty{padding:18px;text-align:center;color:var(--t4);font-size:12px}
.rc-f .sp{flex:1}
.ca-extra{display:flex;gap:6px}
.td-d{font-size:10.5px;font-weight:800;color:var(--t2);background:var(--muted);border-radius:5px;padding:1px 6px;margin-right:4px}
.td-item.off-day{background:color-mix(in srgb,var(--c) 5%,var(--surface))}
.td-span{font-size:12px;font-weight:700;color:var(--t3)}
.od-list{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 12px}
.od-list button{height:26px;padding:0 10px;border:1px solid var(--line);border-radius:13px;background:var(--surface);font-size:12px;cursor:pointer}
.od-list button:hover{border-color:var(--red);color:var(--red)}
.od-add{display:flex;gap:6px;align-items:center;padding:12px 14px;flex-wrap:wrap}
.od-add .fi{width:auto}
.rc-del{color:var(--red)!important}
@media (max-width:900px){.td-wrap{grid-template-columns:minmax(0,1fr)}.td-col{min-height:0}.td-body{min-height:90px}}
@media (max-width:720px){.cal-day{min-height:64px;padding:3px}.chip-ev .n{display:none}.chip-ev{height:16px;padding:0 3px;font-size:9px}.cal-dow{padding:4px;text-align:center}}
`;
    document.head.appendChild(st);
  }

  const S = { box: null, tab: 'camp', month: null, sel: null, mine: false, cfg: null, drag: null };
  // ── 휴무일: 주말 + 법정공휴일(대체공휴일 포함) + [⚙ 설정]의 특별 휴무(샌드위치 등) − 출근일(공휴일인데 일하는 날) ──
  //  [오늘 업무] = 오늘 + 다음 근무일 전까지 쉬는 날 (금요일 → 금·토·일). 공휴일 목록은 해마다 추가
  const KR_HOL = new Set(['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03', '2026-06-06', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
    '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13', '2027-06-06', '2027-08-15', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-03', '2027-10-04', '2027-10-09', '2027-10-11', '2027-12-25', '2027-12-27']);
  async function loadOffdays() {
    if (S.offd) return S.offd;
    const { data } = await sb.from('crm_settings').select('value').eq('key', 'cal_offdays').maybeSingle();
    const v = data?.value && typeof data.value === 'object' ? data.value : {};
    S.offd = { off: Array.isArray(v.off) ? v.off : [], work: Array.isArray(v.work) ? v.work : [] };
    return S.offd;
  }
  const isOff = (d, o) => !o.work.includes(d) && (o.off.includes(d) || KR_HOL.has(d) || [0, 6].includes(parse(d).getDay()));
  const spanDays = (d, o) => { const out = [d]; for (let x = addDays(d, 1); isOff(x, o) && out.length < 12; x = addDays(x, 1)) out.push(x); return out; };
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
    const ev = [], pending = [], gen = new Set();
    S.coAll = co.data || [];
    let m = addMonth(monthOf(addDays(from, -maxOff)), 0);
    const last = monthOf(to);
    for (; m <= last; m = addMonth(m, 1)) {
      const [y, mo] = m.split('-').map(Number), dim = new Date(y, mo, 0).getDate();
      for (const c of camp) for (const d of new Set(c.recruit_days.map((x) => Math.min(Number(x) || 1, dim)))) {
        const cycle = `${m}-${pad(d)}`; gen.add(`${c.id}|${cycle}`);
        if (tasks.get(`${c.id}|${cycle}|모집`)?.skipped) continue; // 이번 회차만 삭제한 모집
        // 모집은 혼자 움직임(모집 기간이 업체마다 다름). 발표는 날짜를 정해야 생김(그 전엔 '발표일 미정').
        // 마감 = 발표 + (마감 간격 − 발표 간격, 기본 14일). 추적 시작일 이전 회차는 예전처럼 간격으로 계산.
        const tM = tasks.get(`${c.id}|${cycle}|모집`), tA = tasks.get(`${c.id}|${cycle}|발표`), tD = tasks.get(`${c.id}|${cycle}|마감`);
        const legacy = cycle < cfg.start || (tA && !tA.due_on);
        const ann = tA?.due_on || (legacy ? addDays(cycle, cfg.off.발표 || 0) : null);
        const dl = tD?.due_on || (ann ? addDays(ann, (cfg.off.마감 || 0) - (cfg.off.발표 || 0)) : null);
        const push = (step, due, t) => { if (due && due >= from && due <= to) ev.push({ co: c, cycle, step, due, task: t, done: !!t?.done_at, ann, dl }); };
        push('모집', tM?.due_on || cycle, tM);
        push('발표', ann, tA); push('마감', dl, tD);
        if (!ann && cycle >= cfg.start && cycle <= to) pending.push({ co: c, cycle, step: '발표', due: null, recruit: tM?.due_on || cycle, task: tA, done: false });
      }
    }
    // 달력에서 두 번 클릭해 직접 추가한 회차 (매월 모집일과 다른 날·모집일 없는 업체): camp_tasks 행만으로 일정
    const adhoc = new Map();
    const skip = new Set((tk.data || []).filter((t) => t.skipped).map((t) => `${t.company_id}|${t.cycle_on}`));
    (tk.data || []).filter((t) => ['모집', '발표', '마감'].includes(t.step) && byId.has(t.company_id) && !gen.has(`${t.company_id}|${t.cycle_on}`) && !skip.has(`${t.company_id}|${t.cycle_on}`))
      .forEach((t) => { const k = `${t.company_id}|${t.cycle_on}`; if (!adhoc.has(k)) adhoc.set(k, {}); adhoc.get(k)[t.step] = t; });
    adhoc.forEach((g, k) => {
      const c = byId.get(k.split('|')[0]), cycle = k.split('|')[1];
      const ann = g.발표?.due_on || null, dl = g.마감?.due_on || (ann ? addDays(ann, (cfg.off.마감 || 0) - (cfg.off.발표 || 0)) : null);
      const push = (step, due, t) => { if (due && due >= from && due <= to) ev.push({ co: c, cycle, step, due, task: t, done: !!t?.done_at, ann, dl, adhoc: true }); };
      if (g.모집) push('모집', g.모집.due_on || cycle, g.모집);
      push('발표', ann, g.발표); push('마감', dl, g.마감);
    });
    // 2차마감: 마감에서 인원이 모자라면 생긴 행
    (tk.data || []).filter((t) => t.step === '2차마감' && byId.has(t.company_id) && t.due_on >= from && t.due_on <= to && !skip.has(`${t.company_id}|${t.cycle_on}`))
      .forEach((t) => ev.push({ co: byId.get(t.company_id), cycle: t.cycle_on, step: '2차마감', due: t.due_on, task: t, done: !!t.done_at }));
    // 2차마감에도 발표·마감 날짜를 붙여둠 (링크 확인·연장 안내용)
    ev.filter((e) => e.step === '2차마감').forEach((e) => { const d = ev.find((x) => x.step === '마감' && x.co.id === e.co.id && x.cycle === e.cycle); if (d) { e.ann = d.ann; e.dl = d.dl; } });
    return { ev, noDays, cfg, pending };
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
  // 날짜 옮기기: 모집·마감·2차마감은 그것만, 발표는 마감도 같은 일수만큼 (마감을 따로 옮겨뒀으면 그 날짜도 같이)
  async function moveStep(e, to) {
    const from = e.due;
    if (from === to) return true;
    const get = async (step) => (await sb.from('camp_tasks').select('*').eq('company_id', e.co.id).eq('cycle_on', e.cycle).eq('step', step).maybeSingle()).data;
    const put = async (step, cur, patch) => {
      const row = { company_id: e.co.id, cycle_on: e.cycle, step, due_on: cur?.due_on || null, done_at: cur?.done_at || null, done_by: cur?.done_by || null, target: cur?.target ?? null, closed: cur?.closed ?? null, ...patch };
      const { error } = await sb.from('camp_tasks').upsert(row, { onConflict: 'company_id,cycle_on,step' });
      if (error) { toast('저장 실패: ' + error.message); return false; } return true;
    };
    if (!(await put(e.step, await get(e.step), { due_on: to }))) return false;
    let dlTxt = '';
    if (e.step === '발표') {
      const d = await get('마감');
      if (d?.due_on && from) { const nd = addDays(d.due_on, dayDiff(to, from)); if (!(await put('마감', d, { due_on: nd }))) return false; dlTxt = ` · 마감 ${md(nd)}`; }
      else { const cfg = await loadCfg(); dlTxt = ` · 마감 ${md(addDays(to, (cfg.off.마감 || 0) - (cfg.off.발표 || 0)))}`; }
    }
    toast(`${e.co.name} ${e.step} → ${md(to)}${dlTxt}`);
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
        dot(STEP_COLOR.모집, `모집 — 매월 모집일 (업체마다 설정). 모집은 혼자 움직이고 발표·마감에 영향 없음`),
        dot(STEP_COLOR.발표, `발표 — 모집 달력에서 업체명을 눌러 발표일을 정하면 생김 · 선정·가이드라인·일정 안내`),
        dot(STEP_COLOR.마감, `마감 — 발표 +${(o.마감 || 0) - (o.발표 || 0)}일 ♥ (발표를 옮기면 같이 옮겨짐) · 링크 취합`),
        dot(STEP_COLOR['2차마감'], `2차마감 — 인원 부족이면 마감 +${o['2차마감'] || 0}일 자동 · 연장(+14)은 발표·마감 상세 안의 [+14 연장] 버튼`),
        `체험+리뷰 기간 = 발표 다음날 ~ 마감 전날`,
        `간격은 위 [⚙ 설정]에서 바꾸며, 바꾸면 이 설명도 같이 바뀝니다`,
      ]),
      sec('체험단 쓰는 법', [
        '[오늘 업무] = 그날 할 일을 모집 · 발표 · 마감(2차마감 포함) 3열로. 다음 근무일 전까지 쉬는 날도 같이 (금요일 = 금·토·일, 연휴 전날 = 연휴 끝까지). 특별 휴무·공휴일 출근은 [⚙ 설정] → 휴무일 설정',
        '[모집·발표·마감·2차마감] = 그 단계만 한 달 달력과 아래 목록으로',
        '업체명을 누르면 상세: 모집 = 발표일 정하기·삭제(이번 회차만 / 매월 그 날짜 그만) · 발표/마감 = 명단·점주 안내·가이드·명단 체크리스트·재촉 문자 + 🔍 링크 확인 · +14 연장 · 2차마감 = 리뷰 수정 요청(회차·블로거·사유 → 문구·번호 복사)',
        '칸의 빈 곳을 한 번 누르면 그날 그 업무 완료 표시(단계 색 배경, 팀 전체 공유) · 다시 누르면 해제',
        '칸의 빈 곳을 두 번 누르면 업체명 입력 → 그 단계 일정으로 추가 (모집 = 그날 새 회차, 추가만 · 발표/마감 = 최근 회차의 날짜를 그날로 + 바로 상세)',
        '업체명이 아닌 글자를 적으면 메모로 남음 (예전 메모·업체명 자동 완성) · 메모를 누르면 수정·삭제',
        '날짜 바꾸기: 업체명을 끌어 다른 날짜에 놓기',
        '많은 날은 … +n 으로 줄어듭니다. 오른쪽 위 [⤢ 전체 보기]로 모든 칸을 펼칩니다',
        '리뷰노트 명단: 리뷰노트 체험단 진행(캠페인) 화면에서 북마크 [리뷰노트 → MUYI] → 그 캠페인 명단만 CRM에 저장 (설치: 명단 변환 → 명단 탭 → 리뷰노트 북마크 설치)',
        '모집일 미설정 업체 · 단계 간격은 위 [⚙ 설정]',
      ]),
      sec('무이 콘텐츠 달력 (자체 마케팅 제작)', [
        '칸 빈 곳 두 번 = 그날 콘텐츠 등록 창 · 여러 날을 끌어서 고르면 기간 등록 · 한 번 = 완료 표시',
        '막대를 끌어 다른 날짜에 놓으면 기간 그대로 옮겨지고, 누르면 수정·삭제',
        `채널: ${CH.map(([k]) => k).join(' · ')} — 위 채널 탭을 누르면 그 채널만`,
        `진행 상태: ${CST.join(' → ')} (업로드 완료는 흐리게·취소선)`,
      ]),
      sec('계약 (재계약) 달력', [
        '칩 앞 글자: D-n(재계약까지 남은 날) · 지남 · 홀딩 · 종료/환불(취소선)',
        '칸 빈 곳 한 번 = 완료 표시(그룹 색) · 두 번 = 업체명을 적어 그날을 재계약일로(업체 상세 열림), 그 외 글자는 메모',
        '재계약일은 [결제 등록]·[재계약 등록] 시 결제일 + 기간으로 자동 계산, 업체 상세에서 직접 수정 가능',
        '칩을 끌어 다른 날짜에 놓으면 재계약일 변경',
        '그룹: 전체 · 진행 중 · 재계약 지남 · 홀딩 · 종료 · 정보 없음(재계약일·결제일 비어 있음)',
        '실행 소진: 남은 수량 20% 이하 = 임박, 0 = 완료 → 재계약 제안 · 수량 입력 14일 넘게 안 고치면 알림',
      ]),
    ]).layer.firstChild.classList.add('ci-pm');
  }
  async function dropCamp(e, d) {
    if (d === e.due) return;
    if (await moveStep(e, d)) { await draw(); flash([d]); }
  }

  // 마감 연장 → 마감일 +14일 2차마감 (표기는 2차마감). 리뷰노트가 참여자 전원에게 연장 연락을 보내므로,
  // 이미 글을 올린(해당 없는) 블로거에게 보낼 안내 문자를 바로 연다 (문자는 알리고 연동 후 발송)
  const EXTEND_DAYS = 14;
  async function extendClose(e) {
    const due = addDays(e.due, EXTEND_DAYS);
    if (!confirm(`${e.co.name} 마감 연장\n${md(e.due)} → ${md(due)} 2차마감을 만들까요?`)) return;
    const t = e.task;
    const { error } = await sb.from('camp_tasks').upsert({ company_id: e.co.id, cycle_on: e.cycle, step: '2차마감', due_on: due, target: t?.target ? Math.max(0, t.target - (t.closed || 0)) || null : null }, { onConflict: 'company_id,cycle_on,step' });
    if (error) { toast('연장 실패: ' + error.message); return; }
    toast(`${e.co.name} 연장 → ${md(due)} 2차마감`); await draw(); flash([due]);
    const { data: round } = await sb.from('rounds').select('id').eq('company_id', e.co.id).eq('cycle_on', e.cycle).maybeSingle();
    const { data: ros } = round ? await sb.from('roster').select('nickname,name,phone,post_url,cancelled').eq('round_id', round.id) : { data: [] };
    const done = (ros || []).filter((r) => r.post_url && !r.cancelled && r.phone);
    if (!done.length) { toast(round ? '글을 이미 올린 블로거가 없어 따로 보낼 안내가 없습니다' : '저장된 명단이 없어 안내 대상을 찾지 못했습니다 (명단 변환에서 명단 저장)'); return; }
    await loadScript('/assets/crm-sms.js?v=4');
    window.CRM_SMS.open({ title: `${e.co.name} 연장 안내 · 이미 등록한 블로거 ${done.length}명`, ad: false,
      text: `안녕하세요, 무이(MUYI)입니다.\n${e.co.name} 체험단 리뷰 마감 연장 안내를 받으셨다면, 이미 리뷰를 등록해주셔서 해당되지 않습니다.\n참여해주셔서 감사합니다 :)`,
      load: async () => done.map((r) => ({ company_id: e.co.id, name: r.nickname || r.name, phone: r.phone })) });
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
    const link = window.__openCamp; delete window.__openCamp;
    if (link) { S.tab = 'camp'; S.month = monthOf(link.cycle); }
    draw().then(() => link && openCampLink(link.id, link.cycle));
  }
  // 바깥 링크(#camp-업체_회차, 리뷰노트 북마크 결과)로 그 회차의 명단 변환 열기 — 실제 발표·마감 날짜로
  async function openCampLink(id, cycle) {
    const cfg = await loadCfg();
    const { data: co } = await sb.from('companies').select('id,name,brand,recruit_days,camp_teams,phone,store_phone,rep_name,sales_owner,manager_owner,sales_owner_name,manager_owner_name,service_type').eq('id', id).maybeSingle();
    if (!co) { toast('업체를 찾을 수 없습니다'); return; }
    const { ev } = await campEvents(cycle, addDays(cycle, 90));
    const e = ev.find((x) => x.co.id === id && x.cycle === cycle);
    openCamp({ co, cycle, cfg, announce: e?.ann || undefined, deadline: e?.dl || undefined });
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
    const [{ data, error }, marks] = await Promise.all([sb.from('content_items').select('*').lte('starts_on', days[41]).gte('ends_on', days[0]).order('starts_on').limit(1000), loadMarks('content', days[0], days[41])]);
    if (error) throw error;
    const items = (S.mine ? (data || []).filter((x) => x.owner === me) : data || []).filter((x) => !S.cch || x.channel === S.cch);
    // 채널 필터 (누르면 그 채널만)
    const inMonth = (data || []).filter((x) => x.starts_on <= `${S.month}-31` && x.ends_on >= `${S.month}-01`);
    const chSeg = el('div', { className: 'cal-seg cg-seg' }, [['', 'var(--accent)'], ...CH].map(([k, c]) => { const b = el('button', { type: 'button', className: (S.cch || '') === k ? 'on' : '', onclick: () => { S.cch = (S.cch || '') === k ? '' : k; draw(); } }, [el('i'), k || '전체', el('span', { className: 'n', text: (k ? inMonth.filter((x) => x.channel === k) : inMonth).length })]); b.style.setProperty('--c', c); return b; }));
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
        markCell(c, { cal: 'content', cat: S.cch || '전체', day: d, color: CH_C[S.cch] || 'var(--accent)', marks, onDbl: () => itemModal({ starts_on: d, ends_on: d, channel: S.cch || '' }) });
        c.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('.ct-bar, .cal-more, .mk-note, .mk-in')) return; e.preventDefault(); sel = { a: d, b: d }; grid.classList.add('dragging'); paintSel(); });
        c.addEventListener('pointerenter', () => { if (sel) { sel.b = d; paintSel(); } if (mv) { mv.to = d; paintMove(); } });
        row.append(c);
      });
      segs.filter((g) => g.l < MAXL).forEach((g) => {
        const x = g.x, done = x.status === '업로드 완료';
        const bar = el('button', { type: 'button', className: 'ct-bar' + (done ? ' done' : '') + (x.starts_on < wd[0] ? ' cont-l' : '') + (x.ends_on > wd[6] ? ' cont-r' : ''), title: `${x.title} · ${x.channel || '채널 없음'} · ${x.status}\n${x.starts_on}${x.ends_on !== x.starts_on ? ' ~ ' + x.ends_on : ''}${x.owner_name ? ' · ' + x.owner_name : ''}\n끌어서 옮기기 · 눌러서 수정` },
          [el('span', { className: 'st', text: done ? '✓' : x.status === '기획' ? '' : x.status }), el('span', { className: 'tt', text: x.title })]);
        bar.style.gridColumn = `${g.a + 1} / ${g.b + 2}`; bar.style.gridRow = `${g.l + 2}`; bar.style.setProperty('--c', '#71717A');
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
      // 한 칸만 누름 = 완료 표시/메모(칸 클릭), 여러 날을 끌면 = 등록 창
      if (sel) { const [a, b] = [sel.a, sel.b].sort(); sel = null; paintSel(); if (a !== b) itemModal({ starts_on: a, ends_on: b }); return; }
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
      const P = popup(`${md(d)} 콘텐츠 ${list.length}개`, list.map((x) => { const b = el('button', { type: 'button', className: 'ct-bar list', onclick: () => { P.close(); itemModal(x); } }, [el('span', { className: 'st', text: x.status }), el('span', { className: 'tt', text: x.title })]); b.style.setProperty('--c', '#71717A'); return b; }));
    }
    // 오른쪽: 이번 달 상태별
    const mine = inMonth.filter((x) => !S.cch || x.channel === S.cch);
    const side = el('div', { className: 'cal-side' }, [
      el('div', { className: 'card cs-card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: `${+S.month.slice(5)}월 콘텐츠` }), el('span', { className: 'n', text: mine.length })]),
        el('div', { className: 'ct-stat' }, CST.map((st) => el('div', {}, [el('b', { text: mine.filter((x) => x.status === st).length }), el('small', { text: st })]))),
        el('div', { className: 'cs-list' }, mine.filter((x) => x.status !== '업로드 완료').sort((a, b) => a.ends_on.localeCompare(b.ends_on)).slice(0, 12).map((x) => el('button', { type: 'button', className: 'cs-line', onclick: () => itemModal(x) }, [el('b', { text: x.title }), el('small', { className: x.ends_on < today ? 'late' : '', text: `${x.channel || '—'} · ${x.status} · ${x.ends_on < today ? '마감 지남 ' : ''}~${md(x.ends_on)}` }), el('span', { className: 'go', text: '›' })])))]),
      el('button', { className: 'btn primary', type: 'button', text: '+ 콘텐츠 추가', onclick: () => itemModal({ starts_on: today, ends_on: today }) }),
    ]);
    return [el('div', { className: 'cal-tools' }, [chSeg, el('span', { className: 'sp' }), el('span', { className: 'ct-hint', text: '빈 곳 두 번 = 등록 · 여러 날 끌어서 기간 등록 · 막대 끌어서 옮기기 · 한 번 = 완료 표시' })]), el('div', { className: 'cal-wrap' }, [el('div', { className: 'card' }, grid), side])];
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
  // ── 칸 표시 (세 달력 공통): 빈 곳 한 번 클릭 = 그날 그 분류 업무 완료(분류 색 배경) · 두 번 클릭 = 메모 이벤트 직접 입력 ──
  async function loadMarks(cal, from, to) {
    const { data } = await sb.from('cal_marks').select('*').eq('cal', cal).gte('day', from).lte('day', to).limit(3000);
    return new Map((data || []).map((r) => [`${r.cat}|${r.day}`, r]));
  }
  async function saveMark(cal, cat, day, cur, patch) {
    const row = { cal, cat, day, filled: cur?.filled || false, notes: cur?.notes || [], ...patch, updated_by: me, updated_at: new Date().toISOString() };
    if (!row.filled && !row.notes.length) {
      const { error } = await sb.from('cal_marks').delete().eq('cal', cal).eq('cat', cat).eq('day', day);
      if (error) { toast('저장 실패: ' + error.message); return undefined; } return null;
    }
    const { data, error } = await sb.from('cal_marks').upsert(row, { onConflict: 'cal,cat,day' }).select().single();
    if (error) { toast('저장 실패: ' + error.message); return undefined; }
    return data;
  }
  // 자동 완성 후보: 업체명(진행 중 계약 업체) 먼저 + 예전에 적은 메모(많이 쓴 순)
  async function suggestList() {
    if (!S.sugg || Date.now() - S.sugg.at > 120000) {
      const [n, c] = await Promise.all([sb.from('cal_marks').select('notes').limit(3000), sb.from('companies').select('name,run_status').eq('stage', '결제').limit(3000)]);
      const cnt = new Map(); (n.data || []).forEach((r) => (r.notes || []).forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1)));
      const cos = (c.data || []).sort((a, b) => (a.run_status !== '진행 중') - (b.run_status !== '진행 중') || a.name.localeCompare(b.name)).map((r) => r.name);
      S.sugg = { at: Date.now(), list: [...new Set([...cos, ...[...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)])] };
    }
    let dl = document.getElementById('cal-sugg');
    if (!dl) { dl = el('datalist', { id: 'cal-sugg' }); document.body.append(dl); }
    if (dl.childElementCount !== S.sugg.list.length) dl.replaceChildren(...S.sugg.list.slice(0, 3000).map((v) => el('option', { value: v })));
  }
  // add(text): 업체명이면 그 업체 일정으로 등록 + 상세 열기 → true, 아니면 false(메모로 남김) · onDbl: 두 번 클릭을 직접 처리(콘텐츠 등록 창)
  function markCell(cell, { cal, cat, day, color, marks, add, onDbl }) {
    const key = `${cat}|${day}`; let cur = marks.get(key);
    cell.classList.add('mk'); cell.style.setProperty('--mk', color);
    const notes = el('div', { className: 'mk-notes' });
    const paint = () => {
      cell.classList.toggle('mk-on', !!cur?.filled);
      const dbl = onDbl ? '두 번 클릭 = 등록' : add ? '두 번 클릭 = 일정 추가(업체명) · 메모' : '두 번 클릭 = 메모';
      cell.title = cur?.filled ? `완료 표시됨 · 빈 곳 클릭 = 해제 · ${dbl}` : `빈 곳 클릭 = 완료 표시 · ${dbl}`;
      notes.replaceChildren(...(cur?.notes || []).map((t, i) => el('button', { type: 'button', className: 'mk-note', text: t, title: '직접 적은 메모 — 누르면 수정·삭제', onclick: (x) => { x.stopPropagation(); editNote(i); } })));
    };
    const put = async (patch) => { const r = await saveMark(cal, cat, day, cur, patch); if (r === undefined) return; cur = r || null; if (r) marks.set(key, r); else marks.delete(key); paint(); };
    const editNote = (i) => { const v = prompt('메모 수정 (비우면 삭제)', cur.notes[i]); if (v === null) return; const n = [...cur.notes]; if (v.trim()) n[i] = v.trim(); else n.splice(i, 1); put({ notes: n }); };
    const input = () => {
      if (notes.querySelector('.mk-in')) return;
      const inp = el('input', { className: 'fi mk-in', placeholder: add ? '업체명 (그 외 글자는 메모)' : '메모', autocomplete: 'off' }); inp.setAttribute('list', 'cal-sugg');
      suggestList();
      let fin = false;
      const done = async (ok) => {
        if (fin) return; fin = true; const v = inp.value.trim(); inp.remove();
        if (!ok || !v) return;
        if (add && await add(v)) return;
        put({ notes: [...(cur?.notes || []), v] }); if (S.sugg && !S.sugg.list.includes(v)) S.sugg.list.push(v);
      };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
      ['click', 'dblclick', 'pointerdown'].forEach((t) => inp.addEventListener(t, (e) => e.stopPropagation()));
      notes.append(inp); inp.focus();
    };
    let t = null;
    const empty = (x) => !x.target.closest('button, a, input, select, .cc');
    cell.addEventListener('click', (x) => { if (!empty(x)) return; clearTimeout(t); t = setTimeout(() => put({ filled: !cur?.filled }), 240); });
    cell.addEventListener('dblclick', (x) => { if (!empty(x)) return; clearTimeout(t); if (onDbl) onDbl(); else input(); });
    cell.append(notes); paint();
  }

  // 두 번 클릭 → 업체명 입력 → 그 단계 일정으로 등록하고 바로 상세
  //  모집: 그날 새 회차(모집일 = 그날) · 발표/마감/2차마감: 그날 이전 가장 최근 회차의 그 단계 날짜를 그날로 (회차가 없으면 그날로 새 회차)
  const findCo = (name, list) => { const k = (x) => String(x || '').replace(/\s+/g, '').toLowerCase(); const q = k(name); return (list || []).find((c) => k(c.name) === q) || null; };
  async function addCamp(step, name, d) {
    const cfg = await loadCfg();
    if (!S.coAll) await campEvents(d, d);
    const co = findCo(name, S.coAll);
    if (!co) return false; // 업체가 아니면 메모로
    const { ev } = await campEvents(addDays(d, -90), addDays(d, 60));
    const cycles = [...new Set(ev.filter((e) => e.co.id === co.id).map((e) => e.cycle))].filter((c) => c <= d).sort();
    const cycle = step === '모집' ? d : (cycles[cycles.length - 1] || d);
    const cur = ev.find((e) => e.co.id === co.id && e.cycle === cycle && e.step === step);
    if (step === '모집') {
      const { error } = await sb.from('camp_tasks').upsert({ company_id: co.id, cycle_on: d, step: '모집', due_on: d }, { onConflict: 'company_id,cycle_on,step' });
      if (error) { toast('저장 실패: ' + error.message); return true; }
      toast(`${co.name} ${md(d)} 모집 추가`);
    } else if (!(await moveStep({ co, cycle, step, due: cur?.due || null }, d))) return true;
    await draw(); flash([d]);
    if (step === '모집') return true; // 모집 달력은 추가만 (상세 팝업 없음)
    const { ev: now } = await campEvents(d, d);
    const e = now.find((x) => x.co.id === co.id && x.cycle === cycle && x.step === step) || { co, cycle, step, due: d, ann: step === '발표' ? d : null, dl: null };
    openDetail(e, cfg);
    return true;
  }
  // 계약 달력: 업체명 → 그날을 재계약일로 + 업체 상세
  async function addRenew(name, d, list) {
    const c = findCo(name, list);
    if (!c) return false;
    if (!confirm(`${c.name} 재계약일을 ${md(d)}로 정할까요?${c.next_renew_due ? `\n(지금 ${c.next_renew_due})` : ''}`)) return true;
    const { error } = await sb.from('companies').update({ next_renew_due: d }).eq('id', c.id);
    if (error) { toast('저장 실패: ' + error.message); return true; }
    toast(`${c.name} 재계약일 → ${md(d)}`); S.cc = null; await draw(); flash([d]);
    openCompanyFromToday(c.id);
    return true;
  }

  // 상세 열기: 모집 = 발표일·모집일 정하기 / 발표·마감·2차마감 = 같은 상세(명단·안내·가이드) + 링크 확인 · +14 연장
  async function openDetail(e, cfg) {
    if (e.step === '모집') return recruitPopup(e, cfg);
    let close = e.step === '마감' ? e : null;
    if (!close) {
      const { data: t } = await sb.from('camp_tasks').select('*').eq('company_id', e.co.id).eq('cycle_on', e.cycle).eq('step', '마감').maybeSingle();
      close = { co: e.co, cycle: e.cycle, step: '마감', due: t?.due_on || e.dl, task: t, done: !!t?.done_at, ann: e.ann, dl: t?.due_on || e.dl };
    }
    const chk = e.step === '2차마감' ? e : close;
    const extra = [
      chk.due && el('button', { className: 'btn sm', type: 'button', text: `🔍 ${chk.step} 링크 확인`, title: '블로그 글 링크 자동 확인 → 마감 인원 반영 (부족하면 2차마감)', onclick: () => campLib().then(() => window.CRM_CAMP.closeCheck({ co: e.co, cycle: e.cycle, cfg, step: chk.step, announce: e.ann, deadline: chk.due,
        onCount: async (n, tg) => { if (await saveClose(chk, n, tg, cfg)) { toast(n >= tg ? `${e.co.name} 마감 완료 (${n}/${tg})` : `${e.co.name} ${tg - n}명 부족 → ${md(addDays(chk.due, cfg.off['2차마감'] || 7))} 2차마감`); draw(); } } })) }),
      close.due && el('button', { className: 'btn sm', type: 'button', text: `+${EXTEND_DAYS} 연장`, title: `마감 연장 → 마감일 +${EXTEND_DAYS}일 2차마감 (해당 없는 블로거 안내 문자)`, onclick: () => extendClose(close) }),
    ].filter(Boolean);
    const args = { co: e.co, cycle: e.cycle, cfg, announce: e.ann || undefined, deadline: close.due || e.dl || undefined };
    // 2차마감 = 리뷰 다시 확인(태그 누락 등) → 수정 요청 화면. 전체 상세는 버튼으로
    if (e.step === '2차마감') return campLib().then(() => window.CRM_CAMP.fixReq({ co: e.co, cycle: e.cycle, extra: [extra[0], el('button', { className: 'btn sm', type: 'button', text: '발표 상세', onclick: () => openCamp({ ...args, extra: extra.slice(1) }) })].filter(Boolean) })).catch((x) => toast('화면을 불러오지 못했습니다: ' + x.message));
    openCamp({ ...args, extra });
  }
  // 모집 삭제: 이번 회차만(camp_tasks 모집 skipped, 직접 추가한 회차는 행 삭제) 또는 매월 그 날짜 규칙까지
  async function delRecruit(e, P) {
    const day = +e.cycle.slice(8), dim = new Date(+e.cycle.slice(0, 4), +e.cycle.slice(5, 7), 0).getDate();
    const rds = e.co.recruit_days || [];
    const ruleDay = e.adhoc ? null : rds.find((x) => Math.min(Number(x) || 1, dim) === day);
    const { data: rd } = await sb.from('rounds').select('id').eq('company_id', e.co.id).eq('cycle_on', e.cycle).maybeSingle();
    const warn = rd ? '\n(저장된 명단은 지우지 않고 남겨둡니다)' : '';
    const once = async () => {
      if (!confirm(`${e.co.name} ${md(e.cycle)} 모집 회차를 삭제할까요?\n발표·마감 일정도 같이 사라집니다.${warn}`)) return;
      const { error } = e.adhoc
        ? await sb.from('camp_tasks').delete().eq('company_id', e.co.id).eq('cycle_on', e.cycle)
        : await sb.from('camp_tasks').upsert({ company_id: e.co.id, cycle_on: e.cycle, step: '모집', due_on: e.task?.due_on || e.cycle, skipped: true }, { onConflict: 'company_id,cycle_on,step' });
      if (error) { toast('삭제 실패: ' + error.message); return; }
      D.close(); P.close(); toast(`${e.co.name} ${md(e.cycle)} 모집 삭제`); draw();
    };
    const rule = async () => {
      if (!confirm(`${e.co.name} 매월 ${ruleDay}일 모집을 그만할까요?\n이번 회차부터 매월 ${ruleDay}일 일정이 더 이상 생기지 않습니다.${warn}`)) return;
      await sb.from('camp_tasks').upsert({ company_id: e.co.id, cycle_on: e.cycle, step: '모집', due_on: e.task?.due_on || e.cycle, skipped: true }, { onConflict: 'company_id,cycle_on,step' });
      if (await saveDays(e.co, rds.filter((x) => x !== ruleDay).map(Number))) { D.close(); P.close(); }
    };
    const D = popup(`${e.co.name} · ${mdw(e.due)} 모집 삭제`, [
      el('div', { className: 'hint', text: ruleDay ? `매월 ${rds.join(', ')}일 모집 업체입니다. 이번 회차만 지울지, 매월 ${ruleDay}일 모집 자체를 그만할지 고르세요.` : '직접 추가한 회차입니다.' }),
    ], [el('button', { className: 'btn ghost', type: 'button', text: '취소', onclick: () => D.close() }), el('span', { className: 'sp' }),
      ruleDay ? el('button', { className: 'btn', type: 'button', text: `매월 ${ruleDay}일 모집 그만하기`, onclick: rule }) : null,
      el('button', { className: 'btn primary', type: 'button', text: '이번 회차만 삭제', onclick: once })].filter(Boolean));
    D.layer.querySelector('.pm-f').classList.add('rc-f');
  }
  function recruitPopup(e, cfg) {
    const gap = (cfg.off.마감 || 0) - (cfg.off.발표 || 0);
    const inp = el('input', { className: 'fi', type: 'date', value: e.ann || '' });
    const dlTxt = el('div', { className: 'hint' });
    const paintDl = () => { dlTxt.textContent = inp.value ? `마감은 자동으로 ${mdw(addDays(inp.value, gap))} (발표 +${gap}일)` : '발표일이 아직 정해지지 않았습니다. 정해지면 날짜를 고르세요.'; };
    inp.oninput = paintDl; paintDl();
    const P = popup(`${e.co.name} · ${mdw(e.due)} 모집`, [
      el('label', {}, [el('span', { className: 'lbl', text: '발표일' }), inp]), dlTxt,
    ], [
      el('button', { className: 'btn ghost', type: 'button', text: '⚙ 매월 모집일', onclick: () => { P.close(); editDays(e.co); } }),
      el('button', { className: 'btn ghost rc-del', type: 'button', text: '삭제', onclick: () => delRecruit(e, P) }),
      el('span', { className: 'sp' }),
      e.ann ? el('button', { className: 'btn', type: 'button', text: '발표 상세 열기', onclick: () => { P.close(); openDetail({ ...e, step: '발표', due: e.ann }, cfg); } }) : null,
      el('button', { className: 'btn primary', type: 'button', text: '발표일 저장', onclick: async () => {
        if (!inp.value) { toast('발표일을 고르세요'); return; }
        if (await moveStep({ co: e.co, cycle: e.cycle, step: '발표', due: e.ann || null }, inp.value)) { P.close(); await draw(); flash([inp.value]); }
      } }),
    ].filter(Boolean));
    P.layer.querySelector('.pm-f').classList.add('rc-f');
  }

  async function campView() {
    const today = todayKst();
    if (!['오늘', ...STEPS].includes(S.cstep)) S.cstep = '오늘';
    if (!S.day) S.day = today;
    if (S.expand === undefined) try { S.expand = localStorage.getItem('crm-cal-expand') === '1'; } catch { S.expand = false; }
    const isToday = S.cstep === '오늘';
    const days = gridDays();
    const offd = await loadOffdays();
    const span = isToday ? spanDays(S.day, offd) : null; // 오늘 + 이어지는 휴무일 (금요일이면 금·토·일)
    const [from, to] = isToday ? [S.day, span[span.length - 1]] : [days[0], days[41]];
    const [{ ev: all, noDays, cfg, pending: pendAll }, marks] = await Promise.all([campEvents(from, to), loadMarks('camp', from, to)]);
    const ev = S.mine ? all.filter((e) => isMine(e.co)) : all;
    const pending = S.mine ? pendAll.filter((e) => isMine(e.co)) : pendAll;
    const who = (e) => e.co.manager_owner_name || e.co.sales_owner_name || '미배정';
    const sub = (e) => [e.step === '모집' ? (e.ann ? `발표 ${md(e.ann)}` : '발표일 미정') : e.step === '발표' ? (e.dl ? `마감 ${md(e.dl)}` : '') : (e.ann ? `발표 ${md(e.ann)}` : ''),
      (e.step === '마감' || e.step === '2차마감') && e.task?.target ? `${e.task.closed ?? 0}/${e.task.target}명` : '', who(e)].filter(Boolean).join(' · ');
    const byName = (a, b) => a.co.name.localeCompare(b.co.name);

    // 단계 탭: 오늘 업무(모집·발표·마감 3열) · 모집 · 발표 · 마감 · 2차마감(그 단계 달력)
    const inMonth = ev.filter((e) => monthOf(e.due) === S.month);
    const stepSeg = el('div', { className: 'cal-seg cg-seg' }, [['오늘', '오늘 업무', 'var(--accent)'], ...STEPS.map((x) => [x, x, STEP_COLOR[x]])].map(([k, t, c]) => {
      const b = el('button', { type: 'button', className: S.cstep === k ? 'on' : '', onclick: () => { S.cstep = k; draw(); } }, [el('i'), t, isToday || k === '오늘' ? null : el('span', { className: 'n', text: inMonth.filter((e) => e.step === k).length })].filter(Boolean));
      b.style.setProperty('--c', c); return b; }));

    const setBtn = el('button', { className: 'btn', type: 'button', text: `⚙ 설정${noDays.length ? ` · 모집일 미설정 ${noDays.length}` : ''}`, onclick: () => {
      popup('체험단 설정', [
        noDays.length ? el('div', { className: 'card' }, [el('div', { className: 'cs-h' }, [el('h3', { text: '모집일 미설정 (체험단 진행 중)' }), el('span', { className: 'n', text: noDays.length })]),
          ...noDays.slice(0, 60).map((c) => { const inp = el('input', { className: 'fi', placeholder: '예: 1, 16', title: '매월 모집일 (쉼표로 여러 날)' });
            const save = el('button', { className: 'btn sm', type: 'button', text: '저장', onclick: async () => { const ds = parseDays(inp.value); if (!ds.length) { toast('1~31 사이 날짜를 넣어주세요'); return; } save.disabled = true; await saveDays(c, ds); save.disabled = false; } });
            return el('div', { className: 'cs-row' }, [el('span'), el('div', { className: 'nm', text: c.name }), el('div', { className: 'acts' }, [inp, save])]); })]) : null,
        settingsCard(cfg), offdayCard(),
      ].filter(Boolean));
    } });
    const annEv = [...ev.filter((e) => e.step === '발표' && (isToday || monthOf(e.due) === S.month)), ...pending.map((e) => ({ ...e, due: null }))];
    const campBtn = el('button', { className: 'btn primary', type: 'button', text: `명단 변환${annEv.length ? ` (${annEv.length})` : ''}`, onclick: () => pickCamp(annEv, cfg) });

    // 리뷰노트 북마크로 복사한 명단을 캘린더에서 Ctrl+V → 캠페인 제목으로 업체를 찾아 명단 변환을 바로 연다 (예비)
    document.removeEventListener('paste', S.rnPaste || (() => {}));
    S.rnPaste = async (x) => {
      if (S.tab !== 'camp' || !S.box?.isConnected || document.querySelector('.pm-layer') || /input|textarea/i.test(x.target?.tagName || '')) return;
      const t = x.clipboardData?.getData('text') || ''; if (!/^MUYI-RN:/.test(t)) return;
      x.preventDefault(); await campLib(); const rn = window.CRM_CAMP.parseRN(t);
      if (!rn) { toast('붙여넣은 명단을 읽지 못했습니다 — 북마크를 다시 눌러주세요'); return; }
      const { ev: near } = await campEvents(addDays(today, -60), addDays(today, 45));
      const anns = near.filter((e) => e.step === '발표'); const seen = new Set(anns.map((e) => e.co.id));
      near.filter((e) => e.step === '모집' && !seen.has(e.co.id)).forEach((e) => { seen.add(e.co.id); anns.push({ ...e, step: '발표', due: e.ann || null }); });
      pickCamp(anns, cfg, rn);
    };
    document.addEventListener('paste', S.rnPaste);

    // ── 오늘 업무: 모집 | 발표 | 마감(2차마감 포함) 3열 ──
    if (isToday) {
      const prevWork = () => { let x = addDays(S.day, -1); for (let i = 0; i < 12 && isOff(x, offd); i++) x = addDays(x, -1); return x; };
      const nav = el('div', { className: 'td-nav' }, [
        el('button', { className: 'icon-btn', type: 'button', text: '‹', title: '이전 근무일', onclick: () => { S.day = isOff(S.day, offd) ? addDays(S.day, -1) : prevWork(); draw(); } }),
        el('b', { text: mdw(S.day) + (span.length > 1 ? ` ~ ${mdw(to)}` : '') + (S.day === today ? ' · 오늘' : '') }),
        el('button', { className: 'icon-btn', type: 'button', text: '›', title: '다음 근무일', onclick: () => { S.day = addDays(to, 1); draw(); } }),
        span.length > 1 ? el('span', { className: 'td-span', text: `휴무 포함 ${span.length}일치` }) : null,
        S.day !== today ? el('button', { className: 'btn sm', type: 'button', text: '오늘', onclick: () => { S.day = today; draw(); } }) : null,
      ].filter(Boolean));
      const col = (step) => {
        const list = ev.filter((e) => span.includes(e.due) && (step === '마감' ? e.step === '마감' || e.step === '2차마감' : e.step === step)).sort((a, b) => a.due.localeCompare(b.due) || (a.step === '2차마감') - (b.step === '2차마감') || byName(a, b));
        const body = el('div', { className: 'td-body' }, list.map((e) => { const b = el('button', { type: 'button', className: 'td-item' + (e.due !== S.day ? ' off-day' : ''), title: '눌러서 상세 열기', onclick: () => openDetail(e, cfg) }, [el('b', {}, [span.length > 1 ? el('span', { className: 'td-d', text: mdw(e.due) }) : null, e.co.name].filter(Boolean)), e.step === '2차마감' ? el('span', { className: 'td-tag', text: '2차마감' }) : el('span'), el('small', { text: sub(e) })]); b.style.setProperty('--c', STEP_COLOR[e.step]); return b; }));
        if (!list.length) body.append(el('div', { className: 'td-empty', text: '없음' }));
        markCell(body, { cal: 'camp', cat: step, day: S.day, color: STEP_COLOR[step], marks, add: (v) => addCamp(step, v, S.day) });
        const card = el('div', { className: 'card td-col' }, [el('div', { className: 'td-h' }, [el('i'), el('h3', { text: step === '마감' ? '마감 · 2차마감' : step }), el('span', { className: 'n', text: list.length })]), body]);
        card.style.setProperty('--c', STEP_COLOR[step]);
        return card;
      };
      const tools = el('div', { className: 'cal-tools' }, [stepSeg, nav, el('span', { className: 'sp' }), setBtn, campBtn]);
      return [tools, el('div', { className: 'hint', text: '업체명을 누르면 상세 · 다음 근무일 전까지 쉬는 날(주말·공휴일·설정한 휴무)도 같이 보임 · 칸 빈 곳 한 번 = 완료 표시 · 두 번 = 업체명을 적어 일정 추가 · 업체가 아닌 글자는 메모' }), el('div', { className: 'td-wrap' }, ['모집', '발표', '마감'].map(col))];
    }

    // ── 단계 달력: 그 단계 업체만 · 업체명 누르면 상세 · 끌어서 날짜 변경 ──
    const shown = ev.filter((e) => e.step === S.cstep);
    const byDay = {}; shown.forEach((e) => { (byDay[e.due] = byDay[e.due] || []).push(e); });
    const chip = (e) => {
      const b = el('div', { className: 'cc' + (e.step === '모집' && !e.ann ? ' pend' : ''), draggable: true });
      b.append(el('button', { type: 'button', className: 'cc-n', text: e.co.name, title: `${e.step} · ${e.co.name}\n${sub(e)}\n누르면 상세 · 끌어서 날짜 변경`, onclick: (x) => { x.stopPropagation(); openDetail(e, cfg); } }));
      b.addEventListener('dragstart', (x) => { x.stopPropagation(); startDrag(x, { kind: 'camp', e, label: e.co.name }, b.closest('.pm-layer')); b.classList.add('dragging'); });
      b.addEventListener('dragend', () => { b.classList.remove('dragging'); endDrag(b.closest('.pm-layer')); });
      return b;
    };
    const MAXC = 4;
    const cells = days.map((d) => {
      const list = (byDay[d] || []).sort(byName);
      const cell = el('div', { className: 'cal-day' + (monthOf(d) !== S.month ? ' out' : '') + (d === today ? ' today' : '') }, [
        el('div', { className: 'dn' }, el('b', { text: String(+d.slice(8)) })),
        ...list.map(chip),
        list.length > MAXC ? el('button', { type: 'button', className: 'cc-more', text: `… +${list.length - MAXC}`, title: '전체 보기', onclick: (x) => { x.stopPropagation(); setExpand(true); } }) : null,
      ].filter(Boolean));
      markCell(cell, { cal: 'camp', cat: S.cstep, day: d, color: STEP_COLOR[S.cstep], marks, add: (v) => addCamp(S.cstep, v, d) });
      dropZone(cell, d, (g) => { if (g.kind !== 'camp') return; g.close?.(); dropCamp(g.e, d); });
      return cell;
    });
    const grid = el('div', { className: 'cal-grid camp' + (S.expand ? ' expand' : '') }, [...DOW.map((w) => el('div', { className: 'cal-dow', text: w })), ...cells]);
    grid.style.setProperty('--sc', STEP_COLOR[S.cstep]);
    const expandBtn = el('button', { className: 'btn sm', type: 'button' });
    const setExpand = (v) => { S.expand = v; grid.classList.toggle('expand', v); expandBtn.textContent = v ? '⤡ 접기' : '⤢ 전체 보기'; try { localStorage.setItem('crm-cal-expand', v ? '1' : '0'); } catch {} };
    expandBtn.onclick = () => setExpand(!S.expand); setExpand(S.expand);
    const goDay = (d) => { if (monthOf(d) !== S.month) { S.month = monthOf(d); draw().then(() => flash([d])); return; } setExpand(true); S.box.querySelector(`.cal-day[data-d="${d}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); flash([d]); };
    const listRows = shown.filter((e) => monthOf(e.due) === S.month).sort((a, b) => a.due.localeCompare(b.due) || byName(a, b));
    const list = el('div', { className: 'card' }, [
      el('div', { className: 'cs-h' }, [el('h3', { text: `${+S.month.slice(5)}월 ${S.cstep} ${listRows.length}건` })]),
      listRows.length ? el('div', { className: 'tbl-wrap cg-wrap' }, el('table', { className: 'tbl cg-tbl' }, [
        el('thead', {}, el('tr', {}, ['날짜', '업체', '일정', '담당', ''].map((h) => el('th', { text: h })))),
        el('tbody', {}, listRows.slice(0, 400).map((e) => el('tr', { className: 'click', onclick: () => goDay(e.due) }, [el('td', { className: e.due === today ? 'today' : 'sub', text: mdw(e.due) }), el('td', {}, el('b', { text: e.co.name })), el('td', { className: 'sub', text: sub(e) }), el('td', { className: 'sub', text: who(e) }),
          el('td', {}, el('button', { className: 'btn sm ghost', type: 'button', text: '상세', onclick: (x) => { x.stopPropagation(); openDetail(e, cfg); } }))]))),
      ])) : el('div', { className: 'cs-empty cs-char' }, [el('img', { src: '/assets/brand/muyi-char-idea.webp', alt: '' }), '이 달에 해당하는 일정이 없습니다.']),
    ]);
    const tools = el('div', { className: 'cal-tools' }, [stepSeg, el('span', { className: 'sp' }), expandBtn, setBtn, campBtn]);
    return [tools, el('div', { className: 'stack' }, [el('div', { className: 'card' }, grid), list])];
  }
  const campLib = () => loadScript('/assets/crm-camp.js?v=10');
  const openCamp = (a) => campLib().then(() => window.CRM_CAMP.open(a)).catch((e) => toast('발표 도우미를 불러오지 못했습니다: ' + e.message));
  const pickCamp = (evs, cfg, rn) => campLib().then(() => window.CRM_CAMP.pick(evs, cfg, rn)).catch((e) => toast('발표 도우미를 불러오지 못했습니다: ' + e.message));
  function settingsCard(cfg) {
    const gap = Math.max(0, (cfg.off.마감 || 0) - (cfg.off.발표 || 0));
    const F = { 마감: el('input', { className: 'fi', type: 'number', min: 0, value: gap }), '2차마감': el('input', { className: 'fi', type: 'number', min: 0, value: cfg.off['2차마감'] }) };
    const d = el('details', {}, [el('summary', { className: 'cs-h', text: '⚙ 단계 간격 설정' }), el('div', { className: 'cs-set' }, [
      el('label', {}, [el('span', { text: '마감 = 발표 +' }), F.마감, '일']),
      el('label', {}, [el('span', { text: '2차마감(인원 부족) = 마감 +' }), F['2차마감'], '일']),
      el('div', { className: 'hint', text: `모집은 업체마다 달라 따로 움직이고, 발표일은 정해질 때 달력에 놓습니다. 연장은 항상 마감 +${EXTEND_DAYS}일.` }),
      el('button', { className: 'btn primary', type: 'button', text: '저장', onclick: async () => {
        const ann = cfg.off.발표 || 0, v = { 발표: ann, 마감: ann + Math.max(0, Number(F.마감.value) || 0), '2차마감': Math.max(0, Number(F['2차마감'].value) || 0) };
        const { error } = await sb.from('crm_settings').upsert({ key: 'camp_offsets', value: v, updated_at: new Date().toISOString() });
        if (error) { toast('저장 실패: ' + error.message); return; } S.cfg = null; toast('단계 간격 저장'); draw();
      } })])]);
    return el('div', { className: 'card' }, d);
  }

  // 휴무일 설정: 특별 휴무(샌드위치 등) 추가 · 공휴일인데 출근하는 날 지정 → [오늘 업무] 며칠치 보일지에 반영 (팀 공유)
  function offdayCard() {
    const box = el('div', {});
    const paint = async () => {
      const o = await loadOffdays(), today = todayKst();
      const save = async (v) => { const { error } = await sb.from('crm_settings').upsert({ key: 'cal_offdays', value: v, updated_at: new Date().toISOString() }); if (error) { toast('저장 실패: ' + error.message); return; } S.offd = v; paint(); draw(); };
      const list = (k, label) => { const arr = o[k].filter((d) => d >= addDays(today, -31)).sort(); return [el('div', { className: 'cs-g', text: `${label} ${arr.length}` }), el('div', { className: 'od-list' }, arr.length ? arr.map((d) => el('button', { type: 'button', text: `${mdw(d)} ✕`, title: '눌러서 빼기', onclick: () => save({ ...o, [k]: o[k].filter((x) => x !== d) }) })) : [el('span', { className: 'hint', text: '없음' })])]; };
      const inp = el('input', { className: 'fi', type: 'date', value: today });
      const add = (k) => { const d = inp.value; if (!d) return; const other = k === 'off' ? 'work' : 'off'; save({ ...o, [k]: [...new Set([...o[k], d])], [other]: o[other].filter((x) => x !== d) }); };
      const next = []; for (let x = today, i = 0; next.length < 8 && i < 120; i++, x = addDays(x, 1)) if (KR_HOL.has(x) && ![0, 6].includes(parse(x).getDay())) next.push(x);
      box.replaceChildren(
        el('div', { className: 'od-add' }, [inp, el('button', { className: 'btn sm', type: 'button', text: '휴무일 추가', onclick: () => add('off') }), el('button', { className: 'btn sm ghost', type: 'button', text: '출근일 지정 (공휴일 근무)', onclick: () => add('work') })]),
        ...list('off', '특별 휴무'), ...list('work', '출근일'),
        el('div', { className: 'hint od-hint', text: `주말·법정공휴일은 자동. 다가오는 평일 공휴일: ${next.map(mdw).join(', ') || '없음'}` }));
    };
    paint();
    return el('div', { className: 'card' }, el('details', {}, [el('summary', { className: 'cs-h', text: '📅 휴무일 설정 ([오늘 업무] 며칠치 보일지)' }), box]));
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
  const CGROUPS = [['all', '전체', 'var(--accent)'], ['run', '진행 중', '#16A34A'], ['past', '재계약 지남', '#E11D48'], ['hold', '홀딩', '#D97706'], ['end', '종료', '#71717A'], ['none', '정보 없음', '#7C3AED']];
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
    const [[A, all], marks] = await Promise.all([S.cc.p.catch((e) => { S.cc = null; throw e; }), loadMarks('contract', days[0], days[41])]);
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
      markCell(cell, { cal: 'contract', cat: S.cgroup, day: d, color: (CGROUPS.find(([k]) => k === S.cgroup) || CGROUPS[0])[2], marks, add: (v) => addRenew(v, d, all.data || []) });
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
