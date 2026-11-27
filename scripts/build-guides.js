// 업종별 마케팅 가이드 페이지 생성: node scripts/build-guides.js
// 입력: scripts/guides-data.js  →  출력: marketing/index.html, marketing/<slug>.html
// 생성된 HTML은 직접 고치지 말고 데이터를 고친 뒤 다시 실행한다. (sitemap.xml 의 marketing 항목도 같이 갱신)
const fs = require('fs');
const path = require('path');
const { UPDATED, CASES, PAGES, COST } = require('./guides-data');

const ASSET_V = 1; // assets/guide.css·guide.js 를 고치면 올릴 것 (/assets 1년 캐시)
const SITE = 'https://www.muyi.co.kr';
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'marketing');
const ORG = { '@id': `${SITE}/#organization` };
const ORG_NODE = {
  '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'MUYI',
  alternateName: ['무이', '무이코퍼레이션', '주식회사 무이코퍼레이션', 'MUYI Corporation'],
  legalName: '주식회사 무이코퍼레이션', url: `${SITE}/`, logo: `${SITE}/assets/logo/logo-blue.png`,
  telephone: '+82-70-8833-8210', email: 'info@muyi.co.kr',
  address: { '@type': 'PostalAddress', streetAddress: '디지털로 178 퍼블릭 가산 B1313', addressLocality: '금천구', addressRegion: '서울특별시', addressCountry: 'KR' },
  sameAs: ['https://www.instagram.com/muyi_official_/', 'https://pf.kakao.com/_VbxkKG', 'https://www.youtube.com/@muyicorp'],
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (s) => s.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '');
const ld = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function head({ url, title, desc, keywords, graph }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<!-- 생성 파일: scripts/build-guides.js (직접 수정 금지) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GMHE5GQDBV"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GMHE5GQDBV');gtag('config','AW-11170573795');</script>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="${esc(keywords)}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<meta name="theme-color" content="#0A0A0B">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="MUYI">
<meta property="og:image" content="${SITE}/assets/og/local-business.png">
<meta property="og:locale" content="ko_KR">
<meta property="article:modified_time" content="${UPDATED}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" sizes="512x512" href="/assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/guide.css?v=${ASSET_V}">
<script type="application/ld+json">${ld({ '@context': 'https://schema.org', '@graph': graph })}</script>
<script src="/assets/muyi-monitor.js?v=2"></script>
</head>
<body>
<header id="hd">
  <a href="/" class="hd-logo" aria-label="MUYI 홈"><img src="/assets/logo/logo-white.png" alt="MUYI" width="1512" height="1512"></a>
  <div class="hd-r">
    <a href="/marketing" class="btn">업종별 가이드</a>
    <a href="#order" class="btn btn-p">무료 진단</a>
  </div>
</header>
<main>`;
}

function foot(dock) {
  return `</main>
${dock ? `<a href="#order" class="dock"><b>${dock}</b><span>신청 →</span></a>` : ''}
<footer>
  <div class="wrap">주식회사 무이코퍼레이션 · 대표 이채원 · 사업자등록번호 481-81-02827 · 서울특별시 금천구 디지털로 178 퍼블릭 가산 B1313 · <a href="tel:070-8833-8210">070-8833-8210</a> · <a href="mailto:info@muyi.co.kr">info@muyi.co.kr</a> · <a href="/case-studies">마케팅 사례</a> · <a href="/local-business">소상공인 무료 진단</a> · <a href="/shortform-marketing">숏폼 마케팅</a></div>
</footer>
<script src="/assets/guide.js?v=${ASSET_V}"></script>
</body>
</html>
`;
}

const crumb = (name) => `<nav class="crumb rise" aria-label="현재 위치"><a href="/">MUYI</a> › <a href="/marketing">업종별 마케팅 가이드</a> › ${esc(name)}</nav>`;
const breadcrumb = (name, url) => ({ '@type': 'BreadcrumbList', itemListElement: [
  { '@type': 'ListItem', position: 1, name: 'MUYI 홈', item: `${SITE}/` },
  { '@type': 'ListItem', position: 2, name: '업종별 마케팅 가이드', item: `${SITE}/marketing` },
  { '@type': 'ListItem', position: 3, name, item: url },
] });
const faqLd = (url, faq) => ({ '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

const hero = (name, h1, q, answer, cta) => `
<section id="top">
  <div class="wrap">
    ${crumb(name)}
    <span class="eyebrow dsp rise">Marketing guide</span>
    <h1 class="rise">${h1}</h1>
    <div class="answer rise"><b>짧은 답</b><p>${esc(answer)}</p></div>
    <div class="hero-cta rise">
      <a href="#order" class="btn btn-p btn-lg">${cta}</a>
      <a href="#faq" class="btn btn-lg">자주 묻는 질문</a>
    </div>
    <p class="upd rise">최종 수정 <time datetime="${UPDATED}">${UPDATED.replace(/-/g, '.')}</time> · 작성 MUYI(무이코퍼레이션)</p>
  </div>
</section>
<div class="proof wrap rise" aria-label="MUYI 실적">
  <div><b class="dsp">2,800+</b><span>누적 매장 진단</span></div>
  <div><b class="dsp">300+</b><span>무이 스튜디오 촬영</span></div>
  <div><b class="dsp">0원</b><span>무료 진단 · 계약 의무 없음</span></div>
  <div><b class="dsp">3개월</b><span>단위 성과 점검</span></div>
</div>`;

const faqHtml = (title, faq) => `
<section class="sec" id="faq">
  <div class="wrap">
    <span class="eyebrow dsp rise">FAQ</span>
    <h2 class="rise">${esc(title)}</h2>
    <div class="rise">
${faq.map(([q, a]) => `      <div class="faq-i"><button class="faq-q" type="button" aria-expanded="false">${esc(q)}</button><div class="faq-a"><div><p>${esc(a)}</p></div></div></div>`).join('\n')}
    </div>
  </div>
</section>`;

const formHtml = ({ industry, page, source, title, bullets, button, placeholder }) => `
<section id="order">
  <div class="wrap order-in">
    <div class="order-hd rise">
      <span class="eyebrow dsp">Free diagnosis</span>
      <h2>${title}</h2>
      <ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </div>
    <form class="form-box rise" id="form" novalidate data-industry="${esc(industry)}" data-page="${esc(page)}" data-source="${source}">
      <div class="fg"><label class="fl" for="f-store">상호명<span class="req">*</span></label><input class="fi" id="f-store" type="text" name="store" autocomplete="organization" required></div>
      <div class="fg"><label class="fl" for="f-phone">연락처<span class="req">*</span></label><input class="fi" id="f-phone" type="tel" name="phone" placeholder="010-0000-0000" inputmode="numeric" autocomplete="tel" maxlength="13" required></div>
      <div class="fg"><label class="fl" for="f-msg">문의 내용<span class="req">*</span></label><textarea class="ft" id="f-msg" name="message" placeholder="${esc(placeholder)}" required></textarea></div>
      <label class="agree"><input type="checkbox" id="f-agree" name="agree" required><span>개인정보 수집·이용에 동의합니다. (<a href="/local-business" target="_blank" rel="noopener">전문 보기</a>)<span class="req">*</span></span></label>
      <button class="fsub" type="submit" id="sbtn">${button}</button>
      <div class="fst" id="fst" role="status" aria-live="polite"></div>
      <p class="alt">바로 답변 받고 싶다면 → <a href="https://pf.kakao.com/_VbxkKG/chat" target="_blank" rel="noopener">카카오톡으로 문의하기</a></p>
    </form>
  </div>
</section>`;

const moreHtml = (cur) => `
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">More guides</span>
    <h2 class="rise">다른 업종 마케팅 가이드</h2>
    <ul class="more rise">
${[...PAGES.map((p) => [p.slug, p.label]), [COST.slug, '숏폼 제작 비용']].map(([s, l]) => `      <li><a href="/marketing/${s}"${s === cur ? ' aria-current="page"' : ''}>${esc(l)}</a></li>`).join('\n')}
    </ul>
  </div>
</section>`;

function industryPage(p) {
  const url = `${SITE}/marketing/${p.slug}`;
  const name = `${p.label} 마케팅`;
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: strip(p.h1), headline: p.q, description: p.desc, inLanguage: 'ko-KR', datePublished: UPDATED, dateModified: UPDATED, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${url}#service` }, publisher: ORG, author: ORG, breadcrumb: breadcrumb(name, url) },
    { '@type': 'Service', '@id': `${url}#service`, name: `${p.label} 마케팅 대행`, serviceType: `${p.industry} 마케팅`, description: p.answer, provider: ORG, areaServed: { '@type': 'Country', name: '대한민국' }, audience: { '@type': 'BusinessAudience', name: `${p.label} 사업자` },
      offers: { '@type': 'Offer', name: `${p.label} 무료 마케팅 진단`, price: '0', priceCurrency: 'KRW', url: `${url}#order` } },
    faqLd(url, p.faq),
    ORG_NODE,
  ];
  const cases = p.cases.map((k) => CASES[k]);
  return head({ url, title: p.title, desc: p.desc, keywords: p.keywords, graph }) +
    hero(name, p.h1, p.q, p.answer, `${esc(p.label)} 무료 진단 받기`) + `
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">Problem</span>
    <h2 class="rise">${esc(p.label)} 사장님이 가장 많이 겪는 문제</h2>
    <ul class="pain">
${p.problems.map(([h, t], i) => `      <li><i>0${i + 1}</i><div><h3>${esc(h)}</h3><p>${esc(t)}</p></div></li>`).join('\n')}
    </ul>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">How MUYI works</span>
    <h2 class="rise">MUYI는 이 순서로 합니다</h2>
    <ol class="steps rise">
${p.steps.map(([h, t]) => `      <li class="step"><h3>${esc(h)}</h3><p>${esc(t)}</p></li>`).join('\n')}
    </ol>
  </div>
</section>
${cases.length || p.extra ? `<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">Case</span>
    <h2 class="rise">관련 사례</h2>
    ${cases.length ? `<div class="cs rise">
${cases.map((c) => `      <a href="/case-studies#${c.id}"><div class="ci"><img src="/cases/opt/${c.img}" alt="${esc(c.name)} 마케팅 사례" loading="lazy" width="800" height="600"></div><div class="ct"><small>${esc(c.tag)}</small><h3>${esc(c.name)}</h3><p>${esc(c.text)}</p></div></a>`).join('\n')}
    </div>` : ''}
    ${p.extra ? `<p class="extra rise">${esc(p.extra)}</p>` : ''}
  </div>
