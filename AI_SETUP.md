# HIVE AI — setup guide

Time needed: about 15 minutes. You don't need to install anything — everything is done in the Supabase and OpenRouter websites.

## How it works (so the steps make sense)

```
Student's phone  ──▶  Supabase function "hive-ai"  ──▶  OpenRouter  ──▶  Nemotron 3 Ultra
 (the HIVE app)       (the ONLY place the key lives)
```

The app never holds the AI key. It sends the student's question plus a safe snapshot of *their own* HIVE data
(no passwords, usernames, e-mails, roll number or payment references) to your Supabase function.
The function checks who the student is, adds the key, talks to OpenRouter and sends the answer back.

---

## 1. Where each key goes

| Key | Where it goes | Can it be public? |
|---|---|---|
| **OpenRouter key** (`sk-or-v1-…`) | Supabase dashboard → **Edge Functions** → **Secrets** → Key name `OPENROUTER_API_KEY` | **No.** Never in a file of the app, a GitHub repo, a screenshot or a chat |
| **NVIDIA key** (`nvapi-…`) | Nowhere. You are using OpenRouter, so it isn't needed | No |
| Supabase URL + publishable key | Already inside `app.js`. Nothing to do | Yes, they are made to be public |
| Supabase **secret** / `service_role` key | Nowhere. HIVE AI never needs it | **No** |

If your OpenRouter key was ever visible in a screenshot or a chat, delete it (OpenRouter → Keys) and make a fresh one before Step 4.

---

## 2. Step by step

### Step 1 — Create the usage table (1 min, recommended)
Supabase → **SQL Editor** → **New query** → paste everything from `hive_ai.sql` → **Run**.
It gives every student a fair limit (15 questions per 10 minutes, 60 per day). Safe to run twice.
If you skip it, a simpler built-in limit still protects you.

### Step 2 — Deploy the function (3 min)
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly **`hive-ai`** (the app looks for this name).
3. Delete the sample code. In VS Code open `supabase/functions/hive-ai/index.ts`, select all, copy, and paste it into the editor.
4. Click **Deploy function**.

### Step 3 — Turn off "Verify JWT" for this function (1 min)
Edge Functions → click **hive-ai** → find the switch called **Verify JWT** (some versions say "Enforce JWT verification") → **OFF** → save.

Why: HIVE AI checks the student's login by itself. If this switch stays on, Supabase turns the app's requests away and the app says
"the server turned the sign-in away".

### Step 4 — Put the OpenRouter key in Secrets (1 min)
1. Supabase → **Edge Functions** → **Secrets**.
2. In **Add new secrets**: Key = `OPENROUTER_API_KEY` (exactly, capital letters) · Value = your key (`sk-or-v1-…`).
3. **Save**. It works straight away — no redeploy needed.

### Step 5 — Check it (30 seconds)
Open this address in your browser:

`https://YOUR-PROJECT-REF.supabase.co/functions/v1/hive-ai`

| You see | Meaning |
|---|---|
| `{"ok":true,"ai":"ready"}` | ✅ Everything is set up |
| `{"ok":true,"ai":"missing_key"}` | Step 4: the name is misspelt or it wasn't saved |
| "Requested function was not found" | Step 2: the function isn't named exactly `hive-ai` |
| `Missing authorization header` (401) | Step 3: Verify JWT is still on |

### Step 6 — Put the new app files on your website (2 min)
Upload to Cloudflare Pages the way you always do. Use the folder from `hive_v5_WEB_UPLOAD.zip` (see Section 6 for why that one).
New or changed files: `hive-ai.js`, `hive-ai.css` (new) · `index.html`, `sw.js`, `hive.js`, `hive2.js` (changed).
If your phone still shows the old Profile screen, close the app completely and open it once while online.

### Step 7 — Try it
Open the app → **Profile** → the gold **HIVE AI** card → **I understand** → tap **Attendance**.

---

## 3. The free model: what to expect

HIVE AI uses **Nemotron 3 Ultra (free)** by default: `nvidia/nemotron-3-ultra-550b-a55b:free`.

- OpenRouter limits free models for your **whole account**, not per student: **20 questions per minute** and
  **50 per day** — or **1,000 per day once you have bought at least $10 of credit** (one time). The count restarts at
  00:00 UTC (5:30 AM India time). Failed tries count too.
- 50 per day is only a handful of students. If many students will use it, buy the $10 credit once (OpenRouter → Credits).
- When the free limit is used up, students see "HIVE AI has reached its free limit for today".
- Free models can be slower or busier than paid ones, and the free provider may keep and learn from what it receives.
  That's fine for a college project. For real student data, use the paid model below.

### Recommended once students use it: free first, paid as backup
Add one more secret (same screen as Step 4):

`AI_MODELS` = `nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3-ultra-550b-a55b`

HIVE AI tries the free model first. If the free limit is used up or it fails, the paid model of the same name answers.
You only pay for those backup answers. Needs credit on OpenRouter.

