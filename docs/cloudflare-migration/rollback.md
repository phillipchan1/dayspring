# Rollback

Rebuild the clients without `VITE_BACKEND=workers` and without a Worker
`VITE_API_BASE_URL`. Supabase stays untouched: auth, journal, Storage, and the
Apple/Stripe webhooks on Vercel.

Desktop or iOS builds that baked a Worker origin roll back by installing the
previous release.
