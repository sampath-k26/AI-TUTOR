# Demo Video Script

Recording the video is a manual step (screen recording isn't something an agent can do) — this is a script to make it quick to record in one take. Follows the exact loop submission requirement §18.2 asks for, in order. Aim for under 6 minutes; pause the recording between numbered sections if you need a retake, they don't need to be one continuous take.

Do this against the **deployed** app (not localhost) — the requirement is demonstrating the public URL. Sign in as a fresh user, not the seeded demo accounts, so the "Create Space → Create Project → Upload Material" steps aren't skipped by pre-existing data.

## Setup (before recording)

- Have a real short PDF ready to upload (2-4 pages of real prose on one topic — a syllabus, a Wikipedia-style summary, whatever won't get flagged as too sparse to extract cleanly; a scanned page or two will additionally demonstrate the vision-fallback path if you want to show that off, but isn't required).
- Have your Supabase SQL editor open in another tab, ready to run one `UPDATE profiles SET role = 'admin' WHERE id = '...'` — you'll need it for the Admin Dashboard segment (see step 10).
- Sign up your demo account before recording starts (skip narrating email confirmation — use the Admin-API/SQL-confirmation workaround in `CLAUDE.md` beforehand so the recording starts at a clean login screen).

## Script

1. **Login** — show the login screen, sign in, land on the Spaces list ("Your Spaces").
2. **Create Space** — fill the form, submit, show it appear in the list.
3. **Create Project** — open the Space, fill the Create Project form, submit, land on the Project's Materials tab.
4. **Upload Material** — choose the PDF, click Upload, show the status badge move `queued → processing → ready` (this takes a few seconds — say what's happening while it runs: local text extraction, Gemini embeddings, concept extraction, all in a background job).
5. **Ask Tutor → Grounded Answer + Citation** — switch to the Tutor tab, ask a question genuinely answerable from the uploaded material, show the answer arriving with a citation (material name + page number).
6. **Unsupported Question** — ask something unrelated to the material (e.g. "what's the capital of France?" if the material has nothing to do with geography), show the "insufficient evidence" response — call out that this is a deliberate branch, not a failure.
7. **Adaptive Quiz + Open-Ended Assessment** — switch to the Quiz tab, start a quiz, answer an MCQ question, show the immediate correct/incorrect result; answer an open-ended question, show the structured feedback (understanding level + what was missing, not just a score).
8. **Mastery / Growth** — switch to the Growth tab, show the per-concept mastery bar move after the quiz, and point out the trend badge (Improving/Stable/Requires Attention).
9. **Analytics → Recommendation** — switch to the Analytics tab to show assessment/mastery/AI-usage stats for this Project; go back to Growth to show the generated Recommendation (may take a few seconds to appear — mention it's a background job triggered by finishing the quiz); optionally show Global Analytics from the Spaces page header too.
10. **Admin Dashboard** — run the prepared `UPDATE profiles SET role = 'admin' ...` in Supabase, refresh the app, show the "Admin Dashboard" link now appears in the header; walk through its five tabs (Users, Spaces & Projects, Activity, Engagement & Learning, AI & System) pointing out that AI usage/cost and background-job status are real, not mocked.

## What to say about what's real vs. simplified (optional, but strengthens the submission)

If there's time, a closing 20-30 seconds naming one or two things from `11-KNOWN-LIMITATIONS.md` (e.g., "retrieval is a lightweight pgvector similarity search, not a full RAG framework — a deliberate scope tradeoff, documented in the repo") demonstrates the kind of engineering judgment §17 says is being evaluated, not just feature completeness.
