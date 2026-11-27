import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// AI 노출 모니터링. 주 1회 pg_cron이 엔진별로 호출 → 같은 질문을 웹 검색 켠 AI에 던져 '무이' 언급 여부를 ai_visibility에 기록.
// POST { engine: 'claude'|'openai'|'gemini' }  → 실행 (응답은 바로 202, 작업은 백그라운드)
// POST { report: true }                        → 이번 주 결과 요약을 마스터에게 카카오워크 1:1 발송
// 인증: 헤더 x-ai-vis-key = ai_vis_secret('cron')  또는  로그인한 관리자(문의함 [지금 실행])
// 질문: crm_settings 'ai_vis_questions' [{g,q}] · 모델·언급 규칙: crm_settings 'ai_vis_config'
// 키: ANTHROPIC_API_KEY(있음) · OPENAI_API_KEY · GEMINI_API_KEY — 없는 엔진은 건너뜀
// v4(2026-11-27) 무료 등급 대응:
//   ① 엔진별 속도 `ai_vis_config.pace.<engine> = {conc, gap_ms}` — Gemini 기본 1개씩 6.5초 간격(무료 분당 한도 안)
//   ② 429면 API가 알려 준 대기 시간(최대 60초)만큼 쉬고 한 번 다시
//   ③ 결제·인증 문제(OpenAI 크레딧 없음, 401/403, 처음 3개 연속 한도 초과)면 그 엔진은 건너뜀 — 실패 20건을 쌓지 않고 지난 결과 유지
//   ④ 실행 시간이 길면(110초) 남은 질문을 자기 자신에게 넘겨 이어서 실행 (Free 플랜 백그라운드 150초 제한)
const KW = 'https://api.kakaowork.com/v1';
const ADMIN_URL = 'https://www.muyi.co.kr/admin#ai';
const SYSTEM = '한국에서 사업을 하는 사용자의 질문에 답하세요. 필요하면 웹 검색을 쓰고, 업체를 추천할 때는 실제 업체명을 번호 목록으로 알려주세요.';
const BUDGET_MS = 110_000;
const PACE_DEFAULT: Record<string, { conc: number; gap_ms: number }> = { gemini: { conc: 1, gap_ms: 6500 } };

const kstDay = (d: number) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
function mondayKst(now = Date.now()) {
  const d = kstDay(now); const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd)); const wd = (t.getUTCDay() + 6) % 7; // 월=0
  t.setUTCDate(t.getUTCDate() - wd); return t.toISOString().slice(0, 10);
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 목록형 답변이면 무이가 처음 나온 항목 번호, 아니면 null
function rankOf(text: string, re: RegExp): number | null {
  const items = text.split('\n').filter((l) => /^\s*(\d+[.)]|[-*•]|#{2,4}\s*\d+)/.test(l));
  if (items.length < 2) return null;
  const i = items.findIndex((l) => re.test(l));
  return i < 0 ? null : i + 1;
}

type Out = { text: string; urls: string[] };
// status: HTTP 코드 · retryMs: 429일 때 API가 알려 준 대기 시간 · fatal: 다시 해도 안 되는 문제(결제·인증) → 엔진 건너뜀
class ApiErr extends Error {
  constructor(msg: string, public status = 0, public retryMs = 0, public fatal = false) { super(msg); }
}
const fatalStatus = (s: number) => s === 401 || s === 403;

async function askClaude(model: string, q: string): Promise<Out> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const messages: any[] = [{ role: 'user', content: q }];
  let res: any;
  for (let turn = 0; turn < 4; turn++) {
    try {
      res = await client.beta.messages.create({
        model, max_tokens: 4000, system: SYSTEM,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'low' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'KR', timezone: 'Asia/Seoul' } }],
        messages,
      } as any);
    } catch (e: any) {
      const s = Number(e?.status) || 0;
      throw new ApiErr(`claude ${s} ${e?.message || e}`.slice(0, 300), s, 0, fatalStatus(s) || /credit balance/i.test(String(e?.message)));
    }
    if (res.stop_reason !== 'pause_turn') break; // 서버 도구가 길어지면 이어서 요청
    messages.push({ role: 'assistant', content: res.content });
  }
  if (res.stop_reason === 'refusal') throw new Error('refusal ' + (res.stop_details?.category || ''));
  const urls = new Set<string>(); let text = '';
  for (const b of res.content || []) {
    if (b.type === 'text') { text += b.text; for (const c of b.citations || []) if (c.url) urls.add(c.url); }
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r.url) urls.add(r.url);
  }
  return { text, urls: [...urls] };
}

