# Deployment

Three independently-deployable pieces (decision D6): **Supabase** (already hosted — nothing to do), **Render** (Express API + pg-boss worker, two services from one blueprint), **Vercel** (the React static build). This is a runbook, not something an agent can do for you — it needs your own Render/Vercel accounts and billing, so this is written as steps to follow, not steps already taken.

## 0. Prerequisites

- The Supabase project is already live (`wuhvesnhkjgstsbpkeyn`) with the schema migrated, RLS policies applied, and a `materials` Storage bucket — see `apps/api/db/migrations/`.
- Have on hand: `DATABASE_URL` (Supabase → Project Settings → Database → Connection string, **transaction pooler**, not the direct connection), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API), `GEMINI_API_KEY`, `GROQ_API_KEY`.

## 1. Backend + worker — Render

This repo includes `render.yaml` at the root, a Blueprint that defines both services (`ai-tutor-api`, a web service; `ai-tutor-worker`, a background worker) from `apps/api` in one monorepo.

1. Render dashboard → **New → Blueprint** → connect this GitHub repo → Render reads `render.yaml` and proposes both services.
2. Before the first deploy, fill in every env var marked `sync: false` in the blueprint for **both** services (they need the same Supabase/AI credentials): `CORS_ORIGIN` (set this once the Vercel URL from step 2 is known — Vercel gives you the URL before you need this, so do step 2 first if you want to avoid a redeploy), `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`. `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are optional (leave blank to skip Langfuse mirroring — see `CLAUDE.md`).
3. Deploy. Render runs `npm install` then `npm start` (API) / `npm run worker:start` (worker) from `apps/api`, both via `tsx` directly — there's no separate compile step (`tsx` is a production dependency specifically so this works after Render's own dependency install, see the commit that moved it there).
4. Confirm the API is up: `curl https://<your-render-api-url>/health` → `{"status":"ok"}`.
5. Confirm the worker is up: Render's worker service logs should show `Worker registered and listening for jobs.` shortly after boot.

**Free-tier note:** Render's free web services spin down after 15 minutes of inactivity and take ~30-60s to wake on the next request — expect a slow first request after idle time. The free worker service does not spin down the same way but has no persistent disk; that's fine here since all state lives in Supabase Postgres, not on the worker's local disk.

## 2. Frontend — Vercel

1. Vercel dashboard → **New Project** → import this GitHub repo.
2. Set **Root Directory** to `apps/web` (monorepo — Vercel auto-detects the Vite framework preset once the root directory is set correctly).
3. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same Supabase project as the backend), `VITE_API_BASE_URL` = the Render API URL from step 1.4 (no trailing slash).
4. Deploy. `apps/web/vercel.json` adds the SPA rewrite rule React Router needs (every path falls back to `index.html` so a direct link to e.g. `/projects/:id/growth` doesn't 404 on refresh).
5. Once deployed, go back to Render and set `CORS_ORIGIN` on the API service to this Vercel URL (exact origin, no path), then redeploy the API service — the backend rejects cross-origin requests from anywhere else (`helmet`/`cors` in `main.ts`).

## 3. Post-deploy checklist

- [ ] Sign up a real user through the deployed frontend, confirm the email-confirmation flow works (or see `CLAUDE.md`'s Admin-API workaround if you're doing this yourself without email access).
- [ ] Upload a PDF, confirm it reaches `ready` status (proves Storage + the worker + Gemini are all correctly wired in production).
- [ ] Ask the Tutor a grounded question and an off-topic one, confirm both branches work.
- [ ] Take a quiz, confirm mastery/growth update and a recommendation eventually appears.
- [ ] Promote your own user to `admin` (`UPDATE profiles SET role = 'admin' WHERE id = '<your-id>'` via the Supabase SQL editor) and confirm the Admin Dashboard loads all five tabs.
- [ ] Optionally run `npm run seed --workspace apps/api` **locally, pointed at the production `DATABASE_URL`/Supabase project** (not from Render — it's a one-off script, not a service) to populate demo data for the recorded walkthrough.

## 4. Rollback / redeploy

Both Render and Vercel redeploy automatically on a push to `main` by default (configurable per-service in each dashboard) — a bad deploy is fixed by pushing a revert commit, not a manual dashboard rollback in most cases, though both platforms also keep prior deploys one click away in their dashboards if you need to roll back immediately while a fix is in progress.
