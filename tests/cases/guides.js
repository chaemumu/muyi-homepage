// 업종별 가이드(local-business #guide) · 숏폼 비용(shortform-marketing #cost): 구조화 데이터 · 탭 · 폼 연결 · 모바일
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PAGES } = require('../../scripts/guides-data');

const ROOT = path.resolve(__dirname, '../..');

async function open(browser, base, file, { viewport = { width: 1280, height: 900 }, hash = '' } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route(/googletagmanager|fonts\.(googleapis|gstatic)|connect\.facebook|cdn\.jsdelivr|cdnjs/, (r) => r.fulfill({ status: 200, body: '' }));
  await page.route(/supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(`${base}/${file}${hash}`);
  return page;
}
const faqNames = (page) => page.evaluate(() => {
  const g = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => { const d = JSON.parse(s.textContent); return d['@graph'] || [d]; });
  return g.find((n) => n['@type'] === 'FAQPage').mainEntity.map((q) => q.name);
});

module.exports = [
  {
    name: '생성 스크립트: 다시 돌려도 결과가 같음',
    run: async () => {
      const files = ['local-business.html', 'shortform-marketing.html'].map((f) => path.join(ROOT, f));
      const before = files.map((f) => fs.readFileSync(f, 'utf8'));
      execFileSync('node', [path.join(ROOT, 'scripts/build-guides.js')]);
      files.forEach((f, i) => assert.equal(fs.readFileSync(f, 'utf8'), before[i], `${path.basename(f)} 바뀜 — build-guides.js 를 돌리고 커밋할 것`));
    },
  },
  {
    name: 'local-business: 업종 탭 8개 · FAQPage = 화면 질문(중복 없음) · llms.txt 주소',
    run: async ({ browser, base }) => {
      const page = await open(browser, base, 'local-business.html');
      const info = await page.evaluate(() => ({
        tabs: [...document.querySelectorAll('#guide [data-g]')].map((b) => b.dataset.g),
        panels: [...document.querySelectorAll('#guide .gd-p')].map((p) => p.id),
        visible: [...document.querySelectorAll('.faq-q')].map((b) => b.textContent.trim()),
      }));
      assert.deepEqual(info.tabs, PAGES.map((p) => p.slug));
      assert.deepEqual(info.panels, PAGES.map((p) => 'guide-' + p.slug));
      const names = await faqNames(page);
      assert.equal(new Set(names).size, names.length, 'FAQPage 질문 중복');
      assert.equal(new Set(info.visible).size, info.visible.length, '화면 질문 중복');
      assert.deepEqual([...names].sort(), [...info.visible].sort(), 'FAQPage = 화면 FAQ');
      const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
      PAGES.forEach((p) => assert.ok(llms.includes(`/local-business#guide-${p.slug}`), `llms.txt ${p.slug}`));
      assert.deepEqual(page.errors, []);
      await page.context().close();
    },
  },
  {
    name: '탭 전환 · #guide-clinic 주소로 바로 열림 · [무료 진단 신청] → 폼 + 업종 선택',
    run: async ({ browser, base }) => {
      const page = await open(browser, base, 'local-business.html', { hash: '#guide-clinic' });
      assert.ok(await page.isVisible('#guide-clinic'), '주소로 연 업종이 보임');
      assert.ok(!(await page.isVisible('#guide-restaurant')), '다른 업종은 숨김');
      await page.click('#gdt-cafe');
      assert.ok(await page.isVisible('#guide-cafe'));
      assert.ok(!(await page.isVisible('#guide-clinic')));
      assert.equal(new URL(page.url()).hash, '#guide-cafe', '주소 갱신');
      await page.click('#guide-cafe .gd-cta');
      await page.waitForFunction(() => document.getElementById('f-industry').value === '음식점·카페');
      assert.equal(await page.locator('#bizGrid .biz-b.sel[data-biz="음식점·카페"]').count(), 1, '업종 버튼 선택됨');
      await page.waitForFunction(() => { const r = document.getElementById('cta').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, null, { timeout: 4000 }); // 폼 구간으로 이동
      await page.click('#guide-cafe .faq-q');
      assert.equal(await page.getAttribute('#guide-cafe .faq-q', 'aria-expanded'), 'true', '업종 FAQ 열림');
      assert.deepEqual(page.errors, []);
      await page.context().close();
    },
  },
  {
    name: 'shortform-marketing: 비용 섹션 · FAQPage = 화면 질문',
    run: async ({ browser, base }) => {
      const page = await open(browser, base, 'shortform-marketing.html');
      assert.ok(await page.isVisible('#cost table.pt'));
      assert.match(await page.textContent('#cost'), /20만 원부터/);
      const visible = await page.$$eval('.faq-q', (bs) => bs.map((b) => b.textContent.trim()));
      const names = await faqNames(page);
      assert.equal(new Set(visible).size, visible.length, '화면 질문 중복');
      assert.deepEqual([...names].sort(), [...visible].sort(), 'FAQPage = 화면 FAQ');
      assert.deepEqual(page.errors, []);
      await page.context().close();
    },
  },
  {
    name: '모바일(375px): 두 페이지 가로 넘침 없음',
    run: async ({ browser, base }) => {
      for (const f of ['local-business.html', 'shortform-marketing.html']) {
        const page = await open(browser, base, f, { viewport: { width: 375, height: 800 } });
        const over = await page.evaluate(() => {
          const s = document.querySelector('#guide, #cost');
          return Math.max(...[...s.querySelectorAll('*')].map((e) => e.getBoundingClientRect().right)) - window.innerWidth;
        });
        assert.ok(over <= 1, `${f} 섹션 가로 넘침 ${over}px`);
        await page.context().close();
      }
    },
  },
];
