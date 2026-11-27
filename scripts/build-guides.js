// 업종별 가이드 섹션 생성: node scripts/build-guides.js
// 입력 scripts/guides-data.js → 두 페이지의 표시 구간만 다시 씀 (몇 번을 돌려도 결과 같음)
//   local-business.html      : <!-- guide:css --> · <!-- guide:section --> (#guide, 업종 탭 #guide-<slug>) · <!-- guide:js -->
//                              + FAQPage JSON-LD 끝에 업종 질문 추가 (@id …#faq-g-<slug>-<n>, 이미 있는 질문은 건너뜀)
//   shortform-marketing.html : <!-- guide:css --> · <!-- guide:section --> (#cost, 숏폼 제작 비용) + FAQPage 에 비용 질문 추가
const fs = require('fs');
const path = require('path');
const { CASES, PAGES, COST } = require('./guides-data');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.muyi.co.kr';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

// 표시 구간 교체. 처음이면 anchor 앞(before) 또는 뒤(after)에 새로 넣음
function block(html, name, body, anchor, where) {
  const re = new RegExp(`<!-- guide:${name}:start[^>]*-->[\\s\\S]*?<!-- guide:${name}:end -->`);
  const out = `<!-- guide:${name}:start (scripts/build-guides.js 가 생성 — 직접 수정 금지) -->\n${body}\n<!-- guide:${name}:end -->`;
  if (re.test(html)) return html.replace(re, () => out);
  const i = html.indexOf(anchor);
  if (i < 0 || html.indexOf(anchor, i + 1) >= 0) throw new Error(`기준 위치를 하나로 못 찾음: ${anchor.slice(0, 60)}`);
  return where === 'after' ? html.slice(0, i + anchor.length) + '\n' + out + html.slice(i + anchor.length) : html.slice(0, i) + out + '\n' + html.slice(i);
}

