-- 모집 캘린더 재계약 임박 표시 (2026-11-27)
-- camp_renew_ack   = [확인 완료]를 누른 계약 회차 (같으면 빨간 표시 끔)
-- camp_renew_added = 재계약 칸에 자동으로 넣은 계약 회차 (같으면 다시 안 넣음)
alter table public.companies add column if not exists camp_renew_ack int, add column if not exists camp_renew_added int;
