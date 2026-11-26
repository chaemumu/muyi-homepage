// 실행: node tests/run.js            (전체)
//       node tests/run.js camp       (파일 이름에 'camp'가 든 것만)
// 각 cases/*.js 는 [{ name, run: async ({ browser, base }) => {} }] 를 내보낸다. 실패 = throw (node:assert)
const fs = require('fs');
const path = require('path');
const { chromium, serve } = require('./lib');

(async () => {
  const only = process.argv[2] || '';
  const files = fs.readdirSync(path.join(__dirname, 'cases')).filter((f) => f.endsWith('.js') && f.includes(only)).sort();
  const srv = await serve();
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  for (const f of files) for (const t of require(path.join(__dirname, 'cases', f))) {
    const t0 = Date.now();
    try { await t.run({ browser, base: srv.url }); pass++; console.log(`✓ ${f.replace('.js', '')} · ${t.name} (${Date.now() - t0}ms)`); }
    catch (e) { fail++; console.log(`✗ ${f.replace('.js', '')} · ${t.name}\n    ${String(e.message || e).split('\n').join('\n    ')}`); }
  }
  await browser.close(); srv.close();
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
