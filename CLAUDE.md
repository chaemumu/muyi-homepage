# MUYI WEBSITE — CLAUDE CODE SYSTEM

## PROJECT TYPE
전환 중심 인터랙션 랜딩페이지 (단순 소개 사이트 금지)

---

## CORE GOAL (CRITICAL)

이 사이트의 목적은 단 하나다:

👉 방문자를 리드로 전환 → CRM으로 전달

---

## USER FLOW (반드시 유지)

[유입]
↓
Hero (관심 끌기)
↓
Problem (공감)
↓
Solution (신뢰)
↓
Proof (확신)
↓
CTA (행동)
↓
CRM 전송

---

## TECH STACK

- Single HTML (`index.html`)
- Three.js r128 (고정)
- GSAP 3.12.2 + ScrollTrigger
- Fonts:
  - Syne (헤딩)
  - DM Sans (영문)
  - Noto Sans KR (한글)

---

## DESIGN SYSTEM

### Color
- Main: #1E10C7 (Deep Blue) — 80%
- Point: #EE4E00 (Orange) — 20%

### Typography
- Bold / Large Heading
- 여백 최소화 (정보 밀도 높게)

---

## UI PRINCIPLES (CRITICAL)

❌ 금지:
- 카드형 레이아웃
- 정적인 섹션
- 단순 텍스트 나열

✅ 필수:
- 인터랙션 기반 UI
- 스크롤 스토리텔링
- hover / motion / transition 적극 사용
- 클릭 → 자연스러운 전환

---

## INTERACTION RULE

- 모든 주요 요소는 “움직임”이 있어야 한다
- 등장 애니메이션 필수
- ScrollTrigger 적극 활용
- Three.js는 Hero + 핵심 구간에만 집중 사용

---

## SECTION RULE

### 1. Hero
- 첫 화면에서 가치 전달
- 강한 메시지 + CTA 포함
- Three.js 인터랙션 유지

### 2. Problem
- 고객 문제를 직설적으로 표현
- 스크롤 기반 강조

### 3. Solution
- MUYI가 해결하는 방식
- 인터랙션으로 구조 표현

### 4. Proof
- 숫자 / 실제 사례 / 신뢰 요소
- 카운터 애니메이션

### 5. Services
- 나열 금지 → 흐름 기반 표현

### 6. Clients
- grayscale → hover color 유지

### 7. CTA (CRITICAL)
- 모든 섹션 하단에 CTA 존재
- 클릭 유도 강하게

---

## FORM / DATA FLOW (CRITICAL)

폼은 반드시 실제 작동해야 한다.

Flow:
[사용자 입력]
→ JS fetch (POST)
→ CRM API endpoint
→ 성공 / 실패 처리

필수 항목:
- 이름
- 연락처
- 문의 내용

UX:
- 로딩 상태 표시
- 성공 메시지
- 실패 시 재시도 안내

---

## DEV RULE (STRICT)

- index.html 단일 파일만 수정
- UI만 있고 기능 없는 상태 금지
- 기존 구조 유지하면서 개선
- Three.js 버전 변경 금지
- 코드 중복 금지 (DRY)

---

## PERFORMANCE RULE

- 불필요한 애니메이션 금지
- 초기 로딩 속도 유지
- Three.js 최적화 필수

---

## WORKFLOW (MANDATORY)

1. Plan 먼저 작성
2. todo.md 형태로 작업 정의
3. 승인 후 구현
4. 테스트 포함

---

## OUTPUT RULE

- 항상 전체 구조 기준으로 수정
- 부분 수정 금지
- 결과는 “전환 개선” 기준으로 판단

---

## QUALITY STANDARD

이 프로젝트는 일반 웹사이트가 아니다.

👉 “레드닷 수준 인터랙션 + 전환 퍼널” 기준

수준 낮으면 재설계한다.

---

## 운영 · 연동 (실제 구성 — 2026-11-12 기준)

> **영업 관리는 문의함(`/admin`) 하나로 한다.** 예전 MUYI CRM(`chaemumu/muyi-crm`, Supabase `npkpxlbcwmwlxqauevyv`)은
> 사용 중단·보관(일시정지). 그쪽 코드·함수·DB에 새 기능을 만들지 말 것. 최종 백업: 구글 드라이브 `MUYI CRM 백업`(2026-11-12).

