# Profile Population Strategy

## The question this answers

If we add ~100 structured fields to `PartnerProfile`, how do they actually get filled in? Who updates them, when, and through what interface?

Not every field is extractable from a dossier. Not every field should be. And Slack slash commands don't scale to editing 100 fields one at a time.

---

## Three population paths

Every field falls into exactly one of these:

### Path A — Dossier-extractable (Claude does it at import time)
Facts that appear in a well-written 15-40 page dossier and can be pulled out by Claude during the existing `/partner sync` extraction flow. No human data entry required.

### Path B — Human-stated (strategist updates over time)
Facts that don't typically appear in dossiers but are known to the strategist or the client. These are preferences, current state, and operational details that shift more often than dossiers get rewritten.

### Path C — Behavioral (system computes from reactions)
Facts that emerge from observed behavior — what a strategist actually shares, skips, or reviews. Never entered by a human. Computed from the match results table over time.

---

## Field-by-field assignment

### Tier 1 — Must-have

| Field | Path | Notes |
|-------|------|-------|
| `gender` | **A** (Opus can often infer from pronouns in dossier narrative) + **B** (strategist confirms) | Opt-in. Default `not_specified` if not explicit. |
| `pronouns` | **A** (usually stated in dossiers) | |
| `homeBaseCity` | **A** (almost always in dossiers) | |
| `homeBaseState` | **A** | |
| `homeBaseCountry` | **A** | |
| `timezone` | **A** (inferable from location) | |
| `willingToTravelFor` | **B** (rarely in dossiers) | Strategist enters based on client conversations |
| `travelRadiusMiles` | **B** | |
| `remoteFirst` | **A** (often stated) + **B** (confirm) | |
| `primaryFormats` | **A** (strongly implied by dossier content) | |
| `openToPodcastGuest` | **A** (if dossier mentions podcast history) + **B** | |
| `openToSpeaking` | **A** + **B** | |
| `openToPanels` | **A** + **B** | |
| `openToEditorial` | **A** (if dossier shows published work) + **B** | |
| `openToInvesting` | **A** + **B** | |
| `toolsInUse` | **A** (dossiers sometimes mention tools) + **B** (partners will know this better) | |
| `toolsConsidering` | **B** only | Not in dossiers. Volatile. |
| `avoidedTools` | **B** only | |

**Tier 1 split: 11 extractable, 7 human-entered, 18 total.**

### Tier 2 — High-value

| Field | Path | Notes |
|-------|------|-------|
| `businessModel` | **A** | |
| `pricingModel` | **A** (often in dossiers) | |
| `primaryIndustry` | **A** (always) | |
| `secondaryIndustries` | **A** | |
| `industriesAvoided` | **B** | Rarely in dossiers |
| `clientIndustries` | **A** (if service provider) | |
| `b2bOrB2c` | **A** | |
| `careerStage` | **A** (inferable from history) | |
| `yearsOfExperience` | **A** | |
| `teamSize` | **A** (in dossier business section) | |
| `fundingStage` | **A** (usually stated) | |
| `revenueStage` | **B** (sensitive; strategist enters) | |
| `profitability` | **B** (sensitive) | |
| `openToInvestment` | **B** (volatile state) | |
| `investmentStage` | **B** | |
| `seeksNonDilutive` | **B** | |
| `checkSizeSeeking` | **B** | |
| `minGrantAmount` | **B** | |
| `exitsPriorCompanies` | **A** (in career history) | |
| `hasNewsletter` | **A** (dossiers usually note this) | |
| `newsletterSubscribers` | **B** (volatile) | |
| `hasPodcast` | **A** | |
| `activePlatforms` | **A** | |
| `socialReach` | **B** (volatile) | |
| `publishedAuthor` | **A** | |
| `contentFocus` | **A** | |
| `openToCollaborativeContent` | **B** | |
| `expertiseAreas` | **A** (strong signal in dossiers) | |
| `canTeachTopics` | **A** + **B** | |
| `certifications` | **A** | |
| `degrees` | **A** | |
| `awards` | **A** | |
| `openToIntros` | **B** | Default `true`, strategist can opt out |
| `lookingFor` | **A** (from "current challenges" section) + **B** (refinement) | |
| `canOfferIntros` | **A** (from services offered) + **B** | |
| `memberOfCommunities` | **A** (often in network analysis section) + **B** | |
| `closedCommunitiesOnly` | **B** | |

