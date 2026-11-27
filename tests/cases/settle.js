// 정산 계산 (assets/crm-settle.js): 인센 · 원천세 3.3% (3% + 0.3% 각 10원 절사)
const assert = require('node:assert/strict');
const { adminPage } = require('../lib');

module.exports = [
  {
    name: '인센 = (결제 − 실비) ÷ 1.1 × 비율 · 고정 인센 우선 · 원천세 10원 절사 · 음수면 0',
    async run({ browser, base }) {
      const p = await adminPage(browser, base);
      const r = await p.evaluate(async () => {
        await loadScript('/assets/crm-settle.js?v=6');
        const { incentive, tax33 } = window.CRM_SETTLE.calc;
        return {
          inc: incentive({ amount_won: 1100000, exec_won: 110000, incentive_rate: 0.6 }),
          fixed: incentive({ amount_won: 1100000, exec_won: 0, incentive_rate: 0.6, incentive_fixed_won: 50000 }),
          t1: tax33(1234567), t2: tax33(999), t3: tax33(-500000), t4: tax33(0),
        };
      });
      assert.equal(r.inc, 540000); assert.equal(r.fixed, 50000);
      assert.equal(r.t1, 37030 + 3700, '1,234,567 → 소득세 37,030 + 지방세 3,700');
      assert.equal(r.t2, 20 + 0); assert.equal(r.t3, 0); assert.equal(r.t4, 0);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
];
