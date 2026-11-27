// 체험단 회차 번호 규칙 — 한 곳에만 둔다 (2026-11-27~)
// 쓰는 곳: assets/crm-calendar.js fillRounds(모집·발표·마감·2차마감 달력, 오늘 업무, 상세) · Edge Function rn-import roundOf(리뷰노트 북마크)
//   rn-import는 이 파일을 그대로 복사한 supabase/functions/rn-import/rounds.js를 쓴다 → 고친 뒤 `node scripts/sync-rounds.js` (테스트가 같은지 확인)
// 일반 스크립트(브라우저 <script>, Deno side-effect import, Node require) 어디서나 읽히게 globalThis.CRM_ROUNDS에 붙인다. 바깥 변수 쓰지 말 것
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const addMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const dim = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
  const days = (co) => (co.recruit_days || []).map(Number).filter(Boolean);
  // co의 매월 모집일 회차 중 a < c ≤ b (a 없으면 빈 Set)
  function cyclesIn(co, a, b) {
    const out = new Set(), ds = days(co); if (!ds.length || !a || !b) return out;
    for (let m = a.slice(0, 7); m <= b.slice(0, 7); m = addMonth(m, 1)) { const n = dim(m); ds.forEach((d) => { const c = `${m}-${pad(Math.min(d, n))}`; if (c > a && c <= b) out.add(c); }); }
    return out;
  }
  // 그날이 매월 모집일 규칙에 맞는 회차인지 (아니면 달력에서 직접 추가한 회차)
  const isRegular = (co, c) => days(co).some((d) => Math.min(d, dim(c.slice(0, 7))) === +c.slice(8));
  // 회차 번호. 우선순위: 모집 label('-' = 회차 없음) > 이 회차 rounds 번호(own) > 지난 기준점 + 그 뒤 모집 수 > camp_round_done@camp_round_cycle + 그 뒤 모집 수
  //   anchors: 이 업체의 기준점 [{ cycle_on, round_no, lb }] — 모집 label(lb: true, skipped 제외) + 번호 있는 rounds. 같은 날이면 label 우선
  //   extra: 모집 수에 더 셀 회차(직접 추가한 모집 회차 등, 매월 모집일과 겹치면 한 번만)
  //   seen: (달력만) 위 기준이 모두 없고 camp_round_done만 있을 때 셀 회차들 — 없으면 이 단계는 건너뜀
  // 돌려줌: { no, auto } · no = null이면 회차 없음, none = label '-'
  function roundNo({ co, cycle, label, own, anchors = [], extra = [], seen }) {
    const lb = String(label ?? '');
    if (lb === '-') return { no: null, auto: false, none: true };
    if (/^\d+$/.test(lb)) return { no: +lb, auto: false };
    if (own != null) return { no: +own, auto: false };
    const after = (c0) => new Set([...cyclesIn(co, c0, cycle), ...extra.filter((c) => c > c0 && c <= cycle)]).size;
    const prev = anchors.filter((r) => r.cycle_on && r.round_no != null && r.cycle_on < cycle)
      .sort((a, b) => b.cycle_on.localeCompare(a.cycle_on) || (b.lb ? 1 : 0) - (a.lb ? 1 : 0))[0];
    if (prev) return { no: +prev.round_no + Math.max(1, after(prev.cycle_on)), auto: true };
    if (co.camp_round_done != null && co.camp_round_cycle && co.camp_round_cycle <= cycle) { const no = co.camp_round_done + after(co.camp_round_cycle); return { no, auto: !!no }; }
    if (co.camp_round_done != null && seen) { const no = co.camp_round_done + Math.max(1, [...seen].filter((c) => c <= cycle).length); return { no, auto: !!no }; }
    return { no: null, auto: false };
  }
  root.CRM_ROUNDS = { cyclesIn, isRegular, roundNo };
})(typeof globalThis !== 'undefined' ? globalThis : window);