</section>` : ''}
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">Cost</span>
    <h2 class="rise">${esc(p.label)} 마케팅 비용</h2>
    <table class="pt rise">
      <thead><tr><th>항목</th><th>금액</th><th>설명</th></tr></thead>
      <tbody>
        <tr><td>무료 진단</td><td>0원</td><td>광고비 누수 리포트 · 같은 상권 경쟁사 3곳 분석 · 30일 실행 체크리스트. 계약 의무 없음</td></tr>
        <tr><td>매체 광고비</td><td>대부분 월 10만 원대부터</td><td>네이버·구글·메타에 직접 집행되는 금액. 업종·상권에 따라 다름</td></tr>
        <tr><td>숏폼 제작</td><td>20만 원부터</td><td>무이 스튜디오 방문 촬영·편집, 편집본·원본 제공 (<a href="/marketing/shortform-cost">비용 자세히</a>)</td></tr>
        <tr><td>대행 수수료</td><td>진단 후 안내</td><td>채널·운영 범위에 따라 결정. 최소 계약 기간 강요 없음</td></tr>
      </tbody>
    </table>
  </div>
</section>
` + formHtml({ industry: p.industry, page: p.label, source: 'local-business-diagnosis', title: `${esc(p.label)} 무료 진단 신청`, bullets: ['비용 0원, 계약 의무 없음', '영업일 기준 24시간 안에 연락', '전국 전화·화상 상담 (약 15분)'], button: '무료 진단 신청하기', placeholder: '지금 하고 있는 마케팅, 고민되는 점 (예: 플레이스 순위, 광고비)' }) +
    faqHtml(`${p.label} 마케팅 자주 묻는 질문`, p.faq) + moreHtml(p.slug) + `
<div class="wrap"><p class="about">MUYI(주식회사 무이코퍼레이션)는 서울 금천구 가산동에 있는 마케팅 대행사입니다. 2023년 설립, 직원 12명, 누적 매장 진단 2,800곳 이상. 영상 촬영 브랜드 무이 스튜디오(MUYI studio)가 매장을 직접 촬영하고(300건+), 네이버 플레이스·검색·인스타그램을 한 팀이 운영해 방문과 문의로 이어지게 합니다.</p></div>
` + foot(`${esc(p.label)} 무료 진단 0원`);
}

