// 캘린더 (assets/crm-calendar.js): 추가 명단 마감 칩
const assert = require('node:assert/strict');
const { adminPage } = require('../lib');

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
];
