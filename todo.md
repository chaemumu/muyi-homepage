# AI 노출 모니터링 (GEO) — 승인 2026-11-19, 구현 2026-11-20 (OpenAI·Gemini 키 등록 대기)

목표: 매주 ChatGPT·Gemini·Claude에 같은 질문 20개를 던져 "무이"가 답변에 나오는지, 몇 번째인지, 어떤 출처를 인용하는지 기록한다.

### 구조 (기존 daily-digest와 같은 방식)
- [ ] DB 테이블 `ai_visibility` (Supabase): 실행일 · 엔진 · 질문 · 무이 언급 여부 · 언급 순서 · 인용 URL · 답변 원문. RLS = `is_admin()` 읽기만, 쓰기는 함수만
- [ ] 질문 20개는 `crm_settings 'ai_vis_questions'`에 저장 (문의함에서 수정 가능, 코드 수정 없이 교체)
- [ ] Edge Function `ai-visibility`: 엔진별로 질문 20개 실행 → 저장. 웹 검색을 켠 상태로 질문(실제 사용자 답변과 비슷하게)
  - ChatGPT: OpenAI Responses API + 웹 검색 (Secret `OPENAI_API_KEY`, 직접 등록 필요)
  - Gemini: Gemini API + Google 검색 그라운딩 (Secret `GEMINI_API_KEY`, 직접 등록 필요)
  - Claude: Messages API + 웹 검색 (기존 Secret `ANTHROPIC_API_KEY`)
  - 모델 이름은 `crm_settings 'ai_vis_config'`에 두고 바꿀 수 있게
- [ ] pg_cron: 매주 월요일 07:30~08:00 KST 엔진별 실행 → 08:10 리포트
- [ ] 카카오워크 주간 요약 (마스터에게 1:1, daily-digest와 같은 봇): 엔진별 언급률, 지난주 대비 변화, 새로 언급된/빠진 질문
- [ ] 문의함 `/admin`에 'AI 노출' 화면: 주차별 언급률 그래프 · 질문별 결과 표 · 답변 원문 · 인용 출처 Top 10
- [ ] 첫 실행 후 결과 확인

### 질문 20개 (초안)
소상공인 12: 소상공인 마케팅 대행사 추천 / 네이버 플레이스 상위노출 잘하는 마케팅 회사 / 음식점 마케팅 대행 어디가 좋아 / 식당 홍보 업체 추천 / 카페 마케팅 대행사 / 미용실 마케팅 대행 / 동네 병원 마케팅 대행사 / 필라테스 마케팅 대행 / 학원 마케팅 대행사 / 자영업자 광고비 새는 곳 진단해주는 곳 / 서울 소상공인 마케팅 회사 / 프랜차이즈 매장 마케팅 대행
숏폼·영상 6: 음식점 숏폼 촬영 업체 추천 / 매장 릴스 촬영 대행 / 식당 홍보 영상 제작 업체 / 가게 숏폼 제작 비용 / 인스타 릴스 마케팅 대행사 / 음식점 유튜브 쇼츠 제작 대행
브랜드 2: 무이코퍼레이션은 어떤 회사야 / 무이 스튜디오 숏폼 촬영 후기

### 비용 (주 1회 · 60회 호출 기준, 추정)
ChatGPT 월 약 1만 원 · Gemini 무료 한도 안 · Claude 월 약 5천 원

---

# MUYI 홈페이지 UX/UI 개선 작업 리스트

## Phase 1: Hero 압도적 타이포 (최우선)
- [ ] Hero 타이틀 font-size 1.4배+ 확대 (`clamp(5rem, 12vw, 13rem)`)
- [ ] 3D 풍선 느낌 텍스트: 다층 text-shadow + 블루 그라데이션 `background-clip: text`
- [ ] h-sub, h-eye 텍스트 크기 20% 확대
- [ ] Hero CTA 버튼(`h-enter`) 크기/강조 대폭 강화 — 배경 블루, 사이즈 업

## Phase 2: 네비게이션 / CTA
- [ ] 헤더 로고 크기 2배 (`130px`+), `mix-blend-mode: difference` 제거 → 브랜드 블루 유지
- [ ] `nav-cta` "문의하기" 버튼: 배경 `#1E10C7`, 크기 확대, hover 효과 강화
- [ ] nav-lnk 폰트 사이즈 업 (`.78rem` → `.9rem`)

## Phase 3: IMC 궤도 인터랙션 (핵심)
- [ ] 중앙 코어 sphere 반지름 `.3` → `.5` (클릭 영역 확대)
- [ ] 코어 glow `.7` → `1.0` 확대
- [ ] hover 시: 노드 이름 + 설명 툴팁 HTML 오버레이 표시
- [ ] hover 시: 노드 확대 + glow 강화 + 궤도 링 하이라이트
- [ ] 클릭 시: active 상태 시각 유지 (선택된 노드 강조 고정)
- [ ] 중앙 코어 클릭 → 정보 패널 전환 (기존 동작 보장)

## Phase 4: 흐름 유도 인터랙션
- [ ] 각 패널 등장 시 stagger 애니메이션 강화 (요소별 시차 더 뚜렷하게)
- [ ] 섹션 전환 시 방향성 모션 (현재 fade만 → slide + fade)
- [ ] scroll-hint 스타일 강화 (더 눈에 띄게)

## Phase 5: 전체 UI 스케일 업
- [ ] 전반 타이포 20~30% 확대 (nc-title, ss-t, cli-ti, ct-ti 등)
- [ ] 버튼 패딩 전반 30% 확대 (nc-next, btn-pri, btn-sec, fsub 등)
- [ ] 여백/간격 확대 (섹션 간 gap, padding)

## Phase 6: 레이아웃 비대칭화
- [ ] Hero 레이아웃: 타이포 좌측 오프셋 + 통계 우측 배치
- [ ] 노드 패널(nc): 텍스트 블록에 미세 회전/오프셋 도입
- [ ] Services 그리드 → 오프셋 스택 (비대칭 배치)

## Phase 7: 마감
- [ ] Contact 폼 입력 필드 시각성 강화
- [ ] Contact Submit 버튼 크기/강조 업
- [ ] Clients 로고 그리드 시각 계층 개선
- [ ] 모바일 반응형 재점검
