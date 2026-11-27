import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.68";

// 리뷰노트 북마크 → 선정 명단을 CRM에 바로 저장 (rounds + roster).
// 인증: 북마크에 든 개인 키(rn_keys.key_hash = sha256) — verify_jwt=false, 함수가 직접 확인. 리뷰노트 계정은 받지 않는다.
// 요청: { key, campaigns: [{ id, title, rows, company_id? }] } (최대 30개)
// 캠페인 제목으로 업체(체험단 진행 중·모집일 있는 곳) 매칭 → 가장 최근 모집 회차 → 발표일 비어 있으면 오늘 → 닉네임(네이버)·AI 특이사항 → 저장.
// v4(2026-11-24): 캠페인 날짜(dates)로 회차 고르기(모집 시작일과 가장 가까운 모집일 ±12일) + 발표·마감 날짜를 달력에 반영. 회차 번호 = 모집 달력과 같은 번호
// v5(2026-11-24): 모집일 없는 업체·계약 끝난 업체도 매칭(진행 중 체험단 우선), 모집일 규칙에 맞는 회차가 없으면 캠페인 모집 시작일을 회차로(직접 추가 회차), 발표일 없으면 신청 마감일. 날짜로 만든 회차는 회차 번호를 추측하지 않음(비워 두고 CRM 상세에서 직접 입력, 결과 창에 '회차 직접 입력')
// v6(2026-11-25): 회차 확인 — preview:true면 저장하지 않고 업체 + '명단 없는 다음 회차'(마지막 계약 기준, 명단 있는 마지막 회차 + 1)를 돌려줌(status confirm) → 북마크 창에서 회차 입력·확인 → round_no와 함께 다시 보내면 그 회차로 저장(그 번호의 모집일 회차·모집 label 회차가 있으면 거기, 없으면 날짜로 고른 회차에 번호 지정)
// v7(2026-11-25): 업체 바꾸기 — search(업체명 일부)를 보내면 이름에 그 글자가 든 계약 업체에서 찾음(진행 중 우선, 하나면 회차 확인·여러 개면 고르기)
// v8(2026-11-26): ① 이미 저장한 캠페인도 preview면 항상 회차 확인(confirm, 지금 저장된 회차를 기본값). 다른 회차(또는 추가 명단)를 고르면 예전 저장분에서 옮김
//   ② extra:true = 추가 명단 — 회차를 새로 만들지 않고 명단 있는 마지막 회차(last)에 붙임: rounds 행 state '추가'(cycle_on 없음 · recruit_on = 그 회차 모집일 · round_no = last · deadline = 북마크 일정 마감일)
//      달력은 그 마감일에 '추가' 마감 칩으로 표시(crm-calendar campEvents)
// v9(2026-11-27): 북마크 버전(bm) — 새 북마크는 bm:9를 보냄. bm 없는 예전 북마크(회차 입력칸, '추가 명단 생성' 없음)면 결과 msg 앞에 '다시 설치' 안내
// v10(2026-11-27): sup:true(extra와 함께) = 보충 명단 — 추가 명단과 같은 저장(state '추가', 회차 안 늘림)인데 이름 'N회차 보충', 마감일이 없으면 그 회차 마감일. 취소 상태 글자 넓힘(취소·포기·cancel·drop·withdraw·give up). bm<10이면 다시 설치 안내
// 같은 캠페인은 rounds.rn_campaign_id로 한 번만: 인원이 같으면 건너뜀(same), 바뀌었으면 글 링크를 지키며 갱신(updated).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ADMIN = "https://www.muyi.co.kr/admin";
const kstDay = (d: number | string | Date) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (s: string, n: number) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const addMonth = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const norm = (t: string) => String(t || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
const unesc = (s: string) => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
const blogId = (u: string) => { const m = String(u || "").match(/blog\.naver\.com\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; };
const fmtPhone = (v: string) => { const d = String(v || "").replace(/\D/g, ""); if (!d) return null; if (/^01\d{8,9}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`; return v.trim(); };

// 리뷰노트 응답 한 줄 → 명단 행 (칸 이름 대신 값 모양으로 찾음 — admin crm-camp.js rnRows와 같은 규칙)
function mapRow(r: any) {
  const flat = (o: any, pre = "", out: Record<string, unknown> = {}, d = 0) => { if (o && typeof o === "object" && d < 4) for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object" && !Array.isArray(v)) flat(v, pre + k + ".", out, d + 1); else out[pre + k] = v; } return out; };
  const f = Object.entries(flat(r)).map(([k, v]) => [k, v == null ? "" : String(v).trim()] as [string, string]).filter(([, v]) => v);
  const by = (re: RegExp, test?: (v: string) => boolean) => (f.find(([k, v]) => re.test(k) && (!test || test(v))) || [])[1] || "";
  const phone = (f.find(([, v]) => /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(v)) || [])[1] || by(/phone|mobile|tel|연락/i);
  const blog = (f.find(([, v]) => /blog\.naver\.com/.test(v)) || [])[1] || by(/blog|channel|sns|url|link/i, (v) => /^https?:/.test(v));
  const name = by(/(^|\.)(realName|userName|name|이름|성함)$/i, (v) => !/^https?:/.test(v)) || by(/name/i, (v) => !/^https?:|campaign/i.test(v));
  const msg = f.filter(([k]) => /message|msg|comment|content|reason|introduce|신청/i.test(k)).map(([, v]) => v).sort((a, b) => b.length - a.length)[0] || "";
  // 취소: 상태 칸(status·state·상태)에 '취소/cancel' 또는 북마크가 취소 목록에서 가져온 표시(__cancel)
  const st = f.filter(([k]) => /status|state|상태/i.test(k)).map(([, v]) => v).join(' ');
  const cancelled = !!r.__cancel || /취소|포기|cancel|drop|withdraw|give_?up/i.test(st);
  return { cancelled, blog, name, phone: fmtPhone(phone), msg, grade: by(/grade|level|rank|등급/i), visits: Number(by(/visit|daily|today|방문/i).replace(/[^\d]/g, "")) || null, area: by(/address|addr|area|주소/i), nickname: by(/nick/i), post: by(/review.*url|post.*url|reviewUrl|postUrl/i, (v) => /^https?:/.test(v)) };
}
async function nick(id: string) {
  try { const t = await (await fetch(`https://m.blog.naver.com/${id}`, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR" } })).text(); const m = t.match(/"nickName"\s*:\s*"((?:[^"\\]|\\.)*)"/); return m ? unesc(m[1]) : null; } catch { return null; }
}
const NOTE_SCHEMA = { type: "object", properties: { notes: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, note: { type: "string" } }, required: ["i", "note"], additionalProperties: false } } }, required: ["notes"], additionalProperties: false };
const NOTE_SYSTEM = `체험단에 선정된 블로거 명단입니다. 각 사람의 신청메시지·등급·방문자·주소를 보고 업체 점주가 미리 알면 좋은 특이사항을 한 줄(30자 안팎)으로 적어주세요.\n- 예: "아이 동반 육아 블로거", "3일 이내 리뷰 약속", "제품 리뷰 위주 · 영상/GIF 촬영"\n- 메시지가 비어 있고 특별한 점이 없으면 빈 문자열.\n- 개인정보(전화·주소 상세)는 적지 마세요. 없는 내용을 지어내지 마세요.`;
async function notes(company: string, rows: any[]) {
  const key = Deno.env.get("ANTHROPIC_API_KEY"); if (!key || !rows.some((r) => r.msg)) return {};
  try {
    const msg: any = await new Anthropic({ apiKey: key }).beta.messages.create({ model: "claude-haiku-5-5", max_tokens: 3000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { format: { type: "json_schema", schema: NOTE_SCHEMA } }, system: NOTE_SYSTEM,
      messages: [{ role: "user", content: `업체: ${company.slice(0, 60)}\n명단(JSON):\n${JSON.stringify(rows.slice(0, 40).map((r, i) => ({ i, msg: String(r.msg || "").slice(0, 600), grade: r.grade, visits: r.visits, area: String(r.area || "").slice(0, 30) })))}` }] } as any);
    const out = JSON.parse((msg.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(""));
    return Object.fromEntries((out.notes || []).map((n: any) => [n.i, String(n.note || "").slice(0, 60)]));
  } catch (e) { console.error("RN_NOTES", e); return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json();
    const key = String(body.key || "");
    if (key.length < 24) return json({ error: "북마크 키가 없습니다 — CRM에서 북마크를 다시 만들어주세요" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: k } = await sb.from("rn_keys").select("user_id").eq("key_hash", await sha256(key)).maybeSingle();
    if (!k) { await new Promise((r) => setTimeout(r, 600)); return json({ error: "북마크 키가 맞지 않습니다 — CRM에서 북마크를 다시 만들어주세요" }, 401); }
    const { data: admin } = await sb.from("admins").select("user_id,name").eq("user_id", k.user_id).maybeSingle();
    if (!admin) return json({ error: "관리자 계정이 아닙니다" }, 403);
    await sb.from("rn_keys").update({ last_used_at: new Date().toISOString() }).eq("user_id", k.user_id);

    const camps = (Array.isArray(body.campaigns) ? body.campaigns : []).slice(0, 30);
    const preview = !!body.preview;
    const today = kstDay(Date.now());
    const [{ data: cos }, { data: cfgRows }] = await Promise.all([
      sb.from("companies").select("id,name,brand,recruit_days,camp_teams,camp_round_done,camp_round_cycle,run_status").eq("stage", "결제").limit(3000),
      sb.from("crm_settings").select("key,value").in("key", ["camp_offsets", "camp_start"]),
    ]);
    const live = (c: any) => c.run_status === "진행 중";
    const camp = (cos || []).filter(live); // 1차 매칭 = 진행 중 계약 업체 (모집일 없어도), 못 찾으면 계약 끝난 업체까지
    const cfg = Object.fromEntries((cfgRows || []).map((x: any) => [x.key, x.value]));
    const off = { 발표: 7, 마감: 21, ...(cfg.camp_offsets || {}) } as Record<string, number>;
    const gap = (off["마감"] || 0) - (off["발표"] || 0);
    const start = String(cfg.camp_start || today).replace(/"/g, "");
    const score = (co: any, title: string) => { const T = norm(title), n = norm(co.name), br = norm(String(co.name || "").replace(co.brand || String(co.name).split(/\s+/)[0], "")); if (!T || !n) return 0; if (T.includes(n)) return 3; if (br.length >= 2 && T.includes(br) && (!co.brand || T.includes(norm(co.brand)))) return 2; if (br.length >= 3 && T.includes(br)) return 1; return 0; };
    // 가장 최근 모집 회차 (오늘 +3일까지)
    const lastCycle = (co: any) => { const days: number[] = (co.recruit_days || []).map(Number).filter(Boolean); if (!days.length) return null; let best: string | null = null; for (let m = addMonth(today.slice(0, 7), -2); m <= today.slice(0, 7); m = addMonth(m, 1)) { const [y, mo] = m.split("-").map(Number), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate(); for (const d of days) { const c = `${m}-${pad(Math.min(d, dim))}`; if (c <= addDays(today, 3) && (!best || c > best)) best = c; } } return best; };
    const linkOf = (coId: string, cycle: string) => `${ADMIN}#camp-${coId}_${cycle}`;
    // 리뷰노트 캠페인 날짜 (키 이름으로 추정): 모집 시작 · 발표 · 리뷰 마감
    const pickDates = (d: Record<string, string>) => {
      const ent = Object.entries(d || {}).filter(([, v]) => /^\d{4}-\d{2}-\d{2}$/.test(String(v))).map(([k, v]) => [k.toLowerCase(), String(v)] as [string, string]);
      const find = (re: RegExp, not?: RegExp) => ent.filter(([k]) => re.test(k) && !(not && not.test(k))).map(([, v]) => v).sort()[0] || null;
      return {
        rs: find(/(recruit|apply|application|regist|모집|신청).*(start|begin|from|open|시작)|(^|\.)(start|begin)(date|at|day)?$/),
        ann: find(/(announce|winner|select|choice|result|발표)/, /(end|deadline|close)/),
        ae: find(/(apply|application|recruit|regist|모집|신청).*(end|close|until|마감|종료)/),
        dl: find(/(review|post|mission|submit|content|리뷰|등록).*(end|deadline|due|until|close|마감|종료)/),
      };
    };
    const cyclesIn = (co: any, a: string, b: string) => { const out: string[] = []; const days: number[] = (co.recruit_days || []).map(Number).filter(Boolean); for (let m = addMonth(a.slice(0, 7), 0); m <= b.slice(0, 7); m = addMonth(m, 1)) { const [y, mo] = m.split("-").map(Number), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate(); for (const d of days) { const c = `${m}-${pad(Math.min(d, dim))}`; if (c >= a && c <= b) out.push(c); } } return [...new Set(out)].sort(); };
    const dd = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
    // 모집 시작일과 가장 가까운 모집 회차 (매월 모집일 + 달력에서 직접 추가한 회차, ±12일)
    const nearCycle = async (co: any, rs: string) => {
      const { data: tk } = await sb.from("camp_tasks").select("cycle_on,skipped").eq("company_id", co.id).eq("step", "모집").gte("cycle_on", addDays(rs, -12)).lte("cycle_on", addDays(rs, 12));
      const skip = new Set((tk || []).filter((t: any) => t.skipped).map((t: any) => t.cycle_on));
      const cand = [...cyclesIn(co, addDays(rs, -12), addDays(rs, 12)), ...(tk || []).filter((t: any) => !t.skipped).map((t: any) => t.cycle_on)].filter((c) => !skip.has(c));
      return cand.sort((a, b) => dd(a, rs) - dd(b, rs))[0] || null;
    };
    // 회차 번호 = 모집 달력과 같은 규칙: 모집 label > 이 회차 rounds > 지난 명단 회차 + 그 뒤 모집 수 > 끝난 회차 기준점 + 그 뒤 모집 수
    const roundOf = async (co: any, cycle: string, cur: any, byDate = false) => {
      const { data: t } = await sb.from("camp_tasks").select("label").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", "모집").maybeSingle();
      if (t?.label === "-") return null;
      if (/^\d+$/.test(t?.label || "")) return +t!.label;
      if (cur?.round_no) return cur.round_no;
      if (byDate) return null; // 모집일 규칙 밖 회차 = 자동 번호 없음 → 직접 입력
      const { data: pr } = await sb.from("rounds").select("round_no,cycle_on").eq("company_id", co.id).lt("cycle_on", cycle).not("round_no", "is", null).order("cycle_on", { ascending: false }).limit(1);
      const n = (a: string) => cyclesIn(co, addDays(a, 1), cycle).length;
      if (pr?.[0]) return pr[0].round_no + Math.max(1, n(pr[0].cycle_on));
      if (co.camp_round_done != null && co.camp_round_cycle && co.camp_round_cycle <= cycle) return co.camp_round_done + n(co.camp_round_cycle);
      return null;
    };

    // 명단 없는 다음 회차: 이 업체 회차 중 명단이 있는 것(모집일 회차 + 마지막 계약 텍스트 회차)의 가장 큰 번호 + 1
    const ctrOf = (k: string | null) => +((String(k || '').match(/^txt:.*:(\d{2}):\d{3}$/) || [])[1] || 0);
    const nextOf = async (co: any, exceptId?: string) => {
      const { data: rs } = await sb.from("rounds").select("id,round_no,cycle_on,import_key").eq("company_id", co.id).limit(500);
      const ids = (rs || []).map((r: any) => r.id), cnt = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 150) ((await sb.from("roster").select("round_id").in("round_id", ids.slice(i, i + 150)).limit(5000)).data || []).forEach((x: any) => cnt.set(x.round_id, (cnt.get(x.round_id) || 0) + 1));
      const maxC = Math.max(0, ...(rs || []).map((r: any) => ctrOf(r.import_key)));
      const cur = (rs || []).filter((r: any) => r.id !== exceptId && r.round_no && cnt.get(r.id) && (r.cycle_on || !ctrOf(r.import_key) || ctrOf(r.import_key) === maxC));
      const have = [...new Set(cur.map((r: any) => r.round_no as number))].sort((a, b) => a - b);
      const last = have.length ? have[have.length - 1] : null;
      return { next: last ? last + 1 : null, last, have };
    };
    // 회차 번호로 저장할 모집 회차 고르기: 그 번호의 모집일 회차(rounds) → 모집 label이 그 번호인 회차 → 날짜로
    const cycleForNo = async (co: any, n: number, D: any) => {
      const { data: r1 } = await sb.from("rounds").select("cycle_on").eq("company_id", co.id).eq("round_no", n).not("cycle_on", "is", null).order("cycle_on", { ascending: false }).limit(1);
      if (r1?.[0]?.cycle_on) return { cycle: r1[0].cycle_on, byDate: false };
      const { data: t1 } = await sb.from("camp_tasks").select("cycle_on").eq("company_id", co.id).eq("step", "모집").eq("label", String(n)).order("cycle_on", { ascending: false }).limit(1);
      if (t1?.[0]?.cycle_on) return { cycle: t1[0].cycle_on, byDate: false };
      let c = D.rs ? await nearCycle(co, D.rs) : null, bd = false;
      if (!c && D.rs) { c = D.rs; bd = true; }
      if (!c) c = lastCycle(co);
      return { cycle: c, byDate: bd };
    };
    // 닉네임 · AI 특이사항
    const enrich = async (co: any, rows: any[]) => {
      const ids = [...new Set(rows.map((r: any) => blogId(r.blog)).filter(Boolean))] as string[];
      const [nk, nt] = await Promise.all([Promise.all(ids.slice(0, 40).map((id) => nick(id))), notes(co.name, rows)]);
      const nkMap = Object.fromEntries(ids.map((id, i) => [id, nk[i]]));
      rows.forEach((r: any, i: number) => { const id = blogId(r.blog); if (!r.nickname && id && nkMap[id]) r.nickname = nkMap[id]; r.note = (nt as any)[i] || ""; });
    };
    // 명단 저장 (그 회차 행의 명단을 새 명단으로 교체) — 예전 명단(old)의 글 링크·취소는 지킴 (전화번호·이름으로 맞춤)
    const putRoster = async (roundId: string, rows: any[], old: any[]) => {
      const keep = (r: any) => old.find((o: any) => (o.phone && o.phone === r.phone) || (o.name && o.name === r.name));
      await sb.from("roster").delete().eq("round_id", roundId);
      return await sb.from("roster").insert(rows.map((r: any) => { const o = keep(r); return { round_id: roundId, nickname: r.nickname || null, name: r.name || null, phone: r.phone || null, blog_url: r.blog || null, post_url: o?.post_url || r.post || null, note: r.note || null, grade: r.grade || null, visits: r.visits, cancelled: !!(o?.cancelled || r.cancelled) }; }));
    };
    const results: any[] = [];
    for (const cp of camps) {
      const rid = String(cp.id || "").slice(0, 40), title = String(cp.title || "").slice(0, 200);
      const rows = (Array.isArray(cp.rows) ? cp.rows : []).slice(0, 100).map(mapRow).filter((r: any) => r.name || r.blog || r.phone);
      const out: any = { id: rid, title, count: rows.length };
      const D = pickDates(cp.dates || {});
      const sup = !!cp.sup, extra = !!cp.extra || sup, XN = sup ? "보충" : "추가";
      const wantNo = Number(cp.round_no) > 0 ? Math.floor(Number(cp.round_no)) : null;
      console.log("RN_DATES", rid, JSON.stringify(cp.dates || {}).slice(0, 600), JSON.stringify(D));
      if (!rid || !rows.length) { results.push({ ...out, status: "empty", msg: "선정 명단이 비어 있음" }); continue; }
      // 이미 저장한 캠페인?
      let { data: prev } = await sb.from("rounds").select("id,company_id,cycle_on,round_no,round_label,state,recruit_on").eq("rn_campaign_id", rid).maybeSingle();
      // v8: 이미 저장한 캠페인도 항상 회차를 다시 물어봄 (지금 저장된 회차를 기본값으로)
      const otherCo = !!prev && (!!cp.search || (!!cp.company_id && String(cp.company_id) !== prev.company_id)); // 업체 바꾸기 → 새로 찾기 (저장 때 예전 저장분에서 옮김)
      if (prev && preview && !otherCo) {
        const pco = (cos || []).find((c: any) => c.id === prev!.company_id) || (await sb.from("companies").select("id,name").eq("id", prev.company_id).single()).data;
        const nx = await nextOf({ id: prev.company_id }, prev.id);
        const isX = prev.state === "추가", isS = isX && /보충/.test(prev.round_label || "");
        results.push({ ...out, status: "confirm", company: pco?.name, company_id: prev.company_id, saved_no: prev.round_no, saved_extra: isX, saved_sup: isS, next: isX ? null : prev.round_no, last: nx.last, have: nx.have,
          msg: `이미 ${prev.round_no ? prev.round_no + "회차" : "회차 없음"}${isX ? (isS ? " 보충 명단" : " 추가 명단") : ""}으로 저장됨 — 같은 회차로 저장하면 갱신, 다른 회차를 고르면 옮김` });
        continue;
      }
      let moveFrom: any = null;
      if (prev && preview) prev = null; // 업체 바꾸기 미리보기: 새 업체 기준으로 확인만
      if (prev) { // 저장: 고른 회차가 예전 저장분과 다르면 옮김(예전 행의 명단은 지우고 글 링크·취소는 새 명단으로 가져감)
        const same = !otherCo && (extra ? prev.state === "추가" : prev.state !== "추가" && (!wantNo || wantNo === prev.round_no));
        if (!same) { moveFrom = prev; prev = null; }
      }
      const moveOld = moveFrom ? ((await sb.from("roster").select("name,phone,post_url,cancelled").eq("round_id", moveFrom.id)).data || []) : [];
      const releaseMove = async () => { if (!moveFrom) return; if (moveFrom.state === "추가") await sb.from("rounds").delete().eq("id", moveFrom.id); else { await sb.from("roster").delete().eq("round_id", moveFrom.id); await sb.from("rounds").update({ rn_campaign_id: null }).eq("id", moveFrom.id); } };
      let co: any, cycle: string | null, round: any = prev, byDate = false;
      if (prev) {
        co = (cos || []).find((c: any) => c.id === prev.company_id) || (await sb.from("companies").select("id,name,brand,recruit_days,camp_teams,camp_round_done,camp_round_cycle").eq("id", prev.company_id).single()).data; cycle = prev.cycle_on;
        // 추가 명단 갱신: 마감일 = 북마크 일정 · 명단 교체
        if (prev.state === "추가") {
          await enrich(co, rows);
          const old = (await sb.from("roster").select("name,phone,post_url,cancelled").eq("round_id", prev.id)).data || [];
          await sb.from("rounds").update({ ...(D.dl ? { deadline: D.dl } : {}), teams: rows.length, round_label: `${prev.round_no}회차 ${XN}` }).eq("id", prev.id);
          const ins = await putRoster(prev.id, rows, old);
          if (ins.error) { results.push({ ...out, status: "error", company: co?.name, msg: "명단 저장 실패: " + ins.error.message }); continue; }
          results.push({ ...out, cancelled: rows.filter((r: any) => r.cancelled).length, status: "updated", company: co?.name, round_no: prev.round_no, extra: true, sup, deadline: D.dl, msg: `${prev.round_no}회차 ${XN} 명단 갱신`, link: prev.recruit_on ? linkOf(prev.company_id, prev.recruit_on) : null });
          continue;
        }
        const { count } = await sb.from("roster").select("id", { count: "exact", head: true }).eq("round_id", prev.id);
        const { count: cc } = await sb.from("roster").select("id", { count: "exact", head: true }).eq("round_id", prev.id).eq("cancelled", true);
        if (count === rows.length && (cc || 0) === rows.filter((r: any) => r.cancelled).length) {
          const ap: string[] = []; for (const [st, due] of [["발표", D.ann || D.ae], ["마감", D.dl]] as [string, string | null][]) { if (!due) continue; const { data: t } = await sb.from("camp_tasks").select("due_on,skipped").eq("company_id", prev.company_id).eq("cycle_on", cycle).eq("step", st).maybeSingle(); if (t?.due_on !== due || t?.skipped) { await sb.from("camp_tasks").upsert({ company_id: prev.company_id, cycle_on: cycle, step: st, due_on: due, skipped: false }, { onConflict: "company_id,cycle_on,step" }); ap.push(`${st} ${+due.slice(5, 7)}/${+due.slice(8)}`); } }
          results.push({ ...out, applied: ap.join(" · "), status: "same", company: co?.name, round_no: prev.round_no, cycle, msg: "이미 저장됨 (인원·취소 같음)", link: linkOf(prev.company_id, prev.cycle_on) }); continue; }
      } else {
        const pickId = cp.company_id && String(cp.company_id);
        const search = norm(String(cp.search || ""));
        if (pickId) co = (cos || []).find((c: any) => c.id === pickId);
        else if (search) {
          const hit = (pool: any[]) => pool.filter((c: any) => norm(c.name).includes(search));
          const h = hit(camp).length ? hit(camp) : hit(cos || []);
          if (h.length === 1) co = h[0];
          else { results.push({ ...out, status: "pick", msg: h.length ? `'${cp.search}' 업체가 ${h.length}곳 — 골라주세요` : `'${cp.search}' 이름의 계약 업체가 없습니다`, candidates: h.slice(0, 8).map((c: any) => ({ id: c.id, name: c.name })) }); continue; }
        }
        else {
          const rank = (pool: any[]) => pool.map((c: any) => ({ c, s: score(c, title) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s);
          let ranked = rank(camp); if (!ranked.some((x: any) => x.s === 3)) { const all = rank(cos || []); if (all.some((x: any) => x.s === 3)) ranked = all; }
          const top = ranked.filter((x: any) => x.s === 3);
          if (top.length === 1) co = top[0].c;
          else { results.push({ ...out, status: "pick", msg: ranked.length ? "어느 업체인지 골라주세요" : "제목과 맞는 업체가 없습니다 (CRM 등록·모집일 확인)", candidates: (top.length ? top : ranked).slice(0, 6).map((x: any) => ({ id: x.c.id, name: x.c.name })) }); continue; }
        }
        if (!co) { results.push({ ...out, status: "pick", msg: "업체를 찾지 못했습니다", candidates: [] }); continue; }
        if (preview) { const nx = await nextOf(co); results.push({ ...out, status: "confirm", company: co.name, company_id: co.id, next: nx.next, last: nx.last, have: nx.have, msg: nx.last ? `명단 있는 마지막 회차 ${nx.last}회차 → 다음 ${nx.next}회차` : "명단 있는 회차 없음 — 회차를 입력하세요" }); continue; }
        // v8 추가 명단: 새 회차 없이 명단 있는 마지막 회차에 붙임 · 마감일 = 북마크 일정
        if (extra) {
          const nx = await nextOf(co, moveFrom?.id);
          if (!nx.last) { results.push({ ...out, status: "error", company: co.name, msg: `명단 있는 회차가 없어 ${XN} 명단을 붙일 수 없습니다 — 회차를 골라 저장하세요` }); continue; }
          if (!D.dl && !sup) { results.push({ ...out, status: "error", company: co.name, msg: "북마크 일정에서 마감일을 찾지 못했습니다 — 리뷰노트 [일정 확인]에 마감일이 있는지 확인" }); continue; }
          const { data: par } = await sb.from("rounds").select("id,cycle_on,deadline").eq("company_id", co.id).eq("round_no", nx.last).neq("state", "추가").order("cycle_on", { ascending: false, nullsFirst: false }).limit(1);
          const pCycle = par?.[0]?.cycle_on || null;
          // 보충 명단: 마감일이 없으면 그 회차 마감일(모집 회차 camp_tasks 마감 → 텍스트 회차 deadline)
          let dl: string | null = D.dl;
          if (!dl && pCycle) dl = (await sb.from("camp_tasks").select("due_on").eq("company_id", co.id).eq("cycle_on", pCycle).eq("step", "마감").maybeSingle()).data?.due_on || null;
          if (!dl) dl = par?.[0]?.deadline || null;
          await enrich(co, rows);
          await releaseMove(); // 예전 저장분 연결을 먼저 풀어 rn_campaign_id가 한 행에만
          const ins0 = await sb.from("rounds").insert({ company_id: co.id, cycle_on: null, recruit_on: pCycle, round_no: nx.last, round_label: `${nx.last}회차 ${XN}`, state: "추가", teams: rows.length, deadline: dl, rn_campaign_id: rid, import_key: `add:${co.id}:${rid}`, memo: `${XN} 명단 (북마크)` }).select("id").single();
          if (ins0.error) { results.push({ ...out, status: "error", company: co.name, msg: `${XN} 명단 저장 실패: ` + ins0.error.message }); continue; }
          const ins = await putRoster(ins0.data.id, rows, moveOld);
          if (ins.error) { results.push({ ...out, status: "error", company: co.name, msg: "명단 저장 실패: " + ins.error.message }); continue; }
          await sb.from("company_events").insert({ company_id: co.id, actor: k.user_id, kind: "system", body: `리뷰노트 ${XN} 명단 ${rows.length}명 저장 (북마크 · ${nx.last}회차에 ${XN}${dl ? " · 마감 " + dl.slice(5) : ""})` });
          results.push({ ...out, cancelled: rows.filter((r: any) => r.cancelled).length, status: "saved", company: co.name, round_no: nx.last, extra: true, sup, deadline: dl, applied: dl ? `${XN} 마감 ${+dl.slice(5, 7)}/${+dl.slice(8)}` : "", link: pCycle ? linkOf(co.id, pCycle) : null, msg: pCycle ? "" : `${nx.last}회차 ${XN} 명단 저장 (모집일 없는 회차 — 전체 회차 명단에서 확인)` });
          continue;
        }
        if (wantNo) { const fc = await cycleForNo(co, wantNo, D); cycle = fc.cycle; if (cycle && fc.byDate) { const { data: tm } = await sb.from("camp_tasks").select("cycle_on").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", "모집").maybeSingle(); if (!tm) await sb.from("camp_tasks").upsert({ company_id: co.id, cycle_on: cycle, step: "모집", due_on: cycle, skipped: false }, { onConflict: "company_id,cycle_on,step" }); } }
        else cycle = (D.rs ? await nearCycle(co, D.rs) : null);
        // 모집일 규칙에 맞는 회차가 없으면(모집일 미설정·오래된 캠페인) 캠페인 모집 시작일을 회차로 = 달력 '직접 추가 회차'(camp_tasks 모집 행)
        if (!wantNo && !cycle && D.rs) { cycle = D.rs; byDate = true; const { data: tm } = await sb.from("camp_tasks").select("cycle_on").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", "모집").maybeSingle(); if (!tm) await sb.from("camp_tasks").upsert({ company_id: co.id, cycle_on: cycle, step: "모집", due_on: cycle, skipped: false }, { onConflict: "company_id,cycle_on,step" }); }
        if (!cycle) cycle = lastCycle(co);
        if (!cycle) { results.push({ ...out, status: "no_cycle", company: co.name, msg: "CRM에 매월 모집일이 없습니다 — 캘린더 '모집일 미설정'에서 넣은 뒤 다시" }); continue; }
        const { data: r0 } = await sb.from("rounds").select("id,round_no,rn_campaign_id").eq("company_id", co.id).eq("cycle_on", cycle).maybeSingle();
        if (r0?.rn_campaign_id && r0.rn_campaign_id !== rid) { results.push({ ...out, status: "conflict", company: co.name, msg: `${cycle} 회차에 다른 캠페인 명단이 이미 있습니다`, link: linkOf(co.id, cycle) }); continue; }
        round = r0;
        if (moveFrom && round?.id === moveFrom.id) moveFrom = null; // 같은 행이면 옮길 것 없음
      }
      // 발표일: 비어 있으면 오늘 (명단이 나왔다 = 발표)
      // 발표·마감: 리뷰노트 캠페인 날짜가 있으면 그 날짜로 달력 반영, 없으면 예전처럼 (발표 비어 있으면 오늘)
      const applied: string[] = [];
      const putStep = async (step: string, due: string) => { const { data: t } = await sb.from("camp_tasks").select("due_on,skipped").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", step).maybeSingle(); if (t?.due_on === due && !t?.skipped) return; await sb.from("camp_tasks").upsert({ company_id: co.id, cycle_on: cycle, step, due_on: due, skipped: false }, { onConflict: "company_id,cycle_on,step" }); applied.push(`${step} ${+due.slice(5, 7)}/${+due.slice(8)}`); };
      const annD = D.ann || D.ae; // 리뷰노트에 발표일이 없으면 신청 마감일 = 선정 발표
      if (annD) await putStep("발표", annD);
      if (D.dl) await putStep("마감", D.dl);
      const { data: tA } = await sb.from("camp_tasks").select("due_on").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", "발표").maybeSingle();
      let ann = tA?.due_on || (cycle! < start ? addDays(cycle!, off["발표"] || 0) : null);
      if (!ann) { ann = today; await sb.from("camp_tasks").upsert({ company_id: co.id, cycle_on: cycle, step: "발표", due_on: today, skipped: false }, { onConflict: "company_id,cycle_on,step" }); applied.push(`발표 ${+today.slice(5, 7)}/${+today.slice(8)}(오늘)`); }
      const { data: tD } = await sb.from("camp_tasks").select("due_on").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", "마감").maybeSingle();
      const deadline = tD?.due_on || addDays(ann, gap);
      await enrich(co, rows);
      // 회차 저장
      const forcedNo = !prev && wantNo ? wantNo : null;
      const roundNo = forcedNo || await roundOf(co, cycle!, round, byDate);
      if (forcedNo) { const { data: tl } = await sb.from("camp_tasks").select("id").eq("company_id", co.id).eq("cycle_on", cycle).eq("step", "모집").maybeSingle(); if (tl) await sb.from("camp_tasks").update({ label: String(forcedNo) }).eq("id", tl.id); else await sb.from("camp_tasks").insert({ company_id: co.id, cycle_on: cycle, step: "모집", due_on: cycle, label: String(forcedNo) }); } // 모집 달력 회차도 그 번호로
      const rowR = { company_id: co.id, cycle_on: cycle, round_no: roundNo, round_label: roundNo ? String(roundNo) : null, teams: co.camp_teams || rows.length, recruit_on: cycle, deadline, state: "진행", rn_campaign_id: rid };
      await releaseMove(); // 예전 저장분(다른 회차)에서 캠페인 연결을 먼저 풀어야 rn_campaign_id 중복 없이 저장됨
      const saved = round ? (await sb.from("rounds").update(rowR).eq("id", round.id).select("id").single()) : (await sb.from("rounds").insert(rowR).select("id").single());
      if (saved.error) { results.push({ ...out, status: "error", company: co.name, msg: "회차 저장 실패: " + saved.error.message }); continue; }
      const roundId = saved.data.id;
      const { data: old } = await sb.from("roster").select("name,phone,post_url,cancelled").eq("round_id", roundId);
      const ins = await putRoster(roundId, rows, [...(old || []), ...moveOld]);
      if (ins.error) { results.push({ ...out, status: "error", company: co.name, msg: "명단 저장 실패: " + ins.error.message }); continue; }
      await sb.from("company_events").insert({ company_id: co.id, actor: k.user_id, kind: "system", body: `리뷰노트 명단 ${rows.length}명 ${prev ? "갱신" : moveFrom ? "옮겨 저장" : "저장"} (북마크 · ${roundNo ? roundNo + "회차 · " : ""}발표 ${ann.slice(5)}${applied.length ? " · 달력 " + applied.join(", ") : ""})` });
      results.push({ ...out, cancelled: rows.filter((r: any) => r.cancelled).length, status: prev || moveFrom ? "updated" : "saved", company: co.name + (roundNo ? "" : " · 회차 직접 입력"), round_no: roundNo, cycle, announce: ann, deadline, applied: applied.join(" · "), nick: rows.filter((r: any) => r.nickname).length, notes: rows.filter((r: any) => r.note).length, link: linkOf(co.id, cycle!) });
    }
    // v9: 예전 북마크(bm 없음)는 회차 드롭다운·'＋ 추가 명단 생성'이 없음 → 결과마다 다시 설치 안내 (예전 북마크도 msg는 그대로 보여 줌)
    if (!(Number(body.bm) >= 10)) results.forEach((r) => { r.msg = "⚠ 예전 북마크입니다 — CRM 체험단 명단 탭 [리뷰노트 북마크 설치]로 다시 설치하면 '＋ 보충 명단'·취소 인원 가져오기가 됩니다. " + (r.msg || ""); });
    console.log("RN_IMPORT", admin.name, results.map((r) => `${r.id}:${r.status}`).join(" "));
    return json({ by: admin.name, results });
  } catch (e) {
    console.error("RN_IMPORT", e);
    return json({ error: "서버 오류" }, 500);
  }
});
