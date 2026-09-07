import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  POST,
  validateContact,
  renderContactEmail,
  renderAutoReply,
  renderContactIssue,
  deliveryChain,
  checkRateLimit,
  clientIp,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type ContactMessage,
  type RateStore,
} from "./contact";

const good = {
  name: "Ruth",
  email: "ruth@example.com",
  subject: "Import stuck",
  message: "My Day One import stopped halfway through.",
  elapsedMs: 20_000,
};

const message: ContactMessage = {
  name: "Ruth",
  email: "ruth@example.com",
  subject: "Import stuck",
  message: "My Day One import stopped halfway through.",
  platform: "macOS",
  appVersion: "1.0.231",
};

describe("validateContact", () => {
  it("accepts an ordinary submission", () => {
    const r = validateContact(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.message.name).toBe("Ruth");
      expect(r.message.subject).toBe("Import stuck");
    }
  });

  it("defaults a missing subject rather than rejecting", () => {
    const r = validateContact({ ...good, subject: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message.subject).toBe("Support request");
  });

  it("trims whitespace", () => {
    const r = validateContact({ ...good, name: "  Ruth  ", email: " ruth@example.com " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.message.name).toBe("Ruth");
      expect(r.message.email).toBe("ruth@example.com");
    }
  });

  describe("spam", () => {
    it("silently drops anything that filled the honeypot", () => {
      const r = validateContact({ ...good, company: "Acme Marketing" });
      expect(r).toEqual({ ok: false, silent: true });
    });

    it("silently drops a submission completed impossibly fast", () => {
      const r = validateContact({ ...good, elapsedMs: 400 });
      expect(r).toEqual({ ok: false, silent: true });
    });

    it("accepts when elapsed time is missing or unparseable", () => {
      // A privacy extension or a restored tab can lose the timestamp. Dropping a
      // real person's message over that is far worse than accepting some spam.
      expect(validateContact({ ...good, elapsedMs: undefined }).ok).toBe(true);
      expect(validateContact({ ...good, elapsedMs: "nonsense" }).ok).toBe(true);
      expect(validateContact({ ...good, elapsedMs: -1 }).ok).toBe(true);
    });
  });

  describe("rejections a person should see", () => {
    it("needs a name", () => {
      const r = validateContact({ ...good, name: "   " });
      expect(r).toMatchObject({ ok: false, silent: false });
    });

    it("needs a plausible email", () => {
      for (const email of ["", "ruth", "ruth@", "@example.com", "ruth @example.com"]) {
        const r = validateContact({ ...good, email });
        expect(r, `accepted ${JSON.stringify(email)}`).toMatchObject({
          ok: false,
          silent: false,
        });
      }
    });

    it("needs a message", () => {
      const r = validateContact({ ...good, message: "" });
      expect(r).toMatchObject({ ok: false, silent: false });
    });

    it("caps an over-long message", () => {
      const r = validateContact({ ...good, message: "x".repeat(5001) });
      expect(r).toMatchObject({ ok: false, silent: false });
    });

    it("survives entirely non-string input", () => {
      const r = validateContact({ name: 42, email: null, message: {} });
      expect(r).toMatchObject({ ok: false, silent: false });
    });
  });
});

describe("renderContactEmail", () => {
  it("sets a subject that's obvious in an inbox", () => {
    expect(renderContactEmail(message).subject).toBe("[Dayspring support] Import stuck");
  });

  it("carries the sender and the context", () => {
    const { text } = renderContactEmail(message);
    expect(text).toContain("Ruth <ruth@example.com>");
    expect(text).toContain("Platform: macOS");
    expect(text).toContain("App version: 1.0.231");
  });

  it("omits context lines that aren't there", () => {
    const { text } = renderContactEmail({ ...message, platform: null, appVersion: null });
    expect(text).not.toContain("Platform:");
    expect(text).not.toContain("App version:");
  });

  it("escapes HTML so a message can't inject markup into the inbox", () => {
    const { html } = renderContactEmail({
      ...message,
      name: '<img src=x onerror="alert(1)">',
      message: "<script>alert('xss')</script>",
    });
    // Assert on live markup, not on substrings: `onerror=` legitimately appears
    // inside the escaped text `&lt;img src=x onerror=&quot;`, which is inert.
    // What must not exist is an actual tag or an attribute on a real element.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    // The quotes in the injected attribute must be entities, so they can't
    // terminate a real attribute value.
    expect(html).not.toContain('onerror="alert(1)"');
  });

  it("keeps a plaintext alternative alongside the HTML", () => {
    const mail = renderContactEmail(message);
    expect(mail.text).toContain("My Day One import stopped halfway through.");
    expect(mail.html).toContain("My Day One import stopped halfway through.");
  });
});

