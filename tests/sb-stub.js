// 가짜 Supabase (테스트 전용) — admin.html이 CDN에서 불러오는 supabase-js 대신 이 파일을 넣는다.
// 데이터: window.__SB_DATA = { 테이블: [행, …] } (addInitScript로 미리 넣기)
// 쓰기: insert·update·upsert·delete는 저장하지 않고 window.__writes에 기록 → 테스트에서 확인
// 지원 필터: eq · in · neq · is · range (나머지 체인 메서드는 무시하고 그대로 통과)
// 실제 Supabase처럼 select는 한 번에 최대 1,000줄 (MAX_ROWS) — range로 이어 읽어야 전부 나옴
(function () {
  window.__writes = [];
  const DATA = () => window.__SB_DATA || {};
  let nid = 0;
  const MAX_ROWS = 1000;
  function q(table) {
    let single = false, op = 'select', payload = null, rng = null;
    const filt = [];
    const res = () => {
      if (op !== 'select') {
        window.__writes.push({ table, op, payload, filt: Object.fromEntries(filt.filter((f) => f[0] === 'eq').map((f) => [f[1], f[2]])) });
        const row = Array.isArray(payload) ? payload.map((p) => ({ id: 'new' + (++nid), ...p })) : { id: 'new' + (++nid), ...(payload || {}) };
        return { data: single ? (Array.isArray(row) ? row[0] : row) : [].concat(row), error: null };
      }
      const d = (DATA()[table] || []).filter((r) => filt.every(([k, c, v]) => {
        if (!(c in r)) return true; // 픽스처에 없는 칸은 거르지 않음
        if (k === 'eq') return r[c] === v;
        if (k === 'neq') return r[c] !== v;
        if (k === 'in') return v.includes(r[c]);
        if (k === 'is') return v === null ? r[c] == null : r[c] === v;
        return true;
      }));
      const page = rng ? d.slice(rng[0], rng[1] + 1) : d;
      return { data: single ? d[0] || null : page.slice(0, MAX_ROWS), error: null, count: d.length };
    };
    const p = new Proxy(function () {}, {
      get(t, k) {
        if (k === 'then') return (ok, bad) => Promise.resolve(res()).then(ok, bad);
        if (k === 'single' || k === 'maybeSingle') return () => { single = true; return p; };
        if (['insert', 'update', 'upsert', 'delete'].includes(k)) return (v) => { op = k; payload = v; return p; };
        if (k === 'range') return (a, b) => { rng = [a, b]; return p; };
        if (['eq', 'neq', 'in', 'is'].includes(k)) return (c, v) => { filt.push([k, c, v]); return p; };
        return () => p;
      },
      apply() { return p; },
    });
    return p;
  }
  const user = { id: 'u1', email: 'test@muyi.co.kr' }, session = { user, access_token: 'test' };
  window.supabase = {
    createClient() {
      return {
        auth: { getSession: async () => ({ data: { session } }), getUser: async () => ({ data: { user } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => ({}), signInWithPassword: async () => ({}) },
        rpc: (n) => Promise.resolve({ data: /^is_/.test(n) ? true : [], error: null }), // is_admin · is_master = true
        from: (t) => q(t),
        functions: { invoke: async (n, o) => { (window.__fn = window.__fn || []).push({ n, body: o && o.body }); return { data: { nick: {}, notes: {}, posts: {} }, error: null }; } },
        storage: { from: () => q('__storage') },
        channel: () => { const c = { on: () => c, subscribe: () => c, unsubscribe() {} }; return c; },
        removeChannel() {},
      };
    },
  };
})();
