// 테스트 공통: 정적 서버 + 가짜 Supabase를 넣은 브라우저 페이지
// 실제 DB·함수는 건드리지 않는다 (모든 쓰기는 window.__writes에만 기록)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const STUB = fs.readFileSync(path.join(__dirname, 'sb-stub.js'), 'utf8');

function serve() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      if (p === '/admin') p = '/admin.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(d); });
    });
    s.listen(0, () => ok({ url: `http://localhost:${s.address().port}`, close: () => s.close() }));
  });
}

// data: 가짜 DB 픽스처 { 테이블: [행] } · device: Playwright 기기 이름(예: 'iPhone 13') 또는 viewport
async function adminPage(browser, base, { data = {}, device, viewport = { width: 1280, height: 900 }, hash = '' } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((d) => { window.__SB_DATA = d; }, data);
  await page.route(/supabase-js/, (r) => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await page.route(/supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })); // 혹시 직접 fetch해도 실제 서버로 안 나감
  await page.goto(`${base}/admin.html${hash}`);
  await page.waitForFunction(() => !document.getElementById('app')?.hidden, null, { timeout: 10000 });
  return page;
}
const writes = (page, table) => page.evaluate((t) => (window.__writes || []).filter((w) => !t || w.table === t), table);

// 체험단 발표 상세(crm-camp.js) 열기
async function openCamp(page, args) {
  await page.evaluate(async (a) => {
    if (!window.CRM_CAMP) await new Promise((ok, ng) => { const s = document.createElement('script'); s.src = '/assets/crm-camp.js?test'; s.onload = ok; s.onerror = ng; document.head.append(s); });
    window.CRM_CAMP.open(a);
  }, args);
  await page.waitForSelector('.ca-steps');
}
const tab = async (page, name) => { await page.locator('.ca-steps button', { hasText: name }).first().click(); await page.waitForTimeout(250); };

module.exports = { chromium, serve, adminPage, writes, openCamp, tab, ROOT };
