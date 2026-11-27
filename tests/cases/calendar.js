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
];
