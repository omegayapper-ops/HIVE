# HIVE — campus super-app with HIVE AI

HIVE is a installable campus web app (PWA): attendance, news, study info, chat, Lost & Found, clubs, EcoPoints,
**HIVE AI** (a private assistant that reads the student's own HIVE data) and **HIVE Care Bridge** (medical module).

## Run / deploy
1. Static files in the repo root (`index.html`, `app.js`, …) can be hosted anywhere (Cloudflare Pages/Workers, GitHub Pages) or run locally: `python -m http.server 8000`.
2. In `app.js` set `SUPABASE_URL` and `SUPABASE_KEY` (the **publishable** key only; never a secret/service_role key). Do the same in `ecopoints.html`.
3. Supabase → SQL Editor: run `database/1_setup.sql`, create a user `demo@hive.local` (Authentication → Users), then run `database/3_demo_user.sql`.
4. HIVE AI: follow `AI_SETUP.md` (deploy `supabase/functions/hive-ai/index.ts`, Verify JWT **off**, store the OpenRouter key as the secret `OPENROUTER_API_KEY`).
5. Demo login: username `demo`, password `HiveDemo2026!` (sample account, sample data).

## HIVE AI — privacy
The AI key lives only in Supabase Secrets. The app sends a snapshot of the signed-in student's own data with passwords,
usernames, e-mails, roll numbers and payment references removed (client-side and again in the function). The AI is read-only.

## Care Bridge
`carebridge.html` is a separate module with its own Supabase project and a helpline AI function. Sign-in is one box:
hospital accounts open their patient/nurse/doctor screen; HIVE student logins open the student app.

## Team
Built for a hackathon by the HIVE team.
