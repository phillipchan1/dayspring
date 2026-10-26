/**
 * Cloudflare Worker entry for the marketing site.
 *
 * `/api/*` is the dynamic surface (same `POST()` as Vercel). Everything else
 * is static assets from `dist/`. `run_worker_first` is true so we can unwrap
 * `html_handling` 307s: Vercel (and `astro preview`) serve both `/why` and
 * `/why/` as 200, and they serve `*.html` files at their exact path (Google
 * site verification). Keep `api/contact.ts`: it is the Vercel rollback.
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

const APEX_HOST = "usedayspring.app";
const WWW_HOST = "www.usedayspring.app";

const isContactPath = (pathname: string): boolean =>
  pathname === "/api/contact" || pathname === "/api/contact/";

/** Apex → www, same 307 Vercel sends today. */
export function apexRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== APEX_HOST) return null;
  url.hostname = WWW_HOST;
  return Response.redirect(url.toString(), 307);
}

/**
 * Follow a same-origin html_handling redirect and return the destination
 * body at the original URL, so `/why` and `/file.html` 200 like Vercel.
 */
export async function serveAsset(request: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 307 && res.status !== 308) return res;

  const loc = res.headers.get("Location");
  if (!loc) return res;

  const dest = new URL(loc, request.url);
  const src = new URL(request.url);
  if (dest.origin !== src.origin) return res;

  return env.ASSETS.fetch(new Request(dest, request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const apex = apexRedirect(request);
    if (apex) return apex;

    const { pathname } = new URL(request.url);

    if (isContactPath(pathname)) {
      bindContactEnv(env as unknown as Record<string, unknown>);
      if (request.method === "POST") return POST(request);
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    if (pathname.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    return serveAsset(request, env);
  },
};
