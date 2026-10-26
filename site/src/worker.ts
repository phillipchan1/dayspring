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

const isNotFoundDoc = (pathname: string): boolean =>
  pathname === "/404" || pathname === "/404/" || pathname === "/404.html";

/**
 * Cloudflare does not overwrite a client-supplied `x-real-ip` / `X-Forwarded-For`.
 * `api/contact.ts` (shared with Vercel) reads those first, so a rotating spoof
 * would bypass the 429 and lie to Turnstile. Replace them with CF's connecting
 * IP before the handler runs. Missing `cf-connecting-ip` (local, tests) drops
 * the client-supplied headers so they cannot be trusted.
 */
export function pinClientIp(request: Request): Request {
  const headers = new Headers(request.headers);
  const connecting = headers.get("cf-connecting-ip")?.trim();
  headers.delete("x-forwarded-for");
  if (connecting) headers.set("x-real-ip", connecting);
  else headers.delete("x-real-ip");
  return new Request(request, { headers });
}

/** Exact HSTS value Vercel sends on usedayspring.app (every response). (Not exported: workerd rejects non-handler named exports.) */
const HSTS = "max-age=63072000";

/**
 * Exact Content-Type strings Vercel's edge sends (cache HIT) for these types.
 * Workers static assets omit the charset and serve JS as `text/javascript`.
 */
const CHARSET_TYPES: Record<string, string> = {
  "text/html": "text/html; charset=utf-8",
  "text/plain": "text/plain; charset=utf-8",
  "text/css": "text/css; charset=utf-8",
  "text/javascript": "application/javascript; charset=utf-8",
  "application/javascript": "application/javascript; charset=utf-8",
};

/** Add Vercel's charset and HSTS to a response (headers copied, body streamed). */
export function withVercelHeaders(res: Response): Response {
  const ct = res.headers.get("Content-Type");
  // Vercel's redirects send bare `text/plain`; only bodies get a charset.
  const isRedirect = res.status >= 300 && res.status < 400;
  const base = ct?.split(";")[0].trim().toLowerCase() ?? "";
  // An existing charset is kept, except JS (local workerd adds one to text/javascript).
  const isJs = base === "text/javascript" || base === "application/javascript";
  const target = CHARSET_TYPES[base];
  const fixedCt = target && !isRedirect && (isJs || !/charset=/i.test(ct!)) && ct !== target ? target : undefined;
  if (!fixedCt && res.headers.get("Strict-Transport-Security") === HSTS) return res;
  const headers = new Headers(res.headers);
  if (fixedCt) headers.set("Content-Type", fixedCt);
  headers.set("Strict-Transport-Security", HSTS);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Apex → www, same 307 (and headers) Vercel sends today. */
export function apexRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== APEX_HOST) return null;
  url.hostname = WWW_HOST;
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.toString(),
      "Content-Type": "text/plain",
      "Strict-Transport-Security": HSTS,
    },
  });
}

/**
 * Follow a same-origin html_handling redirect and return the destination
 * body at the original URL, so `/why` and `/file.html` 200 like Vercel.
 */
export async function serveAsset(request: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 307 && res.status !== 308) return withNotFoundStatus(request, res);

  const loc = res.headers.get("Location");
  if (!loc) return res;

  const dest = new URL(loc, request.url);
  const src = new URL(request.url);
  if (dest.origin !== src.origin) return res;

  const followed = await env.ASSETS.fetch(new Request(dest, request));
  return withNotFoundStatus(request, followed);
}

/** `/404` is the 404 document, not a 200 page. Unknown paths stay 404. */
function withNotFoundStatus(request: Request, res: Response): Response {
  if (res.status === 404) return res;
  if (isNotFoundDoc(new URL(request.url).pathname) && res.status === 200) {
    return new Response(res.body, { status: 404, statusText: "Not Found", headers: res.headers });
  }
  return res;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withVercelHeaders(await route(request, env));
  },
};

async function route(request: Request, env: Env): Promise<Response> {
  const apex = apexRedirect(request);
  if (apex) return apex;

  const { pathname } = new URL(request.url);

  if (isContactPath(pathname)) {
    bindContactEnv(env as unknown as Record<string, unknown>);
    if (request.method === "POST") return POST(pinClientIp(request));
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  if (pathname.startsWith("/api/")) {
    return new Response("Not Found", { status: 404 });
  }

  return serveAsset(request, env);
}
