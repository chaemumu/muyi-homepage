// 체험단 발표 상세 (assets/crm-camp.js): ① 명단 추가명단 · ④ 블로거 가이드 주소·예약 번호
const assert = require('node:assert/strict');
const { adminPage, writes, openCamp, tab } = require('../lib');

const CO = 'c1', CYCLE = '2026-11-10';
const DATA = {
  companies: [{ id: CO, name: '테스트 지점', address: '서울 마포구 원래로 1', phone: '010-9999-0000', store_phone: '02-111-2222', camp_info: { price: '2인 3만원', must: '마포 맛집', opt: '' } }],
  rounds: [
    { id: 'r1', company_id: CO, round_no: 3, round_label: '3', cycle_on: CYCLE, recruit_on: CYCLE, teams: 10, state: '진행', import_key: null },
    { id: 'x1', company_id: CO, round_no: 3, round_label: '3회차 추가', cycle_on: null, recruit_on: CYCLE, deadline: '2026-12-20', teams: 1, state: '추가', rn_campaign_id: '999', created_at: '2026-11-26' },
  ],
  roster: [
    { id: 'p1', round_id: 'r1', nickname: '블로거A', name: '김가', phone: '010-1111-2222', blog_url: 'https://blog.naver.com/aaa' },
    { id: 'p2', round_id: 'r1', nickname: '블로거B', name: '이나', phone: '010-3333-4444', blog_url: 'https://blog.naver.com/bbb' },
    { id: 'p3', round_id: 'x1', nickname: '추가C', name: '박다', phone: '010-5555-6666', blog_url: 'https://blog.naver.com/ccc' },
  ],
};
const ARGS = { co: { id: CO, name: '테스트 지점', phone: '010-9999-0000' }, cycle: CYCLE, cfg: { off: { 발표: 7, 마감: 21, '2차마감': 7 }, start: '2026-01-01' }, announce: '2026-11-17', deadline: '2026-12-01', rno: 3 };

module.exports = [
  {
    name: '① 명단: [추가명단 생성]이 관리팀 TXT 왼쪽 · 기존 추가 명단 표시',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { data: DATA, hash: '#calendar' });
      await openCamp(p, ARGS); await tab(p, '명단');
      const r = await p.evaluate(() => { const row = document.querySelector('.ca-txtrow'), b = row?.querySelector('.btn'), s = row?.querySelector('summary');
        return { shown: !!row && !row.hidden, text: b?.textContent, left: b && s ? b.getBoundingClientRect().right <= s.getBoundingClientRect().left + 1 : false, xl: document.querySelector('.ca-xl')?.innerText || '' }; });
      assert.equal(r.shown, true); assert.equal(r.text, '추가명단 생성'); assert.equal(r.left, true, '버튼이 TXT 미리보기 왼쪽');
      assert.match(r.xl, /3회차 추가/); assert.match(r.xl, /12\/20/); assert.match(r.xl, /1명/);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '① 명단: 추가명단 저장 = 새 회차 없이 3회차에 state 추가 + 마감일',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { data: DATA, hash: '#calendar' });
      await openCamp(p, ARGS); await tab(p, '명단');
      await p.locator('.ca-txtrow .btn').click();
      await p.fill('.rt-pm textarea', '닉네임D\n최라\n010-7777-8888\nhttps://blog.naver.com/ddd\n\n닉네임E\n정마\n010-1212-3434\nhttps://blog.naver.com/eee');
      await p.locator('.rt-pm input[type=date]').fill('2026-12-24');
      await p.locator('.rt-pm .btn.primary').click(); await p.waitForTimeout(500);
      const rd = (await writes(p, 'rounds')).find((w) => w.op === 'insert');
      assert.ok(rd, 'rounds insert'); assert.equal(rd.payload.state, '추가'); assert.equal(rd.payload.round_no, 3);
      assert.equal(rd.payload.cycle_on, null); assert.equal(rd.payload.recruit_on, CYCLE); assert.equal(rd.payload.deadline, '2026-12-24');
      const ro = (await writes(p, 'roster')).find((w) => w.op === 'insert');
      assert.equal(ro.payload.length, 2);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: '④ 가이드: 주소·예약 번호 입력 → 메시지 즉시 반영 → 업체 정보 저장',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { data: DATA, hash: '#calendar' });
      await openCamp(p, ARGS); await tab(p, '블로거 가이드');
      const addr = p.locator('.ca-info input').nth(0), tel = p.locator('.ca-info input').nth(1);
      assert.equal(await addr.inputValue(), '서울 마포구 원래로 1'); assert.equal(await tel.inputValue(), '02-111-2222');
      await addr.fill('서울 마포구 새주소 99'); await tel.fill('0212345678');
      const msg = await p.locator('.ca-panel:not([hidden]) textarea.ca-msg').inputValue();
      assert.match(msg, /업체 주소\t\t: 서울 마포구 새주소 99/); assert.match(msg, /예약 번호\t\t: 02-1234-5678/);
      await addr.press('Tab'); await p.waitForTimeout(300);
      const up = (await writes(p, 'companies')).map((w) => w.payload);
      assert.deepEqual(up, [{ address: '서울 마포구 새주소 99' }, { store_phone: '02-1234-5678' }]);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
  {
    name: "④ 가이드: 지점 특이사항이 있어도 '~확인 사항' 머리 없음",
    async run({ browser, base }) {
      const data = { ...DATA, guidelines: [{ company_id: CO, kind: '체험단', body: '주차 가능, 월요일 휴무', fields: { title: '기본' }, created_at: '2026-11-26' }] };
      const p = await adminPage(browser, base, { data, hash: '#calendar' });
      await openCamp(p, ARGS); await tab(p, '블로거 가이드');
      const msg = await p.locator('.ca-panel:not([hidden]) textarea.ca-msg').inputValue();
      assert.match(msg, /주차 가능, 월요일 휴무/); assert.doesNotMatch(msg, /확인 사항/);
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  },
];
