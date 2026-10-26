import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { apexRedirect, pinClientIp, serveAsset, withVercelHeaders } from "./worker";
import { bindContactEnv, RATE_LIMIT_MAX } from "../api/contact";

const CONTACT_ENV = [
  "RESEND_API_KEY",
  "GITHUB_TOKEN",
  "SUPPORT_REPO",
  "SUPPORT_LABEL",
  "CONTACT_TO_EMAIL",
  "CONTACT_FROM_EMAIL",
  "CONTACT_AUTOREPLY",
  "TURNSTILE_SECRET_KEY",
] as const;

const assets = {
  fetch: async (request: Request) =>
    new Response(`asset:${new URL(request.url).pathname}`, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }),
};

const env = { ASSETS: assets };

const good = {
  name: "Ruth",
  email: "ruth@example.com",
  subject: "Import stuck",
  message: "My Day One import stopped halfway through.",
  elapsedMs: 20_000,
};

const postContact = (body: unknown, ip = "198.51.100.1", extraHeaders: Record<string, string> = {}) =>
  worker.fetch(
    new Request("https://www.usedayspring.app/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": ip,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
    env,
  );

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(CONTACT_ENV.map((k) => [k, process.env[k]]));
  for (const k of CONTACT_ENV) delete process.env[k];
  bindContactEnv(null);
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const href =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    throw new Error(`unexpected network call: ${href}`);
  });
});

