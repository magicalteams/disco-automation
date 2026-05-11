# Matching Feedback Loop — Schema Brief

Cara, this is the async brief you asked for. Read it at your own pace, mark it up, and we can huddle or thread-reply on anything.

Your concerns are right. Everything below is built around them.

**One important correction before I start.** In an earlier version of this design I used "Magical Match" as the canonical example of a recurring opportunity that should be filtered out globally. You've since made clear that's exactly backwards — you *want* Magical Match appearing in every client's matches every week because it's a business outcome you've been trying to drive for over a year. That's a perfect example of why this feedback design has to be careful: one strategist's "noise" is your KPI. The noise bucket below reflects that correction.

---

## What you said

You flagged four things, all of them load-bearing:

1. **Bias risk.** A free-text `matchingNotes` field on each partner invites every strategist to encode their personal perception of what's "best" for their client. That's a system-of-record problem, not a preference problem.
2. **Source-of-truth drift.** Dossiers are supposed to be authoritative. If a strategist can override matching behavior with a sticky note, the dossier stops being the source of truth and becomes one of several.
3. **Wrong target.** Much of the feedback strategists want to give is actually about sourcing (your job) or about Claude making up context — not about the matching logic. The current tool gives them nowhere to route that, so it lands as a note.
4. **No taxonomy.** Strategists don't know what feedback is for you, what's for the tool, and what's for the dossier.

You said: *"Changes should be made in the dossiers to get different results, not in the matching mechanism."* That's the principle I'm designing around.

You also said: *"The feedback phase should be brief anyway."* Same.

---

## The core problem in one sentence

`matchingNotes` is a single field being asked to do four completely different jobs, and it's doing all four of them badly.

Here's what I see strategists trying to put in that field:

| What they really mean | Where it should actually go |
|---|---|
| "The dossier doesn't know X about this partner anymore." | Dossier update request |
| "This recurring opportunity feels like noise to me." | A suggestion queue you (Cara) review — not an auto-exclusion |
| "The newsletter shouldn't have included this opportunity." | Your sourcing queue |
| "Claude hallucinated context in the rationale." | Engineering / eval set |
| "I personally never want to send this client X." | ...nowhere. This is the bias risk. |

The field has become a dumping ground because it's the only lever within reach. The fix isn't a better note field — it's giving each real concern its own place to land.

---

## The design principle

**The dossier is the source of truth for facts about a partner. Strategists give feedback on outcomes, not on the matcher. Every feedback signal has exactly one owner and one queue.**

Under that principle, `matchingNotes` (or anything like it) mostly goes away.

---

## The proposed taxonomy — four buckets

When a strategist reacts ❌ on a match, they pick one of four reasons. That's the only friction. No typing required.

| Bucket | What it means | Owner | What happens |
|---|---|---|---|
| **Dossier stale** | The match logic is reasonable, but it's working off incomplete or out-of-date info about the partner. | The partner's pod | Creates a dossier update request. The pod can choose to re-sync from Drive, edit the dossier, or dismiss. |
| **Sourcing issue** | This opportunity shouldn't have been in the newsletter pool, or it was mis-tagged. | **You** | Lands in your sourcing queue — a real persistent list, not buried in a free-text field. |
| **Recurring noise (suggestion only)** | This opportunity shows up every week and the strategist thinks it's irrelevant. | **You** approve or reject | Creates an *exclusion suggestion* — never an auto-exclusion. You see the suggestion in your feedback queue and decide whether to honor it. |
| **Just a bad fit** | Dossier is fine, sourcing is fine, the matcher made a bad judgment call. | Engineering | Feeds a weekly digest I can use to tune the matching prompt. Never writes back to any per-partner field. |

There's a fifth implicit bucket that's deliberately missing from the menu: **personal strategist preference**. That's the bias risk you flagged, and I'm designing it out rather than accommodating it.

**Important:** The "recurring noise" bucket now requires your approval before anything gets excluded. This is because of Magical Match — it's exactly the kind of opportunity a strategist might flag as "noise" that's actually a stated business outcome. No strategist should be able to unilaterally remove something from the matching pool. Every suggestion flows to you, and you decide. If an exclusion is approved, it persists; if it's rejected, the opportunity stays in circulation and the strategist sees a note that you've deliberately kept it in.

---

## What the schema would look like

Three new tables, one field removed (or narrowed).

### `MatchFeedback` — one-to-one with each match

This is the load-bearing change. Feedback attaches to a specific bad match, not to a partner. It's outcome-scoped, not partner-scoped, which structurally prevents the "sticky preferences accumulating" problem.

### `SourcingFeedback` — your queue

