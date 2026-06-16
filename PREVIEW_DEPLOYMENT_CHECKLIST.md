# B-MVP Preview Deployment Checklist

## Local Status

- Build: `npm run build` passed.
- Git: local repository initialized in `b-mvp`.
- Commit: `Prepare B MVP routine tracker preview`.
- Sensitive files:
  - `.env.local` is ignored by Git.
  - `.env`, `.env.*.local`, `node_modules`, `.next`, `.next-*` are ignored.

## Vercel Environment Variables

Add these in Vercel Project Settings > Environment Variables.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=
```

Notes:

- `OPENAI_API_KEY` can stay empty for the current MVP.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must match the Supabase project used locally.
- Do not upload `.env.local` to GitHub.

## Supabase Auth Redirect URL

After Vercel creates a Preview URL, add it in Supabase:

Supabase Dashboard > Authentication > URL Configuration

Recommended values:

```text
Site URL:
https://YOUR-PRODUCTION.vercel.app

Redirect URLs:
http://localhost:3000/**
https://YOUR-PREVIEW.vercel.app/**
https://YOUR-PRODUCTION.vercel.app/**
```

For Preview testing, the important one is:

```text
https://YOUR-PREVIEW.vercel.app/**
```

## GitHub Push

This folder does not yet have a GitHub remote.

After creating a GitHub repository, connect it:

```bash
git remote add origin https://github.com/YOUR_ID/YOUR_REPO.git
git push -u origin main
```

## Vercel Preview Deploy

In Vercel:

1. Import the GitHub repository.
2. Set Framework Preset to `Next.js`.
3. Set Root Directory to `b-mvp` only if the GitHub repository contains the full `routine_app` folder.
4. If the GitHub repository contains only this `b-mvp` folder, leave Root Directory as the project root.
5. Add the environment variables above.
6. Deploy.

## iPhone QA

Open the Preview URL in iPhone Safari.

Check:

- Login works.
- Main routine screen loads.
- Check/uncheck saves.
- Memo save/delete works.
- Item add/change/delete works.
- Weight save works.
- Future calendar dates are disabled.
- Report bottom sheet opens.
- Add to Home Screen works.