async function askOpenAI(model: string, q: string): Promise<Out> {
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions: SYSTEM, input: q, tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'KR' } }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(j?.error?.message || '');
    // 크레딧 없음(insufficient_quota)은 기다려도 안 풀림 → 건너뜀. 일반 429(속도)는 잠깐 쉬고 다시
    const noCredit = j?.error?.code === 'insufficient_quota' || /credits|quota|billing/i.test(msg);
    const ra = Number(r.headers.get('retry-after')) * 1000 || 0;
    throw new ApiErr(`openai ${r.status} ${msg}`.slice(0, 300), r.status, ra, fatalStatus(r.status) || (r.status === 429 && noCredit));
  }
  let text = ''; const urls = new Set<string>();
  for (const o of j.output || []) for (const c of o.content || []) if (c.type === 'output_text') {
    text += c.text; for (const a of c.annotations || []) if (a.url) urls.add(a.url);
  }
  return { text: text || j.output_text || '', urls: [...urls] };
}

async function askGemini(model: string, q: string): Promise<Out> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: q }] }], tools: [{ google_search: {} }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 429 응답의 RetryInfo.retryDelay("37s")를 읽어 그만큼 기다렸다 다시
    const ri = (j?.error?.details || []).find((d: any) => String(d?.['@type'] || '').includes('RetryInfo'));
    const retryMs = ri?.retryDelay ? Math.ceil(parseFloat(ri.retryDelay) * 1000) : 0;
    throw new ApiErr(`gemini ${r.status} ${j?.error?.message || ''}`.slice(0, 300), r.status, retryMs, fatalStatus(r.status));
  }
  const c = j.candidates?.[0];
  const text = (c?.content?.parts || []).map((p: any) => p.text || '').join('');
  const urls = (c?.groundingMetadata?.groundingChunks || []).map((g: any) => g.web?.uri).filter(Boolean);
  return { text, urls };
}

const ENGINES: Record<string, { key: string; ask: (m: string, q: string) => Promise<Out> }> = {
  claude: { key: 'ANTHROPIC_API_KEY', ask: askClaude },
  openai: { key: 'OPENAI_API_KEY', ask: askOpenAI },
  gemini: { key: 'GEMINI_API_KEY', ask: askGemini },
};

// 한 질문: 429면 알려 준 시간(없으면 15초, 최대 60초) 쉬고 한 번 더. 시간 예산을 넘기면 재시도 안 함
async function askOnce(engine: string, model: string, q: string, deadline: number): Promise<Out> {
  try { return await ENGINES[engine].ask(model, q); } catch (e) {
    if (!(e instanceof ApiErr) || e.fatal || e.status !== 429) throw e;
    const wait = Math.min(60_000, e.retryMs || 15_000);
    if (Date.now() + wait > deadline) throw e;
    await sleep(wait);
    return await ENGINES[engine].ask(model, q);
  }
}

// 지난 실행이 남긴 '전부 실패' 행만 정리 (정상 결과는 그대로)
async function clearFailedWeek(sb: any, week: string, engine: string) {
  const { data } = await sb.from('ai_visibility').select('error').eq('run_week', week).eq('engine', engine);
  if (data?.length && data.every((r: any) => r.error)) await sb.from('ai_visibility').delete().eq('run_week', week).eq('engine', engine);
}

// 남은 질문을 새 요청으로 넘김 (같은 인증 키로 자기 자신 호출)
async function handOff(sb: any, engine: string, offset: number, week: string) {
  const { data } = await sb.from('ai_vis_secret').select('value').eq('key', 'cron').maybeSingle();
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-visibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, 'x-ai-vis-key': data?.value || '' },
    body: JSON.stringify({ engine, offset, week }),
  }).catch((e) => ({ status: 0, e }));
  console.log('AI_VIS_HANDOFF', engine, offset, (r as any).status);
}