Today, sourcing concerns have nowhere to go. With this, every `sourcing` bucket selection creates an entry in a real queue you can review — in Slack, in a canvas, or both.

### `DossierUpdateRequest` — the "dossier is stale" audit trail

Today, "the dossier is wrong" is an invisible signal that disappears unless a strategist remembers to run `/partner sync`. With this, every `dossier_stale` bucket creates a tracked request: who flagged it, for which partner, with what suggestion, in which state (open, synced, rejected).

### `PartnerProfile.matchingNotes` — remove or narrow

Two options. I'll recommend one but defer to you.

**Option A — Remove it entirely.** Everything flows through the dossier. If a partner stops taking speaking gigs, that goes in the dossier, not in a note. Strongest stance. Matches your "eliminate overdependency on Strategist overrides" framing exactly.

**Option B — Replace it with a narrow, typed, source-attributed preferences field.** Keep a small structured field for *actual* partner-stated preferences — things like "paused until end of Q2" or "not taking speaking gigs this quarter." But constrain it hard:
- Typed enum (pause / exclude category / exclude format / client-stated focus)
- **Source attribution required** — every entry has to cite either a dossier line, a client meeting, or a client email. Strategist judgment is not a valid source.
- Automatic expiry via `pausedUntil`

Under Option B, a preference without a citation can't exist. That structurally solves the bias problem while still letting real client-stated preferences land somewhere legitimate.

**My recommendation:** Option B. It gives strategists a legitimate (but tightly bounded) place for real client preferences, and the attribution requirement does the work of keeping bias out. But if you want the stronger signal, Option A works.

---

## What the ❌ reaction would feel like

The whole point of the feedback phase is that it stays brief. One click mandatory, one sentence optional.

```
Strategist reacts ❌ on a match thread reply
        ↓
Bot posts an ephemeral message in the thread (only that user sees it):
  "Quick — what made this a miss?"
  [Dossier stale]  [Sourcing issue]  [Recurring noise]  [Just a bad fit]  [Skip]
        ↓
On click:
  "One line of context (optional):"
  [___________________________________]
        ↓
Bot logs the feedback and replies with where it went:
  "Logged. Sent to Cara's sourcing queue."
  "Logged. Queued a dossier update request for Erin."
  "Logged. Flagged as an exclusion suggestion — Cara will review."
  "Logged. Added to this week's matching quality digest."
```

`✅` and `👀` stay exactly as they are — no prompts, no forms, no friction. Friction is only paid on `❌`, and it's a single click.