**Tier 2 split: 22 extractable, 13 human-entered, 35 total.**

### Tier 3 — Nice-to-have

| Field | Path | Notes |
|-------|------|-------|
| `ethnicityIdentity` | **B** (opt-in, always) | Never infer from name or photo |
| `lgbtqIdentifies` | **B** (opt-in) | Never infer |
| `ageRange` | **A** (if dossier has DOB or "graduated in") + **B** | |
| `parentingStatus` | **A** (if dossier mentions family) + **B** | |
| `veteranStatus` | **B** (opt-in) | |
| `immigrantFounder` | **A** (if dossier mentions) + **B** | |
| `firstGeneration` | **B** | |
| `disabilityIdentifies` | **B** (opt-in) | |
| `religiousIdentity` | **B** (opt-in) | |
| `languagesSpoken` | **A** | |
| `missionDriven` | **A** (strong dossier signal) | |
| `impactAreas` | **A** | |
| `deibCommitment` | **A** | |
| `bCorpCertified` | **A** | |
| `sustainabilityFocused` | **A** | |
| `meetingPreference` | **B** | |
| `introvertExtrovert` | **A** (psychological profile section) + **B** | |
| `prefersVirtual` | **B** | |
| `prefersSmallGroup` | **B** | |
| `prefersFemaleSpaces` | **B** (opt-in) | |
| `avoidsNetworkingEvents` | **B** | |
| `prefersAsync` | **B** | |
| `openToPress` | **B** (volatile) | |
| `mediaKit` | **B** | |
| `headshotOnFile` | **B** | |
| `pressAngles` | **A** + **B** | |
| `openToPartnerships` | **B** | |
| `partnershipTypes` | **B** | |
| `hasAffiliateProgram` | **A** + **B** | |
| `currentCapacity` | **B** (volatile) | |
| `typicalResponseTime` | **B** | |
| `hoursPerWeekAvailable` | **B** | |
| `notSeekingCurrently` | **B** (volatile) | |
| `pausedUntil` | **B** | |
| `techStackCategory` | **A** + **B** | |
| `primaryRevenueChannel` | **A** + **B** | |

**Tier 3 split: 12 extractable, 29 human-entered, 41 total.**

### Tier 4 — Behavioral

All **Path C**. Zero human entry. Computed from `MatchResult.reactionStatus` over time.

### Relationship metadata

| Field | Path |
|-------|------|
| `partnerType` | **B** (set at profile creation, rarely changes) |
| `assignedStrategist` | **B** |
| `relationshipStartDate` | **B** |
| `lastInteractionDate` | **B** (or auto-updated by future integrations) |

---

## Path summary

| Path | Field count | When populated | Who does it |
|------|-------------|----------------|-------------|
| **A** — Dossier-extractable | 45 | Automatically on `/partner sync` | Claude Opus |
| **A+B** — Extract, confirm, refine | ~20 (overlap) | On sync + over time | Claude + strategist |
| **B** — Human-stated | 49 | Over time, as known | Strategist or Cara |
| **C** — Behavioral | 5 | Computed nightly | System |

Roughly **half the fields** can be populated entirely by dossier extraction. The other half need human input.

That means strategists need a way to edit ~50 fields per partner without rewriting the dossier every time.

---

## Why Slack commands are the wrong interface for this

Slack slash commands work great for narrow, one-off updates:
- `/partner set-channel Amanda Antonym #client-amanda`
- `/partner sync Fernlove`
- `/partner note Erin Cunningham [note text]`

They fall apart for editing 50 fields:
- **Discoverability** — you can't scan a Slack command list to see which fields exist or what values they accept
- **Validation** — enums and booleans have constrained values that strategists can't see until they guess wrong
- **Review** — you can't see the whole profile at once to know what's already set vs. blank
- **Bulk edits** — updating multiple fields means running multiple commands
- **Error correction** — typos and formatting errors are a constant source of friction
- **Onboarding** — new strategists can't learn the system from the command list alone

At 100 fields, Slack commands are actively hostile to the people who would use them.

---

## Proposed: a lightweight partner profile editor

A small web app — one page — that shows all fields for a partner and lets strategists edit them with appropriate inputs per field type.

### Core principles

1. **Read-only by default for everything dossier-extracted.** Those fields show as "from dossier" with the current value. Editing them inline is possible but prompts a confirmation: "This change will be overwritten the next time the dossier is re-extracted. Update the dossier instead?" with a shortcut to queue a dossier update request.