### 프로젝트 구분
| 프로젝트 | 저장소 / 위치 | 용도 |
|---|---|---|
| MUYI 홈페이지 + 문의함 (이 저장소) | `chaemumu/muyi-homepage` → Vercel `muyi-homepage`, www.muyi.co.kr | 랜딩·문의 폼, 문의함(`/admin`) = 영업 관리 |
| MUYI Lab | 내부 대시보드 (이 저장소 아님) | 사내 UI 디자인 기준 |
| ~~MUYI CRM~~ | `chaemumu/muyi-crm` | **사용 중단(보관)** |

### 페이지
- 문의 폼이 있는 페이지: `index.html`, `b2b-marketing.html`, `public-sector.html`, `consult.html`, `expo-event.html`, `local-business.html`
- 위 페이지 수정 시 `<head>`의 `/assets/muyi-monitor.js?v=N` 태그 유지 (수정하면 `v` 값 올리기 — `/assets`는 1년 캐시, 현재 v=2)
- `admin.html` = 문의함: 목록·상태·담당자·다음 연락일·상담 기록(채팅)·**사업자등록증**·광고 성과·CSV

### Supabase (`pacyhanuwuizcxwoggen`) — 유일한 백엔드
- 문의 접수: 폼 → Edge Function `contact` → `contacts` insert + Resend 메일(info@muyi.co.kr) + 메타 CAPI
- `contacts` insert 트리거 → `notify-lead` → 카카오워크 🐙 문의 알림 방
- 장애 알림: `notify-alert` (카카오워크 🐙 방). `contact` 함수의 DB 저장·메일 실패·서버 오류 시 고객 이름·연락처 포함 발송
- 사업자등록증: `biz-ocr`(이미지 → Claude 추출, 저장 안 함, 관리자만, Secret `ANTHROPIC_API_KEY`)
  → 화면에서 확인·수정 → `business_registrations`(텍스트, RLS = `is_admin()`) + 비공개 버킷 `biz-docs/{contact_id}/{uuid}.webp`(흑백 압축본 ≈50KB)
- 백업: `backup-export`(헤더 `x-backup-key` = Secret `BACKUP_KEY`) ← 구글 Apps Script가 매일 03시 호출
  (코드 `backup/google-apps-script.js`, 드라이브 `MUYI 문의함 백업/db`(30일) + `files`(첨부·사업자등록증, 누적))
- 권한: `admins` 테이블에 있는 계정만 문의함 사용(`is_admin()`). anon은 `contact/` 경로 첨부 업로드만 가능(문의 insert는 `contact` 함수만)
- 업체 DB: 가망 = 출처 탭(매장 영업·박람회·홈페이지 문의), 박람회는 `expo_events`(행사·기간) + `founder_status`. 뿌러짐은 `archived` 보관.
  계약 업체 = `service_type`(체험단 패키지·프로젝트·ETC) × 상태. 애매한 건 `needs_review`+`review_reason` → 담당자가 [확인 완료]
- `naver-place`: 네이버 지도 URL → 업체명·주소·전화·업종 (관리자만, 저장 안 함)
- 기타: `expo-gate`, `expo-copy`, `call-dispatch`(AI 1차 통화, 매분), `retell-webhook`, `capi-purchase`, `notify-assign`(담당 배정 1:1 알림), `daily-digest`(아침 요약 1:1), `meta-spend`
- `push-crm`: 옛 CRM 연동, 410 비활성 — 대시보드에서 삭제 대상

### 장애 감지 (제거·우회 금지)
- `assets/muyi-monitor.js`: `contact` / 첨부 업로드 요청 실패 시 브라우저에서 즉시 `notify-alert` 호출
- 폼 전송 코드를 바꿀 때도 `fetch`로 `/functions/v1/contact`를 호출해야 감시가 동작함
- `.github/workflows/health.yml`: 30분(매시 7·37분) 점검 — 홈페이지·문의함·DB·로그인·문의 접수 함수
  - 실패 시 `notify-alert` + GitHub 실패 메일(Supabase 자체 장애 대비 2차 경로)
  - Supabase Free 자동 일시정지 방지 역할도 겸함 → 삭제·주기 완화 금지