async function run(sb: any, engine: string, offset = 0, weekIn?: string) {
  const started = Date.now(); const deadline = started + BUDGET_MS;
  const { data: rows } = await sb.from('crm_settings').select('key,value').in('key', ['ai_vis_questions', 'ai_vis_config']);
  const cfg = Object.fromEntries((rows || []).map((r: any) => [r.key, r.value]));
  const qs: { g: string; q: string }[] = cfg.ai_vis_questions || [];
  const conf = cfg.ai_vis_config || {};
  const model = conf.models?.[engine];
  const re = new RegExp(conf.brand || '무이(?!자)|MUYI|muyi\\.co\\.kr', 'i');
  const week = weekIn || mondayKst();
  const pace = { conc: Math.max(1, Math.min(20, Number(conf.concurrency) || 10)), gap_ms: 0, ...(PACE_DEFAULT[engine] || {}), ...(conf.pace?.[engine] || {}) };
  const conc = Math.max(1, Math.min(20, Number(pace.conc) || 1));
  const gap = Math.max(0, Number(pace.gap_ms) || 0);

  let firstWrite = offset === 0; // 처음 쓸 때만 이번 주 이전 결과를 지움 (건너뛰면 지난 결과 유지)
  let done = 0, ok = 0, fails = 0, rateFails = 0;
  const save = async (part: any[]) => {
    if (!part.length) return;
    if (firstWrite) { await sb.from('ai_visibility').delete().eq('run_week', week).eq('engine', engine); firstWrite = false; }
    const { error } = await sb.from('ai_visibility').insert(part);
    if (error) console.error('AI_VIS_INSERT', engine, error.message);
  };

  for (let i = offset; i < qs.length; i += conc) {
    if (i > offset && Date.now() + gap > deadline) { await handOff(sb, engine, i, week); break; }
    const t0 = Date.now();
    const part = qs.slice(i, i + conc);
    let fatal = null as ApiErr | null;
    const res = await Promise.all(part.map(async ({ g, q }) => {
      try {
        const { text, urls } = await askOnce(engine, model, q, deadline);
        return { run_week: week, engine, model, q_group: g, question: q, mentioned: re.test(text) || urls.some((u) => /muyi\.co\.kr/i.test(u)), rank: rankOf(text, re), cited_urls: urls.slice(0, 30), answer: text.slice(0, 20000) };
      } catch (e) {
        if (e instanceof ApiErr && e.fatal) fatal = e;
        if (e instanceof ApiErr && e.status === 429) rateFails++;
        return { run_week: week, engine, model, q_group: g, question: q, mentioned: null, rank: null, cited_urls: [], answer: null, error: String((e as Error)?.message || e).slice(0, 500) };
      }
    }));
    done += res.length; ok += res.filter((r: any) => !r.error).length; fails += res.filter((r: any) => r.error).length;
    // 결제·인증 문제, 또는 처음부터 3개 연속 한도 초과 = 이번엔 이 엔진을 건너뜀
    const stuck = offset === 0 && ok === 0 && rateFails >= 3 && rateFails === done;
    if (fatal || stuck) {
      console.log('AI_VIS_SKIP', engine, week, String(fatal?.message || 'rate limit (free tier quota?)'));
      if (ok === 0 && offset === 0) await clearFailedWeek(sb, week, engine);
      return;
    }
    await save(res);
    const wait = gap - (Date.now() - t0);
    if (wait > 0 && i + conc < qs.length) await sleep(wait);
  }
  console.log('AI_VIS', engine, week, `from ${offset}`, `${ok} ok`, `${fails} errors`, `${Math.round((Date.now() - started) / 1000)}s`);
}

