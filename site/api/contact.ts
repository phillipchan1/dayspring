/**
 * The support contact endpoint.
 *
 * Vercel serves a root `api/` directory as serverless functions even for a
 * static Astro build, so this needs no adapter and no change to `output`. The
 * handler style mirrors the app repo (`export async function POST(req: Request)`).
 *
 * ---------------------------------------------------------------------------
 * Delivery
 * ---------------------------------------------------------------------------
 * Two ways to deliver, picked by whichever is configured. Both end with the
 * message reaching a human at hello@usedayspring.app:
 *
 *   RESEND   — set RESEND_API_KEY. The message is emailed with Reply-To set to
 *              the sender, so replying from the mailbox just works. This works
 *              with NO DNS setup at all: a fresh Resend account can send from
 *              `onboarding@resend.dev` to the address it was registered with.
 *              Verifying the domain later unlocks two things: a From address on
 *              your own domain, and the auto-reply to the visitor.
 *
 *   GITHUB   — set GITHUB_TOKEN and SUPPORT_REPO. Each message becomes an issue
 *              in a private repo, and GitHub emails you about it. Needs no mail
 *              service whatsoever. This is the same pattern the app already uses
 *              for beta feedback.
 *
 * If NEITHER is configured the endpoint returns 503 and the form shows a real
 * error with the mailto fallback. It never reports success for a message it
 * didn't deliver — a contact form that silently swallows mail is worse than no
 * contact form, because the person believes they've been heard.
 */

const MAX_MESSAGE = 5000;
const MAX_NAME = 120;
const MAX_EMAIL = 254;

/** Reject submissions completed faster than a human could type them. */
const MIN_FILL_MS = 3000;

export interface ContactInput {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  /** Honeypot — a field hidden from people and irresistible to bots. */
  company?: unknown;
  /** Milliseconds since the form was rendered. */
  elapsedMs?: unknown;
  /** Optional context the form collects to save a round-trip. */
  platform?: unknown;
  appVersion?: unknown;
}

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  platform: string | null;
  appVersion: string | null;
}

export type ValidationResult =
  | { ok: true; message: ContactMessage }
  /**
   * `silent` means: looks like a bot. Respond 200 and send nothing. Telling a
   * bot why it failed only helps it try again.
   */
  | { ok: false; silent: true }
  | { ok: false; silent: false; error: string };

