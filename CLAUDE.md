# MUYI 홈페이지 — Claude Code 작업 가이드

## 프로젝트 개요
무이 코퍼레이션(MUYI Corporation) 공식 홈페이지.
온라인 마케팅 / IMC 컨설팅 회사 소개 싱글파일 HTML.

## 기술 스택
- **구조**: 단일 HTML 파일 (`index.html`) — 약 900KB
- **라이브러리**: Three.js (r128), GSAP 3.12.2 + ScrollTrigger, DM Sans / Syne / Noto Sans KR 폰트
- **배포**: Vercel
- **도메인**: 가비아 외부 도메인 연결
- **GitHub**: (레포 연결 후 업데이트)

## 파일 구조
```
muyi-website/
├── CLAUDE.md    ← 이 파일
└── index.html   ← 전체 소스 (단일 파일)
```

## 브랜드 가이드
- **메인 컬러**: `#1E10C7` (Deep Blue) — 주도적으로 사용
- **포인트 컬러**: `#EE4E00` (Orange) — 필요할 때만 사용
- **폰트**: Syne (헤딩), DM Sans (영문 본문), Noto Sans KR (한글)
- **슬로건**: Keep Going, Stay Inspired

## 주요 섹션 구성
1. Hero — Three.js 파티클 + 커스텀 커서
2. 선언 (Why MUYI)
3. 숫자 카운터 (실적)
4. IMC 궤도 3D 인터랙션
5. Services
6. Clients 로고 그리드 (37개 로고, grayscale → 호버 컬러)
7. Contact 문의폼
8. Footer

## 문의폼
- Notion DB 연동 구조 포함
- 폴백: mailto:ceo@muyi.co.kr

## 작업 규칙
1. **`index.html` 단일 파일만** 수정
2. 블루 메인 / 오렌지 포인트 컬러 비율 유지
3. Three.js r128 버전 고정
4. 로고 이미지는 base64로 파일 내 인라인 삽입됨

## 배포 방법
```bash
git add index.html
git commit -m "feat: 변경내용"
git push origin main
```
→ Vercel 자동 배포
