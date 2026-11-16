// ── 정산 (대표 전용): 매출 원장 · 월 정산 · 정산계산기 · 실행비 단가표 · 엑셀 가져오기 ──
// admin.html의 sb·el·$·admins·me·toast·kst·todayKst 사용. window.CRM_SETTLE.mount(box)
// 데이터: ledger(원장) · settle_people(정산 대상) · settlements(월 확정) · settle_prices(단가표) — RLS = is_master()
// 계산 규칙
//   원금 = 결제금액(VAT 포함) / 1.1, 실행원금 = 실행비(VAT 포함) / 1.1
//   인센 = 고정 인센이 있으면 그 값, 없으면 (원금 − 실행원금) × 인센율
//   월 정산(예: 김동환): 4대보험 처리분 = 가입 보수(100만원) 고정, 3.3% 처리분 = 인센 합계 − 100만원 (음수면 그대로 −표기)
//   원천세 = 소득세 3% + 지방소득세 0.3% (각 10원 미만 절사), 3.3% 처리분이 음수면 0
(function () {
  const won = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString());
  const signed = (n) => (n > 0 ? '' : n < 0 ? '−' : '') + Math.abs(Math.round(n || 0)).toLocaleString();
  const num = (v) => { const d = String(v ?? '').replace(/[^\d.-]/g, ''); return d === '' || d === '-' ? null : Number(d); };
  const base = (r) => (r.amount_won || 0) / 1.1;
  const execBase = (r) => (r.exec_won || 0) / 1.1;
  const incentive = (r) => r.incentive_fixed_won != null ? Number(r.incentive_fixed_won) : Math.round((base(r) - execBase(r)) * (Number(r.incentive_rate) || 0));
  const tax33 = (x) => x > 0 ? Math.floor(x * 0.03 / 10) * 10 + Math.floor(x * 0.003 / 10) * 10 : 0;
  const ym = (d) => d.slice(0, 7);
  const addMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const keyOf = (name) => String(name || '').trim().replace(/\s+/g, '').replace(/[()（）\[\]·.,'"]/g, '').toLowerCase();
  const KINDS = ['결제', '환불', '환수', '지급'];
  const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const loadLib = (src) => new Promise((ok, ng) => {
    if (window.XLSX) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('엑셀 라이브러리를 불러오지 못했습니다')); document.head.appendChild(s);
  });

  if (!document.getElementById('crm-settle-css')) {
    const st = document.createElement('style'); st.id = 'crm-settle-css';
    st.textContent = `
.st-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#settleBody,#settleBody .stack{grid-template-columns:minmax(0,1fr)}
#settleBody .tbl-wrap{overflow-x:auto}
.pm-layer{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:60;display:grid;place-items:center;padding:16px}
.pm{background:var(--surface);border-radius:14px;width:min(720px,100%);max-height:calc(var(--vh, 100vh) - 32px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.pm-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
.pm-h h3{font-size:16px;font-weight:700}
.pm-b{overflow-y:auto;min-height:0;flex:1;padding:16px 20px;display:grid;gap:16px;align-content:start}
.pm-f{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--line)}
.btn.sm{height:26px;padding:0 10px;font-size:12px}
.btn.ghost{background:transparent;border-color:transparent;box-shadow:none;color:var(--t2)}
.btn.ghost:hover{background:var(--muted);color:var(--t1)}
.st-seg{display:inline-flex;gap:2px;padding:3px;background:var(--muted);border-radius:10px}
.st-seg button{height:32px;padding:0 14px;border:0;border-radius:8px;background:none;font-weight:600;font-size:13px;color:var(--t2)}
.st-seg button.on{background:var(--surface);color:var(--t1);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.st-month{display:inline-flex;align-items:center;gap:4px;margin-left:auto}
.st-month b{min-width:96px;text-align:center;font-size:15px;font-variant-numeric:tabular-nums}
.st-month .icon-btn{width:30px;height:30px}
.st-kpi .kpi-val{font-variant-numeric:tabular-nums}
.st-kpi .kpi-val.neg{color:var(--red)}
.st-tbl td.num,.st-tbl th.num{text-align:right;font-variant-numeric:tabular-nums}
.st-tbl td.neg{color:var(--red)}
.st-tbl td.k{white-space:nowrap}
.st-tbl tr.click{cursor:pointer}
.st-tbl tr.click:hover td{background:var(--muted)}
.st-tbl tfoot td{font-weight:700;border-top:1px solid var(--line-strong);background:var(--surface-2)}
.st-tbl .ex-btn{height:24px;padding:0 8px;border:1px dashed var(--line-strong);border-radius:12px;background:none;font-size:12px;color:var(--t2);font-variant-numeric:tabular-nums}
.st-tbl .ex-btn:hover{border-color:var(--accent);color:var(--accent)}
.st-tbl .ex-btn.set{border-style:solid;color:var(--t1)}
.st-tag{display:inline-block;font-size:11px;font-weight:600;padding:1px 6px;border-radius:8px;background:var(--muted);color:var(--t2);margin-left:4px}
.st-tag.neg{background:color-mix(in srgb,var(--red) 12%,var(--surface));color:var(--red)}
.st-calc{display:grid;gap:2px;font-variant-numeric:tabular-nums}
.st-line{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:8px 14px;font-size:14px}
.st-line.sub{padding-left:34px;font-size:13px;color:var(--t2)}
.st-line.total{border-top:1px solid var(--line-strong);font-size:16px;font-weight:800;margin-top:4px;padding-top:12px}
.st-line b{font-weight:700}
.st-line .neg{color:var(--red)}
.st-line input{width:120px;text-align:right}
.st-note{font-size:12px;color:var(--t3);padding:4px 14px 10px}
.st-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,400px);gap:12px;align-items:start}
.st-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;background:color-mix(in srgb,var(--green) 12%,var(--surface));color:var(--green)}
.st-badge.wait{background:var(--muted);color:var(--t2)}
.st-acts{display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid var(--line)}
.st-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.st-head h3{font-size:14px;font-weight:700;margin-right:auto}
.st-people{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--t2);flex-wrap:wrap}
.st-people input{width:80px;height:28px;text-align:right}
.cc-tbl td input.fi{height:30px;width:100%;text-align:right}
.cc-tbl td input.fi.nm{text-align:left}
.cc-tbl td input.fi.ro{border-color:transparent;background:transparent;box-shadow:none;cursor:default}
.cc-unit{display:flex;align-items:center;gap:6px}
.cc-unit .fi{flex:1;min-width:0}
.ed-btn{flex:none;height:24px;padding:0 8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);font-size:11px;font-weight:600;color:var(--t3)}
.ed-btn:hover{border-color:var(--accent);color:var(--accent)}
.st-btns{display:inline-flex;gap:4px}
.cc-tbl tr.editing td{background:color-mix(in srgb,var(--accent) 6%,var(--surface))}
.cc-tbl tr.used td{background:color-mix(in srgb,var(--accent) 5%,var(--surface))}
.cc-sum{display:grid;gap:2px}
.st-imp{display:grid;gap:8px}
.pm.st-modal.wide{width:min(860px,100%)}
.st-modal .dr-grid,#settleBody .dr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.st-modal .dr-grid label.wide{grid-column:1/-1}
@media (max-width:900px){.st-grid2{grid-template-columns:minmax(0,1fr)}.st-month{margin-left:0}.st-modal .dr-grid{grid-template-columns:1fr}.pm-layer{padding:0;place-items:stretch}.pm{width:100%!important;max-height:none;height:var(--vh,100vh);border-radius:0}}
`;
    document.head.appendChild(st);
  }

  let S = null; // { box, tab, month, rows, people, person, prices }

  function mount(box) {
    S = { box, tab: 'ledger', month: ym(todayKst()), rows: [], people: [], person: null, prices: [] };
    try { const t = localStorage.getItem('crm-settle-tab'); if (t) S.tab = t; } catch {}
    draw();
  }

  async function draw() {
    const tabs = [['ledger', '매출 원장'], ['settle', '월 정산'], ['calc', '정산계산기'], ['prices', '단가표']];
    const seg = el('div', { className: 'st-seg' }, tabs.map(([k, t]) => el('button', { type: 'button', className: S.tab === k ? 'on' : '', text: t, onclick: () => { S.tab = k; try { localStorage.setItem('crm-settle-tab', k); } catch {} draw(); } })));
    const monthNav = ['ledger', 'settle'].includes(S.tab) ? el('div', { className: 'st-month' }, [
      el('button', { className: 'icon-btn', type: 'button', text: '‹', title: '이전 달', onclick: () => { S.month = addMonth(S.month, -1); draw(); } }),
      el('b', { text: S.month.replace('-', '. ') }),
      el('button', { className: 'icon-btn', type: 'button', text: '›', title: '다음 달', onclick: () => { S.month = addMonth(S.month, 1); draw(); } }),
    ]) : null;
    const body = el('div', { className: 'stack' }, el('div', { className: 'hint', text: '불러오는 중…' }));
    S.box.replaceChildren(el('div', { className: 'st-top' }, [seg, monthNav].filter(Boolean)), body);
    try {
      if (S.tab === 'ledger') body.replaceChildren(...await ledgerView());
      else if (S.tab === 'settle') body.replaceChildren(...await settleView());
      else if (S.tab === 'calc') body.replaceChildren(...await calcView());
      else body.replaceChildren(...await pricesView());
    } catch (e) { body.replaceChildren(el('div', { className: 'err', text: '불러오기 실패: ' + e.message })); }
  }

  async function loadRows(filter) {
    let q = sb.from('ledger').select('*').eq('settle_month', S.month).order('paid_on').order('created_at');
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }
  async function loadPeople() { const { data } = await sb.from('settle_people').select('*').order('name'); S.people = data || []; return S.people; }
  async function loadPrices() { const { data } = await sb.from('settle_prices').select('*').order('sort').order('name'); S.prices = data || []; return S.prices; }

  const kpi = (l, v, sub, neg) => el('div', { className: 'kpi' }, [el('div', { className: 'kpi-lbl', text: l }), el('div', { className: 'kpi-val' + (neg ? ' neg' : ''), text: v }), sub ? el('div', { className: 'kpi-sub', text: sub }) : null].filter(Boolean));
  const th = (t, num) => el('th', { className: num ? 'num' : '', text: t });
  const td = (t, cls = '') => el('td', { className: cls, text: t == null ? '—' : String(t) });
  const editCell = (r) => el('td', { className: 'num' }, el('button', { className: 'btn sm', type: 'button', text: '수정', onclick: (e) => { e.stopPropagation(); rowModal(r); } }));
  const ntd = (n) => el('td', { className: 'num' + (n < 0 ? ' neg' : ''), text: n == null ? '—' : signed(n) });

  // ── 매출 원장 ──
  async function ledgerView() {
    const rows = S.rows = await loadRows();
    const sum = (f) => rows.reduce((s, r) => s + (f(r) || 0), 0);
    const tAmt = sum((r) => r.amount_won), tBase = sum(base), tExec = sum((r) => r.exec_won), tExecB = sum(execBase), tInc = sum(incentive);
    const profit = tBase - tExecB - tInc;
    const noExec = rows.filter((r) => r.kind === '결제' && r.amount_won > 0 && r.exec_won == null).length;
    // 영업사원별
    const byP = new Map();
    rows.forEach((r) => { const k = r.owner_name || '(미지정)'; const x = byP.get(k) || { n: 0, base: 0, exec: 0, inc: 0 }; x.n++; x.base += base(r); x.exec += execBase(r); x.inc += incentive(r); byP.set(k, x); });
    const tbl = el('table', { className: 'tbl st-tbl' }, [
      el('thead', {}, el('tr', {}, [th('결제일'), th('영업사원'), th('업체'), th('품목'), th('결제금액', 1), th('원금', 1), th('실행비 (VAT 포함)', 1), th('인센율', 1), th('인센', 1), th('확인/입금'), th('특이사항'), th('')])),
      el('tbody', {}, rows.length ? rows.map((r) => el('tr', { className: 'click', onclick: () => rowModal(r) }, [
        td(r.paid_on.slice(5).replace('-', '/'), 'k'), td(r.owner_name), el('td', {}, [r.company_name || '—', r.kind !== '결제' && el('span', { className: 'st-tag' + (r.kind === '환불' || r.kind === '환수' ? ' neg' : ''), text: r.kind })].filter(Boolean)), td(r.item, 'sub'),
        ntd(r.amount_won), ntd(r.amount_won == null ? null : base(r)),
        el('td', { className: 'num' }, el('button', { className: 'ex-btn' + (r.exec_won != null ? ' set' : ''), type: 'button', text: r.exec_won != null ? won(r.exec_won) : '계산', title: '정산계산기로 실행비 계산', onclick: (e) => { e.stopPropagation(); calcModal(r); } })),
        td(r.incentive_fixed_won != null ? '고정' : r.incentive_rate != null ? Math.round(r.incentive_rate * 100) + '%' : '—', 'num sub'), ntd(incentive(r)),
        td(r.checked, 'sub'), td(r.memo, 'sub memo'), editCell(r),
      ])) : [el('tr', {}, el('td', { colSpan: 12, className: 'empty', text: '이 달 결제가 없습니다. CRM에서 [결제 등록]을 하면 자동으로 들어옵니다.' }))]),
      rows.length ? el('tfoot', {}, el('tr', {}, [el('td', { colSpan: 4, text: `합계 ${rows.length}건` }), ntd(tAmt), ntd(tBase), el('td', { className: 'num', text: won(tExec) }), td(''), ntd(tInc), td(''), td(''), td('')])) : null,
    ].filter(Boolean));
    const ppl = [...byP.entries()].sort((a, b) => b[1].base - a[1].base);
    return [
      el('div', { className: 'kpi-row st-kpi' }, [
        kpi('총 매출 (VAT 포함)', won(tAmt), `원금 ${won(tBase)}`),
        kpi('실행비 (VAT 포함)', won(tExec), noExec ? `실행비 미입력 ${noExec}건` : '전부 입력됨'),
        kpi('인센 합계 (세전)', won(tInc), `${byP.size}명`),
        kpi('순수익', signed(profit), '원금 − 실행원금 − 인센', profit < 0),
      ]),
      ppl.length ? el('div', { className: 'card' }, el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl st-tbl' }, [
        el('thead', {}, el('tr', {}, [th('영업사원'), th('건수', 1), th('매출 원금', 1), th('실행원금', 1), th('원금 − 실행원금', 1), th('인센 (세전)', 1)])),
        el('tbody', {}, ppl.map(([n, x]) => el('tr', {}, [td(n), td(x.n, 'num'), ntd(x.base), ntd(x.exec), ntd(x.base - x.exec), ntd(x.inc)]))),
      ]))) : null,
      el('div', { className: 'co-filters' }, [
        el('button', { className: 'btn primary', type: 'button', text: '+ 줄 추가', onclick: () => rowModal(null) }),
        el('button', { className: 'btn', type: 'button', text: 'CSV 내보내기', onclick: () => csv(rows) }),
        el('span', { className: 'ml-auto' }),
        el('button', { className: 'btn ghost', type: 'button', text: '엑셀 가져오기 (영업사원 결제건)', onclick: importModal }),
      ]),
      el('div', { className: 'card' }, el('div', { className: 'tbl-wrap' }, tbl)),
    ].filter(Boolean);
  }

  function csv(rows) {
    const H = ['정산월', '결제일', '영업사원', '업체', '품목', '구분', '결제금액', '원금', '실행비', '실행원금', '인센율', '인센', '확인/입금', '특이사항'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [H.map(q).join(','), ...rows.map((r) => [r.settle_month, r.paid_on, r.owner_name, r.company_name, r.item, r.kind, r.amount_won, Math.round(base(r)), r.exec_won, Math.round(execBase(r)), r.incentive_rate, incentive(r), r.checked, r.memo].map(q).join(','))];
    const a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })), download: `매출원장_${S.month}.csv` });
    document.body.append(a); a.click(); a.remove();
  }

  // ── 모달 공통 ──
  function modal(title, kids, foot, wide) {
    const layer = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === layer) layer.remove(); } }, el('div', { className: 'pm st-modal' + (wide ? ' wide' : '') }, [
      el('div', { className: 'pm-h' }, [el('h3', { text: title }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: () => layer.remove() })]),
      el('div', { className: 'pm-b' }, kids), el('div', { className: 'pm-f' }, foot),
    ]));
    layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') layer.remove(); });
    document.body.append(layer); return layer;
  }
  const lab = (t, x, wide) => el('label', { className: wide ? 'wide' : '' }, [el('span', { className: 'lbl', text: t }), x]);
  const fi = (props, tag = 'input', kids) => el(tag, { className: 'fi', ...props }, kids || []);

  async function rowModal(r) {
    if (!S.people.length) await loadPeople();
    const isNew = !r; r = r || { paid_on: todayKst(), settle_month: S.month, kind: '결제', in_revenue: true, in_promo: true };
    const F = {
      paid_on: fi({ type: 'date', value: r.paid_on || '' }), settle_month: fi({ type: 'month', value: r.settle_month || '' }),
      owner_name: fi({ value: r.owner_name || '', placeholder: '영업사원', list: 'st-owners' }), company_name: fi({ value: r.company_name || '' }),
      item: fi({ value: r.item || '', placeholder: '체험단 / 패키지 / 플레이스…' }),
      kind: fi({}, 'select', KINDS.map((k) => el('option', { value: k, text: k, selected: r.kind === k }))),
      amount_won: fi({ inputMode: 'numeric', value: r.amount_won != null ? Math.round(r.amount_won).toLocaleString() : '', placeholder: '환불은 −' }),
      exec_won: fi({ inputMode: 'numeric', value: r.exec_won != null ? Math.round(r.exec_won).toLocaleString() : '' }),
      rate: fi({ inputMode: 'decimal', value: r.incentive_rate != null ? Math.round(r.incentive_rate * 1000) / 10 : '', placeholder: '예: 60' }),
      fixed: fi({ inputMode: 'numeric', value: r.incentive_fixed_won != null ? Math.round(r.incentive_fixed_won).toLocaleString() : '', placeholder: '촬영비·환수(−) 등' }),
      pay_method: fi({ value: r.pay_method || '' }), tax_invoice: fi({ value: r.tax_invoice || '' }),
      checked: fi({ value: r.checked || '', placeholder: '완료 / 확인' }), memo: fi({ rows: 2, value: r.memo || '' }, 'textarea'),
    };
    const owners = el('datalist', { id: 'st-owners' }, [...new Set([...S.people.map((p) => p.name), ...Object.values(admins)])].map((n) => el('option', { value: n })));
    F.owner_name.addEventListener('change', () => { const p = S.people.find((x) => x.name === F.owner_name.value.trim()); if (p && !F.rate.value) F.rate.value = p.rate * 100; });
    const preview = el('div', { className: 'hint' });
    const calc = () => { const t = { amount_won: num(F.amount_won.value), exec_won: num(F.exec_won.value), incentive_rate: num(F.rate.value) != null ? num(F.rate.value) / 100 : null, incentive_fixed_won: num(F.fixed.value) }; preview.textContent = `원금 ${won(base(t))} · 실행원금 ${won(execBase(t))} · 인센 ${signed(incentive(t))}`; };
    Object.values(F).forEach((x) => x.addEventListener('input', calc)); calc();
    const err = el('div', { className: 'err' });
    const save = async () => {
      err.textContent = '';
      if (!F.paid_on.value) { err.textContent = '결제일을 입력하세요'; return; }
      const row = { paid_on: F.paid_on.value, settle_month: F.settle_month.value || F.paid_on.value.slice(0, 7), owner_name: F.owner_name.value.trim() || null, company_name: F.company_name.value.trim() || null,
        item: F.item.value.trim() || null, kind: F.kind.value, amount_won: num(F.amount_won.value), exec_won: num(F.exec_won.value),
        incentive_rate: num(F.rate.value) != null ? num(F.rate.value) / 100 : null, incentive_fixed_won: num(F.fixed.value),
        pay_method: F.pay_method.value.trim() || null, tax_invoice: F.tax_invoice.value.trim() || null, checked: F.checked.value.trim() || null, memo: F.memo.value.trim() || null };
      const { error } = isNew ? await sb.from('ledger').insert({ ...row, created_by: me }) : await sb.from('ledger').update(row).eq('id', r.id);
      if (error) { err.textContent = '저장 실패: ' + error.message; return; }
      layer.remove(); toast('저장됨'); draw();
    };
    const del = !isNew && !r.contract_id ? el('button', { className: 'btn lg ghost', type: 'button', text: '삭제', onclick: async () => {
      if (!confirm('이 줄을 삭제할까요?')) return;
      const { error } = await sb.from('ledger').delete().eq('id', r.id); if (error) { toast('삭제 실패: ' + error.message); return; }
      layer.remove(); toast('삭제됨'); draw();
    } }) : null;
    const layer = modal(isNew ? '원장 줄 추가' : `${r.company_name || '원장'} 수정`, [
      owners,
      el('div', { className: 'dr-grid' }, [lab('결제일', F.paid_on), lab('정산 월', F.settle_month), lab('영업사원', F.owner_name), lab('구분', F.kind), lab('업체', F.company_name), lab('품목', F.item),
        lab('결제금액 (VAT 포함)', F.amount_won), lab('실행비 (VAT 포함)', F.exec_won), lab('인센율 (%)', F.rate), lab('고정 인센 (있으면 율 대신)', F.fixed),
        lab('결제방식', F.pay_method), lab('세금계산서', F.tax_invoice), lab('확인/입금', F.checked), lab('특이사항', F.memo, true)]),
      preview, r.contract_id ? el('div', { className: 'hint', text: 'CRM 결제 등록에서 온 줄입니다 (결제금액·결제일은 계약을 고치면 함께 바뀜).' }) : null, err,
    ].filter(Boolean), [del, el('span', { className: 'ml-auto' }), el('button', { className: 'btn lg ghost', type: 'button', text: '취소', onclick: () => layer.remove() }), el('button', { className: 'btn primary lg', type: 'button', text: '저장', onclick: save })].filter(Boolean));
  }

  // ── 월 정산 (김동환 등) ──
  async function settleView() {
    await loadPeople();
    if (!S.people.length) return [el('div', { className: 'dr-empty', text: '정산 대상이 없습니다.' })];
    if (!S.person || !S.people.some((p) => p.name === S.person)) S.person = S.people[0].name;
    const P = S.people.find((p) => p.name === S.person);
    const [rows, conf, hist] = await Promise.all([
      loadRows((q) => q.eq('owner_name', P.name)),
      sb.from('settlements').select('*').eq('person', P.name).eq('month', S.month).maybeSingle(),
      sb.from('settlements').select('*').eq('person', P.name).order('month', { ascending: false }).limit(12),
    ]);
    const C = conf.data;
    const inc = rows.reduce((s, r) => s + incentive(r), 0);
    const insured = Number(P.insured_base_won) || 0;
    const insIn = fi({ inputMode: 'numeric', value: C ? Math.round(C.ins_deduct_won).toLocaleString() : '', placeholder: '0' });
    const box = el('div', { className: 'st-calc' });
    const figures = () => {
      const insDed = num(insIn.value) || 0;
      const taxable = inc - insured;
      const tax = tax33(taxable);
      const insNet = insured - insDed, taxNet = taxable - tax;
      return { inc, insured, insDed, taxable, tax, insNet, taxNet, pay: insNet + taxNet };
    };
    const line = (label, v, cls = '', strong) => el('div', { className: 'st-line ' + cls }, [el('span', { text: label }), el(strong ? 'b' : 'span', { className: v < 0 ? 'neg' : '', text: signed(v) })]);
    const paint = () => {
      const f = figures();
      box.replaceChildren(...[
        line('인센 합계 (세전)', f.inc, '', true),
        line(`① 4대보험 처리분 (가입 보수)`, f.insured, '', true),
        el('div', { className: 'st-line sub' }, [el('span', { text: '4대보험 근로자 공제 (급여대장 금액 입력)' }), insIn]),
        line('4대보험분 실수령', f.insNet, 'sub'),
        line(`② 3.3% 처리분 (인센 − ${won(f.insured)})`, f.taxable, '', true),
        line('원천세 3.3% (소득세 3% + 지방세 0.3%)', -f.tax, 'sub'),
        line('3.3% 실지급', f.taxNet, 'sub'),
        line('실지급 합계 (①+②)', f.pay, 'total', true),
        f.taxable < 0 ? el('div', { className: 'st-note', text: `인센이 4대보험 가입 보수보다 ${won(-f.taxable)}원 적어 3.3% 처리분이 마이너스입니다.` }) : null,
      ].filter(Boolean));
    };
    insIn.addEventListener('input', paint); paint();
    const confirmBtn = el('button', { className: 'btn primary', type: 'button', text: C ? '다시 확정' : '정산 확정', onclick: async () => {
      if (C && !confirm('이미 확정된 정산입니다. 지금 숫자로 다시 확정할까요?')) return;
      const f = figures();
      const { error } = await sb.from('settlements').upsert({ person: P.name, month: S.month, incentive_won: f.inc, insured_won: f.insured, ins_deduct_won: f.insDed, taxable_won: f.taxable, tax_won: f.tax, pay_won: f.pay,
        detail: { rate: P.rate, rows: rows.map((r) => ({ id: r.id, company: r.company_name, amount: r.amount_won, exec: r.exec_won, incentive: incentive(r) })) }, confirmed_at: new Date().toISOString(), confirmed_by: me, paid_at: C?.paid_at || null }, { onConflict: 'person,month' });
      if (error) { toast('확정 실패: ' + error.message); return; }
      toast(`${S.month} 정산 확정`); draw();
    } });
    const paidIn = fi({ type: 'date', value: C?.paid_at || '' });
    const paidBtn = C ? el('button', { className: 'btn', type: 'button', text: '입금일 저장', onclick: async () => {
      const { error } = await sb.from('settlements').update({ paid_at: paidIn.value || null }).eq('id', C.id); if (error) { toast('저장 실패: ' + error.message); return; } toast('입금일 저장'); draw();
    } }) : null;
    const rateIn = fi({ inputMode: 'decimal', value: Math.round(P.rate * 1000) / 10 }), baseIn = fi({ inputMode: 'numeric', value: Math.round(P.insured_base_won).toLocaleString() });
    const savePerson = el('button', { className: 'btn sm', type: 'button', text: '저장', onclick: async () => {
      const { error } = await sb.from('settle_people').update({ rate: (num(rateIn.value) || 0) / 100, insured_base_won: num(baseIn.value) || 0 }).eq('name', P.name);
      if (error) { toast('저장 실패: ' + error.message); return; } toast('정산 기준 저장 (새 결제부터 적용)'); draw();
    } });
    const personSel = el('div', { className: 'st-seg' }, S.people.map((p) => el('button', { type: 'button', className: p.name === P.name ? 'on' : '', text: p.name, onclick: () => { S.person = p.name; draw(); } })));
    const noExec = rows.filter((r) => r.kind === '결제' && r.amount_won > 0 && r.exec_won == null && r.incentive_fixed_won == null).length;
    return [
      el('div', { className: 'co-filters' }, [personSel, el('div', { className: 'st-people' }, ['인센율', rateIn, '% · 4대보험 가입 보수', baseIn, '원', savePerson])]),
      el('div', { className: 'st-grid2' }, [
        el('div', { className: 'card' }, [
          el('div', { className: 'st-head' }, [el('h3', { text: `${P.name} · ${S.month.replace('-', '년 ')}월 결제 ${rows.length}건` }), noExec ? el('span', { className: 'st-tag neg', text: `실행비 미입력 ${noExec}건` }) : null].filter(Boolean)),
          el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl st-tbl' }, [
            el('thead', {}, el('tr', {}, [th('결제일'), th('업체'), th('원금', 1), th('실행원금', 1), th('차액', 1), th('율', 1), th('인센', 1), th('')])),
            el('tbody', {}, rows.length ? rows.map((r) => el('tr', { className: 'click', onclick: () => rowModal(r) }, [td(r.paid_on.slice(5).replace('-', '/'), 'k'),
              el('td', {}, [r.company_name || '—', r.kind !== '결제' && el('span', { className: 'st-tag neg', text: r.kind })].filter(Boolean)),
              ntd(base(r)), el('td', { className: 'num' }, el('button', { className: 'ex-btn' + (r.exec_won != null ? ' set' : ''), type: 'button', text: r.exec_won != null ? won(execBase(r)) : '계산', onclick: (e) => { e.stopPropagation(); calcModal(r); } })),
              ntd(base(r) - execBase(r)), td(r.incentive_fixed_won != null ? '고정' : r.incentive_rate != null ? Math.round(r.incentive_rate * 100) + '%' : '—', 'num sub'), ntd(incentive(r)), editCell(r)]))
              : [el('tr', {}, el('td', { colSpan: 8, className: 'empty', text: '이 달 결제가 없습니다.' }))]),
          ])),
        ]),
        el('div', { className: 'card' }, [
          el('div', { className: 'st-head' }, [el('h3', { text: '정산' }), C ? el('span', { className: 'st-badge', text: `확정 ${kst(C.confirmed_at)}${C.paid_at ? ' · 입금 ' + C.paid_at : ''}` }) : el('span', { className: 'st-badge wait', text: '미확정' })]),
          box,
          el('div', { className: 'st-acts' }, [C ? el('label', { className: 'st-people' }, ['입금일', paidIn]) : null, paidBtn, confirmBtn].filter(Boolean)),
        ]),
      ]),
      (hist.data || []).length ? el('div', { className: 'card' }, [
        el('div', { className: 'st-head' }, el('h3', { text: '확정 이력' })),
        el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl st-tbl' }, [
          el('thead', {}, el('tr', {}, [th('월'), th('인센 합계', 1), th('4대보험분', 1), th('3.3% 처리분', 1), th('원천세', 1), th('실지급', 1), th('입금일')])),
          el('tbody', {}, hist.data.map((h) => el('tr', { className: 'click', onclick: () => { S.month = h.month; draw(); } }, [td(h.month), ntd(h.incentive_won), ntd(h.insured_won - h.ins_deduct_won), ntd(h.taxable_won), ntd(-h.tax_won), ntd(h.pay_won), td(h.paid_at || '미입금', 'sub')]))),
        ])),
      ]) : null,
    ].filter(Boolean);
  }

  // ── 정산계산기: 실비(단가 × 수량) → 원금 − 실비 → 인센 ──
  function calculator(r, onApply) {
    const prices = S.prices.filter((p) => p.active);
    const prev = new Map((r?.exec_items || []).map((x) => [x.name, x]));
    const amount = fi({ inputMode: 'numeric', value: r?.amount_won != null ? Math.round(r.amount_won).toLocaleString() : '', placeholder: '1,584,000' });
    const rate = fi({ inputMode: 'decimal', value: r?.incentive_rate != null ? Math.round(r.incentive_rate * 1000) / 10 : (S.people[0] ? Math.round(S.people[0].rate * 1000) / 10 : 60) });
    const items = prices.map((p) => ({ name: p.name, unit: prev.get(p.name)?.unit ?? Number(p.unit_won), qty: prev.get(p.name)?.qty ?? '' }));
    (r?.exec_items || []).filter((x) => !prices.some((p) => p.name === x.name)).forEach((x) => items.push({ ...x }));
    const tbody = el('tbody'), out = el('div', { className: 'st-calc cc-sum' });
    const fmt = (v) => { const d = String(v).replace(/[^\d]/g, ''); return d ? Number(d).toLocaleString() : ''; };
    const rowEl = (it) => {
      const tot = el('td', { className: 'num' });
      const unit = fi({ inputMode: 'numeric', value: Number(it.unit || 0).toLocaleString(), readOnly: !it.custom, className: 'fi' + (it.custom ? '' : ' ro'), tabIndex: it.custom ? 0 : -1 }), qty = fi({ inputMode: 'numeric', value: it.qty === '' ? '' : Number(it.qty).toLocaleString(), placeholder: '0' });
      const name = it.custom ? fi({ className: 'fi nm', value: it.name || '', placeholder: '항목명' }) : null;
      const unlock = it.custom ? null : el('button', { className: 'ed-btn', type: 'button', text: '수정', title: '이번 계산에서만 단가 바꾸기 (단가표는 그대로)', onclick: () => { unit.readOnly = false; unit.classList.remove('ro'); unit.tabIndex = 0; unit.focus(); unit.select(); unlock.remove(); } });
      const tr = el('tr', {}, [name ? el('td', {}, name) : td(it.name), el('td', {}, el('div', { className: 'cc-unit' }, [unit, unlock].filter(Boolean))), el('td', {}, qty), tot]);
      const upd = () => { it.unit = num(unit.value) || 0; it.qty = num(qty.value) ?? ''; if (name) it.name = name.value.trim(); const t = (it.unit || 0) * (Number(it.qty) || 0); tot.textContent = t ? won(t) : '-'; tr.classList.toggle('used', !!t); paint(); };
      unit.addEventListener('input', () => { unit.value = fmt(unit.value); upd(); }); qty.addEventListener('input', () => { qty.value = fmt(qty.value); upd(); }); name?.addEventListener('input', upd);
      const t = (it.unit || 0) * (Number(it.qty) || 0); tot.textContent = t ? won(t) : '-'; tr.classList.toggle('used', !!t);
      return tr;
    };
    const figures = () => {
      const execNet = items.reduce((s, it) => s + (Number(it.unit) || 0) * (Number(it.qty) || 0), 0);
      const amt = num(amount.value) || 0, b = amt / 1.1, diff = b - execNet, rt = (num(rate.value) || 0) / 100;
      return { execNet, amt, b, diff, rt, inc: Math.round(diff * rt) };
    };
    const line = (l, v, cls = '', strong) => el('div', { className: 'st-line ' + cls }, [el('span', { text: l }), el(strong ? 'b' : 'span', { className: v < 0 ? 'neg' : '', text: signed(v) })]);
    function paint() {
      const f = figures();
      out.replaceChildren(line('결제금액 (VAT 포함)', f.amt), line('원금 (÷1.1)', f.b, 'sub'), line('실비 합계 (단가 × 수량)', -f.execNet, '', true), line('원금 − 실비', f.diff, '', true), line(`인센 (${Math.round(f.rt * 1000) / 10}%)`, f.inc, 'total', true));
    }
    amount.addEventListener('input', () => { amount.value = fmt(amount.value); paint(); }); rate.addEventListener('input', paint);
    tbody.replaceChildren(...items.map(rowEl));
    const addBtn = el('button', { className: 'btn sm', type: 'button', text: '+ 항목 직접 추가', onclick: () => { const it = { name: '', unit: 0, qty: '', custom: true }; items.push(it); tbody.append(rowEl(it)); } });
    paint();
    const view = [
      el('div', { className: 'dr-grid' }, [lab('결제금액 (VAT 포함)', amount), lab('인센율 (%)', rate)]),
      el('div', { className: 'card' }, el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl st-tbl cc-tbl' }, [el('thead', {}, el('tr', {}, [th('품목'), th('단가', 1), th('수량', 1), th('합계', 1)])), tbody]))),
      addBtn,
      el('div', { className: 'card' }, out),
      el('div', { className: 'hint', text: '단가는 VAT 별도 실비 기준입니다. 원장에 적용하면 실행비(VAT 포함) = 실비 합계 × 1.1 로 저장됩니다.' }),
    ];
    const apply = onApply ? async () => {
      const f = figures();
      const used = items.filter((it) => it.name && Number(it.qty)).map((it) => ({ name: it.name, unit: Number(it.unit) || 0, qty: Number(it.qty) }));
      await onApply({ exec_won: Math.round(f.execNet * 1.1), exec_items: used, amount_won: f.amt || null, incentive_rate: f.rt });
    } : null;
    return { view, apply };
  }
  async function calcView() {
    await Promise.all([loadPrices(), S.people.length ? null : loadPeople()]);
    const { view } = calculator(null, null);
    return [el('div', { className: 'hint', text: '패키지 정산: 결제 원금에서 실비(단가 × 수량)를 빼고 인센율을 곱합니다. 원장 줄의 [계산] 버튼으로 열면 결과를 그 줄에 저장할 수 있습니다.' }), ...view];
  }
  async function calcModal(r) {
    await Promise.all([loadPrices(), S.people.length ? null : loadPeople()]);
    const { view, apply } = calculator(r, async (v) => {
      const patch = { exec_won: v.exec_won, exec_items: v.exec_items, incentive_rate: v.incentive_rate };
      if (v.amount_won != null && v.amount_won !== Number(r.amount_won) && !r.contract_id) patch.amount_won = v.amount_won;
      const { error } = await sb.from('ledger').update(patch).eq('id', r.id);
      if (error) { toast('저장 실패: ' + error.message); return; }
      layer.remove(); toast(`실행비 ${won(v.exec_won)}원 저장`); draw();
    });
    const layer = modal(`정산계산기 · ${r.company_name || ''}`, view, [el('button', { className: 'btn lg ghost', type: 'button', text: '닫기', onclick: () => layer.remove() }), el('button', { className: 'btn primary lg', type: 'button', text: '원장에 적용', onclick: apply })], true);
  }

  // ── 단가표 ──
  async function pricesView() {
    const list = await loadPrices();
    const tbody = el('tbody');
    // 보기 줄 ↔ 수정 줄: [수정]을 눌러야 입력칸이 열림 (실수로 단가가 바뀌지 않게)
    const viewRow = (p) => el('tr', {}, [td(p.name), td(Number(p.unit_won || 0).toLocaleString(), 'num'),
      el('td', {}, el('span', { className: 'st-tag' + (p.active === false ? ' neg' : ''), text: p.active === false ? '사용 안 함' : '사용' })),
      el('td', { className: 'num' }, el('button', { className: 'btn sm', type: 'button', text: '수정', onclick: (e) => e.target.closest('tr').replaceWith(editRow(p)) }))]);
    const editRow = (p) => {
      const name = fi({ value: p.name || '', placeholder: '품목' }), unit = fi({ inputMode: 'numeric', value: p.unit_won != null ? Number(p.unit_won).toLocaleString() : '' }), act = el('input', { type: 'checkbox', checked: p.active !== false });
      unit.addEventListener('input', () => { const d = unit.value.replace(/[^\d]/g, ''); unit.value = d ? Number(d).toLocaleString() : ''; });
      const save = el('button', { className: 'btn sm primary', type: 'button', text: '저장', onclick: async () => {
        const row = { name: name.value.trim(), unit_won: num(unit.value) || 0, active: act.checked, sort: p.sort ?? list.length + 1 };
        if (!row.name) { toast('품목명을 입력하세요'); return; }
        save.disabled = true;
        const { error } = p.id ? await sb.from('settle_prices').update(row).eq('id', p.id) : await sb.from('settle_prices').insert(row);
        save.disabled = false;
        if (error) { toast('저장 실패: ' + error.message); return; } toast('저장됨'); draw();
      } });
      const cancel = el('button', { className: 'btn sm ghost', type: 'button', text: '취소', onclick: (e) => { const tr = e.target.closest('tr'); if (p.id) tr.replaceWith(viewRow(p)); else tr.remove(); } });
      const tr = el('tr', { className: 'editing' }, [el('td', {}, name), el('td', { className: 'num' }, unit), el('td', {}, el('label', { className: 'st-people' }, [act, '사용'])), el('td', { className: 'num' }, el('span', { className: 'st-btns' }, [cancel, save]))]);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); if (e.key === 'Escape') cancel.click(); });
      queueMicrotask(() => (p.id ? unit : name).focus());
      return tr;
    };
    const rowEl = viewRow;
    tbody.replaceChildren(...list.map(rowEl));
    return [
      el('div', { className: 'hint', text: '정산계산기에 쓰는 실비 단가 (VAT 별도). 품목 오른쪽 [수정]을 눌러 바꾸고 [저장]하세요 (Enter 저장 · Esc 취소). 안 쓰는 품목은 "사용"을 끄면 계산기에서 빠집니다.' }),
      el('div', { className: 'card' }, el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl st-tbl cc-tbl' }, [el('thead', {}, el('tr', {}, [th('품목'), th('단가 (원)', 1), th(''), th('')])), tbody]))),
      el('button', { className: 'btn', type: 'button', text: '+ 품목 추가', onclick: () => tbody.append(editRow({})) }),
    ];
  }

  // ── 엑셀 가져오기: "무이 영업사원 결제건" (월별 시트, 25년 1~3월은 '소속' 칸 있는 예전 양식) ──
  function importModal() {
    const file = el('input', { type: 'file', accept: '.xlsx,.xls' });
    const out = el('div', { className: 'st-imp' });
    let parsed = null;
    const go = el('button', { className: 'btn primary lg', type: 'button', text: '저장', disabled: true, onclick: save });
    file.onchange = async () => {
      out.replaceChildren(el('div', { className: 'hint', text: '읽는 중…' })); go.disabled = true;
      try { await loadLib(XLSX_SRC); parsed = await parse(file.files[0]); }
      catch (e) { out.replaceChildren(el('div', { className: 'err', text: e.message })); return; }
      const byM = {}; parsed.rows.forEach((r) => { byM[r.settle_month] = (byM[r.settle_month] || 0) + 1; });
      out.replaceChildren(
        el('div', { className: 'hint', text: `시트 ${parsed.sheets}개 · ${parsed.rows.length}줄 · 업체 연결 ${parsed.rows.filter((r) => r.company_id).length}줄 · 날짜 확인 필요 ${parsed.warn.length}줄` }),
        el('div', { className: 'st-people', text: Object.entries(byM).sort().map(([m, n]) => `${m} ${n}`).join(' · ') }),
        parsed.warn.length ? el('div', { className: 'hint', text: '시트 월과 결제일이 다른 줄(정산 월은 시트 기준): ' + parsed.warn.slice(0, 8).join(', ') }) : null,
        el('div', { className: 'hint', text: '같은 파일을 다시 넣으면 같은 줄은 덮어씁니다 (중복 안 생김).' }),
      );
      go.disabled = !parsed.rows.length;
    };
    async function save() {
      go.disabled = true; go.textContent = '저장 중…';
      for (let i = 0; i < parsed.rows.length; i += 200) {
        const { error } = await sb.from('ledger').upsert(parsed.rows.slice(i, i + 200), { onConflict: 'import_key' });
        if (error) { out.append(el('div', { className: 'err', text: '저장 실패: ' + error.message })); go.disabled = false; go.textContent = '다시 저장'; return; }
      }
      layer.remove(); toast(`${parsed.rows.length}줄 저장`); draw();
    }
    const layer = modal('엑셀 가져오기 · 영업사원 결제건', [el('div', { className: 'hint', text: '월별 시트(예: "26년 5월")의 결제 줄을 매출 원장으로 가져옵니다. 오른쪽 요약 칸은 읽지 않습니다.' }), file, out],
      [el('button', { className: 'btn lg ghost', type: 'button', text: '취소', onclick: () => layer.remove() }), go]);
  }
  async function parse(f) {
    if (!f) throw new Error('파일을 고르세요');
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true, cellFormula: true });
    // 업체 연결용 이름 키
    const co = new Map(), dupe = new Set();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('companies').select('id,name_key').range(from, from + 999);
      if (error) throw error;
      (data || []).forEach((c) => { if (co.has(c.name_key)) dupe.add(c.name_key); co.set(c.name_key, c.id); });
      if (!data || data.length < 1000) break;
    }
    const rows = [], warn = []; let sheets = 0;
    const iso = (d) => d instanceof Date ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : null;
    for (const name of wb.SheetNames) {
      const m = name.match(/(\d{2})년\s*(\d{1,2})월/); if (!m) continue;
      const month = `20${m[1]}-${m[2].padStart(2, '0')}`;
      const ws = wb.Sheets[name]; const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
      const val = (r, c) => { const x = cell(r, c); return x ? x.v : null; };
      // 2행 머리글로 칸 찾기 (양식이 달라도 동작)
      const H = {}; for (let c = 0; c <= Math.min(ref.e.c, 30); c++) { const h = String(val(1, c) ?? '').trim(); if (h && H[h] == null) H[h] = c; }
      if (H['결제일자'] == null || H['업체명'] == null) continue;
      sheets++;
      const col = (h) => H[h];
      for (let r = 2; r <= ref.e.r; r++) {
        const d = val(r, col('결제일자')); if (!(d instanceof Date)) continue;
        let owner = val(r, col('영업사원')); const company = val(r, col('업체명'));
        if (!owner && !company) continue;
        owner = owner == null ? null : String(owner).trim();
        let branch = H['소속'] != null ? val(r, col('소속')) : null;
        const ab = owner && owner.match(/^(.+?)([AB])$/); if (ab) { branch = [branch, ab[2] + '팀'].filter(Boolean).join(' '); owner = ab[1]; }
        const item = val(r, col('광고품목')); const itemS = item == null ? null : String(item).trim();
        const amount = val(r, col('총결제금액')), exec = val(r, col('실행비용'));
        const rate = val(r, col('인센')); const incCell = cell(r, col('인센금액'));
        const fixed = incCell && !incCell.f && typeof incCell.v === 'number' ? incCell.v : null;
        const kind = /환불/.test(itemS || '') ? '환불' : /환수/.test(itemS || '') ? '환수' : (amount == null && fixed != null) ? '지급' : '결제';
        const paid = iso(d); if (paid.slice(0, 7) !== month) warn.push(`${name} ${r + 1}행`);
        const nk = keyOf(company);
        rows.push({
          import_key: `xls:${name}:${r + 1}`, paid_on: paid, settle_month: month, branch: branch ? String(branch).trim() : null, owner_name: owner,
          company_name: company == null ? null : String(company).trim(), company_id: nk && co.has(nk) && !dupe.has(nk) ? co.get(nk) : null,
          item: itemS, kind, in_revenue: val(r, col('총 매출')) === '포함', in_promo: val(r, col('프모 매출')) === '포함',
          pay_method: val(r, col('결제방식')) == null ? null : String(val(r, col('결제방식'))), tax_invoice: val(r, col('세금계산서')) == null ? null : String(val(r, col('세금계산서'))),
          amount_won: typeof amount === 'number' ? amount : null, exec_won: typeof exec === 'number' ? exec : null,
          incentive_rate: typeof rate === 'number' ? rate : null, incentive_fixed_won: fixed,
          checked: val(r, col('확인/입금')) == null ? null : String(val(r, col('확인/입금'))), memo: val(r, col('특이사항')) == null ? null : String(val(r, col('특이사항'))), created_by: me,
        });
      }
    }
    if (!sheets) throw new Error('"26년 5월" 같은 월별 시트를 찾지 못했습니다');
    return { rows, warn, sheets };
  }

  window.CRM_SETTLE = { mount };
})();