async function report(sb: any) {
  const key = Deno.env.get('KAKAOWORK_BOT_KEY');
  if (!key) return 'no kakaowork key';
  const week = mondayKst(); const prev = mondayKst(Date.now() - 7 * 864e5);
  const { data } = await sb.from('ai_visibility').select('run_week,engine,question,mentioned,rank,error').in('run_week', [week, prev]);
  const rows = data || [];
  if (!rows.some((r: any) => r.run_week === week)) return 'no data this week';
  const lines: string[] = [];
  for (const e of ['openai', 'gemini', 'claude']) {
    const cur = rows.filter((r: any) => r.run_week === week && r.engine === e && !r.error);
    if (!cur.length) continue;
    const old = rows.filter((r: any) => r.run_week === prev && r.engine === e && !r.error);
    const pct = (a: any[]) => Math.round((a.filter((r) => r.mentioned).length / a.length) * 100);
    const name = ({ openai: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' } as any)[e];
    const diff = old.length ? pct(cur) - pct(old) : null;
    lines.push(`· ${name}: ${cur.filter((r: any) => r.mentioned).length}/${cur.length} 질문 (${pct(cur)}%${diff === null ? '' : diff === 0 ? ', 지난주와 같음' : `, 지난주 대비 ${diff > 0 ? '+' : ''}${diff}%p`})`);
    const oldSet = new Set(old.filter((r: any) => r.mentioned).map((r: any) => r.question));
    const curSet = new Set(cur.filter((r: any) => r.mentioned).map((r: any) => r.question));
    const gained = [...curSet].filter((q) => old.length && !oldSet.has(q));
    const lost = [...oldSet].filter((q) => !curSet.has(q));
    gained.slice(0, 3).forEach((q) => lines.push(`   + 새로 나옴: ${q}`));
    lost.slice(0, 3).forEach((q) => lines.push(`   - 빠짐: ${q}`));
  }
  const errs = rows.filter((r: any) => r.run_week === week && r.error).length;
  if (errs) lines.push(`· 실패한 질문 ${errs}건 (API 키·모델 이름 확인)`);
  const text = [`[AI 노출 주간 리포트] ${week.slice(5).replace('-', '/')} 주`, '답변에 무이가 언급된 질문 수', ...lines, ADMIN_URL].join('\n');
  const kw = (path: string, init?: RequestInit) => fetch(KW + path, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }).then((r) => r.json()).catch(() => ({}));
  const { data: masters } = await sb.from('admins').select('name,email').eq('role', 'master').not('email', 'is', null);
  const sent: string[] = [];
  for (const a of masters || []) {
    const u = await kw(`/users.find_by_email?email=${encodeURIComponent(a.email)}`);
    if (!u.success) { sent.push(`${a.name}: 사용자 없음`); continue; }
    const conv = await kw('/conversations.open', { method: 'POST', body: JSON.stringify({ user_id: u.user.id }) });
    if (!conv.success) { sent.push(`${a.name}: 방 열기 실패`); continue; }
    const blocks = [
      { type: 'header', text: 'AI 노출 주간 리포트', style: 'blue' },
      { type: 'text', text: lines.join('\n') || '데이터 없음', markdown: true },
      { type: 'button', text: '자세히 보기', style: 'primary', action_type: 'open_system_browser', value: ADMIN_URL },
    ];
    let s = await kw('/messages.send', { method: 'POST', body: JSON.stringify({ conversation_id: conv.conversation.id, text, blocks }) });
    if (!s.success) s = await kw('/messages.send', { method: 'POST', body: JSON.stringify({ conversation_id: conv.conversation.id, text }) });
    sent.push(`${a.name}: ${s.success ? '보냄' : '실패'}`);
  }
  console.log('AI_VIS_REPORT', sent.join(' | '));
  return sent.join('\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // 인증: 예약 실행 키 또는 관리자 로그인
  const given = req.headers.get('x-ai-vis-key');
  let ok = false;
  if (given) { const { data } = await sb.from('ai_vis_secret').select('value').eq('key', 'cron').maybeSingle(); ok = !!data && data.value === given; }
  if (!ok) {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(jwt);
    if (u?.user) { const { data: ad } = await sb.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle(); ok = !!ad; }
  }
  if (!ok) return json({ error: 'forbidden' }, 403);
  const body = await req.json().catch(() => ({}));
  if (body.report) return json({ result: await report(sb) });
  const engines = body.engine === 'all' ? Object.keys(ENGINES) : [body.engine];
  const todo = engines.filter((e) => ENGINES[e] && Deno.env.get(ENGINES[e].key));
  const skipped = engines.filter((e) => !todo.includes(e));
  if (!todo.length) return json({ error: 'no engine to run', skipped }, 400);
  const offset = Math.max(0, Number(body.offset) || 0); // 이어서 실행(handOff)일 때만
  const week = /^\d{4}-\d{2}-\d{2}$/.test(String(body.week || '')) ? body.week : undefined;
  // @ts-ignore EdgeRuntime: 응답 먼저 보내고 백그라운드 실행
  EdgeRuntime.waitUntil(Promise.all(todo.map((e) => run(sb, e, offset, week))));
  return json({ started: todo, skipped, offset }, 202);
});