function costPage() {
  const c = COST;
  const url = `${SITE}/marketing/${c.slug}`;
  const name = '숏폼 제작 비용';
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name, headline: c.q, description: c.desc, inLanguage: 'ko-KR', datePublished: UPDATED, dateModified: UPDATED, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/shortform-marketing#service` }, publisher: ORG, author: ORG, breadcrumb: breadcrumb(name, url) },
    { '@type': 'Service', '@id': `${url}#service`, name: '매장 숏폼 제작', serviceType: '숏폼 영상 제작', provider: ORG, areaServed: { '@type': 'Country', name: '대한민국' },
      offers: { '@type': 'Offer', name: '숏폼 제작 (단건)', priceCurrency: 'KRW', priceSpecification: { '@type': 'PriceSpecification', minPrice: 200000, priceCurrency: 'KRW' }, url: `${url}#order` } },
    faqLd(url, c.faq),
    ORG_NODE,
  ];
  return head({ url, title: c.title, desc: c.desc, keywords: c.keywords, graph }) +
    hero(name, '가게 숏폼 제작 비용,<br><em>얼마</em>면 될까?', c.q, c.answer, '숏폼 제작 상담 받기') + `
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">Price</span>
    <h2 class="rise">MUYI 숏폼 비용표</h2>
    <table class="pt rise">
      <thead><tr><th>항목</th><th>금액</th><th>포함 내용</th></tr></thead>
      <tbody>
${c.rows.map((r) => `        <tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">Factors</span>
    <h2 class="rise">숏폼 비용을 정하는 4가지</h2>
    <ol class="steps rise">