/** Deliberately loose. The only real test of an address is sending to it. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validateContact(input: ContactInput): ValidationResult {
  // Honeypot: hidden from real users, so anything in it is automated.
  if (str(input.company)) return { ok: false, silent: true };

  // Timing: a real person cannot read the form and write a message in under
  // three seconds. Absent or unparseable elapsed time is NOT treated as a
  // failure — a privacy extension or a restored tab can lose it, and we would
  // rather accept a little spam than drop a real person's message.
  const elapsed = Number(input.elapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) {
    return { ok: false, silent: true };
  }

  const name = str(input.name);
  const email = str(input.email);
  const subject = str(input.subject) || "Support request";
  const message = str(input.message);

  if (!name) return { ok: false, silent: false, error: "Please tell us your name." };
  if (name.length > MAX_NAME)
    return { ok: false, silent: false, error: "That name is too long." };

  if (!email)
    return { ok: false, silent: false, error: "Please give us an email address to reply to." };
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email))
    return { ok: false, silent: false, error: "That email address doesn't look right." };

  if (!message)
    return { ok: false, silent: false, error: "Please tell us what's going on." };
  if (message.length > MAX_MESSAGE)
    return {
      ok: false,
      silent: false,
      error: `That message is longer than we can accept (${MAX_MESSAGE} characters). Could you trim it a little?`,
    };

  return {
    ok: true,
    message: {
      name,
      email,
      subject: subject.slice(0, 200),
      message,
      platform: str(input.platform).slice(0, 120) || null,
      appVersion: str(input.appVersion).slice(0, 40) || null,
    },
  };
}

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** The email that lands in the support mailbox. */
export function renderContactEmail(m: ContactMessage): RenderedEmail {
  const context = [
    m.platform ? `Platform: ${m.platform}` : null,
    m.appVersion ? `App version: ${m.appVersion}` : null,
  ].filter(Boolean);

  const text = [
    `From: ${m.name} <${m.email}>`,
    ...context,
    "",
    m.message,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1c1a17">
      <p style="margin:0 0 4px"><strong>${escapeHtml(m.name)}</strong>
        &lt;<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>&gt;</p>
      ${
        context.length
          ? `<p style="margin:0 0 16px;color:#7a7266;font-size:13px">${context
              .map(escapeHtml)
              .join(" &middot; ")}</p>`
          : ""
      }
      <div style="white-space:pre-wrap;border-left:2px solid #c4913c;padding-left:16px;margin:16px 0">${escapeHtml(
        m.message,
      )}</div>
      <p style="margin:20px 0 0;color:#7a7266;font-size:13px">Reply directly to this email to answer ${escapeHtml(
        m.name,
      )}.</p>
    </div>`.trim();

  return { subject: `[Dayspring support] ${m.subject}`, text, html };
}

/** The confirmation sent back to whoever wrote in. */
export function renderAutoReply(m: ContactMessage): RenderedEmail {
  const text = [
    `Hi ${m.name},`,
    "",
    "Thanks for writing — your message reached us and a person will read it.",
    "We usually reply within a day or two.",
    "",
    "For reference, here's what you sent:",
    "",
    m.message,
    "",
    "— Dayspring",
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1c1a17">
      <p>Hi ${escapeHtml(m.name)},</p>
      <p>Thanks for writing — your message reached us and a person will read it.
         We usually reply within a day or two.</p>
      <p style="color:#7a7266;font-size:13px;margin-bottom:4px">For reference, here's what you sent:</p>
      <div style="white-space:pre-wrap;border-left:2px solid #c4913c;padding-left:16px;margin:0 0 20px;color:#4a453e">${escapeHtml(
        m.message,
      )}</div>
      <p style="color:#7a7266">— Dayspring</p>
    </div>`.trim();

  return { subject: "We got your message", text, html };
}

/** Issue body for the GitHub delivery path. */
export function renderContactIssue(m: ContactMessage): { title: string; body: string } {
  const context = [
    `**From:** ${m.name} <${m.email}>`,
    m.platform ? `**Platform:** ${m.platform}` : null,
    m.appVersion ? `**App version:** ${m.appVersion}` : null,
  ].filter(Boolean);

  return {
    title: `[support] ${m.subject}`,
    body: [...context, "", "---", "", m.message].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

const env = (k: string): string | null => {
  const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.[k];
  return v && v.trim() ? v.trim() : null;
};

async function sendViaResend(m: ContactMessage, apiKey: string): Promise<void> {
  const to = env("CONTACT_TO_EMAIL") ?? "hello@usedayspring.app";
  // Defaults to Resend's shared sender, which needs no DNS setup. Point
  // CONTACT_FROM_EMAIL at your own domain once it's verified.
  const from = env("CONTACT_FROM_EMAIL") ?? "Dayspring <onboarding@resend.dev>";
  const mail = renderContactEmail(m);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: m.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend rejected the message (${res.status}): ${await res.text()}`);
  }

  // The auto-reply goes to an arbitrary address, which an unverified domain
  // cannot do. Best-effort only: the visitor's confirmation is a nicety, and
  // must never turn a delivered message into a reported failure.
  if (env("CONTACT_AUTOREPLY") === "true") {
    const reply = renderAutoReply(m);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [m.email],
          reply_to: to,
          subject: reply.subject,
          text: reply.text,
          html: reply.html,
        }),
      });
      if (!r.ok) console.warn(`[contact] auto-reply failed (${r.status}): ${await r.text()}`);
    } catch (err) {
      console.warn("[contact] auto-reply threw:", err);
    }
  }
}

async function createIssue(
  repo: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function sendViaGithub(m: ContactMessage, token: string, repo: string): Promise<void> {
  const issue = renderContactIssue(m);
  const label = env("SUPPORT_LABEL") ?? "support";

  let res = await createIssue(repo, token, {
    title: issue.title,
    body: issue.body,
    labels: [label],
  });

  // A label that doesn't exist in the repo yet is a 422. Retry unlabelled
  // rather than lose the message — the label is filing convenience, and no
  // amount of it is worth dropping something a person wrote to us.
  if (res.status === 422) {
    console.warn(
      `[contact] label "${label}" rejected by ${repo} — filing without it. ` +
        `Create the label to get these grouped.`,
    );
    res = await createIssue(repo, token, { title: issue.title, body: issue.body });
  }

  if (!res.ok) {
    throw new Error(`GitHub rejected the issue (${res.status}): ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * A small per-instance sliding window, keyed by IP.
 *
 * Deliberately modest about what this is: serverless instances are ephemeral
 * and there are many of them, so a determined attacker spreading across
 * instances gets around it. It exists to blunt the common case — one script
 * hammering the endpoint, which tends to land on a warm instance — at zero
 * infrastructure cost. Turnstile is the real defence; this is the floor
 * underneath it.
 *
 * The limit is generous enough that a person could never hit it: someone
 * sending a follow-up because they forgot a detail must not be turned away.
 */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export type RateStore = Map<string, number[]>;

const rateStore: RateStore = new Map();

export function checkRateLimit(
  store: RateStore,
  key: string,
  now: number,
  max = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS,
): boolean {
  const cutoff = now - windowMs;

  // Prune every key, not just this one — otherwise the map grows without bound
  // for the life of the instance, one entry per IP ever seen.
  for (const [k, hits] of store) {
    const live = hits.filter((t) => t > cutoff);
    if (live.length) store.set(k, live);
    else store.delete(k);
  }

  const hits = store.get(key) ?? [];
  if (hits.length >= max) return false;

  store.set(key, [...hits, now]);
  return true;
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export type DeliveryRoute = "resend" | "github";

/**
 * Every configured route, in preference order.
 *
 * A LIST rather than a single choice, because they are tried in turn until one
 * succeeds. Resend leads when it's available — a real email with Reply-To set
 * is a far better support inbox than a GitHub issue — but a misconfigured
 * Resend key (unverified domain, wrong recipient) must not take down a working
 * GitHub fallback and silently break the form for everyone.
 */
export function deliveryChain(
  resendKey: string | null,
  githubToken: string | null,
  supportRepo: string | null,
): DeliveryRoute[] {
  const chain: DeliveryRoute[] = [];
  if (resendKey) chain.push("resend");
  if (githubToken && supportRepo) chain.push("github");
  return chain;
}

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare being unreachable must not swallow a real message.
    console.warn("[contact] Turnstile unreachable — allowing through");
    return true;
  }
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function POST(req: Request): Promise<Response> {
  let input: ContactInput;
  try {
    input = (await req.json()) as ContactInput;
  } catch {
    return json({ ok: false, error: "We couldn't read that submission." }, 400);
  }

  const result = validateContact(input);
  if (!result.ok) {
    // Bots get a 200 and nothing else — no signal to tune against.
    if (result.silent) return json({ ok: true }, 200);
    return json({ ok: false, error: result.error }, 400);
  }

  const ip = clientIp(req);

  // Checked after validation so a malformed flood doesn't consume someone's
  // budget, and before delivery so a flood costs us no outbound calls.
  if (!checkRateLimit(rateStore, ip, Date.now())) {
    console.warn(`[contact] rate limit hit for ${ip}`);
    return json(
      {
        ok: false,
        error:
          "That's a few messages in quick succession — give it a minute and try again, or email hello@usedayspring.app.",
      },
      429,
    );
  }

  // Turnstile, when configured. Skipped entirely when there's no secret, so
  // local development needs no Cloudflare account.
  const turnstileSecret = env("TURNSTILE_SECRET_KEY");
  if (turnstileSecret) {
    const token = typeof input === "object" && input && "turnstileToken" in input
      ? String((input as Record<string, unknown>).turnstileToken ?? "")
      : "";
    if (!token) {
      return json({ ok: false, error: "Please complete the verification check." }, 400);
    }
    if (!(await verifyTurnstile(token, turnstileSecret, ip === "unknown" ? null : ip))) {
      return json({ ok: false, error: "That verification check didn't pass. Try again?" }, 400);
    }
  }

  const resendKey = env("RESEND_API_KEY");
  const githubToken = env("GITHUB_TOKEN");
  const supportRepo = env("SUPPORT_REPO");
  const chain = deliveryChain(resendKey, githubToken, supportRepo);

  if (!chain.length) {
    // Loud on purpose. Reporting success here would mean a person believes
    // they've been heard when nothing was delivered.
    console.error(
      "[contact] no delivery configured — set RESEND_API_KEY, or GITHUB_TOKEN + SUPPORT_REPO",
    );
    return json(
      {
        ok: false,
        error:
          "Our contact form isn't able to send right now. Please email hello@usedayspring.app directly — we'll get it either way.",
      },
      503,
    );
  }

  // Try each configured route until one takes it. The message matters more than
  // which pipe carries it, so a broken preferred route costs a log line and a
  // retry rather than the message.
  for (const route of chain) {
    try {
      if (route === "resend") await sendViaResend(result.message, resendKey!);
      else await sendViaGithub(result.message, githubToken!, supportRepo!);

      if (route !== chain[0]) {
        console.warn(`[contact] delivered via fallback "${route}" — fix "${chain[0]}"`);
      }
      return json({ ok: true }, 200);
    } catch (err) {
      console.error(`[contact] delivery via "${route}" failed:`, err);
    }
  }

  console.error(`[contact] every route failed (${chain.join(", ")}) — message not delivered`);
  return json(
    {
      ok: false,
      error:
        "Something went wrong sending that. Please email hello@usedayspring.app directly — sorry for the detour.",
    },
    502,
  );
}