describe("renderAutoReply", () => {
  it("greets the sender and quotes what they wrote back to them", () => {
    const reply = renderAutoReply(message);
    expect(reply.subject).toBe("We got your message");
    expect(reply.text).toContain("Hi Ruth,");
    expect(reply.text).toContain("My Day One import stopped halfway through.");
  });

  it("escapes the sender's name", () => {
    const reply = renderAutoReply({ ...message, name: "<b>Ruth</b>" });
    expect(reply.html).not.toContain("<b>Ruth</b>");
    expect(reply.html).toContain("&lt;b&gt;");
  });
});

describe("renderContactIssue", () => {
  it("titles and attributes the issue", () => {
    const issue = renderContactIssue(message);
    expect(issue.title).toBe("[support] Import stuck");
    expect(issue.body).toContain("**From:** Ruth <ruth@example.com>");
    expect(issue.body).toContain("My Day One import stopped halfway through.");
  });
});

/**
 * Driven through the real handler rather than a pure helper, because the
 * property under test IS the end-to-end one: a message a person wrote must
 * never be reported as sent when it wasn't, and must never be dropped over
 * something incidental like a missing label.
 */
describe("delivery, end to end", () => {
  const ENV_KEYS = ["RESEND_API_KEY", "GITHUB_TOKEN", "SUPPORT_REPO", "TURNSTILE_SECRET_KEY"];
  let saved: Record<string, string | undefined>;

  // The rate-limit store lives at module scope, so every test must post from
  // its own IP. Sharing one bucket would silently cap the suite at
  // RATE_LIMIT_MAX tests and fail the next one added with a confusing 429.
  let ipCounter = 0;
  const post = async (ip?: string) => {
    const res = await POST(
      new Request("https://www.usedayspring.app/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": ip ?? `10.0.0.${++ipCounter}`,
        },
        body: JSON.stringify({ ...good }),
      }),
    );
    return { status: res.status, body: (await res.json()) as { ok?: boolean; error?: string } };
  };

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.restoreAllMocks();
  });

  it("refuses to claim success when nothing is configured", async () => {
    const { status, body } = await post();
    expect(status).toBe(503);
    expect(body.ok).toBe(false);
    // The person must be told where else to write, not left thinking it sent.
    expect(body.error).toContain("hello@usedayspring.app");
  });

  it("files the message even when the label doesn't exist in the repo", async () => {
    process.env.GITHUB_TOKEN = "gh_test";
    process.env.SUPPORT_REPO = "owner/repo";

    const attempts: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body));
      attempts.push(payload);
      // GitHub answers 422 for a label the repo doesn't have.
      return payload.labels
        ? new Response('{"message":"Validation Failed"}', { status: 422 })
        : new Response('{"number":7}', { status: 201 });
    });

    const { status, body } = await post();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.labels).toEqual(["support"]);
    expect(attempts[1]!.labels).toBeUndefined();
    // The retry must carry the same content, not a stripped-down version.
    expect(attempts[1]!.body).toBe(attempts[0]!.body);
  });

  it("reports a failure when GitHub rejects it outright", async () => {
    process.env.GITHUB_TOKEN = "gh_test";
    process.env.SUPPORT_REPO = "owner/repo";
    vi.stubGlobal("fetch", async () => new Response("bad credentials", { status: 401 }));

    const { status, body } = await post();
    expect(status).toBe(502);
    expect(body.ok).toBe(false);
  });

  it("reports a failure when Resend rejects it and there's no fallback", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", async () => new Response("domain not verified", { status: 403 }));

    const { status, body } = await post();
    expect(status).toBe(502);
    expect(body.ok).toBe(false);
  });

  it("falls back to GitHub when Resend is misconfigured", async () => {
    // The real scenario this exists for: a Resend key added before the domain
    // is verified. Resend wins the preference order, so without a fallback one
    // bad key silently breaks the form for everyone.
    process.env.RESEND_API_KEY = "re_test";
    process.env.GITHUB_TOKEN = "gh_test";
    process.env.SUPPORT_REPO = "owner/repo";

    const hits: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      hits.push(String(url));
      return String(url).includes("resend.com")
        ? new Response("domain not verified", { status: 403 })
        : new Response('{"number":9}', { status: 201 });
    });

    const { status, body } = await post();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(hits[0]).toContain("resend.com");
    expect(hits[1]).toContain("api.github.com");
  });

  it("only reports failure once every route has been tried", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.GITHUB_TOKEN = "gh_test";
    process.env.SUPPORT_REPO = "owner/repo";

    let tried = 0;
    vi.stubGlobal("fetch", async () => {
      tried++;
      return new Response("nope", { status: 500 });
    });

    const { status } = await post();
    expect(status).toBe(502);
    expect(tried).toBe(2);
  });

  it("turns away a flood from one sender, and says how to still reach us", async () => {
    process.env.GITHUB_TOKEN = "gh_test";
    process.env.SUPPORT_REPO = "owner/repo";
    let filed = 0;
    vi.stubGlobal("fetch", async () => {
      filed++;
      return new Response('{"number":1}', { status: 201 });
    });

    const ip = "203.0.113.7";
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await post(ip)).status).toBe(200);
    }

    const { status, body } = await post(ip);
    expect(status).toBe(429);
    // A rate-limited person is still a person — give them the mailbox.
    expect(body.error).toContain("hello@usedayspring.app");
    // And the flood must cost us no outbound calls beyond the ones allowed.
    expect(filed).toBe(RATE_LIMIT_MAX);
  });

  it("still succeeds when only the courtesy auto-reply fails", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.CONTACT_AUTOREPLY = "true";
    let call = 0;
    vi.stubGlobal("fetch", async () => {
      call++;
      // First call is the real message; second is the auto-reply, which an
      // unverified domain can't send to an arbitrary address.
      return call === 1
        ? new Response('{"id":"1"}', { status: 200 })
        : new Response("not allowed", { status: 403 });
    });

    const { status, body } = await post();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    delete process.env.CONTACT_AUTOREPLY;
  });
});

