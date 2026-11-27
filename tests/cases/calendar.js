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
    name: "마감 탭: 모집일 없는 회차에 붙은 추가·보충 명단(recruit_on 없음)도 마감일에 칩",
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { hash: '#calendar', data: {
        companies: [{ id: 'c1', name: '텍스트 지점', stage: '결제', run_status: '진행 중', recruit_days: [5] }],
        rounds: [{ id: 'x1', company_id: 'c1', recruit_on: null, cycle_on: null, round_no: 7, round_label: '7회차 보충', deadline: ym + '21', teams: 2, state: '추가' }],
      } });
      await p.waitForTimeout(1200);
      await p.locator('button', { hasText: /^마감/ }).first().click(); await p.waitForTimeout(1200);
      const d = await p.$$eval('.cal-day', (ds) => ds.filter((x) => x.querySelector('.cc.xtra')).map((x) => x.dataset.d + ':' + x.innerText.replace(/\n/g, ' ')));
      assert.equal(d.length, 1, JSON.stringify(d)); assert.match(d[0], new RegExp('^' + ym + '21:.*보충.*텍스트 지점'));
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
    name: '선재계약: 있으면 빨간 표시·임박 칸 제외 · 회차 다 쓰면 자동 갱신 · 팝업에서 등록',
    async run({ browser, base }) {
      const co = (id, name, extra) => ({ id, name, stage: '결제', run_status: '진행 중', service_type: '체험단 패키지', recruit_days: [5], camp_round_total: 10, ...extra });
      const p = await adminPage(browser, base, { hash: '#calendar', now: '2026-11-20T10:00:00+09:00', data: {
        companies: [co('a', '선재 지점', { camp_renew_next: 10, camp_renew_next_on: '2026-11-10' }), co('b', '소진 지점', { camp_renew_next: 12, camp_renew_next_on: '2026-10-20' }), co('c', '임박 지점')],
        rounds: [{ id: 'r1', company_id: 'b', cycle_on: '2026-10-05', recruit_on: '2026-10-05', round_no: 10, state: '완료' }],
        camp_tasks: [{ company_id: 'a', cycle_on: '2026-11-05', step: '모집', due_on: '2026-11-05', label: '9' }, { company_id: 'c', cycle_on: '2026-11-05', step: '모집', due_on: '2026-11-05', label: '9' }],
      } });
      await p.waitForTimeout(1200);
      await p.locator('.cal-seg button', { hasText: /^모집/ }).first().click(); await p.waitForTimeout(1500);
      const lb = await p.$$eval('.cc', (cs) => cs.map((c) => ({ t: c.innerText.replace(/\n/g, ' '), red: !!c.querySelector('.cc-lb.renew') })));
      const f = (n) => lb.find((c) => c.t.includes(n));
      assert.equal(f('선재 지점')?.red, false, JSON.stringify(lb)); assert.match(f('선재 지점').t, /9\/10\+10/);
      assert.match(f('소진 지점').t, /1\/12/, '소진 → 새 계약 1회차');
      assert.equal(f('임박 지점')?.red, true);
      const soon = await p.$$eval('.hb-soon .hb-row b', (bs) => bs.map((b) => b.innerText));
      assert.ok(soon.includes('임박 지점') && !soon.includes('선재 지점'), JSON.stringify(soon)); // (가짜 DB는 쓰기를 저장 안 해서 소진 지점 재계산은 여기서 안 봄)
      const w = await writes(p);
      assert.ok(w.some((x) => x.table === 'camp_tasks' && x.payload.company_id === 'b' && x.payload.cycle_on === '2026-11-05' && x.payload.label === '1'), '자동 갱신 회차 저장');
      assert.ok(w.some((x) => x.table === 'companies' && x.op === 'update' && x.filt.id === 'b' && x.payload.camp_round_total === 12 && x.payload.camp_renew_next === null));
      assert.ok(w.some((x) => x.table === 'companies' && x.filt.id === 'b' && /선재계약 적용/.test(x.payload.camp_memo || '')));
      // 임박 지점 팝업에서 선재계약 등록
      await p.locator('.cc', { hasText: '임박 지점' }).locator('.cc-n').first().click();
      await p.waitForSelector('.rc-ack'); await p.click('.rc-pre');
      const dlg = p.locator('.pm-layer').last();
      await dlg.locator('select').selectOption('10'); await dlg.locator('input[type=date]').fill('2026-11-18');
      await dlg.locator('button', { hasText: '저장' }).click(); await p.waitForTimeout(500);
      const w2 = await writes(p, 'companies');
      assert.ok(w2.some((x) => x.op === 'update' && x.filt.id === 'c' && x.payload.camp_renew_next === 10 && x.payload.camp_renew_next_on === '2026-11-18'));
      assert.ok(w2.some((x) => x.filt.id === 'c' && /11\/18 선재계약 \+10회/.test(x.payload.camp_memo || '')));
      assert.equal(await p.$('.rc-ack'), null);
      assert.equal(await p.textContent('.rc-pre'), '선재계약 +10');
      await p.selectOption('.rc-teams', '5'); await p.waitForTimeout(300);
      assert.ok((await writes(p, 'camp_tasks')).some((x) => x.payload.company_id === 'c' && x.payload.step === '모집' && x.payload.target === 5), '모집 팀 수 저장');
      assert.ok((await writes(p, 'rounds')).some((x) => x.payload.teams === 5 && x.filt.company_id === 'c'));
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '영구 지점(계약 회차 0): 계약 기간이 있어도 재계약 임박·빨간 표시 없음',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { hash: '#calendar', data: {
        companies: [{ id: 'y', name: '영구 지점', stage: '결제', run_status: '진행 중', service_type: '체험단 패키지', recruit_days: [4], camp_round_total: 0 }],
        contracts: [{ company_id: 'y', paid_at: '2022-12-27', period_months: 12 }],
        camp_tasks: [{ company_id: 'y', cycle_on: ym + '04', step: '모집', due_on: ym + '04', label: '45' }],
      } });
      await p.waitForTimeout(1200);
      await p.locator('.cal-seg button', { hasText: /^모집/ }).first().click(); await p.waitForTimeout(1500);
      const c = await p.$eval('.cc', (x) => ({ t: x.querySelector('.cc-lb').innerText, red: !!x.querySelector('.cc-lb.renew') }));
      assert.deepEqual(c, { t: '45', red: false });
      assert.deepEqual(await p.$$eval('.hb-soon .hb-row', (r) => r.length), 0);
      await p.locator('.cc', { hasText: '영구 지점' }).locator('.cc-n').first().click(); await p.waitForSelector('.rc-pre');
      assert.equal(await p.$eval('.rc-row select:nth-of-type(2)', (s) => s.selectedOptions[0].text), '영구 (회차 계속)');
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
