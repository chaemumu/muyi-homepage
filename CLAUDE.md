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