describe("checkRateLimit", () => {
  const t0 = 1_700_000_000_000;

  it("lets a normal person through", () => {
    const store: RateStore = new Map();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit(store, "1.2.3.4", t0 + i * 1000)).toBe(true);
    }
  });

  it("blocks once the window is full", () => {
    const store: RateStore = new Map();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit(store, "1.2.3.4", t0 + i);
    expect(checkRateLimit(store, "1.2.3.4", t0 + RATE_LIMIT_MAX)).toBe(false);
  });

  it("lets them back in once the window rolls past", () => {
    const store: RateStore = new Map();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit(store, "1.2.3.4", t0 + i);
    expect(checkRateLimit(store, "1.2.3.4", t0 + RATE_LIMIT_WINDOW_MS + 1)).toBe(true);
  });

  it("keeps one sender's flood from blocking everyone else", () => {
    const store: RateStore = new Map();
    for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) checkRateLimit(store, "flooder", t0 + i);
    expect(checkRateLimit(store, "someone-else", t0 + 10)).toBe(true);
  });

  it("prunes every key, not just the one being checked", () => {
    // Otherwise the map grows one entry per IP ever seen, for the life of the
    // instance — a slow leak that only shows up under sustained traffic.
    const store: RateStore = new Map();
    for (let i = 0; i < 50; i++) checkRateLimit(store, `ip-${i}`, t0);
    expect(store.size).toBe(50);
    checkRateLimit(store, "someone-new", t0 + RATE_LIMIT_WINDOW_MS + 1);
    expect(store.size).toBe(1);
  });
});

describe("clientIp", () => {
  const withHeaders = (h: Record<string, string>) =>
    clientIp(new Request("https://x/api/contact", { method: "POST", headers: h }));

  it("prefers the proxy's real-ip header", () => {
    expect(withHeaders({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })).toBe("9.9.9.9");
  });

  it("takes the first hop of a forwarded-for chain", () => {
    expect(withHeaders({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" })).toBe("1.1.1.1");
  });

  it("degrades to a constant rather than throwing", () => {
    // Every header-less caller then shares one bucket, which is the safe
    // direction: stricter, never a crash.
    expect(withHeaders({})).toBe("unknown");
  });
});

describe("deliveryChain", () => {
  it("prefers Resend but keeps GitHub as a fallback", () => {
    expect(deliveryChain("re_123", "gh_123", "owner/repo")).toEqual(["resend", "github"]);
  });

  it("uses GitHub alone when there's no Resend key", () => {
    expect(deliveryChain(null, "gh_123", "owner/repo")).toEqual(["github"]);
  });

  it("needs both halves of the GitHub config", () => {
    expect(deliveryChain(null, "gh_123", null)).toEqual([]);
    expect(deliveryChain(null, null, "owner/repo")).toEqual([]);
  });

  it("is empty when nothing is configured", () => {
    // The endpoint returns 503 on an empty chain rather than a false success —
    // a form that silently swallows mail is worse than no form at all.
    expect(deliveryChain(null, null, null)).toEqual([]);
  });
});
