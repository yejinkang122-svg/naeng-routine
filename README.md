# 냉이랑 루틴 B-MVP

Next.js + Supabase 기반 B 버전 앱입니다.

## 현재 단계

이 폴더는 기존 A 버전(`index_phase1.html`)을 건드리지 않고 만든 Next.js + Supabase 기반 B-MVP입니다.

현재 포함:

- Next.js App Router 구조
- Apple + orange + liquid glass + pixel theme 디자인 토큰
- 로그인/로그아웃
- Supabase 루틴/체중 저장
- localStorage JSON 마이그레이션
- 날짜별 루틴/캘린더/체크/항목 추가
- 정적 summer_surf 배경/아이콘 asset
- 환경변수 예시

## 로컬 실행 준비

1. 이 폴더로 이동
2. 패키지 설치
3. 개발 서버 실행

```bash
cd /Users/yejinkang/Desktop/routine_app/b-mvp
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## Supabase 연결

Supabase 프로젝트를 만든 뒤 `.env.example`을 복사해서 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

`.env.local`에 값을 채웁니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

현재 MVP에서는 `OPENAI_API_KEY`를 비워둬도 됩니다. 식단 채팅 입력을 붙일 때 사용합니다.

DB 스키마는 상위 폴더의 `supabase_schema_v1.sql`을 Supabase SQL Editor에 적용합니다.

## Vercel Preview 배포

Vercel 프로젝트 Root Directory는 `b-mvp`로 설정합니다.

Vercel Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=
```

Supabase Auth URL Configuration에 Preview URL을 추가합니다.

- Site URL: Preview 또는 Production URL
- Redirect URLs:
  - `https://YOUR-PREVIEW.vercel.app/**`
  - `https://YOUR-PRODUCTION.vercel.app/**`
