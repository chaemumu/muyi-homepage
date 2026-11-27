// IndexNow: 배포 직후 sitemap.xml 의 모든 주소를 Bing·네이버 등에 "바뀌었음"으로 알림
// 실행: node scripts/indexnow.js   (vercel-deploy.yml 이 배포 뒤 자동 실행)
// 키 = 저장소 루트의 <키>.txt (내용도 키). 키를 바꾸면 파일 이름·내용·vercel.json 헤더를 같이 바꿀 것
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HOST = 'www.muyi.co.kr';
const keyFile = fs.readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('IndexNow 키 파일이 없습니다'); process.exit(1); }
const key = fs.readFileSync(path.join(ROOT, keyFile), 'utf8').trim();
const urlList = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

(async () => {
  const body = { host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList };
  for (const ep of ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow']) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
      console.log(`${ep} → HTTP ${r.status} (${urlList.length}개 주소)`);
    } catch (e) { console.log(`${ep} → 실패: ${e.message}`); }
  }
})();
