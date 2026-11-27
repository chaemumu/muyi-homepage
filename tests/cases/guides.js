// 업종별 마케팅 가이드(/marketing/*): 구조화 데이터 · 폼 접수(가짜 contact) · 모바일 레이아웃
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { PAGES, COST } = require('../../scripts/guides-data');

const ROOT = path.resolve(__dirname, '../..');
const SLUGS = ['index', ...PAGES.map((p) => p.slug), COST.slug];

async function open(browser, base, slug, { viewport = { width: 1280, height: 900 }, contact } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.errors = [];
  page.posts = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route(/googletagmanager|fonts\.(googleapis|gstatic)|connect\.facebook/, (r) => r.fulfill({ status: 200, body: '' }));
  await page.route(/supabase\.co\//, (r) => {
    const req = r.request();
    if (req.method() === 'POST' && /functions\/v1\/contact/.test(req.url())) page.posts.push(JSON.parse(req.postData()));
    return r.fulfill({ status: contact || 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(`${base}/marketing/${slug}.html`);
  return page;
}

module.exports = [
  {
    name: '모든 가이드 페이지: JSON-LD 파싱 · FAQ 화면과 일치 · canonical · sitemap 등록',
    run: async ({ browser, base }) => {
      const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
      const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
      for (const slug of SLUGS) {
        const page = await open(browser, base, slug);
        const url = `https://www.muyi.co.kr/marketing${slug === 'index' ? '' : '/' + slug}`;
        const info = await page.evaluate(() => ({
          ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)),
          canonical: document.querySelector('link[rel=canonical]').href,
          faqs: [...document.querySelectorAll('.faq-q')].map((b) => b.textContent),
          h1: document.querySelectorAll('h1').length,
          form: !!document.getElementById('form'),
          monitor: !!document.querySelector('script[src^="/assets/muyi-monitor.js"]'),
        }));
        assert.equal(info.canonical, url, `${slug} canonical`);
        assert.equal(info.h1, 1, `${slug} h1 하나`);
        assert.ok(info.form, `${slug} 폼 있음`);
        assert.ok(info.monitor, `${slug} 장애 감시 스크립트`);
        const graph = info.ld[0]['@graph'];
        assert.ok(graph.some((n) => n['@id'] === 'https://www.muyi.co.kr/#organization'), `${slug} 조직 엔티티 연결`);
        const faq = graph.find((n) => n['@type'] === 'FAQPage');
        if (slug !== 'index') assert.deepEqual(faq.mainEntity.map((q) => q.name), info.faqs, `${slug} FAQ 구조화 데이터 = 화면`);
        assert.ok(sitemap.includes(`<loc>${url}</loc>`), `${slug} sitemap`);
        if (slug !== 'index') assert.ok(llms.includes(url), `${slug} llms.txt`);
        assert.deepEqual(page.errors, [], `${slug} 스크립트 오류`);
        await page.context().close();
      }
    },
  },
  {
    name: '업종 폼: 필수값 확인 → contact 로 업종·출처와 함께 전송 → 성공 안내',
    run: async ({ browser, base }) => {
      const page = await open(browser, base, 'cafe');
      await page.fill('#f-store', '테스트카페');
      await page.fill('#f-phone', '01012345678');
      await page.check('#f-agree');
      await page.click('#sbtn');
      assert.match(await page.textContent('#fst'), /문의 내용/);
      assert.equal(page.posts.length, 0, '문의 내용 없으면 안 보냄');
      assert.equal(await page.inputValue('#f-phone'), '010-1234-5678', '전화번호 자동 하이픈');
      await page.fill('#f-msg', '플레이스 순위 고민');
      await page.click('#sbtn');
      await page.waitForFunction(() => /접수됐습니다/.test(document.getElementById('fst').textContent));
      assert.equal(page.posts.length, 1);
      const b = page.posts[0];
      assert.equal(b.source, 'local-business-diagnosis');
      assert.equal(b.industry, '카페');
      assert.equal(b.phone, '010-1234-5678');
      assert.match(b.message, /^\[업종 가이드: 카페·디저트\] 플레이스 순위 고민$/);
      assert.match(b.event_id, /^mg-/);
      assert.equal(await page.inputValue('#f-store'), '', '성공 후 비움');
      await page.context().close();
    },
  },
  {
    name: '숏폼 비용 폼은 shortform-order 로 · 서버 실패 시 재시도 안내',
    run: async ({ browser, base }) => {
      const page = await open(browser, base, 'shortform-cost', { contact: 500 });
      await page.fill('#f-store', '테스트식당');
      await page.fill('#f-phone', '010-2222-3333');
      await page.fill('#f-msg', '릴스 3편');
      await page.check('#f-agree');
      await page.click('#sbtn');
      await page.waitForFunction(() => /실패/.test(document.getElementById('fst').textContent));
      assert.equal(page.posts[0].source, 'shortform-order');
      assert.equal(page.posts[0].industry, '숏폼 제작');
      assert.equal(await page.isDisabled('#sbtn'), false, '버튼 다시 누를 수 있음');
      assert.equal(await page.inputValue('#f-store'), '테스트식당', '실패 시 입력 유지');
      await page.context().close();
    },
  },
  {
    name: '모바일(375px): 가로 스크롤 없음 · FAQ 열림',
    run: async ({ browser, base }) => {
      for (const slug of ['clinic', 'shortform-cost', 'index']) {
        const page = await open(browser, base, slug, { viewport: { width: 375, height: 800 } });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(over <= 0, `${slug} 가로 넘침 ${over}px`);
        if (slug !== 'index') {
          await page.click('.faq-q');
          assert.equal(await page.getAttribute('.faq-q', 'aria-expanded'), 'true');
        }
        await page.context().close();
      }
    },
  },
];
