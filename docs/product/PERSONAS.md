# Personas

> **Epistemic status: HYPOTHESES, not findings.**
> As of 2026-07-26 these are built from the product's own design decisions, the
> onboarding fork already shipped in `OnboardingFlow.tsx`, and reasoning about the
> category — **not** from user research. Beta feedback so far has been generic.
>
> Do not cite these as evidence. Use them to generate predictions, then go
> falsify them. The interview script at the bottom is the tool for that, and it is
> arguably the most valuable part of this file.

Three personas. Two we're building for, one we should probably decline.

---

## P1 — The Archivist *(primary wedge — least validated, most actionable)*

**Who.** Has journaled for 3–15 years, mostly in Day One or Diarly, sometimes across
several apps and a shoebox of paper notebooks. Thousands of entries. Writes reliably.
Has essentially never re-read any of it.

**Why we think they exist.** The product already bets on them: the importer targets
Day One and Diarly exports specifically, onboarding forks on *"I've been journaling
for years,"* and the whole `processing_jobs` backfill engine exists to make an
imported archive immediately meaningful. Phil is himself this person (3,460 entries
imported). That's a sample of one — which is a real signal and not remotely proof.

**The questions actually on their mind:**
- "I have eleven years in here. What's in it? I genuinely don't know."
- "Am I the same person? Have I been praying about the same thing this whole time?"
- "Did God answer any of this? I can't remember what I asked for."
- "Is my archive going to survive me moving apps again?"
- "Do I have to give up the app I already like to get this?"

**What they've tried.** Scrolling back on the anniversary of something. Day One's
"On This Day." Both feel like a slot machine — occasionally moving, mostly noise,
never a picture of the whole.

**Objections, in the order they'll raise them:**
1. *"Will the import actually work, or will it mangle my dates?"* — highest-stakes
   first impression in the product. A bad import loses this persona permanently.
2. *"An AI is going to read my entire prayer life."* — the honest privacy conversation,
   unavoidable, and Principle 7 says we have it plainly rather than dodge it.
3. *"Is this just GPT summarizing me?"* — the differentiator is grounding
   (Principle 4). They need to see verbatim quotes to believe it.
4. *"$7/month for a journal? Day One is cheaper and I already have it."*

**The moment they churn.** They import, the first reflection comes back generic or
slightly wrong about their own life, and they conclude it's a wrapper. **This is a
one-shot impression** — an archivist who is disappointed by their first reflection
does not come back for the second.

**Predictions if this persona is real:**
- Import path chosen well above 40% of new signups.
- Import-path trial conversion materially beats fresh-start conversion.
- The Ascent / year-in-review is the most-visited non-editor surface for them.

**Falsified if:** import stays cold, or importers churn *faster* than fresh starts
(which would mean we're setting an expectation the synthesis can't meet).

---

## P2 — The Dry Season *(largest emotional job, weakest current product fit)*

**Who.** Practicing Christian, 25–45, in church, believes. Something has flattened.
God feels distant or silent. They can't tell if they're growing, backsliding, or
just tired, and they don't want to say that out loud at small group.

**Why we think they exist.** Nearly all of the product's emotional copy is aimed at
them — *"what God has been making of you," "what you write today becomes something
you'll one day weep over,"* the sample reflection in the fresh-start onboarding is
literally about waiting on a God who isn't moving. The product's heart is already
built for P2 even though its surface area is built for P1.

**The questions actually on their mind:**
- "Is anything actually happening, or have I been standing still for two years?"
- "Was I closer to God before? When did it change?"
- "Has He answered anything I asked for, or does it only feel like He hasn't?"
- "Is this normal? Do other people go through this?"
- "Is journaling one more thing I'll fail at?"

**What they've tried.** A devotional app they stopped opening. A physical journal with
nine entries. Talking to one friend. Sermons that named the problem and didn't fix it.

**Objections:**
1. *"I don't journal. I've tried."* — the entry barrier is the whole fight here.
2. *"Will this make me feel worse?"* — a product that shows a dry season *as* a dry
   season could deepen the shame. Principle 1 (light, not verdict) is load-bearing
   for this persona specifically.
3. *"Is a computer going to tell me how I'm doing with God?"*

