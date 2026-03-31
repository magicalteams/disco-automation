# Disco Automation — What We Built

You had three standalone tools that worked well on their own but didn't talk to each other: the Business Village Newsletter Claude project, the Post-Meeting Workflow that Cara uses after discovery calls, and the dossier creation prompt for building client partner profiles. Running the matching process manually — opening Claude, uploading dossiers, running prompts per partner, copying language into emails — worked, but it didn't scale.

This system connects those pieces. The newsletter, the call transcripts, and the partner dossiers all feed into a single automated workflow that runs every Monday and is available on demand from Slack. The matching logic, the output language, the intro email format, and the review process are all built from your existing materials — Ariel's SOP, Christina's voice rules, your intro message template, and the Magical Teams tone.

We built this in the staggered sequence you asked for: newsletter opportunity matching first, validated with the team, then discovery call matching layered on top.

---

## What It Does

### Output 1: Newsletter Opportunity Matching

Every Monday, the system reads the latest Business Village newsletter from LinkedIn, extracts each opportunity, and matches them against every client partner in the database.

This replaces the manual process of opening the Business Village Newsletter Claude project, uploading a partner's dossier, and running "identify which current newsletter opportunities are most relevant to this partner" — one partner at a time.

**What you get in Slack, grouped by partner:**

- Which opportunities matched and why, with a confidence score
- **Pod language** — the shorthand the pod and Strategist would say to each other about this match (professional shorthand, assumes context)
- **Client language** — a warm, specific excerpt that could be shared directly with the partner
- For strong matches (confidence 0.7+): a **draft outreach email** ready to customize

The pod decides what to do with each match — it might become an email, a Slack message, a conversation in a meeting, or nothing at all. The system gives you the language and the reasoning; the team decides the action and who delivers it.

The system knows the Business Village category taxonomy — Networking Events, Angel Investment Opportunities, Community Memberships, Editorial Roles, Podcast Guest Calls, Panel Opportunities, and the rest — and tags each match accordingly.

### Output 2: Discovery Call Matching

After one of Cara's discovery calls, anyone on the team can type `/disco` in Slack to process the Fireflies transcript. The system reads the full conversation, identifies what the person needs and what they offer, and matches in both directions.

This replaces the process of going into the Post-Prospect Meeting Claude project, pulling up a transcript, uploading partner dossiers alongside it, and running "identify which of our client partners would be a strong introduction for this prospect."

**What you get in Slack:**

- **What They Need → Matching Opportunities:** Their expressed needs matched against active newsletter opportunities, with language to share the opportunity with them (same format as Output 1)
- **What They Offer → Partners Who'd Benefit:** Their capabilities matched against client partners who have gaps they could fill
- **Intro-Worthiness Assessment:** Whether this person would value proactive introductions, and suggested intro topics
- For strong intro matches: a **double-sided intro email** following your exact template — "Hey [A] and [B], Connecting you two because this feels like a great match..." with the specific expertise and need spelled out for both parties. Closes with "I'll let you both take it from here. Happy connecting!"

The intro emails are drafts. They're written in the format from your Introduction Message Generator, but whoever sends them — Michael, Cara, the pod — customizes the voice and adds their personal touch before sending.

### Partner Profile Extraction

Each client partner needs a dossier before they can be matched. The dossier creation process (the one that produces the 15-40 page assessments) hasn't changed — you still create dossiers using the prompt, gathering LinkedIn profiles, transcripts, articles, and whatever else is available.

What's new is what happens after. When a dossier is saved to the Client Dossiers folder on the Shared Drive, the system extracts it into a structured profile optimized for matching. That 15-40 page narrative gets distilled into a matching summary — a dense 400-500 word paragraph that captures what the partner does, who they serve, what industries they work in, what makes them unique, what challenges they face, and what kinds of opportunities would be valuable to them.

This means dossiers don't need to be re-uploaded into Claude every time matching runs. Each partner's matching DNA lives in the database and is evaluated against every opportunity, every week, automatically.

Three dossiers have been extracted so far. As new partners onboard (you estimated 1-3 per month), each new dossier gets extracted the same way and immediately starts appearing in weekly matching.

### Opportunity Review (Solving the Date Problem)

The original brief flagged a known issue: the newsletter process couldn't reliably determine whether an opportunity had passed or was still active. Claude isn't good at tracking dates, and expired opportunities were getting through.

The solution is a Google Sheet with a human review window built into the Monday timeline. After the newsletter is ingested at 11 AM, all extracted opportunities are pushed to the sheet. A Slack reminder goes out at 2 PM with a link. Between 2 and 5 PM, the team can scan the status column and flag anything that's stale, past its deadline, or not worth matching. Those changes sync back to the database before matching runs at 5 PM.

The system also auto-expires opportunities whose deadlines have passed, so obvious ones don't require manual attention. But for the ambiguous cases — the ones Claude can't reliably date — the sheet gives you a quick way to catch them.

If you don't change anything, all opportunities are matched as-is. The review step is there if you need it, invisible if you don't.

---

## When It Runs

Everything happens on Mondays, spaced to give time for review between steps.

| Time (UTC) | What Happens |
|------------|--------------|
| 11:00 AM | Newsletter ingested from LinkedIn RSS. Opportunities extracted and pushed to Google Sheet. Slack confirmation posted. |
| 2:00 PM | Slack reminder with a link to the review sheet. Review window opens. |
| 5:00 PM | Sheet overrides synced. Past-due opportunities auto-expired. Matching runs against all active opportunities and all partner profiles. Results posted to Slack. |

The Monday pipeline runs without anyone doing anything. The only manual step is the optional sheet review between 2 and 5 PM.