${c.factors.map(([h, t]) => `      <li class="step"><h3>${esc(h)}</h3><p>${esc(t)}</p></li>`).join('\n')}
    </ol>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <span class="eyebrow dsp rise">Checklist</span>
    <h2 class="rise">숏폼 업체에 맡기기 전 확인할 것</h2>
    <ul class="checks rise">
${c.checks.map((t) => `      <li>${esc(t)}</li>`).join('\n')}
    </ul>
    <p class="extra rise">무이 스튜디오가 직접 촬영한 릴스는 <a href="/shortform-marketing">숏폼 마케팅 페이지</a>에서 볼 수 있습니다.</p>
  </div>
</section>
` + formHtml({ industry: '숏폼 제작', page: '숏폼 제작 비용', source: 'shortform-order', title: '숏폼 제작 상담 신청', bullets: ['숏폼 제작 20만 원부터', '무이 스튜디오 직접 방문 촬영', '편집본·촬영 원본 모두 제공'], button: '숏폼 제작 상담 신청하기', placeholder: '필요한 영상 (예: 릴스 3편, 촬영 희망일, 참고 영상 링크)' }) +
    faqHtml('숏폼 제작 비용 자주 묻는 질문', c.faq) + moreHtml(c.slug) + `
<div class="wrap"><p class="about">MUYI(주식회사 무이코퍼레이션)는 음식점·카페·미용실 등 오프라인 매장의 숏폼 마케팅 회사입니다. 영상 촬영 브랜드 무이 스튜디오(MUYI studio)가 매장에 직접 방문해 촬영·편집하며(300건+), 비디오물제작업 신고 사업자입니다.</p></div>
` + foot('숏폼 제작 20만원부터');
}

function hubPage() {
  const url = `${SITE}/marketing`;
  const all = [...PAGES.map((p) => ({ slug: p.slug, label: `${p.label} 마케팅`, q: p.q })), { slug: COST.slug, label: '숏폼 제작 비용', q: COST.q }];
  const graph = [
    { '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: '업종별 마케팅 가이드 — MUYI', inLanguage: 'ko-KR', dateModified: UPDATED, isPartOf: { '@id': `${SITE}/#website` }, publisher: ORG,
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'MUYI 홈', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: '업종별 마케팅 가이드', item: url }] },
      mainEntity: { '@type': 'ItemList', itemListElement: all.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.label, url: `${url}/${p.slug}` })) } },
    ORG_NODE,
  ];
  return head({ url, title: '업종별 마케팅 가이드 | 음식점·카페·미용실·병원·학원·프랜차이즈 — MUYI', desc: '음식점·카페·미용실·병원·필라테스·학원·프랜차이즈·네이버 플레이스까지, 업종별로 마케팅을 무엇부터 해야 하는지와 비용을 정리했습니다. MUYI(무이코퍼레이션) 무료 진단 0원.', keywords: '업종별 마케팅, 소상공인 마케팅, 자영업 마케팅, 매장 마케팅 대행, 로컬 마케팅', graph }) + `
<section id="top">
  <div class="wrap">
    <span class="eyebrow dsp rise">Marketing guides</span>
    <h1 class="rise">업종별 마케팅,<br><em>무엇부터</em> 해야 할까?</h1>
    <div class="answer rise"><b>짧은 답</b><p>오프라인 매장은 업종마다 손님이 가게를 고르는 경로가 다릅니다. 음식점·카페는 플레이스와 숏폼, 미용실은 플레이스 예약과 리뷰, 병원·학원·필라테스는 상담 신청 흐름이 먼저입니다. 아래에서 업종을 고르면 MUYI가 실제로 하는 순서와 비용을 볼 수 있습니다.</p></div>
    <p class="upd rise">최종 수정 <time datetime="${UPDATED}">${UPDATED.replace(/-/g, '.')}</time></p>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <ul class="hub">
${all.map((p) => `      <li class="rise"><a href="/marketing/${p.slug}"><div><b>${esc(p.label)}</b><span>${esc(p.q)}</span></div><i aria-hidden="true">→</i></a></li>`).join('\n')}
    </ul>
  </div>
</section>
` + formHtml({ industry: '기타', page: '업종별 가이드', source: 'local-business-diagnosis', title: '우리 매장 무료 진단', bullets: ['비용 0원, 계약 의무 없음', '같은 상권 경쟁사 3곳 분석', '30일 실행 체크리스트'], button: '무료 진단 신청하기', placeholder: '업종과 지역, 고민되는 점 (예: 성수동 카페, 플레이스 순위)' }) + foot('무료 진단 0원');
}

