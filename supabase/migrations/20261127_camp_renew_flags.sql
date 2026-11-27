-- 모집 캘린더 재계약 임박 표시 (2026-11-27)
-- camp_renew_ack = 모집 팝업 [확인 완료]를 누른 계약 회차 (같으면 빨간 표시·'재계약 예정' 칸에서 뺌)
alter table public.companies add column if not exists camp_renew_ack int;