// FAQPage(@id = faqId)의 mainEntity 배열 끝에 질문 추가. 예전에 넣은 것(#faq-g-)은 지우고 다시 넣음
function addFaq(html, faqId, items) {
  const at = html.indexOf(`"@id":"${faqId}"`);
  if (at < 0) throw new Error(`FAQPage 없음: ${faqId}`);
  const open = html.indexOf('"mainEntity":[', at) + '"mainEntity":['.length;
  let depth = 1, i = open, str = false;
  for (; depth; i++) {
    const c = html[i];
    if (str) { if (c === '\\') i++; else if (c === '"') str = false; }
    else if (c === '"') str = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  const close = i - 1; // 배열의 ]
  let arr = html.slice(open, close);
  const cut = arr.search(/,\s*\{"@type":"Question","@id":"[^"]*#faq-g-/);
  if (cut >= 0) arr = arr.slice(0, cut);
  const have = new Set(JSON.parse(`[${arr}]`).map((q) => q.name));
  const add = items.filter((q) => !have.has(q.name)).map((q) => ld(q));
  return { have, html: html.slice(0, open) + arr.replace(/\s+$/, '') + (add.length ? ',\n        ' + add.join(',\n        ') + '\n      ' : '\n      ') + html.slice(close), added: add.length };
}
// 페이지 FAQPage 에 원래 있던 질문 이름 (화면에 같은 질문이 두 번 나오지 않게 섹션에서 뺄 때 씀)
const baseFaq = (html, faqId) => addFaq(html, faqId, []).have;
const question = (id, q, a) => ({ '@type': 'Question', '@id': id, name: q, acceptedAnswer: { '@type': 'Answer', text: a } });

// ───────── local-business: 업종별 가이드 섹션 ─────────
const LB_CSS = `<style>
/* 업종별 가이드 (#guide) — 탭으로 한 업종씩. 모든 업종 내용은 HTML에 그대로 있음(검색·AI가 읽음) */
.gd-tabs{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin-bottom:clamp(1.6rem,3.4vw,2.4rem)}
.gd-p{display:none;max-width:860px;margin:0 auto}
.gd-p.on{display:block;animation:gdIn .5s var(--ease)}
@keyframes gdIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.gd-q{font-size:clamp(1.25rem,2.8vw,1.7rem);font-weight:800;letter-spacing:-.02em;line-height:1.35;color:var(--text);word-break:keep-all;margin-bottom:1rem}
.gd-a{position:relative;padding:1.15rem 1.3rem 1.15rem 1.5rem;border-radius:var(--r-md);background:var(--surface);border:1px solid var(--line-str);color:var(--text);line-height:1.8;word-break:keep-all}
.gd-a::before{content:'';position:absolute;left:0;top:.9rem;bottom:.9rem;width:3px;border-radius:3px;background:var(--brand)}
.gd-a b{display:block;font-size:.76rem;letter-spacing:.06em;color:var(--brand);margin-bottom:.3rem}
.gd-steps{list-style:none;counter-reset:g;display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);margin:1.6rem 0 1.2rem}
.gd-steps li{counter-increment:g;padding:1.1rem .9rem 1.1rem 0;border-bottom:1px solid var(--line);transition:color var(--dur) var(--ease)}
.gd-steps li::before{content:'0' counter(g);display:block;font-weight:800;font-size:.74rem;letter-spacing:.14em;color:var(--brand);margin-bottom:.35rem}
.gd-steps b{display:block;font-size:.98rem;color:var(--text);margin-bottom:.25rem}
.gd-steps span{font-size:.86rem;color:var(--text-sub);line-height:1.65;word-break:keep-all}
.gd-steps li:hover b{color:var(--brand)}
.gd-meta{font-size:.88rem;color:var(--text-sub);line-height:1.8;word-break:keep-all;margin-bottom:.5rem}
.gd-meta b{color:var(--text)}
.gd-meta a{color:var(--brand)}
.gd-p .faq-l{margin-top:1.2rem}
.gd-cta{margin-top:1.6rem}
@media (max-width:760px){.gd-steps{grid-template-columns:repeat(2,1fr)}}
@media (max-width:420px){.gd-steps{grid-template-columns:1fr}}
.lp-only #guide{display:none!important}
</style>`;

let LB_HAVE = new Set(), SF_HAVE = new Set();
const lbPanel = (p, i) => {
  const cases = p.cases.map((k) => CASES[k]);
  return `      <article class="gd-p${i ? '' : ' on'}" id="guide-${p.slug}" role="tabpanel" aria-labelledby="gdt-${p.slug}">
        <h3 class="gd-q">${esc(p.q)}</h3>
        <p class="gd-a"><b>짧은 답</b>${esc(p.answer)}</p>
        <ol class="gd-steps">${p.steps.map(([h, t]) => `<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join('')}</ol>
        <p class="gd-meta"><b>비용</b> 무료 진단 0원 · 매체 광고비 대부분 월 10만 원대부터 · 숏폼 제작 20만 원부터(<a href="/shortform-marketing#cost">숏폼 비용</a>) · 대행 수수료는 진단 후 안내</p>
${cases.length ? `        <p class="gd-meta"><b>관련 사례</b> ${cases.map((c) => `<a href="/case-studies#${c.id}">${esc(c.name)}</a>`).join(' · ')}</p>\n` : ''}${p.extra ? `        <p class="gd-meta">${esc(p.extra)}</p>\n` : ''}        <div class="faq-l">
${p.faq.filter(([q]) => !LB_HAVE.has(q)).map(([q, a]) => `          <div class="faq-i"><button class="faq-q" type="button" aria-expanded="false">${esc(q)}<span class="faq-ic"></span></button><div class="faq-a"><div class="faq-a-in">${esc(a)}</div></div></div>`).join('\n')}
        </div>
        <a class="btn btn-primary gd-cta" href="#cta" data-biz="${esc(p.biz)}">${esc(p.label)} 무료 진단 신청<svg class="btn-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a>
      </article>`;
};

const LB_SECTION = () => `<!-- ═══════════ S05-B. 업종별 가이드 (탭, #guide-<업종>) ═══════════ -->
<section id="guide" class="sec">
  <div class="wrap">
    <div class="sec-head mid rise">
      <span class="eyebrow dsp">Guide</span>
      <h2 class="sec-h2 dsp">업종별로 무엇부터 해야 할까요?</h2>
      <p class="sec-p">업종마다 손님이 가게를 고르는 경로가 다릅니다. 업종을 누르면 MUYI가 실제로 하는 순서와 비용을 보여드립니다.</p>
    </div>
    <div class="gd-tabs rise" role="tablist" aria-label="업종 선택">
${PAGES.map((p, i) => `      <button class="rf-b${i ? '' : ' sel'}" type="button" role="tab" id="gdt-${p.slug}" aria-controls="guide-${p.slug}" aria-selected="${i ? 'false' : 'true'}" data-g="${p.slug}">${esc(p.label)}</button>`).join('\n')}
    </div>
    <div class="rise">
${PAGES.map(lbPanel).join('\n')}
    </div>
  </div>
</section>`;

const LB_JS = `<script>
/* 업종별 가이드 탭: 주소 #guide-<업종> 으로 바로 열림 · [무료 진단 신청] = 폼으로 이동 + 업종 미리 선택 */
(function(){
  var tabs=document.querySelectorAll('#guide [data-g]');
  function show(slug,push){
    var hit=false;
    tabs.forEach(function(t){var on=t.dataset.g===slug;hit=hit||on;t.classList.toggle('sel',on);t.setAttribute('aria-selected',on?'true':'false');
      document.getElementById('guide-'+t.dataset.g).classList.toggle('on',on);});
    if(hit&&push&&history.replaceState)history.replaceState(null,'','#guide-'+slug);
    return hit;
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){show(t.dataset.g,true);});});
  var m=location.hash.match(/^#guide-([a-z-]+)$/);
  if(m&&show(m[1])){var sec=document.getElementById('guide');setTimeout(function(){sec.scrollIntoView();},0);}
  document.querySelectorAll('#guide .gd-cta').forEach(function(a){a.addEventListener('click',function(e){
    var cta=document.getElementById('cta');if(!cta)return;
    e.preventDefault();cta.scrollIntoView({behavior:'smooth'});
    var b=a.dataset.biz&&document.querySelector('#bizGrid .biz-b[data-biz="'+a.dataset.biz+'"]');
    if(b&&!b.classList.contains('sel'))b.click();
  });});
})();
</script>`;

// ───────── shortform-marketing: 숏폼 제작 비용 섹션 ─────────
const SF_CSS = `<style>
/* 숏폼 제작 비용 (#cost) */
.pt{width:100%;border-collapse:collapse;font-size:.95rem;margin-bottom:2.4rem}
.pt th,.pt td{text-align:left;padding:1rem .9rem;border-bottom:1px solid var(--line);vertical-align:top}
.pt th{font-size:.78rem;letter-spacing:.06em;color:var(--text-mute);font-weight:700}
.pt td:nth-child(2){font-weight:800;color:var(--brand-hi);white-space:nowrap}
.pt td:nth-child(3){color:var(--text-sub)}
.pt tbody tr{transition:background .3s}
.pt tbody tr:hover{background:var(--surface)}
.cost-ans{max-width:72ch;color:var(--text);margin-bottom:2rem;padding-left:1rem;border-left:3px solid var(--brand)}
.cost-h3{font-size:1.15rem;font-weight:900;letter-spacing:-.02em;margin:2.4rem 0 1rem}
.checks{list-style:none;display:grid;gap:.6rem}
.checks li{padding:.9rem 1.1rem;border:1px solid var(--line);border-radius:1rem;transition:border-color .3s var(--ease),transform .3s var(--ease)}
.checks li::before{content:'✓';color:var(--brand);font-weight:800;margin-right:.6rem}
.checks li:hover{border-color:var(--brand);transform:translateX(4px)}
#cost .faq-l{margin-top:2rem}
#cost .steps{list-style:none}
@media (max-width:620px){.pt thead{display:none}.pt tr{display:block;padding:.8rem 0;border-bottom:1px solid var(--line)}.pt td{display:block;border:0;padding:.15rem 0}}
@media (max-width:900px){#cost .steps{grid-template-columns:repeat(2,1fr)}}
@media (max-width:520px){#cost .steps{grid-template-columns:1fr}}
</style>`;

const SF_SECTION = () => `<section class="sec" id="cost">
  <div class="wrap">
    <span class="eyebrow dsp rise">Price</span>
    <h2 class="rise">${esc(COST.q)}</h2>
    <p class="cost-ans rise">${esc(COST.answer)}</p>
    <table class="pt rise">
      <thead><tr><th>항목</th><th>금액</th><th>포함 내용</th></tr></thead>
      <tbody>
${COST.rows.map((r) => `        <tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('\n')}
      </tbody>
    </table>
    <h3 class="cost-h3 rise">숏폼 비용을 정하는 4가지</h3>
    <ol class="steps rise">
${COST.factors.map(([h, t]) => `      <li class="step"><h3>${esc(h)}</h3><p>${esc(t)}</p></li>`).join('\n')}
    </ol>
    <h3 class="cost-h3 rise">숏폼 업체에 맡기기 전 확인할 것</h3>
    <ul class="checks rise">
${COST.checks.map((t) => `      <li>${esc(t)}</li>`).join('\n')}
    </ul>
    <div class="faq-l rise">
${COST.faq.filter(([q]) => !SF_HAVE.has(q)).map(([q, a]) => `      <div class="faq-i"><button class="faq-q" type="button" aria-expanded="false">${esc(q)}</button><div class="faq-a"><div><p>${esc(a)}</p></div></div></div>`).join('\n')}
    </div>
    <div class="hero-cta rise"><a href="#order" class="btn btn-p btn-lg">숏폼 제작 의뢰하기 <span class="price-tag">20만원~</span></a></div>
  </div>
</section>`;

// ───────── 쓰기 ─────────
const lbPath = path.join(ROOT, 'local-business.html');
let lb = fs.readFileSync(lbPath, 'utf8');
LB_HAVE = baseFaq(lb, `${SITE}/local-business#faq`);
lb = block(lb, 'css', LB_CSS, '</head>', 'before');
lb = block(lb, 'section', LB_SECTION(), '<!-- ═══════════ S06. 실증', 'before');
lb = block(lb, 'js', LB_JS, '</body>', 'before');
const lbFaq = addFaq(lb, `${SITE}/local-business#faq`, PAGES.flatMap((p) => p.faq.map(([q, a], n) => question(`${SITE}/local-business#faq-g-${p.slug}-${n + 1}`, q, a))));
fs.writeFileSync(lbPath, lbFaq.html);

const sfPath = path.join(ROOT, 'shortform-marketing.html');
let sf = fs.readFileSync(sfPath, 'utf8');
SF_HAVE = baseFaq(sf, `${SITE}/shortform-marketing#faq`);
sf = block(sf, 'css', SF_CSS, '</head>', 'before');
sf = block(sf, 'section', SF_SECTION(), '<section id="order">', 'before');
const sfFaq = addFaq(sf, `${SITE}/shortform-marketing#faq`, COST.faq.map(([q, a], n) => question(`${SITE}/shortform-marketing#faq-g-cost-${n + 1}`, q, a)));
fs.writeFileSync(sfPath, sfFaq.html);

console.log(`local-business: 업종 ${PAGES.length}개 · FAQ +${lbFaq.added} / shortform-marketing: 비용 섹션 · FAQ +${sfFaq.added}`);