afterEach(() => {
  bindContactEnv(null);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("worker routing", () => {
  it("sends non-/api requests to assets", async () => {
    const res = await worker.fetch(new Request("https://www.usedayspring.app/why"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset:/why");
  });

  it("returns 405 for a non-POST on /api/contact", async () => {
    const res = await worker.fetch(
      new Request("https://www.usedayspring.app/api/contact", { method: "GET" }),
      env,
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });

  it("404s other /api paths instead of serving assets", async () => {
    const res = await worker.fetch(
      new Request("https://www.usedayspring.app/api/nope", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(404);
  });

  it("307s the apex host to www, keeping the path", () => {
    const res = apexRedirect(new Request("https://usedayspring.app/why"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(307);
    expect(res!.headers.get("Location")).toBe("https://www.usedayspring.app/why");
  });

  it("does not redirect www", () => {
    expect(apexRedirect(new Request("https://www.usedayspring.app/"))).toBeNull();
  });
});

describe("pinClientIp", () => {
  it("overwrites a spoofed x-real-ip and drops XFF", () => {
    const pinned = pinClientIp(
      new Request("https://www.usedayspring.app/api/contact", {
        headers: {
          "cf-connecting-ip": "203.0.113.9",
          "x-real-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8, 9.9.9.9",
        },
      }),
    );
    expect(pinned.headers.get("x-real-ip")).toBe("203.0.113.9");
    expect(pinned.headers.get("x-forwarded-for")).toBeNull();
    expect(pinned.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
  });

  it("drops client x-real-ip when Cloudflare did not set a connecting IP", () => {
    const pinned = pinClientIp(
      new Request("https://www.usedayspring.app/api/contact", {
        headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" },
      }),
    );
    expect(pinned.headers.get("x-real-ip")).toBeNull();
    expect(pinned.headers.get("x-forwarded-for")).toBeNull();
  });
});

describe("serveAsset unwraps html_handling redirects", () => {
  it("returns the destination body at the original URL", async () => {
    const redirecting = {
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (pathname === "/why") {
          return new Response(null, {
            status: 307,
            headers: { Location: "http://127.0.0.1/why/" },
          });
        }
        return new Response("<html>why</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      },
    };

    const res = await serveAsset(new Request("http://127.0.0.1/why"), { ASSETS: redirecting });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>why</html>");
  });

  it("leaves a 200 asset response alone", async () => {
    const res = await serveAsset(new Request("http://127.0.0.1/favicon.svg"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset:/favicon.svg");
  });
});

describe("404 status", () => {
  const page = "<html>not found</html>";
  const assets404 = {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/why" || pathname === "/why/") {
        return new Response("why", { status: 200 });
      }
      return new Response(page, { status: 404, headers: { "Content-Type": "text/html" } });
    },
  };

  it("keeps unknown paths at 404, not 200", async () => {
    const res = await worker.fetch(
      new Request("https://www.usedayspring.app/this-is-not-a-page"),
      { ASSETS: assets404 },
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(page);
  });

  it("serves the 404 document at /404 with status 404, not 200", async () => {
    const asPage = {
      fetch: async () =>
        new Response(page, { status: 200, headers: { "Content-Type": "text/html" } }),
    };
    const res = await worker.fetch(new Request("https://www.usedayspring.app/404"), {
      ASSETS: asPage,
    });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(page);
  });
});

describe("POST /api/contact via the Worker", () => {
  it("uses the same 503 when no delivery is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postContact(good, "198.51.100.10");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("hello@usedayspring.app");
  });

  it("reads delivery secrets from the Worker env, not process.env", async () => {
    const attempts: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      attempts.push(JSON.parse(String(init?.body)));
      return new Response('{"number":3}', { status: 201 });
    });

    const res = await worker.fetch(
      new Request("https://www.usedayspring.app/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": "198.51.100.9",
        },
        body: JSON.stringify(good),
      }),
      { ...env, GITHUB_TOKEN: "gh_worker", SUPPORT_REPO: "owner/repo" },
    );

    expect(res.status).toBe(200);
    expect((await res.json()) as { ok?: boolean }).toEqual({ ok: true });
    expect(attempts).toHaveLength(1);
  });

  it("silently accepts a honeypot the same way as api/contact.ts", async () => {
    const res = await postContact({ ...good, company: "Acme" }, "198.51.100.2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not let a spoofed x-real-ip or XFF bypass the rate limit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfIp = "203.0.113.50";

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const res = await postContact(good, cfIp, {
        "x-real-ip": `198.51.100.${i}`,
        "x-forwarded-for": `198.51.100.${i}, 10.0.0.1`,
      });
      expect(res.status).toBe(503);
    }

    const blocked = await postContact(good, cfIp, {
      "x-real-ip": "198.51.100.99",
      "x-forwarded-for": "198.51.100.99",
    });
    expect(blocked.status).toBe(429);
  });
});

describe("Vercel header parity (charset + HSTS)", () => {
  const typed = (ct: string) => ({
    fetch: async () => new Response("x", { status: 200, headers: { "Content-Type": ct } }),
  });
  const get = (path: string, ct: string) =>
    worker.fetch(new Request(`https://www.usedayspring.app${path}`), { ASSETS: typed(ct) });

  it.each([
    ["/", "text/html", "text/html; charset=utf-8"],
    ["/privacy/", "text/html", "text/html; charset=utf-8"],
    ["/robots.txt", "text/plain", "text/plain; charset=utf-8"],
    ["/_astro/a.css", "text/css", "text/css; charset=utf-8"],
    ["/_astro/a.js", "text/javascript", "application/javascript; charset=utf-8"],
    ["/_astro/b.js", "text/javascript; charset=utf-8", "application/javascript; charset=utf-8"],
    ["/favicon.svg", "image/svg+xml", "image/svg+xml"],
    ["/sitemap-index.xml", "application/xml", "application/xml"],
  ])("%s %s -> %s with HSTS", async (path, ct, want) => {
    const res = await get(path, ct);
    expect(res.headers.get("Content-Type")).toBe(want);
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=63072000");
  });

  it("keeps an existing charset", () => {
    const res = withVercelHeaders(new Response("x", { headers: { "Content-Type": "text/html; charset=iso-8859-1" } }));
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=iso-8859-1");
  });

  it("apex 307 matches Vercel: Location, text/plain, HSTS", async () => {
    const res = await worker.fetch(new Request("https://usedayspring.app/privacy/?a=1"), { ASSETS: typed("text/html") });
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("https://www.usedayspring.app/privacy/?a=1");
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=63072000");
  });

  it("api 405 and 404 carry HSTS", async () => {
    const a = await worker.fetch(new Request("https://www.usedayspring.app/api/contact"), { ASSETS: typed("text/html") });
    const b = await worker.fetch(new Request("https://www.usedayspring.app/api/nope"), { ASSETS: typed("text/html") });
    expect(a.status).toBe(405);
    expect(b.status).toBe(404);
    expect(a.headers.get("Strict-Transport-Security")).toBe("max-age=63072000");
    expect(b.headers.get("Strict-Transport-Security")).toBe("max-age=63072000");
  });

  it("404 doc keeps status 404 and gets charset", async () => {
    const res = await get("/404", "text/html");
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });
});
