import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// 매일 아침 카카오워크로 담당자별 오늘 할 일을 보낸다. pg_cron(daily-digest)이 평일 09:00 KST에 호출한다.
// 문의: 내 담당 중 다음 연락일이 오늘이거나 지난 건 + 내 담당 신규 + 모두에게 공통으로 미배정 신규
// 계약 업체(영업 또는 관리 담당 기준): 체험단 일정(모집·발표·마감·2차마감, 오늘 + 밀린 것) · 발표일 미정 · 포스팅 마감 지남 · 재계약 임박(30일)
//   · 실행 소진(남은 20% 이하) · 실행 수량 입력 필요(14일) · 결제 체크리스트 미완료 · 확인 필요
// 체험단 일정 계산은 admin의 assets/crm-calendar.js campEvents와 같다:
//   모집 = 모집일(또는 옮긴 날짜), 발표 = 정해진 날짜(camp_tasks.due_on)만 · 추적 시작일 전 회차는 모집일 + 간격,
//   마감 = 발표 + (마감 − 발표 간격) 또는 옮긴 날짜, 2차마감 = 저장된 행. 완료는 제외. 할 일이 없으면 안 보낸다.
//   (v8) 캘린더에서 '이번 회차만 삭제'한 모집(camp_tasks 모집 skipped)은 그 회차 전체 제외
//   (v9) 발표 달력에서 삭제한 발표(camp_tasks 발표 skipped)는 그 회차 발표·마감 제외
//   (v10) 마감 달력에서 삭제한 마감(camp_tasks 마감 skipped)은 마감만 제외
const KW = 'https://api.kakaowork.com/v1';
const ADMIN_URL = 'https://www.muyi.co.kr/admin';
const kstDay = (d: string | number | Date) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };
const addMonth = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };

