/**
 * Cloudflare Worker entry for the marketing site.
 *
 * `/api/*` runs here first (see wrangler.jsonc `run_worker_first`). Everything
 * else is static assets from `dist/`. POST /api/contact is the same handler
 * Vercel serves from `api/contact.ts` — same validation, same env var names.
 * Keep that file: it is the Vercel rollback.
 */

import { POST, bindContactEnv } from "../api/contact";

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  RESEND_API_KEY?: string;
  GITHUB_TOKEN?: string;
  SUPPORT_REPO?: string;
  SUPPORT_LABEL?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_AUTOREPLY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const isContactPath = (pathname: string): boolean =>
  pathname === "/api/contact" || pathname === "/api/contact/";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (isContactPath(pathname)) {
      bindContactEnv(env as unknown as Record<string, unknown>);
      if (request.method === "POST") return POST(request);
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    if (pathname.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
