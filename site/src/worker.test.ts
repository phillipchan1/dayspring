import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./worker";
import { bindContactEnv } from "../api/contact";

const assets = {
  fetch: async (request: Request) =>
    new Response(`asset:${new URL(request.url).pathname}`, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }),
};

const env = { ASSETS: assets };

const postContact = (body: unknown, ip = "198.51.100.1") =>
  worker.fetch(
    new Request("https://www.usedayspring.app/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body),
    }),
    env,
  );

afterEach(() => {
  bindContactEnv(null);
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
});

describe("POST /api/contact via the Worker", () => {
  const good = {
    name: "Ruth",
    email: "ruth@example.com",
    subject: "Import stuck",
    message: "My Day One import stopped halfway through.",
    elapsedMs: 20_000,
  };

  it("uses the same 503 when no delivery is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postContact(good);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("hello@usedayspring.app");
  });

  it("reads delivery secrets from the Worker env, not process.env", async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.SUPPORT_REPO;
    const attempts: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      attempts.push(JSON.parse(String(init.body)));
      return new Response('{"number":3}', { status: 201 });
    });

    const res = await worker.fetch(
      new Request("https://www.usedayspring.app/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.9" },
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
});