Deno.serve(async () => {
  const key = Deno.env.get('KAKAOWORK_BOT_KEY');
  if (!key) return new Response('not configured');
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = kstDay(Date.now());
  const addD = (n: number) => kstDay(Date.now() + n * 864e5);
  const COLS = 'id,name,sales_owner,manager_owner,sales_owner_name,manager_owner_name,next_renew_due,recruit_days';
  const [{ data: rows }, { data: admins }, { data: renew }, { data: running }, { data: rdLate }, { data: cts }, { data: rev }, { data: cfgRows }] = await Promise.all([
    sb.from('contacts').select('id,created_at,name,phone,status,assignee,next_contact_at').not('status', 'in', '("계약","종료")').order('created_at').limit(2000),
    sb.from('admins').select('user_id,name,email').not('email', 'is', null),
    sb.from('companies').select(COLS).eq('stage', '결제').eq('run_status', '진행 중').gte('next_renew_due', addD(-30)).lte('next_renew_due', addD(30)).order('next_renew_due').limit(300),
    sb.from('companies').select(COLS).eq('stage', '결제').eq('run_status', '진행 중').limit(2000),
    sb.from('rounds').select('id,company_id,round_label,round_no,deadline').lt('deadline', today).neq('state', '완료').limit(500),
    sb.from('contracts').select('id,company_id,kind,paid_at,handover_at,tax_invoice').gte('paid_at', addD(-90)).limit(500),
    sb.from('companies').select('id,name,sales_owner,manager_owner,sales_owner_name,manager_owner_name,review_reason').eq('needs_review', true).eq('archived', false).limit(3000),
    sb.from('crm_settings').select('key,value').in('key', ['camp_offsets', 'camp_start']),
  ]);
  const cfg = Object.fromEntries((cfgRows || []).map((x: any) => [x.key, x.value]));
  const off: Record<string, number> = { 발표: 7, 마감: 21, '2차마감': 7, ...(cfg.camp_offsets || {}) };
  const gap = (off['마감'] || 0) - (off['발표'] || 0);
  const start = String(cfg.camp_start || today).replace(/"/g, '');
  const maxOff = Math.max(off['발표'] || 0, (off['마감'] || 0) + (off['2차마감'] || 0), 0);
  const from = start > addDays(today, -60) ? start : addDays(today, -60);

  // 체험단 일정 (오늘 + 밀린 것, 완료 제외) + 발표일 미정
  const { data: tk } = await sb.from('camp_tasks').select('company_id,cycle_on,step,due_on,done_at,skipped').gte('cycle_on', addDays(from, -maxOff - 62)).lte('cycle_on', today).limit(5000);
  const tasks = new Map((tk || []).map((t: any) => [`${t.company_id}|${t.cycle_on}|${t.step}`, t]));
  const runById = new Map((running || []).map((c: any) => [c.id, c]));
  const camp: any[] = [], pend: any[] = [];
  for (let m = addDays(from, -maxOff - 31).slice(0, 7); m <= today.slice(0, 7); m = addMonth(m, 1)) {
    const [y, mo] = m.split('-').map(Number), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    for (const c of (running || []).filter((x: any) => (x.recruit_days || []).length)) for (const d of new Set((c.recruit_days as number[]).map((x) => Math.min(Number(x) || 1, dim)))) {
      const cycle = `${m}-${pad(d)}`;
      if ((tasks.get(`${c.id}|${cycle}|모집`) as any)?.skipped) continue; // 캘린더에서 이번 회차만 삭제한 모집
      const tM: any = tasks.get(`${c.id}|${cycle}|모집`), tA: any = tasks.get(`${c.id}|${cycle}|발표`), tD: any = tasks.get(`${c.id}|${cycle}|마감`);
      const legacy = cycle < start || (tA && !tA.due_on);
      const aOff = !!tA?.skipped; // 캘린더에서 삭제한 발표: 발표·마감 없음
      const ann = aOff ? null : tA?.due_on || (legacy ? addDays(cycle, off['발표'] || 0) : null);
      const dl = aOff || tD?.skipped ? null : tD?.due_on || (ann ? addDays(ann, gap) : null); // 마감만 삭제한 회차도 제외
      const push = (step: string, due: string | null, t: any) => { if (due && due >= from && due <= today && !t?.done_at) camp.push({ co: c, step, due }); };
      push('모집', tM?.due_on || cycle, tM); push('발표', ann, tA); push('마감', dl, tD);
      if (!ann && !aOff && cycle >= start && cycle <= today) pend.push({ co: c, recruit: tM?.due_on || cycle });
    }
  }
  (tk || []).filter((t: any) => t.step === '2차마감' && !t.done_at && !(tasks.get(`${t.company_id}|${t.cycle_on}|모집`) as any)?.skipped && t.due_on && t.due_on >= from && t.due_on <= today && runById.has(t.company_id))
    .forEach((t: any) => camp.push({ co: runById.get(t.company_id), step: '2차마감', due: t.due_on }));
  camp.sort((a, b) => a.due.localeCompare(b.due));

  // 실행 소진 · 수량 입력 필요 (최근 계약의 실행 항목 기준)
  const ids = (running || []).map((c: any) => c.id);
  const byId = runById;
  const latest: Record<string, any> = {}; const dls: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const [a, b] = await Promise.all([
      sb.from('contracts').select('id,company_id,paid_at').in('company_id', part),
      sb.from('deliverables').select('company_id,contract_id,item,planned,done,updated_at').in('company_id', part).gt('planned', 0),
    ]);
    (a.data || []).forEach((c: any) => { const l = latest[c.company_id]; if (!l || String(c.paid_at || '') > String(l.paid_at || '')) latest[c.company_id] = c; });
    dls.push(...(b.data || []));
  }
  const exec: any[] = [], touch: Record<string, string> = {};
  dls.filter((d) => !latest[d.company_id] || !d.contract_id || d.contract_id === latest[d.company_id].id).forEach((d) => {
    const left = (Number(d.planned) || 0) - (Number(d.done) || 0);
    if (left <= Number(d.planned) * 0.2) exec.push({ co: byId.get(d.company_id), d, left });
    if (!touch[d.company_id] || d.updated_at > touch[d.company_id]) touch[d.company_id] = d.updated_at;
  });
  const cut = new Date(Date.now() - 14 * 864e5).toISOString();
  const stale = Object.entries(touch).filter(([, t]) => t < cut).map(([id, t]) => ({ co: byId.get(id), t }));

  const lateIds = (rdLate || []).map((r: any) => r.id);
  const { data: ros } = lateIds.length ? await sb.from('roster').select('round_id,post_url').in('round_id', lateIds) : { data: [] as any[] };
  const missing: Record<string, number> = {}; (ros || []).forEach((p: any) => { if (!p.post_url) missing[p.round_id] = (missing[p.round_id] || 0) + 1; });
  const openCts = (cts || []).filter((c: any) => !c.handover_at || c.tax_invoice === '발행 필요');
  const known = new Map<string, any>([...(renew || []), ...(running || [])].map((c: any) => [c.id, c]));
  const ask = [...new Set([...(rdLate || []), ...openCts].map((x: any) => x.company_id))].filter((id) => !known.has(id));
  if (ask.length) { const { data } = await sb.from('companies').select(COLS).in('id', ask); (data || []).forEach((c: any) => known.set(c.id, c)); }
  const co = (id: string) => known.get(id);

  const line = (r: any, extra = '') => `· ${r.name || '(이름 없음)'} ${r.phone || ''}${extra}`;
  const unassigned = (rows || []).filter((r: any) => r.status === '신규' && !r.assignee);
  const kw = (path: string, init?: RequestInit) => fetch(KW + path, {
    ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  }).then((r) => r.json()).catch(() => ({}));
  const dd = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);

  const result: string[] = [];
  for (const a of admins || []) {
    const mine = (c: any) => c && (c.sales_owner === a.user_id || c.manager_owner === a.user_id || (a.name && (c.sales_owner_name === a.name || c.manager_owner_name === a.name)));
    const due = (rows || []).filter((r: any) => r.assignee === a.user_id && r.next_contact_at && kstDay(r.next_contact_at) <= today);
    const mineNew = (rows || []).filter((r: any) => r.assignee === a.user_id && r.status === '신규');
    const cp = camp.filter((e) => mine(e.co));
    const pd = pend.filter((e) => mine(e.co));
    const late = (rdLate || []).filter((r: any) => missing[r.id] && mine(co(r.company_id)));
    const ren = (renew || []).filter(mine);
    const ex = exec.filter((x) => mine(x.co));
    const st = stale.filter((x) => mine(x.co));
    const chk = openCts.filter((c: any) => mine(co(c.company_id)));
    const rv = (rev || []).filter(mine);
    const daysLate = (r: any) => Math.round((Date.parse(today) - Date.parse(kstDay(r.next_contact_at))) / 864e5);
    const sections = [
      due.length && [`오늘 연락할 문의 ${due.length}건`, ...due.slice(0, 10).map((r: any) => line(r, daysLate(r) > 0 ? ` (${daysLate(r)}일 지남)` : ''))],
      mineNew.length && [`내 담당 신규 ${mineNew.length}건 (아직 통화 전)`, ...mineNew.slice(0, 10).map((r: any) => line(r))],
      unassigned.length && [`미배정 신규 ${unassigned.length}건`, ...unassigned.slice(0, 10).map((r: any) => line(r))],
      cp.length && [`체험단 일정 ${cp.length}건 (오늘 ${cp.filter((e) => e.due === today).length} · 밀림 ${cp.filter((e) => e.due < today).length})`, ...cp.slice(0, 12).map((e) => `· ${e.co.name} ${e.step}${e.due < today ? ` (${-dd(e.due)}일 지남)` : ''}`), ...(cp.length > 12 ? [`· 외 ${cp.length - 12}건은 CRM 캘린더에서`] : [])],
      pd.length && [`발표일 정하기 ${pd.length}건 (캘린더 오른쪽 '발표일 미정'에서 끌어 놓기)`, ...pd.slice(0, 10).map((e) => `· ${e.co.name} (모집 ${e.recruit.slice(5).replace('-', '/')})`)],
      late.length && [`포스팅 마감 지남 ${late.length}건`, ...late.slice(0, 10).map((r: any) => `· ${co(r.company_id).name} ${r.round_label || r.round_no}회차 — 포스팅 없는 블로거 ${missing[r.id]}명`)],
      ren.length && [`재계약 임박 ${ren.length}곳`, ...ren.slice(0, 10).map((c: any) => { const d = dd(c.next_renew_due); return `· ${c.name} (${d < 0 ? -d + '일 지남' : d === 0 ? '오늘' : 'D-' + d})`; })],
      ex.length && [`실행 소진 ${ex.length}건 (재계약 제안)`, ...ex.slice(0, 10).map((x) => `· ${x.co.name} ${x.d.item} ${x.left <= 0 ? '소진' : `남은 ${x.left}/${x.d.planned}`}`)],
      st.length && [`실행 수량 입력 필요 ${st.length}곳 (14일 넘게 안 고침)`, ...st.slice(0, 10).map((x) => `· ${x.co.name}`)],
      rv.length && [`확인 필요 ${rv.length}곳 (상태·구분 정리 후 [확인 완료])`, ...rv.slice(0, 5).map((c: any) => `· ${c.name} — ${c.review_reason || '확인 필요'}`), ...(rv.length > 5 ? [`· 외 ${rv.length - 5}곳은 CRM 오늘 할 일에서`] : [])],
      chk.length && [`결제 체크리스트 미완료 ${chk.length}건`, ...chk.slice(0, 10).map((c: any) => `· ${co(c.company_id).name} — ${[!c.handover_at && '인수인계 확인 전', c.tax_invoice === '발행 필요' && '세금계산서 발행'].filter(Boolean).join(', ')}`)],
    ].filter(Boolean) as string[][];
    if (!sections.length) { result.push(`${a.name}: 할 일 없음`); continue; }
    const head = `[오늘 할 일] ${today.slice(5).replace('-', '/')} · ${a.name || ''}`;
    const text = [head, ...sections.map((s) => s.join('\n')), ADMIN_URL + '#today'].join('\n\n');

    const u = await kw(`/users.find_by_email?email=${encodeURIComponent(a.email)}`);
    if (!u.success) { result.push(`${a.name}: 카카오워크 사용자 없음`); console.error('KW_FIND_USER_ERROR', a.email, JSON.stringify(u)); continue; }
    const conv = await kw('/conversations.open', { method: 'POST', body: JSON.stringify({ user_id: u.user.id }) });
    if (!conv.success) { result.push(`${a.name}: 방 열기 실패`); console.error('KW_OPEN_ERROR', JSON.stringify(conv)); continue; }
    const blocks = [
      { type: 'header', text: '오늘 할 일', style: 'blue' },
      ...sections.map((s) => ({ type: 'text', text: `*${s[0]}*\n${s.slice(1).join('\n')}`, markdown: true })),
      { type: 'button', text: 'CRM 열기', style: 'primary', action_type: 'open_system_browser', value: ADMIN_URL + '#today' },
    ];
    let sent = await kw('/messages.send', { method: 'POST', body: JSON.stringify({ conversation_id: conv.conversation.id, text, blocks }) });
    if (!sent.success) sent = await kw('/messages.send', { method: 'POST', body: JSON.stringify({ conversation_id: conv.conversation.id, text }) });
    result.push(`${a.name}: ${sent.success ? '보냄' : '실패'}`);
    if (!sent.success) console.error('KW_SEND_ERROR', JSON.stringify(sent));
  }
  console.log('DIGEST', result.join(' | '));
  return new Response(result.join('\n'));
});
