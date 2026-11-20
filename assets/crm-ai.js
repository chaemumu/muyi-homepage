// ── AI 노출 (GEO 모니터링): 매주 ChatGPT·Gemini·Claude에 같은 질문을 던져 '무이'가 답변에 나오는지 본다 ──
// 데이터: ai_visibility (Edge Function `ai-visibility`가 매주 월 07:30~07:50 KST 저장, 08:10 카카오워크 요약)
// 질문: crm_settings 'ai_vis_questions' [{g,q}] · 모델·언급 규칙: 'ai_vis_config'
// 화면: window.CRM_AI.mount(container). admin.html의 sb·el·toast 사용
(function () {
  const css = `
.ai-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.ai-tile{padding:14px 16px}
.ai-tile .k{font-size:12px;color:var(--t3)}
.ai-tile .v{font-size:24px;font-weight:800;margin-top:2px}
.ai-tile .s{font-size:12px;color:var(--t2);margin-top:2px}
.ai-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ai-bar .ml-auto{margin-left:auto}
.ai-tbl td.c{text-align:center}
.ai-y{color:var(--brand);font-weight:800}
.ai-n{color:var(--t3)}
.ai-e{color:var(--red)}
.ai-tbl tbody tr{cursor:pointer}
.ai-pm{width:820px;max-width:100%;max-height:88vh;background:var(--surface);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.2);display:flex;flex-direction:column}
.ai-pm .ai-h{padding:14px 18px;border-bottom:1px solid var(--line);font-weight:700}
.ai-pm .ai-b{padding:14px 18px;overflow:auto;display:flex;flex-direction:column;gap:14px}
.ai-pm .ai-f{padding:10px 18px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end}
.ai-ans{white-space:pre-wrap;font-size:13px;line-height:1.6;background:var(--muted);border-radius:8px;padding:10px 12px;max-height:320px;overflow:auto}
.ai-urls{font-size:12px;color:var(--t2);word-break:break-all}
.ai-urls a{color:inherit}
.ai-hosts{display:flex;flex-wrap:wrap;gap:6px}
.ai-hosts span{font-size:12px;padding:4px 9px;border-radius:999px;border:1px solid var(--line)}
.ai-ta{width:100%;min-height:340px;font-family:ui-monospace,Menlo,monospace;font-size:13px}`;
  if (!document.getElementById('ai-css')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'ai-css', textContent: css }));

  const ENG = [['openai', 'ChatGPT'], ['gemini', 'Gemini'], ['claude', 'Claude']];
  const engName = Object.fromEntries(ENG);
  const pct = (a) => (a.length ? Math.round((a.filter((r) => r.mentioned).length / a.length) * 100) : null);
  const ok = (rows) => rows.filter((r) => !r.error);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const wk = (d) => d.slice(5).replace('-', '/') + ' 주';

  function modal(title, kids, foot) {
    const L = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === L) L.remove(); } },
      el('div', { className: 'ai-pm' }, [el('div', { className: 'ai-h', text: title }), el('div', { className: 'ai-b' }, kids), el('div', { className: 'ai-f' }, foot)]));
    const esc = (e) => { if (e.key === 'Escape') { L.remove(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    document.body.appendChild(L);
    return L;
  }

  function showAnswers(q, rows) {
    const kids = ENG.map(([k, n]) => {
      const r = rows.find((x) => x.engine === k);
      if (!r) return el('div', {}, [el('b', { text: n }), el('div', { className: 'ai-n', text: '이번 주 실행 안 함' })]);
      const tag = r.error ? el('span', { className: 'ai-e', text: ' · 실패' }) : el('span', { className: r.mentioned ? 'ai-y' : 'ai-n', text: r.mentioned ? ` · 무이 언급${r.rank ? ` (${r.rank}번째)` : ''}` : ' · 언급 없음' });
      return el('div', {}, [
        el('div', {}, [el('b', { text: n }), tag, el('span', { className: 'ai-n', text: r.model ? ` · ${r.model}` : '' })]),
        el('div', { className: 'ai-ans', text: r.error || r.answer || '(빈 답변)' }),
        r.cited_urls?.length ? el('div', { className: 'ai-urls' }, ['출처: ', ...r.cited_urls.slice(0, 15).flatMap((u, i) => [i ? ' · ' : '', el('a', { href: u, target: '_blank', rel: 'noopener', text: host(u) })])]) : null,
      ].filter(Boolean));
    });
    const L = modal(q, kids, [el('button', { className: 'btn', text: '닫기', onclick: () => L.remove() })]);
  }

  async function editQuestions(after) {
    const { data } = await sb.from('crm_settings').select('value').eq('key', 'ai_vis_questions').maybeSingle();
    const ta = el('textarea', { className: 'fi ai-ta', value: (data?.value || []).map((x) => `${x.g} | ${x.q}`).join('\n') });
    const save = el('button', { className: 'btn primary', text: '저장' });
    const L = modal('질문 목록 편집', [
      el('div', { className: 'hint', text: '한 줄에 하나씩 "그룹 | 질문" 형식. 그룹은 소상공인·숏폼·브랜드처럼 자유롭게. 질문을 바꾸면 지난주와 비교가 끊기니 자주 바꾸지 마세요. 질문이 늘면 비용도 늘어납니다.' }), ta,
    ], [el('button', { className: 'btn', text: '취소', onclick: () => L.remove() }), save]);
    save.onclick = async () => {
      const list = ta.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf('|'); return i < 0 ? { g: '기타', q: l } : { g: l.slice(0, i).trim() || '기타', q: l.slice(i + 1).trim() }; }).filter((x) => x.q);
      if (!list.length) { toast('질문이 비어 있습니다'); return; }
      if (list.length > 40) { toast('질문은 40개까지만 넣어 주세요'); return; }
      save.disabled = true;
      const { error } = await sb.from('crm_settings').upsert({ key: 'ai_vis_questions', value: list, updated_at: new Date().toISOString() });
      if (error) { toast('저장 실패: ' + error.message); save.disabled = false; return; }
      L.remove(); toast(`질문 ${list.length}개를 저장했습니다. 다음 월요일부터 적용`); after?.();
    };
  }

  function runNow(after) {
    const sel = el('select', { className: 'fi' }, [['all', '전체 (키가 있는 엔진만)'], ...ENG].map(([v, t]) => el('option', { value: v, text: t })));
    const go = el('button', { className: 'btn primary', text: '실행' });
    const L = modal('지금 실행', [
      el('div', { text: '이번 주 결과를 새로 만듭니다. 같은 주에 다시 실행하면 그 엔진의 이번 주 결과를 바꿔 넣습니다.' }),
      el('div', { className: 'hint', text: 'API 비용이 듭니다 (질문 20개 기준 엔진당 수백 원). 1~3분 뒤 새로고침하면 결과가 보입니다.' }), sel,
    ], [el('button', { className: 'btn', text: '취소', onclick: () => L.remove() }), go]);
    go.onclick = async () => {
      go.disabled = true; go.textContent = '요청 중…';
      const { data, error } = await sb.functions.invoke('ai-visibility', { body: { engine: sel.value } });
      if (error) { let m = error.message; try { const j = await error.context?.json?.(); if (j?.error) m = j.error + (j.skipped?.length ? ` (키 없음: ${j.skipped.join(', ')})` : ''); } catch { /* 본문 없음 */ } toast('실행 실패: ' + m); go.disabled = false; go.textContent = '실행'; return; }
      L.remove();
      toast(`실행 시작: ${(data.started || []).map((e) => engName[e]).join(', ')}${data.skipped?.length ? ` · 키 없어서 건너뜀: ${data.skipped.map((e) => engName[e]).join(', ')}` : ''}`);
      setTimeout(() => after?.(), 120000);
    };
  }

  async function mount(box) {
    box.replaceChildren(el('div', { className: 'hint', text: '불러오는 중…' }));
    const since = new Date(Date.now() - 70 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await sb.from('ai_visibility').select('run_week,engine,model,q_group,question,mentioned,rank,cited_urls,answer,error').gte('run_week', since).order('id');
    if (error) { box.replaceChildren(el('div', { className: 'hint', text: '불러오지 못했습니다: ' + error.message })); return; }
    const rows = data || [];
    const weeks = [...new Set(rows.map((r) => r.run_week))].sort().reverse();
    const reload = () => mount(box);
    const bar = el('div', { className: 'ai-bar' }, [
      el('div', { className: 'hint', text: '매주 월요일 아침 ChatGPT·Gemini·Claude에 같은 질문을 웹 검색을 켠 상태로 던지고, 답변에 무이(무이코퍼레이션·muyi.co.kr)가 나오는지 기록합니다. 결과는 월 08:10 카카오워크로도 옵니다.' }),
      el('div', { className: 'ml-auto ai-bar' }, [
        el('button', { className: 'btn', text: '질문 편집', onclick: () => editQuestions(reload) }),
        el('button', { className: 'btn primary', text: '지금 실행', onclick: () => runNow(reload) }),
      ]),
    ]);
    if (!weeks.length) { box.replaceChildren(bar, el('div', { className: 'hint', text: '아직 결과가 없습니다. [지금 실행]으로 첫 결과를 만들 수 있습니다.' })); return; }

    let cur = weeks[0];
    const body = el('div', { className: 'stack' });
    const weekSel = el('select', { className: 'fi', onchange: () => { cur = weekSel.value; draw(); } }, weeks.map((w) => el('option', { value: w, text: wk(w) })));

    function draw() {
      const now = rows.filter((r) => r.run_week === cur);
      const prevW = weeks[weeks.indexOf(cur) + 1];
      const prev = rows.filter((r) => r.run_week === prevW);
      // 엔진별 이번 주 언급률
      const tiles = el('div', { className: 'ai-tiles' }, ENG.map(([k, n]) => {
        const a = ok(now.filter((r) => r.engine === k)); const b = ok(prev.filter((r) => r.engine === k));
        const p = pct(a), q = pct(b);
        const errs = now.filter((r) => r.engine === k && r.error).length;
        return el('div', { className: 'card ai-tile' }, [
          el('div', { className: 'k', text: n }),
          el('div', { className: 'v', text: p === null ? '—' : `${a.filter((r) => r.mentioned).length}/${a.length}` }),
          el('div', { className: 's', text: p === null ? (errs ? `실패 ${errs}건 · API 키·모델 확인` : '이번 주 실행 안 함') : `${p}% 언급${q === null ? '' : p === q ? ' · 지난주와 같음' : ` · 지난주 대비 ${p > q ? '+' : ''}${p - q}%p`}${errs ? ` · 실패 ${errs}` : ''}` }),
        ]);
      }));
      // 질문별 결과
      const qs = [...new Map(now.map((r) => [r.question, r.q_group])).entries()];
      const mark = (r) => !r ? el('span', { className: 'ai-n', text: '·' }) : r.error ? el('span', { className: 'ai-e', text: '실패' }) : r.mentioned ? el('span', { className: 'ai-y', text: r.rank ? `● ${r.rank}위` : '●' }) : el('span', { className: 'ai-n', text: '○' });
      const tbl = el('div', { className: 'card' }, el('div', { className: 'tbl-wrap' }, el('table', { className: 'tbl ai-tbl' }, [
        el('thead', {}, el('tr', {}, ['그룹', '질문', ...ENG.map(([, n]) => n)].map((t) => el('th', { text: t })))),
        el('tbody', {}, qs.map(([q, g]) => {
          const rs = now.filter((r) => r.question === q);
          return el('tr', { onclick: () => showAnswers(q, rs) }, [
            el('td', { className: 'ai-n', text: g || '' }), el('td', { text: q }),
            ...ENG.map(([k]) => el('td', { className: 'c' }, mark(rs.find((r) => r.engine === k)))),
          ]);
        })),
      ])));
      // 자주 인용되는 출처
      const cnt = {};
      now.forEach((r) => new Set((r.cited_urls || []).map(host)).forEach((h) => { cnt[h] = (cnt[h] || 0) + 1; }));
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 12);
      const hosts = el('div', { className: 'card ai-tile' }, [
        el('div', { className: 'k', text: 'AI가 자주 인용한 출처 (이번 주, 답변 수 기준). 이 사이트들에 무이 정보가 있으면 답변에 나올 가능성이 커집니다.' }),
        el('div', { className: 'ai-hosts', style: 'margin-top:8px' }, top.map(([h, n]) => el('span', { text: `${h} ${n}` }))),
      ]);
      body.replaceChildren(tiles, el('div', { className: 'hint', text: '● 무이 언급 (숫자는 추천 목록에서 몇 번째인지) · ○ 언급 없음 · 줄을 누르면 답변 원문과 출처' }), tbl, hosts);
    }
    box.replaceChildren(bar, el('div', { className: 'ai-bar' }, [weekSel]), body);
    draw();
  }

  window.CRM_AI = { mount };
})();
