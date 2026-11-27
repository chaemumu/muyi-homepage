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
];