fs.mkdirSync(OUT, { recursive: true });
const written = [];
const put = (f, html) => { fs.writeFileSync(path.join(OUT, f), html); written.push(f); };
put('index.html', hubPage());
PAGES.forEach((p) => put(`${p.slug}.html`, industryPage(p)));
put(`${COST.slug}.html`, costPage());

// sitemap.xml: <!-- guides:start --> ~ <!-- guides:end --> 구간만 다시 씀
const smPath = path.join(ROOT, 'sitemap.xml');
const sm = fs.readFileSync(smPath, 'utf8');
const urls = ['', ...PAGES.map((p) => `/${p.slug}`), `/${COST.slug}`].map((s) => `  <url>\n    <loc>${SITE}/marketing${s}</loc>\n    <lastmod>${UPDATED}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${s ? '0.8' : '0.7'}</priority>\n  </url>`).join('\n');
const block = `  <!-- guides:start (scripts/build-guides.js 가 생성) -->\n${urls}\n  <!-- guides:end -->`;
const next = /<!-- guides:start/.test(sm) ? sm.replace(/  <!-- guides:start[\s\S]*?<!-- guides:end -->/, block) : sm.replace('</urlset>', `${block}\n</urlset>`);
fs.writeFileSync(smPath, next);
console.log(`생성: ${written.map((f) => 'marketing/' + f).join(', ')} + sitemap.xml`);