**Note on the exclusion suggestion path:** when a strategist flags something as recurring noise, the opportunity is *not* immediately removed from the pool. It continues to match normally until you review the suggestion in your feedback queue and either approve it (which creates a global exclusion) or reject it (which marks the suggestion as "intentionally kept" so the same opportunity can't be re-flagged without context). This is the Magical Match safeguard: strategist friction doesn't automatically override stated business outcomes.

---

## Surfacing more dossier data to the matcher

This is technically adjacent to the feedback question, but it matters because it directly enables your "fix it in the dossier" principle.

Right now, the matcher only sees five fields per partner: name, company, geographicFocus, matchingNotes, and the dense 400-500 word matchingSummary. Every other structured field we extract — industries, services, key strengths, current challenges, ideal intro profile — is baked into the summary string as prose. The matcher has to infer things like "Erin is in Vermont, remote-first" from a paragraph instead of seeing a structured field that says so.

Two cheap improvements that pair with the feedback loop redesign:

1. **Expose the existing structured fields to the matcher directly**, alongside the summary. The matcher can then do hard rejection on concrete attributes instead of fuzzy prose inference. For example, an opportunity requiring "fashion industry experience" can be rejected directly against the partner's `industries` array rather than relying on Claude to infer it from narrative.

2. **Extend dossier extraction to capture a few more discrete fields worth having.** Candidates:
   - `locationDetail` — finer than `geographicFocus`. "Vermont, remote-first" is a fact the matcher should see discretely.
   - `formats` — writing, speaking, advisory, etc. What the partner *does*, not what they *do it about*.
   - `currentlyAccepting` — a constrained enum of what types of opportunities they're actively open to.

The principle is: whenever the answer to "why was this a bad match?" is "the dossier doesn't expose that fact as a discrete field," the right fix is to add the field to extraction, not to write a notes workaround. The `dossier_stale` feedback bucket gives you data on exactly which fields are missing most often, so the schema grows based on real signal instead of guessing.

---

## What Slack commands would change

| Command | Status |
|---|---|
| `/partner note` | Removed |
| `/partner prefer [name]` | New — opens a modal for typed, source-attributed preferences (Option B only) |
| `/partner dossier-request [name] [text]` | New — manual dossier update request, for when you spot an issue outside of match review |
| `/feedback queue` | New — your sourcing queue + open dossier requests, grouped by status |
| `/feedback digest` | New — weekly "bad fit" digest for reviewing matcher quality |
| ❌ reaction on a match | Becomes interactive (triage prompt) |
| ✅, 👀 reactions | Unchanged |

---

## How you get visibility

Three surfaces, each with one clear job:

- **Your sourcing queue** — `/feedback queue` shows every `sourcing` flag with status, or a Monday morning digest auto-posted to a channel you designate. Either way, this is *yours*.
- **Dossier stale requests** — post to the partner's own channel so the pod sees them without routing through you.
- **"Bad fit" digest** — weekly summary of matcher-quality signals. Auto-posted to a channel you can watch if you want, or just sits as eval data for me to tune the prompt.

The mental model: your job is sourcing. Strategists' job is partner relationships. The matcher's job is matching. Each kind of feedback now has exactly one home and one owner.

---

## Stated business outcomes — a new concept the schema should protect

Magical Match taught me something the original design didn't account for: there are opportunities you *want* surfacing in every client's matches every week, because getting the strategists to use them is a business outcome you've been driving toward for over a year. From the matching engine's perspective, these look identical to noise — they're recurring, they match broadly, they sometimes generate strategist pushback. But they're the opposite of noise.

I'd like to add a small, structured list to the schema: **protected opportunities**. Something like:

```
ProtectedOpportunity {
  id              String   @id
  pattern         String   // e.g. "Magical Match"
  reason          String   // e.g. "Driving strategist adoption — Cara's KPI for 2026"
  createdBy       String   // You
  createdAt       DateTime
}
```

Protected opportunities do three things:

1. They can't be auto-excluded by any strategist feedback, ever.
2. If a strategist reacts ❌ with the "recurring noise" bucket on a protected opportunity, the bot says *"This opportunity is on the protected list because: [reason]. Your feedback has been noted but it will continue to appear in matches."* — so strategists understand *why* something they think is noise keeps showing up, and they don't feel ignored.
3. They surface in `/feedback queue` as a visible list so you can audit what's protected and why.

This feels like the right way to encode what you told me about Magical Match: it's not a bug that it appears everywhere, it's a feature you want the system to actively protect. Let me know if this concept holds up for you, and if there are other opportunities you'd want on this list from the start.

---

## Open questions I need your read on

Before I build any of this, I need your call on:

1. **Option A or Option B** for `matchingNotes`? Hard removal, or narrow typed preferences with source attribution?
2. **Auto-resync vs. confirmation** on `dossier_stale`? When someone flags a dossier as stale, should the bot auto-trigger `/partner sync`, or always require human confirmation? I'd default to confirmation — auto-resync could mask real edit needs.
3. **Who clears the "bad fit" digest** — you, me, or nobody (it's just an eval input)?
4. **Where does the sourcing queue live** — a dedicated Slack channel, a Slack canvas, both?
5. **Which discrete dossier fields** should we add now, versus waiting for `dossier_stale` data to tell us what's actually missing? I'd vote "wait," unless you already know which ones are obviously missing.
6. **Protected opportunities list** — does the `ProtectedOpportunity` concept hold up? Magical Match is the obvious first entry. Are there others you'd add from the start? (Open DMs? Founder Letter Requests? Anything else you've been pushing strategists to engage with?)

---

## Not in this brief

To be clear about scope:

- I'm not proposing we build this right now. I want your read first.
- I'm not touching the existing reaction tracking (✅ / 👀 / ❌ status). That part works and stays.
- I'm not touching the dossier extraction prompt yet. Structural changes there depend on which discrete fields we add.
- I'm not proposing that strategists run anything other than react-and-click. Everything else is your call or mine.

---

## What I'd build first, if we agree on direction

In order of value:

1. The `ProtectedOpportunity` table + Magical Match as the first entry. (This is cheap and eliminates a class of accidental damage before we build anything else.)
2. The four-bucket taxonomy + `MatchFeedback` + `SourcingFeedback` + `DossierUpdateRequest` tables.
3. The interactive ❌ flow (single click → routed to the right queue).
4. Your sourcing queue surface (`/feedback queue` + optional channel post).
5. `matchingNotes` removal or replacement (whichever you pick).
6. Exposing more structured dossier fields to the matcher.
7. Adding new discrete fields to the extraction prompt (whenever the `dossier_stale` data tells us what's missing).

Nothing else happens until you sign off.

---

Let me know how you want to work through this — huddle, Slack thread, or you can just mark this up and send it back. Whichever is easiest.
