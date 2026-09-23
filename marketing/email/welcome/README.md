# Welcome series

Six emails over a new account's first two weeks, from the Dayspring team, each
teaching one thing: the page, `/`, the Journal and Look for, rituals, what gets
told back (Ascent, Lamp, Altar), and a plain trial-ends note.

- **Copy and structure:** `welcome-emails.mjs`, the only place to edit words.
- **Resend Templates:** `templates/` (generated; `npm run email:welcome`).
- **Images:** `site/public/email/welcome/` (re-shoot with `npm run email:welcome:assets`;
  it reuses a dev server on port 5203 or starts its own). `CONTACT_SHEET.png` shows the
  whole set.
- **How it sends:** `docs/WELCOME_EMAILS.md`, which covers the Resend Automation, the
  app hooks and the pre-launch checklist.

Every picture is the shipped app rendered against invented sample content, except
the Journal GIF. That one is a concept drawing (`scripts/email-scenes/journal.html`),
because at inbox width the real wall is too small to read.
