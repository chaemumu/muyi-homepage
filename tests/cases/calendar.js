// 캘린더 (assets/crm-calendar.js): 추가 명단 마감 칩
const assert = require('node:assert/strict');
const { adminPage, writes } = require('../lib');

const ym = new Date().toISOString().slice(0, 8);
module.exports = [
  {
    name: "마감 탭: 추가 명단 마감일에 '추가' 칩 (끌기 없음)",
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { hash: '#calendar', data: {
        companies: [{ id: 'c1', name: '테스트 지점', stage: '결제', run_status: '진행 중' }],
        rounds: [{ id: 'x1', company_id: 'c1', recruit_on: ym + '05', round_no: 3, deadline: ym + '20', teams: 2, state: '추가' }],
      } });
      await p.waitForTimeout(1200);
      await p.locator('button', { hasText: /^마감/ }).first().click(); await p.waitForTimeout(1200);
      const chips = await p.$$eval('.cc', (cs) => cs.map((c) => ({ t: c.innerText.replace(/\n/g, ' '), drag: c.draggable })));
      const x = chips.find((c) => /추가/.test(c.t));
      assert.ok(x, '추가 칩: ' + JSON.stringify(chips)); assert.match(x.t, /테스트 지점/); assert.equal(x.drag, false);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '모집 탭: 계약 회차 − 진행 회차 ≤ 1 → 회차 빨간색 · 재계약 임박 칸 · [확인 완료]로 끄기',
    async run({ browser, base }) {
      const co = (id, name, extra) => ({ id, name, stage: '결제', run_status: '진행 중', service_type: '체험단 패키지', recruit_days: [5], camp_round_total: 10, ...extra });
      const p = await adminPage(browser, base, { hash: '#calendar', data: {
        companies: [co('c1', '임박 지점'), co('c2', '여유 지점'), co('c3', '확인한 지점', { camp_renew_ack: 10 })],
        camp_tasks: ['c1', 'c2', 'c3'].map((id) => ({ company_id: id, cycle_on: ym + '05', step: '모집', due_on: ym + '05', label: id === 'c2' ? '5' : '9' })),
      } });
      await p.waitForTimeout(1200);
      await p.locator('.cal-seg button', { hasText: /^모집/ }).first().click(); await p.waitForTimeout(1500);
      const lb = await p.$$eval('.cc', (cs) => cs.map((c) => ({ t: c.innerText.replace(/\n/g, ' '), red: !!c.querySelector('.cc-lb.renew') })));
      const f = (n) => lb.find((c) => c.t.includes(n));
      assert.equal(f('임박 지점')?.red, true, JSON.stringify(lb)); assert.equal(f('여유 지점')?.red, false); assert.equal(f('확인한 지점')?.red, false);
      const soon = await p.$$eval('.hb-wrap > .card', (cs) => cs.map((c) => c.querySelector('h3').innerText + ':' + [...c.querySelectorAll('.hb-row b')].map((b) => b.innerText).join(',')));
      assert.deepEqual(soon, ['재계약:', '재계약 임박:임박 지점', '홀딩 · 모집 보류:']);
      assert.equal((await writes(p, 'camp_holds')).length, 0, '재계약 칸에 자동으로 넣지 않음');
      await p.locator('.cc', { hasText: '임박 지점' }).locator('.cc-n').first().click();
      await p.waitForSelector('.rc-ack');
      const order = await p.$$eval('.gv .ca-sec button', (bs) => bs.map((b) => b.innerText));
      assert.deepEqual(order.slice(-2), ['확인 완료', '가이드 복사']);
      await p.click('.rc-ack'); await p.waitForTimeout(400);
      assert.ok((await writes(p, 'companies')).some((w) => w.op === 'update' && w.payload.camp_renew_ack === 10 && w.filt.id === 'c1'));
      assert.equal(await p.$('.rc-ack'), null);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '오늘 업무: 마감·2차마감 = 전날 달력분 (월요일 = 금·토·일)',
    async run({ browser, base }) {
      const co = (id) => ({ id, name: '지점' + id, stage: '결제', run_status: '진행 중' });
      const dl = (id, due, step = '마감') => ({ id: 't' + id + step, company_id: id, cycle_on: '2026-11-01', step, due_on: due });
      const data = {
        companies: ['A', 'B', 'C', 'D', 'E'].map(co),
        camp_tasks: [dl('A', '2026-11-26'), dl('B', '2026-11-27'), dl('C', '2026-11-29'), dl('D', '2026-11-28', '2차마감'), dl('E', '2026-11-30')],
      };
      const col = async (p) => { await p.waitForSelector('.td-col'); await p.waitForTimeout(600); return p.$$eval('.td-col', (cs) => { const c = cs.find((x) => /마감/.test(x.querySelector('h3').innerText)); return { h: c.querySelector('.td-h').innerText.replace(/\n/g, ' '), items: [...c.querySelectorAll('.td-item b')].map((b) => b.innerText.replace(/\n/g, ' ')) }; }); };
      // 금요일(11/27): 목요일 마감분만
      let p = await adminPage(browser, base, { hash: '#calendar', data, now: '2026-11-27T10:00:00+09:00' });
      let c = await col(p);
      assert.deepEqual(c.items, ['지점A'], JSON.stringify(c)); assert.match(c.h, /11\/26\(목\)분/);
      assert.deepEqual(p.errors, []); await p.context().close();
      // 월요일(11/30): 금·토·일 마감분 (월요일 당일 E는 다음날)
      p = await adminPage(browser, base, { hash: '#calendar', data, now: '2026-11-30T10:00:00+09:00' });
      c = await col(p);
      assert.deepEqual(c.items, ['11/27(금)지점B', '11/28(토)지점D', '11/29(일)지점C'], JSON.stringify(c)); assert.match(c.h, /11\/27~11\/29분/);
      if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: false });
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '회차 연동: 화면 밖 지난 모집 회차 label이 기준점 → 이번 달 모집·마감 칩 같은 번호',
    async run({ browser, base }) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2); const old = d.toISOString().slice(0, 8) + '05';
      const p = await adminPage(browser, base, { hash: '#calendar', data: {
        companies: [{ id: 'c1', name: '연동 지점', stage: '결제', run_status: '진행 중', service_type: '체험단 패키지', recruit_days: [5] }],
        camp_tasks: [{ company_id: 'c1', cycle_on: old, step: '모집', due_on: old, label: '12', phase: '완' }],
      } });
      await p.waitForTimeout(1200);
      await p.locator('.cal-seg button', { hasText: /^모집/ }).first().click(); await p.waitForTimeout(1500);
      const chips = await p.$$eval('.cc', (cs) => cs.map((c) => c.innerText.replace(/\n/g, ' ')));
      assert.ok(chips.some((t) => /연동 지점/.test(t) && /\b14\b/.test(t)), '이번 달 모집 = 12 + 2 = 14: ' + JSON.stringify(chips));
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
];