**On demand, any time:**

| Slack Command | What It Does |
|---------------|--------------|
| `/disco` | List recent Fireflies meetings, search by name, or process a specific transcript |
| `/match` | Run weekly matching off-schedule (or preview with `/match dry-run`) |
| `/match reset` | Clear a completed match run so you can re-run `/match` |
| `/ingest` | Re-trigger newsletter ingestion if the Monday automation missed it |

Slack commands were the obvious choice for manual triggers — there's nothing simpler than typing a command where you already work. No terminal, no API keys, no browser tabs.

---

## How It Uses Your Materials

This system wasn't built generically and configured for Magical Teams. It was built from your materials. Here's where each one shows up.

**Ariel's SOP** — The workflow architecture maps directly to the SOP: newsletter publishes → readiness check → opportunity matching → disco intro matching → drafts → Strategist review. The automation follows the same sequence, in the same order, with the same review gates. The SOP defined the process; the system runs it.

**Your Dossier Creation Prompt** — The 15-40 page dossier process (executive summary, professional history, psychological profile, network analysis, strategic insights, risk assessment) feeds the partner extraction engine. Each dossier is analyzed to pull out structured intelligence: industries, services, target clients, key strengths, unique positioning, current challenges, ideal intro profile, and the matching summary that powers every match evaluation.

**Your Intro Email Template** — The exact format from the Introduction Message Generator is embedded in discovery call matching. When the system drafts a double-sided intro, it follows your structure: subject line "Intro," opening with "Connecting you two because this feels like a great match," each person introduced to the other with credentials and the specific need or capability, then "I'll let you both take it from here. Happy connecting!" Same format, every time.

**Christina's Voice Rules** — The writing constraints from Christina's guidelines are coded directly into every prompt the system runs. No em dashes. Never use the word "just." No generic business language. No overselling the connection. No citing McKinsey studies. These aren't suggestions to the AI — they're hard rules in every matching and email generation prompt.

**Magical Teams Tone Guidelines** — The tone guidelines shape how the AI writes all output. Strategic and solutions-focused. Direct and transparent. Warmly human. Pod language reads like professional shorthand between people who share context. Client language reads like something you'd actually send — warm, professional, specific to the opportunity. Draft outreach emails reference the partner's actual expertise and explain why this particular opportunity matters for them.

**The Business Village Newsletter** — Cara's weekly newsletter, ingested automatically from LinkedIn every Monday. The system knows the newsletter's category structure — Networking Event, Angel Investment Opportunity, Community Membership, Conference Discount, Leadership Workshop, Buildathon, Editorial Role, Storytelling Project, Open DMs, Free Build Day, Podcast Guest Call, Panel Opportunity, Speaking Call, Founder Letter Request — and maps each to the Slack output with category tags.

**Cara's Fireflies Transcripts** — Fetched directly from your Fireflies account when anyone on the team runs `/disco`. The system reads the full transcript, identifies the non-Antonym participant, and extracts what they need (with urgency levels — high, medium, low) and what they offer (with specificity assessments — concrete, moderate, vague). This intelligence drives both directions of matching.

**The Pod/Strategist Review Workflow** — Every Slack output — weekly matches, disco matches, draft emails — includes a review footer: "These are drafts. Do not send without a review pass." If a reviewer tag is configured, that person gets mentioned directly. The system produces drafts and language; humans review, customize, and send.

---

## Where Outputs Go

Everything posts to Slack.

**Weekly matching** posts a message grouped by partner. Each partner section shows their matching opportunities sorted by confidence, with rationale, pod language, client language, and draft outreach emails for strong matches. A summary at the bottom lists which partners had no matches this week and which opportunities went unmatched. This grouping was deliberate — partner-first makes it easy to relay everything to the relevant pod at once.

**Discovery call matching** posts a message organized around the person from the call. First section: what they need, matched to active opportunities. Second section: what they offer, matched to partners who'd benefit from an intro. Third section: intro-worthiness score and suggested topics. Draft intro emails are included for strong partner matches.

**Sheet reminders** post a message with the opportunity count for the week, a direct link to the Google Sheet, and clear instructions on what to review and when matching will run.

**Error alerts** post if ingestion or matching fails, so you know what happened without checking logs.

---

## What Changed

| Before | After |
|--------|-------|
| Three standalone Claude projects that don't talk to each other | One connected system with shared data |
| Upload each partner's dossier into Claude every time you run matching | Partner profiles extracted once, stored in a database, matched automatically every week |
| Open the Business Village Newsletter project, run matching per partner | Newsletter ingested automatically from RSS, all partners matched in one pass |
| Cara is the only person who can run the Post-Meeting Workflow | Anyone on the team can run `/disco` from Slack |
| Manually track which opportunities have expired | System auto-expires past-deadline opportunities; Google Sheet catches the rest |
| Draft intro emails by hand using the template as a guide | System generates drafts in your exact template format, ready to customize |
| Remember to run each step in the right order every Monday | Monday pipeline runs on schedule without intervention |

The quality is the same. The voice is the same. The review process is the same. The standalone tools are now connected, and the manual steps between "newsletter publishes" and "drafts submitted for review" are handled by the system.

---

## What's Next

The original brief described a third output: **Nurture Automation**. This is the next phase, pending strategy work to design the workflow. The idea is to drip relevant opportunities and introductions to two groups — prospects not yet in the sales pipeline, and referral partners being nurtured ongoing — based on last connection, relevancy, and priority. The system would recommend language, and someone on the team (Michael, Cara, the Strategist) would customize and send in their own voice.

That's a later build. The current system handles the weekly opportunity matching and discovery call matching that were the immediate priority.
