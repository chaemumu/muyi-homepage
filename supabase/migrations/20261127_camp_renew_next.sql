-- 선재계약 · 영구 지점 (2026-11-27)
-- camp_renew_next = 다음 계약 회차(선재계약) · camp_renew_next_on = 계약일
--   있으면 빨간 표시·'재계약 임박' 칸에서 빠지고, 지금 계약 회차를 다 쓰면 캘린더가 자동 갱신(camp_round_total로 옮기고 비움)
-- camp_round_total = 0 → 영구 지점(회차 상한 없음, 재계약 임박 대상 아님)
alter table public.companies add column if not exists camp_renew_next int;
alter table public.companies add column if not exists camp_renew_next_on date;
alter table public.companies drop constraint if exists companies_camp_round_total_check;
alter table public.companies add constraint companies_camp_round_total_check check (camp_round_total between 0 and 99);
alter table public.companies add constraint companies_camp_renew_next_check check (camp_renew_next between 1 and 99);
-- 영구 보장 지점: 용강림 · 가야국수
update public.companies set camp_round_total = 0 where id in ('b85296e4-dec5-4666-835c-aec1dcc107f5', '5992bbab-034a-467d-86da-6ce4cd49aae1');
