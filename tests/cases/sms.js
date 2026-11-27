// 문자 안전장치 (assets/crm-sms.js 화면 쪽 — 서버 sms-send도 같은 규칙을 강제): (광고) 표기 · 080 수신거부 · 밤 9시~아침 8시 금지 · 수신거부·중복·유선 제외
const assert = require('node:assert/strict');
const { adminPage } = require('../lib');

const DATA = (optout = '무료거부 080-123-4567') => ({
  crm_settings: [{ key: 'sms_config', value: { optout, sign: '무이(MUYI)' } }, { key: 'sms_templates', value: [{ name: '기본', body: '안녕하세요 #{업체명} 사장님' }] }],
  sms_optout: [{ phone: '01022223333' }],
});
const TARGETS = [
  { name: '가게A', phone: '010-1111-2222' }, { name: '가게A2', phone: '01011112222' }, // 중복
  { name: '거부', phone: '010-2222-3333' }, { name: '유선', phone: '02-123-4567' }, { name: '가게B', phone: '010-4444-5555' },
];
async function openSms(p) {
  await p.evaluate(async (t) => { await loadScript('/assets/crm-sms.js?v=4'); window.CRM_SMS.open({ title: '테스트', load: async () => t }); }, TARGETS);
  await p.waitForSelector('.sm-bubble'); await p.waitForTimeout(200);
  return p.evaluate(() => ({ preview: document.querySelector('.sm-bubble').textContent, warn: document.querySelector('.sm-warn').hidden ? '' : document.querySelector('.sm-warn').innerText, send: document.querySelector('.sm-col .btn.primary.lg'), kpi: [...document.querySelectorAll('.sm-kpi b')].map((b) => b.textContent) }))
    .then(async (r) => ({ ...r, send: await p.$eval('.sm-col .btn.primary.lg', (b) => ({ disabled: b.disabled, text: b.textContent })) }));
}

module.exports = [
  {
    name: '광고 문자: (광고) 머리 + 080 수신거부 꼬리 · 수신거부·중복·유선 제외 → 2명',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { data: DATA(), now: '2026-11-27T05:00:00Z' }); // KST 14시
      const r = await openSms(p);
      assert.match(r.preview, /^\(광고\) 안녕하세요 가게A 사장님/); assert.match(r.preview, /무료거부 080-123-4567$/);
      assert.deepEqual(r.kpi, ['2', '1', '2']); assert.equal(r.send.disabled, false); assert.match(r.send.text, /^2명/);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '080 수신거부 번호 없으면 광고 문자 못 보냄',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { data: DATA(''), now: '2026-11-27T05:00:00Z' });
      const r = await openSms(p);
      assert.match(r.warn, /080 무료수신거부/); assert.equal(r.send.disabled, true);
      await p.context().close();
    },
  },
  {
    name: '밤 9시~아침 8시(KST)엔 광고 문자 못 보냄',
    async run({ browser, base }) {
      for (const t of ['2026-11-27T12:30:00Z', '2026-11-27T22:30:00Z']) { // KST 21:30, 07:30
        const p = await adminPage(browser, base, { data: DATA(), now: t });
        const r = await openSms(p);
        assert.match(r.warn, /밤 9시~아침 8시/, t); assert.equal(r.send.disabled, true, t);
        await p.context().close();
      }
    },
  },
];
