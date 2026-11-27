// 모바일 폭(360·430px): 관리자 화면 가로 넘침 없음 (긴 업체명·연락처 픽스처)
const assert = require('node:assert/strict');
const { adminPage, openCamp, tab } = require('../lib');

const ym = new Date().toISOString().slice(0, 8);
const LONG = '아주아주긴업체이름테스트지점서울특별시강남구테헤란로점';
const DATA = {
  contacts: Array.from({ length: 3 }, (_, i) => ({ id: 'k' + i, created_at: new Date().toISOString(), name: '홍길동' + i, phone: '010-1234-567' + i, company: LONG, message: '문의 내용 '.repeat(30), status: '신규', source: 'local-business' })),
  companies: [
    { id: 'c1', name: LONG, stage: '결제', run_status: '진행 중', service_type: '체험단 패키지', recruit_days: [5], address: '서울특별시 강남구 테헤란로 123 아주 긴 주소 빌딩 15층', phone: '010-9999-0000' },
    { id: 'c2', name: '가망' + LONG, stage: '가망', lead_source: 'store', phone: '010-2222-3333' },
  ],
  rounds: [{ id: 'r1', company_id: 'c1', round_no: 3, round_label: '3', cycle_on: ym + '05', recruit_on: ym + '05', teams: 10, state: '진행' }],
  roster: [{ id: 'p1', round_id: 'r1', nickname: '블로거A', name: '김가', phone: '010-1111-2222', blog_url: 'https://blog.naver.com/aaa' }],
};
const ARGS = { co: { id: 'c1', name: LONG, phone: '010-9999-0000' }, cycle: ym + '05', cfg: { off: { 발표: 7, 마감: 21, '2차마감': 7 }, start: '2026-01-01' }, announce: ym + '12', deadline: ym + '26', rno: 3 };

// 문서 가로 스크롤 + 스크롤 칸 밖으로 튀어나온 요소(예: 고정 팝업 속)
const overflow = (p) => p.evaluate(() => {
  const W = innerWidth, out = [];
  document.querySelectorAll('body *').forEach((e) => {
    const b = e.getBoundingClientRect(); if (!b.width || (b.right <= W + 1 && b.left >= -1)) return;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= W + 1) return;
    }
    out.push(`${e.tagName}.${e.className} ${Math.round(b.left)}~${Math.round(b.right)}`);
  });
  return { sw: document.documentElement.scrollWidth, W, out: out.slice(0, 5) };
});
const check = async (p, what) => { const r = await overflow(p); assert.ok(r.sw <= r.W && !r.out.length, `${what} @${r.W}px: scrollWidth ${r.sw} ${r.out.join(' | ')}`); };

module.exports = [360, 430].map((w) => ({
  name: `${w}px: 주요 화면 · 업체 상세 · 체험단 상세에 가로 넘침 없음`,
  async run({ browser, base }) {
    const vp = { width: w, height: 800 };
    for (const h of ['today', 'inbox', 'calendar', 'leads', 'clients', 'perf', 'settle']) {
      const p = await adminPage(browser, base, { viewport: vp, hash: '#' + h, data: DATA });
      await p.waitForTimeout(900); await check(p, h);
      if (h === 'calendar') for (const t of [/^모집/, /콘텐츠/]) { await p.locator('button', { hasText: t }).first().click(); await p.waitForTimeout(600); await check(p, 'calendar ' + t); }
      await p.context().close();
    }
    for (const h of ['#co-c1', '#co-c2']) {
      const p = await adminPage(browser, base, { viewport: vp, hash: h, data: DATA });
      await p.waitForTimeout(1200); await check(p, h); await p.context().close();
    }
    const p = await adminPage(browser, base, { viewport: vp, hash: '#calendar', data: DATA });
    await openCamp(p, ARGS);
    for (const t of ['명단', '점주', '일정', '가이드', '체크', '재촉']) { await tab(p, t); await check(p, '체험단 상세 ' + t); }
    await p.context().close();
  },
}));