**The moment they churn.** Day 3 of the trial, blank editor, nothing to look back on
yet. Principle 5 forbids faking depth for them — which means the honest answer is
that **the 14-day trial cannot demonstrate our core value to a fresh-start user.**
That is a real strategic tension and it is not currently solved.

*Candidate resolutions (unvalidated, for `DECISIONS.md`):* a longer trial for
fresh starts; a guided first-week arc; making the trial start at first reflection
rather than at signup; or accepting that P2 is only reachable via import and
therefore isn't a separate acquisition path at all.

**Falsified if:** fresh-start users convert at a rate we can live with anyway (which
would mean the trial tension is imaginary), or if they convert at ~0% (which would
mean P2 is unreachable without a different product).

---

## P3 — The Discipline Builder *(probably NOT our persona — documented so we stop being tempted)*

**Who.** Wants to be someone who journals and prays consistently. Buys the notebook.
Downloads the app in January. Wants a system to make them do it.

**Why they're tempting.** Enormous population, clear stated demand, and they'll tell
you exactly what they want: reminders, streaks, plans, accountability.

**Why we should decline them.** Everything that serves them violates Principle 2.
Streaks and guilt notifications are what this persona is asking for and what we've
committed never to build — and habit-formation apps will beat us at it anyway. Worse,
they'd churn regardless: our value arrives in year three and they quit in February.

**The trap:** P3 gives the loudest, most specific feature requests. Generic beta
feedback ("maybe reminders?") is often P3 leaking through. **Requests that sound like
P3 should be logged, not built.**

**Revisit if:** we find a way to build consistency support that is invitational rather
than coercive — and it survives a Principle 2 review on its own merits.

---

## What this means for positioning

P1 is who we can **reach** (they have an export file and a reason to switch).
P2 is who we can **move** (the emotional job is deeper and the copy already speaks to
them). They are not the same person, though they overlap.

The current bet — implicit in the code, now made explicit — is: **acquire P1, and the
product moves them like P2.** An archivist who sees eleven years read back to them is
having a P2 experience.

If that holds, "tech-savvy Christians" is a reachability constraint, not a market
ceiling, and the answer isn't to broaden the product — it's to find non-technical
paths to people with archives.

---

## How to falsify these — the interview script

Generic feedback is a symptom of generic questions. *"How are you liking it?"* returns
*"it's great!"* every time. These questions are designed so the answers are unfaked.

Aim for **five conversations, 20 minutes each, recorded, no leading**. Ask about the
past, never the future — people are unreliable narrators of what they *would* do and
reliable ones about what they *did*.

**Origin (tests: is P1 real?)**
1. "Walk me through the day you signed up. What were you doing right before?"
2. "What were you using before this? Do you still have it installed?"
3. "Had you tried to solve this before? What did you try?"

**The job (tests: P1 vs P2)**
4. "When was the last time you went back and read something you wrote a year ago?
   What made you do it?"
5. "What did you think this would do for you when you signed up?"

**Value moment (tests: is grounding landing?)**
6. "Has Dayspring shown you anything you didn't already know about yourself?"
   → *If yes:* "Can you find it? Read it to me."
   → *If no:* that's the finding. Don't rescue it.
7. "When it reflects your writing back — does it feel like you, or like a computer?"

**Price (tests: willingness to pay past the trial)**
8. "If it went to $15/month tomorrow, what would you do?"
9. "Is there a month where you'd have cancelled? What was happening?"

**Churn risk**
10. "What almost made you quit?"
11. "What would you tell a friend this is? Say it how you'd actually say it."
    → Q11 doubles as the grunt test for `BRANDSCRIPT.md`. Write down their exact
    words; they are better positioning copy than anything we'll write.

**Rules for running these:**
- Never pitch. The instant you explain a feature, the data is contaminated.
- Silence after an answer. The second thing they say is the true thing.
- Ask "why?" three times before moving on.
- Record verbatim phrases — those become copy.
- **Do not ask "would you use X?"** People say yes to be kind.

**After five interviews:** revise this file, move statements from *hypothesis* to
*finding* with the interview date attached, and log any strategy change in
`DECISIONS.md`.
