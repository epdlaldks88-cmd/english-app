# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.

## [0.3.0] - 2026-07-21

### Phase 1 완료: 한글 번역

- DeepL Free API 연동 (서버사이드 프록시, API 키 노출 방지)
- 자막 추출 완료 시 자동 번역 실행
- 50개 단위 배치 번역
- 영한 자막 동시 표시 / 한글 숨기기 토글
- translations 테이블 추가 (Dexie DB v2)

## [0.2.0] - 2026-07-21

### Phase 1: 영상 + 자막

- YouTube URL 등록/삭제/리스트 UI
- 영상 썸네일 표시
- YouTube IFrame Player 임베드
- youtube-transcript 패키지로 영어 자막 자동 추출
- Vercel Serverless Function (api/subtitles.js) + Vite 로컬 미들웨어
- 자막 Dexie 캐싱 (한 번 추출 후 재사용)
- 자막 클릭 → 해당 시간으로 영상 점프

## [0.1.0] - 2026-07-21

### 프로젝트 초기화

- Vite + React 프로젝트 생성
- Tailwind CSS v4 설정 (다크 테마 기본)
- React Router v7 라우팅 설정 (홈/영상/단어장/학습/통계/설정)
- Dexie.js (IndexedDB) 스키마 설정 (videos, subtitles, words, studyLogs)
- lucide-react 아이콘 라이브러리 추가
- 반응형 레이아웃: 데스크톱 사이드바 + 모바일 하단 탭
- 홈 페이지 퀵 액션 카드 UI
- 각 페이지 placeholder 생성 (Phase별 구현 예정 표시)
- 폴더 구조: components, pages, db, hooks, utils, styles
- Git 저장소 초기화
