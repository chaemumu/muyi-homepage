// 리뷰노트 북마크 (crm-camp.js rnGrab): 가짜 리뷰노트 화면 + 가짜 rn-import로 회차 확인 창만 확인 (실제 저장 없음)
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib');

const SRC = fs.readFileSync(path.join(ROOT, 'assets/crm-camp.js'), 'utf8');
const RN = SRC.slice(SRC.indexOf('  function rnGrab() {'), SRC.indexOf('  const RN_FN = ')).trim().replace(/^function rnGrab\(\)/, 'function ()').replace('__RN_KEY__', 'k'.repeat(30)).replace('__RN_FN__', 'https://rn-import.test/fn');
const CAMP = 1234567; // 주소 숫자는 4자리 이상이어야 캠페인 번호로 인식

// confirm: 가짜 rn-import가 preview에 돌려줄 결과 (이미 3회차로 저장된 캠페인)
async function bookmark(browser, confirmRes, o = {}) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  const sent = [], dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.route('https://www.reviewnote.co.kr/**', (r) => {
    const u = r.request().url();
    if (/\/api\/campaign\?id=/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { id: CAMP, title: '[서울] 테스트 지점 체험단', applyStartAt: '2026-11-10', reviewEndAt: '2026-12-24' } }) });
    if (/selectedApplies/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ objects: [{ id: 1, name: '김가', phone: '010-1111-2222', blogUrl: 'https://blog.naver.com/aaa' }] }) });
    if (o.applies && /\/applies$/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ objects: o.applies }) });
    if (/\/api\//.test(u)) return r.fulfill({ status: 404, body: '{}' });
    return r.fulfill({ contentType: 'text/html', body: '<html><body><h1>테스트 지점 체험단</h1></body></html>' });
  });
  await page.route('https://rn-import.test/**', (r) => {
    const b = JSON.parse(r.request().postData()); sent.push(b); const c = b.campaigns[0];
    const res = b.preview ? { id: c.id, title: c.title, count: 1, status: 'confirm', company: '테스트 지점', company_id: 'c1', ...confirmRes }
      : { id: c.id, title: c.title, count: 1, status: 'saved', company: '테스트 지점', round_no: c.round_no || confirmRes.last, extra: !!c.extra, sup: !!c.sup, link: 'https://www.muyi.co.kr/admin#camp-c1_2026-11-10' };
    r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ results: [res] }) });
  });
  await page.goto(`https://www.reviewnote.co.kr/users/campaigns/${CAMP}`);
  await page.evaluate(`(${RN})()`);
  await page.waitForSelector('#muyi-rn select', { timeout: 15000 });
  return { page, sent, dialogs };
}

module.exports = [
  {
    name: '이미 저장한 캠페인도 회차 확인 창 · 지금 회차 기본 선택 · 맨 아래 추가 명단',
    async run({ browser }) {
      const { page } = await bookmark(browser, { saved_no: 3, saved_extra: false, next: 3, last: 3, have: [1, 2, 3], msg: '이미 3회차로 저장됨' });
      const opts = await page.$$eval('#muyi-rn select option', (o) => o.map((x) => ({ v: x.value, t: x.textContent, sel: x.selected, dis: x.disabled })));
      assert.equal(opts.find((o) => o.sel).v, '3');
      assert.match(opts.find((o) => o.v === '3').t, /지금 저장/);
      assert.equal(opts.at(-2).v, 'extra'); assert.match(opts.at(-2).t, /추가 명단 생성 \(3회차에 추가\)/); assert.equal(opts.at(-2).dis, false);
      assert.equal(opts.at(-1).v, 'sup'); assert.match(opts.at(-1).t, /보충 명단 \(3회차에 보충\)/); assert.equal(opts.at(-1).dis, false);
      assert.deepEqual(page.errors, []); await page.context().close();
    },
  },
  {
    name: "'추가 명단 생성' 저장 = extra:true + 일정 마감일 전송",
    async run({ browser }) {
      const { page, sent, dialogs } = await bookmark(browser, { next: 4, last: 3, have: [1, 2, 3] });
      await page.selectOption('#muyi-rn select', 'extra');
      await page.click('#muyi-rn [data-s]'); await page.waitForTimeout(600);
      assert.match(dialogs[0] || '', /3회차에 추가 명단으로 저장할까요/); assert.match(dialogs[0], /마감일 2026-12-24/);
      const save = sent.find((s) => !s.preview); assert.ok(save, '저장 요청');
      assert.equal(save.campaigns[0].extra, true); assert.equal(save.campaigns[0].company_id, 'c1'); assert.equal(save.campaigns[0].dates.reviewEndAt, '2026-12-24'); assert.ok(sent.every((s) => s.bm === 10), '북마크 버전 bm:10 (rn-import v10 예전 북마크 안내 기준)');
      assert.match(await page.innerText('#muyi-rn'), /3회차 추가 명단/);
      assert.deepEqual(page.errors, []); await page.context().close();
    },
  },
  {
    name: "'보충 명단' 저장 = extra+sup 전송 · 회차 안 늘림",
    async run({ browser }) {
      const { page, sent, dialogs } = await bookmark(browser, { next: 4, last: 3, have: [1, 2, 3] });
      await page.selectOption('#muyi-rn select', 'sup');
      await page.click('#muyi-rn [data-s]'); await page.waitForTimeout(600);
      assert.match(dialogs[0] || '', /3회차에 보충 명단으로 저장할까요/); assert.match(dialogs[0], /새 회차는 만들지 않습니다/);
      const save = sent.find((s) => !s.preview); assert.ok(save, '저장 요청');
      assert.equal(save.campaigns[0].extra, true); assert.equal(save.campaigns[0].sup, true); assert.equal(save.campaigns[0].round_no, undefined);
      assert.match(await page.innerText('#muyi-rn'), /3회차 보충 명단/);
      assert.deepEqual(page.errors, []); await page.context().close();
    },
  },
  {
    name: '리뷰노트에서 취소한 사람도 명단에 같이 보냄 (__cancel) · 확인 창에 취소 인원',
    async run({ browser }) {
      const { page, sent } = await bookmark(browser, { next: 4, last: 3, have: [1, 2, 3] }, { applies: [{ id: 1, name: '김가', status: 'SELECTED' }, { id: 9, name: '박취소', phone: '010-9999-0000', blogUrl: 'https://blog.naver.com/ccc', status: 'CANCELED' }] });
      const rows = sent[0].campaigns[0].rows;
      assert.equal(rows.length, 2, '선정 1 + 취소 1 (선정 목록과 겹치는 사람은 한 번만)');
      assert.equal(rows.find((r) => r.name === '박취소').__cancel, true);
      assert.match(await page.innerText('#muyi-rn'), /취소 1명 같이 저장/);
      assert.deepEqual(page.errors, []); await page.context().close();
    },
  },
  {
    name: '취소 인원을 못 찾으면 안내',
    async run({ browser }) {
      const { page } = await bookmark(browser, { next: 4, last: 3, have: [1, 2, 3] });
      assert.match(await page.innerText('#muyi-rn'), /취소 인원을 리뷰노트에서 못 찾음/);
      await page.context().close();
    },
  },
  {
    name: '명단 있는 회차가 없으면 추가 명단 선택 불가',
    async run({ browser }) {
      const { page } = await bookmark(browser, { next: null, last: null, have: [] });
      const last = await page.$eval('#muyi-rn select option:last-child', (o) => ({ dis: o.disabled, t: o.textContent }));
      assert.equal(last.dis, true); assert.match(last.t, /명단 있는 회차 없음/);
      await page.context().close();
    },
  },
];
