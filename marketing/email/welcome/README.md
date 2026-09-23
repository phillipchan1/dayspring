# Welcome series

Five emails in the live enroll map (day 13 `trial` is uploaded, not scheduled),
from the Dayspring team, each teaching one thing: the page, `/`, the Journal
and Look for, rituals, and what gets told back (Ascent, Lamp, Altar).

- **Copy and structure:** `welcome-emails.mjs`, the only place to edit words.
- **Resend Templates:** `templates/` (generated; `npm run email:welcome`).
- **Images:** `site/public/email/welcome/` (re-shoot with `npm run email:welcome:assets`;
  it reuses a dev server on port 5203 or starts its own). `CONTACT_SHEET.png` shows the
  whole set.
- **How it sends:** `docs/WELCOME_EMAILS.md` — enroll ledger, daily cron,
  backfill dry-run, and the send kill switch. Day 13 is not enrolled.

Every picture is the shipped app rendered against invented sample content, except
the Journal GIF. That one is a concept drawing (`scripts/email-scenes/journal.html`),
because at inbox width the real wall is too small to read.
