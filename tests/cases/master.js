// 마스터 전용 화면(정산·가져오기·계정 관리): 마스터가 아니면 메뉴도 주소(#settle 등)도 안 열림
const assert = require('node:assert/strict');
const { adminPage } = require('../lib');

const visible = (p) => p.evaluate(() => ['today', 'settle', 'import', 'accounts'].filter((k) => !document.getElementById('pg-' + k).hidden));
const navs = (p) => p.evaluate(() => ['navSettle', 'navImport', 'navAccounts'].filter((k) => !document.getElementById(k).hidden));

module.exports = [
  ...['settle', 'import', 'accounts'].map((pg) => ({
    name: `마스터 아님: 주소 #${pg}로 들어와도 오늘 할 일 · 메뉴 숨김`,
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { hash: '#' + pg, data: { __rpc: { is_master: false } } });
      await p.waitForTimeout(600);
      assert.deepEqual(await visible(p), ['today']); assert.deepEqual(await navs(p), []);
      await p.evaluate((k) => { location.hash = k; window.dispatchEvent(new PopStateEvent('popstate')); }, pg); await p.waitForTimeout(300);
      assert.deepEqual(await visible(p), ['today'], '뒤로가기·주소 변경으로도 안 열림');
      assert.deepEqual(p.errors, []); await p.context().close();
    },
  })),
  {
    name: '마스터: 주소 #settle로 들어오면 정산 화면 · 메뉴 보임',
    async run({ browser, base }) {
      const p = await adminPage(browser, base, { hash: '#settle' });
      await p.waitForTimeout(800);
      assert.deepEqual(await visible(p), ['settle']); assert.deepEqual(await navs(p), ['navSettle', 'navImport', 'navAccounts']);
      await p.context().close();
    },
  },
];
