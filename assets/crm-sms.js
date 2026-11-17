// ── 문자 보내기 (알리고): 업체 목록·상세에서 열림. 발송은 Edge Function sms-send (수신거부·중복 제외, 광고 표기·야간 차단은 서버에서 강제) ──
// admin.html의 sb·el·me·toast 사용. window.CRM_SMS.open({ title, load: async () => [{ company_id, name, phone }] })
// 템플릿: crm_settings 'sms_templates' [{name, body}] · 수신거부 문구: crm_settings 'sms_config'.optout · 기록: sms_logs / 수신거부: sms_optout
(function () {
  const digits = (s) => String(s ?? '').replace(/\D/g, '');
  const okPhone = (d) => /^01[016789]\d{7,8}$/.test(d);
  const bytes = (s) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 1 : 2), 0);
  const kstHour = () => Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false })) % 24;
  if (!document.getElementById('crm-sms-css')) {
    const st = document.createElement('style'); st.id = 'crm-sms-css';
    st.textContent = `
.sm-pm{width:min(980px,100%)!important}
.sm-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;padding:16px 20px 20px;overflow-y:auto;min-height:0;flex:1}
.sm-col{display:grid;gap:12px;align-content:start}
.sm-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sm-kpi div{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
.sm-kpi small{display:block;font-size:11px;color:var(--t3)}
.sm-kpi b{font-size:20px;font-variant-numeric:tabular-nums}
.sm-kpi .bad b{color:var(--red)}
.sm-tpl{display:flex;gap:6px;flex-wrap:wrap}
.sm-tpl button{height:30px;padding:0 12px;border:1px solid var(--line);border-radius:15px;background:var(--surface);font-size:12px;font-weight:600;color:var(--t2)}
.sm-tpl button:hover{border-color:#1E10C7;color:#1E10C7}
.sm-text{min-height:180px;font-family:inherit;line-height:1.55}
.sm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--t3)}
.sm-bar .sp{margin-left:auto}
.sm-phone{position:relative;border-radius:28px;padding:14px;background:#111;box-shadow:0 14px 40px rgba(0,0,0,.2)}
.sm-screen{border-radius:18px;background:#EEF0F4;padding:16px 12px;min-height:420px;display:grid;align-content:start;gap:8px}
.sm-from{font-size:11px;color:#6B6B76;text-align:center}
.sm-bubble{justify-self:start;max-width:92%;background:#fff;border-radius:16px 16px 16px 4px;padding:10px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#14141B;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.sm-type{justify-self:start;font-size:11px;font-weight:700;color:#6B6B76}
.sm-warn{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--amber) 10%,var(--surface));border:1px solid color-mix(in srgb,var(--amber) 30%,var(--line));font-size:12px;color:var(--t2)}
.sm-warn img{width:44px;height:auto;flex:none}
.sm-ok{display:grid;justify-items:center;gap:8px;padding:30px;text-align:center}
.sm-ok img{width:130px}
.sm-ok b{font-size:18px}
.sm-row{display:flex;gap:6px;align-items:center}
.sm-row .fi{flex:1;min-width:0}
@media (max-width:900px){.sm-body{grid-template-columns:1fr}}
`;
    document.head.appendChild(st);
  }

  async function open({ title, load, text: preset, ad: adDefault = true }) {
    const L = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === L) close(); } });
    const onKey = (e) => { if (e.key === 'Escape' && document.body.lastElementChild === L) close(); };
    const close = () => { document.removeEventListener('keydown', onKey); L.remove(); };
    document.addEventListener('keydown', onKey);
    const box = el('div', { className: 'pm sm-pm' }, [el('div', { className: 'pm-h' }, [el('h3', { text: `문자 보내기 · ${title}` }), el('button', { className: 'icon-btn', type: 'button', text: '✕', onclick: close })]), el('div', { className: 'sm-body' }, el('div', { className: 'hint', text: '받는 사람 불러오는 중…' }))]);
    L.append(box); document.body.append(L);
    const body = box.querySelector('.sm-body');
    const [list, cfg, tpl, oo] = await Promise.all([load(), sb.from('crm_settings').select('value').eq('key', 'sms_config').maybeSingle(), sb.from('crm_settings').select('value').eq('key', 'sms_templates').maybeSingle(), sb.from('sms_optout').select('phone')]);
    const opt = new Set((oo.data || []).map((x) => x.phone));
    const C = { optout: cfg.data?.value?.optout || '', sign: cfg.data?.value?.sign || '무이(MUYI)' };
    let templates = Array.isArray(tpl.data?.value) ? tpl.data.value : [];
    const seen = new Set();
    const valid = [], bad = { nophone: 0, dup: 0, opt: 0 };
    list.forEach((t) => { const d = digits(t.phone); if (!okPhone(d)) { bad.nophone++; return; } if (seen.has(d)) { bad.dup++; return; } if (opt.has(d)) { bad.opt++; return; } seen.add(d); valid.push({ ...t, phone: d }); });

    const text = el('textarea', { className: 'fi sm-text', value: preset ?? templates[0]?.body ?? '', placeholder: '내용 — #{업체명} 은 업체마다 자동으로 바뀝니다' });
    const ad = el('input', { type: 'checkbox', checked: adDefault });
    const optIn = el('input', { className: 'fi', value: C.optout, placeholder: '무료거부 080-000-0000' });
    const testIn = el('input', { className: 'fi', type: 'tel', placeholder: '내 번호로 테스트 (010-…)' });
    const meter = el('span');
    const preview = el('div', { className: 'sm-bubble' }), ptype = el('div', { className: 'sm-type' });
    const compose = (name) => { const t = text.value.trim().replaceAll('#{업체명}', name || '사장님'); return ad.checked ? `(광고) ${t}\n\n${optIn.value.trim()}` : t; };
    const night = () => { const h = kstHour(); return h >= 21 || h < 8; };
    const warn = el('div', { className: 'sm-warn' });
    const paint = () => {
      const m = compose(valid[0]?.name || '업체명'), b = bytes(m);
      preview.textContent = m; ptype.textContent = `${b > 90 ? 'LMS 장문' : 'SMS 단문'} · ${b.toLocaleString()} / ${b > 90 ? '2,000' : '90'} byte`;
      meter.textContent = `${b.toLocaleString()} byte · ${b > 90 ? 'LMS' : 'SMS'}`;
      const issues = [ad.checked && (!optIn.value.trim() || /000-0000/.test(optIn.value)) && '광고 문자에는 080 무료수신거부 번호가 꼭 필요해요', ad.checked && night() && '지금은 밤 9시~아침 8시라 광고 문자를 보낼 수 없어요', b > 2000 && '2,000byte를 넘었어요'].filter(Boolean);
      warn.hidden = !issues.length; warn.replaceChildren(el('img', { src: '/assets/brand/muyi-char-cry.webp', alt: '' }), el('div', { text: issues.join(' · ') }));
      send.disabled = !!issues.length || !valid.length || !text.value.trim();
      send.textContent = `${valid.length.toLocaleString()}명에게 보내기`;
    };
    [text, optIn].forEach((x) => x.addEventListener('input', paint)); ad.onchange = paint;
    const tplBox = el('div', { className: 'sm-tpl' });
    const paintTpl = () => tplBox.replaceChildren(...templates.map((t) => el('button', { type: 'button', text: t.name, onclick: () => { text.value = t.body; paint(); } })),
      el('button', { type: 'button', text: '+ 지금 내용 템플릿으로 저장', onclick: async () => { const n = prompt('템플릿 이름'); if (!n) return; templates = [...templates.filter((x) => x.name !== n), { name: n, body: text.value }]; const { error } = await sb.from('crm_settings').upsert({ key: 'sms_templates', value: templates, updated_at: new Date().toISOString() }); toast(error ? '저장 실패: ' + error.message : '템플릿 저장'); paintTpl(); } }));
    paintTpl();
    const insertName = el('button', { className: 'btn sm', type: 'button', text: '#{업체명} 넣기', onclick: () => { const p = text.selectionStart ?? text.value.length; text.setRangeText('#{업체명}', p, text.selectionEnd ?? p, 'end'); text.focus(); paint(); } });
    const saveOpt = el('button', { className: 'btn sm', type: 'button', text: '저장', onclick: async () => { const { error } = await sb.from('crm_settings').upsert({ key: 'sms_config', value: { ...C, optout: optIn.value.trim() }, updated_at: new Date().toISOString() }); toast(error ? '저장 실패: ' + error.message : '수신거부 문구 저장'); } });
    const call = async (payload) => { const { data, error } = await sb.functions.invoke('sms-send', { body: payload }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); } return data; };
    const test = el('button', { className: 'btn sm', type: 'button', text: '테스트 발송', onclick: async () => {
      if (!okPhone(digits(testIn.value))) { toast('테스트 받을 휴대폰 번호를 넣어주세요'); return; }
      test.disabled = true; try { const r = await call({ action: 'send', text: text.value, ad: ad.checked, test_phone: testIn.value, targets: valid.slice(0, 1) }); toast(r.sent ? '테스트 문자 보냄' : '테스트 실패: ' + (r.errors || []).join(', ')); } catch (e) { toast('테스트 실패: ' + e.message); } test.disabled = false;
    } });
    const send = el('button', { className: 'btn primary lg', type: 'button', onclick: async () => {
      if (!confirm(`${valid.length.toLocaleString()}명에게 문자를 보냅니다.\n\n${ad.checked ? '(광고) 표기와 수신거부 문구가 붙습니다.' : '광고가 아닌 안내 문자로 보냅니다. 영업·홍보 내용이면 광고를 켜 주세요.'}\n\n보낼까요?`)) return;
      send.disabled = true; send.textContent = '보내는 중…';
      try {
        const r = await call({ action: 'send', text: text.value, ad: ad.checked, targets: valid });
        body.replaceChildren(el('div', { className: 'sm-ok', style: 'grid-column:1/-1' }, [el('img', { src: r.failed ? '/assets/brand/muyi-char-cry.webp' : '/assets/brand/muyi-char-idea.webp', alt: '' }), el('b', { text: `${r.sent.toLocaleString()}건 발송${r.failed ? ` · 실패 ${r.failed}건` : ''}` }), el('span', { className: 'ca-hint', text: [r.skipped ? `제외 ${r.skipped}건 (수신거부·중복·번호 오류)` : '', ...(r.errors || [])].filter(Boolean).join(' · ') || '보낸 내용은 문자 발송 기록에 남습니다.' }), el('button', { className: 'btn', type: 'button', text: '닫기', onclick: close })]));
      } catch (e) { toast('발송 실패: ' + e.message); paint(); }
    } });
    const optAdd = el('input', { className: 'fi', type: 'tel', placeholder: '수신거부 번호 추가 (010-…)' });
    const optBtn = el('button', { className: 'btn sm', type: 'button', text: '추가', onclick: async () => { const d = digits(optAdd.value); if (!okPhone(d)) { toast('휴대폰 번호를 확인해주세요'); return; } const { error } = await sb.from('sms_optout').upsert({ phone: d, created_by: me }); if (error) { toast('저장 실패: ' + error.message); return; } toast('수신거부 등록 — 앞으로 이 번호는 자동 제외됩니다'); optAdd.value = ''; } });
    body.replaceChildren(
      el('div', { className: 'sm-col' }, [
        el('div', { className: 'sm-kpi' }, [el('div', {}, [el('small', { text: '보낼 사람' }), el('b', { text: valid.length.toLocaleString() })]), el('div', { className: bad.nophone ? 'bad' : '' }, [el('small', { text: '번호 없음·유선' }), el('b', { text: bad.nophone })]), el('div', {}, [el('small', { text: '수신거부·중복 제외' }), el('b', { text: bad.opt + bad.dup })])]),
        el('div', {}, [el('span', { className: 'lbl', text: '템플릿' }), tplBox]),
        text,
        el('div', { className: 'sm-bar' }, [insertName, el('label', { className: 'sm-row' }, [ad, '광고 (영업·홍보 문자면 켜기)']), el('span', { className: 'sp' }), meter]),
        el('label', {}, [el('span', { className: 'lbl', text: '무료 수신거부 문구 (광고 문자 끝에 자동으로 붙음)' }), el('div', { className: 'sm-row' }, [optIn, saveOpt])]),
        warn,
        el('div', { className: 'sm-row' }, [testIn, test]),
        el('div', { className: 'sm-row' }, [optAdd, optBtn]),
        el('div', { className: 'sm-row' }, [el('span', { className: 'ca-hint', text: '광고 문자는 (광고) 표기 · 080 수신거부 · 밤 9시~아침 8시 금지가 자동 적용됩니다.' }), el('span', { className: 'sp' }), send]),
      ]),
      el('div', { className: 'sm-col' }, [el('div', { className: 'sm-phone' }, el('div', { className: 'sm-screen' }, [el('div', { className: 'sm-from', text: `${C.sign} · 미리보기 (${valid[0]?.name || '업체명'})` }), preview, ptype]))]),
    );
    paint();
  }
  window.CRM_SMS = { open };
})();