### Paid only
`AI_MODELS` = `nvidia/nemotron-3-ultra-550b-a55b` — no daily cap. At the time of writing it costs about $0.50 per million tokens
going in and $2.20 per million tokens coming out (a token is roughly ¾ of a word; check the model's page on openrouter.ai for today's price).
My rough estimate is half a cent to one cent per question, so $10 is about 1,000 questions or more.
In OpenRouter → Keys you can set a spending limit on the key so a bill can never surprise you.

---

## 4. Options (all optional — add as Secrets, same place as Step 4)

| Secret name | Default | What it does |
|---|---|---|
| `OPENROUTER_API_KEY` | — (required) | The key. Only ever stored here |
| `AI_MODELS` | `nvidia/nemotron-3-ultra-550b-a55b:free` | Models to try, first one preferred, separated by commas |
| `AI_REASONING` | `low` | `off` = fastest answers · `low` · `medium` · `high` = smarter but slower |
| `AI_MAX_TOKENS` | `2500` | Longest answer allowed (200–4000). Thinking counts too |
| `AI_RATE_PER_10MIN` | `15` | Questions one student may ask per 10 minutes |
| `AI_RATE_PER_DAY` | `60` | Questions one student may ask per day |
| `AI_BUDGET_SECONDS` | `48` | Most time one answer may take before giving up |
| `ALLOWED_ORIGINS` | any website | Extra safety: your site address only, e.g. `https://your-site.pages.dev` |

To undo any of these, delete the secret and the default comes back.
If answers feel slow, set `AI_REASONING` to `off` first.

---

## 5. When something goes wrong

What the student (or you) sees, and the fix:

| Message in the app | Cause and fix |
|---|---|
| "HIVE AI is not switched on yet" | The key is missing. Step 4 |
| "not set up on the server yet" | Function not deployed or not named `hive-ai`. Step 2 |
| "the server turned the sign-in away" | Verify JWT is on. Step 3 |
| "is not set up correctly yet" | OpenRouter rejected the key (wrong, deleted or expired). Paste a fresh key in Secrets |
| "has run out of credit" | Add credit on OpenRouter (a negative balance can even block free models) |
| "reached its free limit for today" | Wait for the reset, buy the $10 credit once, or use the paid model (Section 3) |
| "very busy right now" | The free provider is overloaded. Try again in a minute |
| "model is not available right now" | Model name typo in `AI_MODELS`, or your OpenRouter privacy settings exclude free models (openrouter.ai/settings/privacy) |
| "could not answer just now" | A temporary hiccup. Try again. Still happening? Supabase → Edge Functions → hive-ai → **Logs**: a line with `"evt":"ai_fail"` says why |
| "took too long to answer" | Ask something shorter, or set `AI_REASONING` to `off` |
| "Can't reach HIVE AI" | The student is offline, or the function isn't deployed |

The Logs page shows lines like `{"evt":"ai_ok","model":"…","ms":4200}`. No questions, answers or student data are logged.

---

## 6. Before you go live (important)

1. **Change the admin password.** It is written in plain text in `README_HIVE.md`, `ADMIN_SETUP.md`, `hive2.sql` and
   `lost_and_found_admin_setup.sql`. If those files are in the folder you publish, anyone can open
   `https://your-site/README_HIVE.md` and read it. To change it, run this once in Supabase → SQL Editor:

   `update public.admin_config set password_hash = extensions.crypt('YOUR-NEW-PASSWORD', extensions.gen_salt('bf')) where id = 1;`

   Then don't run `hive2.sql` or `lost_and_found_admin_setup.sql` again — they would put the old password back (or edit that line first).
2. **Publish only the website files**, never the `.md` and `.sql` files, `supabase/`, `native/` or `.github/`.
   `hive_v5_WEB_UPLOAD.zip` contains exactly the website files. If Cloudflare Pages reads from a GitHub repo, those files are public
   too, so keep the docs and SQL out of the repo.
3. Never write the OpenRouter key into any file. Keep it only in Supabase Secrets. If it ever leaks, delete it in OpenRouter → Keys and make a new one.

## What the AI can and can't see

Can: attendance, timetable and calendar, news and announcements, study material (each subject's description and syllabus topics —
HIVE holds no notes or PDFs), campus chat (authors shown as "Student A / B", your own messages as "You"), mess and leave status,
fee status, clubs, posts and podcast, Lost & Found.

Can't: passwords, usernames, e-mails, roll number, payment references and UPI details, private claim details, who wrote each chat message.
Three layers enforce this: the app only asks for safe columns, the app strips anything that looks private, and the function strips it again.

The AI is read-only: it can't post, book, pay or change anything.

---

## Optional: deploy with the command line instead of the dashboard
Needs Node.js and the Supabase CLI. The project ref is `YOUR-PROJECT-REF`.

```
supabase login
supabase functions deploy hive-ai --project-ref YOUR-PROJECT-REF --no-verify-jwt
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key --project-ref YOUR-PROJECT-REF
```

Advanced: any OpenAI-compatible service can be used instead of OpenRouter by setting `AI_API_URL`, `AI_API_KEY` and `AI_MODELS`
(use the model name that service documents).
