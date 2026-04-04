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
