# Email suppressions (Worker mail)

Worker-sent mail (remind, welcome-drip) checks `public.email_suppressions`
(`worker/schema/0008_email_suppressions.sql`) before every send. A suppressed
address is never sent to; the send is skipped and counted as handled.
Vercel (Resend) is unchanged and keeps Resend's own unsubscribe state.

Sources:
- `resend`: existing Resend unsubscribes, imported once at the switch with
  `scripts/resend-suppressions.mjs --apply` (dry-run first; read-only on Resend,
  Dayspring segments only).
- `one-click`: the `List-Unsubscribe` / footer link (`/api/email/unsubscribe`,
  RFC 8058 POST; GET only shows a confirm button).
- `mailto`: replies to `hello@usedayspring.app?subject=unsubscribe` are not
  processed automatically. Whoever reads that inbox adds the address by hand:

```sql
INSERT INTO public.email_suppressions (email, source) VALUES (lower(btrim('someone@example.com')), 'mailto') ON CONFLICT (email) DO NOTHING;
```

or `DATABASE_URL_FILE=/path/0600 node scripts/suppress-email.mjs someone@example.com`.

To undo an opt-out (only on the person's request): `DELETE FROM public.email_suppressions WHERE email = lower('someone@example.com');`