2. **Write-enabled for everything human-stated.** Dropdowns, multi-selects, date pickers, checkboxes. Appropriate to each field type. No free-text wherever a constrained value exists.

3. **Save on blur, no form submission.** Each field saves individually as soon as the strategist changes it. No "Save" button. No "Cancel" button. No risk of losing a page of edits.

4. **Searchable partner list.** Landing page is a searchable list of all partner profiles. Click to edit.

5. **Show the matching summary read-only.** The dense 400-500 word summary is shown as a reference, collapsed by default. Strategists can see what the matcher sees without being able to edit it directly (because it's generated from the dossier).

6. **Single auth** — signed in with Slack OAuth. Anyone in the workspace can view; only strategists in the partner's pod + admins can edit.

### Technical approach

- **Stack**: Next.js (we already have it), Tailwind, a simple form library
- **Hosting**: The existing Vercel app. Add a `/partners` route.
- **Auth**: Slack OAuth via NextAuth.js — strategists sign in with their existing Slack identity
- **Data**: Direct Prisma access — same database, no new API layer required
- **Deploy**: Automatic via existing Vercel integration

### What the page would look like

A partner profile page would have:

1. **Header** — partner name, company, partner type, pod channel, last dossier sync date
2. **Tabs or collapsible sections** grouping related fields:
   - Identity & demographics
   - Location & travel
   - Formats & availability
   - Tools & tech stack
   - Business & financial
   - Content & visibility
   - Network & intros
   - Expertise & credentials
   - Values & mission
   - Preferences & work style
   - Press & partnerships
3. **Matching summary** (collapsed, read-only, with a "last extracted" timestamp)
4. **Audit trail** — small footer showing when each section was last updated and by whom

Fields that are opt-in sensitive (ethnicity, LGBTQ+, disability, religion) are visibly labeled as such and default to blank.

### Why this is cheap to build

- No new infrastructure (same Next.js app, same Prisma, same database, same Vercel deploy)
- Forms are the simplest thing a web app does
- Slack OAuth is well-documented and free
- 100 fields is a lot to display but not a lot to build — it's just repetitive form fields
- No need for a separate API layer — server actions or direct Prisma calls work fine

**Rough estimate:** a working v1 could ship in a few days of focused work. Polish (nicer UI, better field grouping, audit trail) adds another day or two.

---

## Migration path — how we roll this out

This is the practical question: we have ~16 existing partner profiles today. How do we get from "everything is in the dossier summary" to "fields are structured and auditable"?

### Step 1 — Schema + extraction prompt update (one-time)

1. Add all Tier 1 and Tier 2 fields to `PartnerProfile` with defaults of `null` / `not_specified` / empty arrays. Migration is additive, no data loss.
2. Update the dossier extraction prompt to explicitly ask for every dossier-extractable field. Null if not found.
3. Update the matching prompt to use the new structured fields as hard-rejection rules.

### Step 2 — Re-extract all existing dossiers

Run `/partner sync all` (the GitHub Action already exists). Every partner profile gets re-extracted with the updated prompt, populating all dossier-extractable fields automatically.

This gives us an immediate baseline of ~45 populated fields per partner, zero human effort.

### Step 3 — Ship the profile editor

Strategists log in, see their partners, see which fields are blank, and fill them in over time. No deadline. The system keeps matching with whatever data exists; more data means better matches.

### Step 4 — Behavioral fields over time

Once the structured fields are in place and stable, add the Tier 4 behavioral fields that compute from reaction data. No human input; the system just starts learning from observed behavior.

---

## What to brief Cara on

Two documents, shared async:

1. **This proposal** (the schema expansion) — for her to review, push back on, and approve field by field if she wants
2. **A sample profile editor wireframe** (to be built) showing what the editor would look like — so the abstract becomes concrete

Frame it this way:

> "The matcher is guessing at facts that should be explicit. Here's the list of facts we'd make explicit, the dossier extraction handles about half of them automatically, and a lightweight profile editor handles the other half. Strategists get a real interface for maintaining their clients' profiles. You get a system where bad matches become structurally impossible instead of caught after the fact. The work is additive — nothing breaks, everything gets better."

---

## What we're NOT committing to in this document

- A specific UI design beyond the principles above
- A timeline (this is proposal, not schedule)
- Deprecating `matchingNotes` (that's a separate decision tied to the feedback brief)
- Building the editor before the schema is agreed on

These all come after Cara signs off on the field list.
