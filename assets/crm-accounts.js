// ── 계정 관리 (마스터 전용): 관리자 목록 · 비밀번호 재설정 메일 · 임시 비밀번호 지정 ──
// 서버: Edge Function `admin-users` (마스터 여부를 서버에서 다시 확인, service_role은 서버에만)
// 화면: window.CRM_ACCOUNTS.mount(container). admin.html의 sb·el·toast 사용
(function () {
  const css = `
.ac-card{padding:0}
.ac-card .tbl td{white-space:nowrap}
.ac-acts{display:flex;gap:6px;justify-content:flex-end}
.ac-role{font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;background:var(--muted);color:var(--t2)}
.ac-role.master{background:var(--brand);color:#fff}
.ac-dim{color:var(--t3);font-size:12px}
.ac-pm{width:420px;max-width:100%;background:var(--surface);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.2);display:flex;flex-direction:column}
.ac-pm .ac-h{padding:16px 18px;border-bottom:1px solid var(--line);font-weight:700;font-size:15px}
.ac-pm .ac-b{padding:16px 18px;display:flex;flex-direction:column;gap:10px}
.ac-pm .ac-f{padding:12px 18px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end}
.ac-pw{display:flex;gap:6px}.ac-pw .fi{flex:1;font-family:ui-monospace,Menlo,monospace;font-size:14px;letter-spacing:.5px}
.ac-err{color:var(--red);font-size:12px;min-height:16px}
.ac-tbl-wrap{overflow-x:auto}
.ac-tbl tbody tr{cursor:default}
.ac-tbl td:last-child{max-width:none;overflow:visible}
@media (max-width:700px){.ac-tbl tr>:nth-child(2),.ac-tbl tr>:nth-child(4){display:none}.ac-acts{flex-direction:column;align-items:flex-end;padding:6px 0}.ac-tbl td{height:auto}}`;
  if (!document.getElementById('ac-css')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'ac-css', textContent: css }));

  const call = async (body) => {
    const { data, error } = await sb.functions.invoke('admin-users', { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* 본문 없음 */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const fmt = (t) => t ? new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '로그인 기록 없음';
  // 헷갈리는 글자(0 O l 1 I) 제외한 임시 비밀번호 10자
  const genPw = () => { const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint32Array(10)); return Array.from(r, (x) => A[x % A.length]).join(''); };

  function modal(title, kids, foot) {
    const L = el('div', { className: 'pm-layer', onclick: (e) => { if (e.target === L) L.remove(); } },
      el('div', { className: 'ac-pm' }, [el('div', { className: 'ac-h', text: title }), el('div', { className: 'ac-b' }, kids), el('div', { className: 'ac-f' }, foot)]));
    const esc = (e) => { if (e.key === 'Escape') { L.remove(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    document.body.appendChild(L);
    return L;
  }

  function resetMail(u) {
    const err = el('div', { className: 'ac-err' });
    const send = el('button', { className: 'btn primary', text: '메일 보내기' });
    const L = modal(`${u.name} · 재설정 메일`, [
      el('div', { text: `${[...new Set([u.contact_email, u.email].filter(Boolean))].join(' · ')} 로 비밀번호 재설정 링크를 보냅니다.` }),
      el('div', { className: 'ac-dim', text: '로그인 이메일과 등록된 연락 메일 둘 다로 보냅니다(보내는 곳 noreply@muyi.co.kr). 안 보이면 스팸함도 확인하게 하세요. 받은 사람이 링크를 눌러 새 비밀번호를 정하고, 새 비밀번호로 다시 로그인합니다. 링크를 쓰기 전까지 지금 비밀번호는 그대로입니다. 같은 사람에게는 1분에 한 번만 보낼 수 있습니다.' }), err,
    ], [el('button', { className: 'btn', text: '취소', onclick: () => L.remove() }), send]);
    send.onclick = async () => {
      send.disabled = true; send.textContent = '보내는 중…'; err.textContent = '';
      try { const r = await call({ action: 'send_reset', user_id: u.user_id }); L.remove(); toast(`${u.name}님 재설정 메일 발송: ${(r.to || []).join(', ')}`); }
      catch (e) { err.textContent = e.message; send.disabled = false; send.textContent = '메일 보내기'; }
    };
  }

  function tempPw(u) {
    const input = el('input', { className: 'fi', value: genPw(), autocomplete: 'off', spellcheck: false });
    const err = el('div', { className: 'ac-err' });
    const save = el('button', { className: 'btn primary', text: '비밀번호 변경' });
    const L = modal(`${u.name} · 임시 비밀번호`, [
      el('div', { text: `${u.email} 계정의 비밀번호를 아래 값으로 바로 바꿉니다.` }),
      el('div', { className: 'ac-pw' }, [input,
        el('button', { className: 'btn', text: '새로 만들기', onclick: () => { input.value = genPw(); } }),
        el('button', { className: 'btn', text: '복사', onclick: () => navigator.clipboard.writeText(input.value).then(() => toast('복사했습니다'), () => toast('복사 실패: 직접 선택해 복사하세요')) })]),
      el('div', { className: 'ac-dim', text: '8자 이상. 바꾼 뒤 본인에게 전달하고, 로그인 후 재설정 메일로 직접 바꾸도록 안내하세요.' }), err,
    ], [el('button', { className: 'btn', text: '취소', onclick: () => L.remove() }), save]);
    save.onclick = async () => {
      const pw = input.value.trim();
      if (pw.length < 8) { err.textContent = '8자 이상 입력하세요'; return; }
      save.disabled = true; save.textContent = '변경 중…'; err.textContent = '';
      try {
        await call({ action: 'set_password', user_id: u.user_id, password: pw });
        navigator.clipboard?.writeText(pw).catch(() => {});
        L.remove(); toast(`${u.name}님 비밀번호를 바꿨습니다 (클립보드에 복사됨)`);
      } catch (e) { err.textContent = e.message; save.disabled = false; save.textContent = '비밀번호 변경'; }
    };
    setTimeout(() => input.select(), 0);
  }

  async function mount(box) {
    box.replaceChildren(el('div', { className: 'hint', text: '불러오는 중…' }));
    let users;
    try { users = (await call({ action: 'list' })).users || []; }
    catch (e) { box.replaceChildren(el('div', { className: 'hint', text: '불러오지 못했습니다: ' + e.message })); return; }
    const rows = users.map((u) => el('tr', {}, [
      el('td', { className: 'name' }, el('strong', { text: u.name || '-' })),
      el('td', { text: u.email || '-' }),
      el('td', {}, el('span', { className: 'ac-role' + (u.role === 'master' ? ' master' : ''), text: u.role === 'master' ? '마스터' : '관리자' })),
      el('td', { className: 'ac-dim', text: fmt(u.last_sign_in_at) }),
      el('td', {}, el('div', { className: 'ac-acts' }, [
        el('button', { className: 'btn', text: '재설정 메일', onclick: () => resetMail(u) }),
        el('button', { className: 'btn', text: '임시 비밀번호', onclick: () => tempPw(u) }),
      ])),
    ]));
    box.replaceChildren(
      el('div', { className: 'hint', text: '비밀번호를 잊은 팀원: [재설정 메일]로 본인이 새로 정하게 하거나, 메일을 못 받는 경우 [임시 비밀번호]로 바로 바꿔 전달하세요.' }),
      el('div', { className: 'card ac-card' }, el('div', { className: 'ac-tbl-wrap' }, el('table', { className: 'tbl ac-tbl' }, [
        el('thead', {}, el('tr', {}, ['이름', '이메일', '권한', '마지막 로그인', ''].map((t) => el('th', { text: t })))),
        el('tbody', {}, rows),
      ]))),
    );
  }

  window.CRM_ACCOUNTS = { mount };
})();
