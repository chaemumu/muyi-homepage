// 회차 번호 규칙 (assets/crm-rounds.js = 달력 fillRounds · rn-import roundOf 공통)
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
require(path.join(ROOT, 'assets/crm-rounds.js'));
const { roundNo, cyclesIn, isRegular } = globalThis.CRM_ROUNDS;
const co = (x = {}) => ({ id: 'c', recruit_days: [10], ...x });

module.exports = [
  {
    name: 'rn-import 복사본 = assets/crm-rounds.js (다르면 node scripts/sync-rounds.js)',
    run: async () => assert.equal(fs.readFileSync(path.join(ROOT, 'supabase/functions/rn-import/rounds.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'assets/crm-rounds.js'), 'utf8')),
  },
  {
    name: 'label > 이 회차 번호 > 기준점 + 모집 수',
    run: async () => {
      const c = co();
      assert.deepEqual(roundNo({ co: c, cycle: '2026-11-10', label: '-' }), { no: null, auto: false, none: true });
      assert.deepEqual(roundNo({ co: c, cycle: '2026-11-10', label: '7', own: 3 }), { no: 7, auto: false });
      assert.deepEqual(roundNo({ co: c, cycle: '2026-11-10', own: 3, anchors: [{ cycle_on: '2026-09-10', round_no: 1 }] }), { no: 3, auto: false });
      assert.deepEqual(roundNo({ co: c, cycle: '2026-11-10', anchors: [{ cycle_on: '2026-08-10', round_no: 4 }] }), { no: 7, auto: true }, '8/10 4회차 → 9·10·11월 = 7');
    },
  },
  {
    name: '같은 날 기준점이면 모집 label이 명단 회차보다 우선 · 직접 추가 회차도 셈',
    run: async () => {
      const c = co();
      const anchors = [{ cycle_on: '2026-09-10', round_no: 2 }, { cycle_on: '2026-09-10', round_no: 5, lb: true }];
      assert.equal(roundNo({ co: c, cycle: '2026-11-10', anchors }).no, 7);
      assert.equal(roundNo({ co: c, cycle: '2026-11-10', anchors, extra: ['2026-10-20', '2026-10-10', '2026-12-01'] }).no, 8, '10/20 직접 추가 +1, 10/10은 매월 모집일과 겹쳐 한 번, 12/1은 뒤라 안 셈');
    },
  },
  {
    name: '기준점 없으면 camp_round_done@camp_round_cycle + 모집 수 · seen은 달력만',
    run: async () => {
      const c = co({ camp_round_done: 3, camp_round_cycle: '2026-09-10' });
      assert.deepEqual(roundNo({ co: c, cycle: '2026-11-10' }), { no: 5, auto: true });
      const d = co({ camp_round_done: 3 });
      assert.deepEqual(roundNo({ co: d, cycle: '2026-11-10' }), { no: null, auto: false }, 'rn-import (seen 없음)');
      assert.deepEqual(roundNo({ co: d, cycle: '2026-11-10', seen: new Set(['2026-10-10', '2026-11-10', '2026-12-10']) }), { no: 5, auto: true }, '달력');
    },
  },
  {
    name: '말일 모집일(31일) = 그달 마지막 날 · 매월 모집일 판정',
    run: async () => {
      const c = co({ recruit_days: [31, 15] });
      assert.deepEqual([...cyclesIn(c, '2026-01-31', '2026-03-31')].sort(), ['2026-02-15', '2026-02-28', '2026-03-15', '2026-03-31']);
      assert.equal(isRegular(c, '2026-02-28'), true); assert.equal(isRegular(c, '2026-02-27'), false);
      assert.equal(cyclesIn(co({ recruit_days: [] }), '2026-01-01', '2026-12-31').size, 0);
    },
  },
];
