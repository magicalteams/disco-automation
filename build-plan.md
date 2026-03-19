# Antonym Intelligence Layer — Revised Build Plan v2

## Context

The Antonym sales team has standalone tools (dossier creation prompt, newsletter extraction via Claude Project, post-meeting workflow via Fireflies) that aren't connected. Manually matching 25-50 client partner profiles against ~14 weekly newsletter opportunities doesn't scale. This build creates an automated matching engine that reads both data sources, evaluates relevance via Claude, and delivers actionable recommendations to Slack.

---

## Architecture

```
                         DATA SOURCES
  ┌──────────────────┬──────────────────┬─────────────────┐
  │ Google Drive      │ Newsletter       │ Fireflies.ai    │
  │ (.docx dossiers)  │ (markdown)       │ (transcripts)   │
  │ + Manual paste    │                  │                 │
  └────────┬─────────┴────────┬─────────┴───────┬─────────┘
           │                  │                  │
           ▼                  ▼                  ▼
  ┌──────────────────────────────────────────────────────────┐
  │  NEXT.JS API ROUTES                                      │
  │                                                          │
  │  POST /api/ingest/dossiers    Opus extraction → profile  │
  │  POST /api/extract/newsletter Sonnet extraction → opptys │
  │  GET  /api/cron/weekly-match  Batch matching → Slack     │
  │  POST /api/match/disco         Disco matching → Slack     │
  │  GET  /api/meetings/recent     Browse Fireflies meetings  │
  └────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────┐
  │  SUPABASE POSTGRES (6 tables)                            │
  │  partner_profiles | newsletter_opportunities             │
  │  match_results    | match_runs                           │
  │  processed_meetings | disco_match_results (Phase 2)      │
  └────────────────────┬─────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
  ┌──────────────────┐   ┌──────────────────┐
  │ Slack             │   │ Google Sheet      │
  │ #opportunity-     │   │ (status override  │
  │  matches          │   │  layer only)      │
  └──────────────────┘   └──────────────────┘
```

---

## Phase 1A: End-to-End Proof of Life (Days 1-4)

**Goal:** One newsletter matched against 3-5 manually seeded partner profiles, results posted to Slack.

| Day | Task | Files |
|-----|------|-------|
| 1 | Project scaffold (Next.js 15, TS strict, Prisma, Supabase) | `package.json`, `tsconfig.json`, `prisma/schema.prisma` |
| 1 | DB schema + migration (4 tables: profiles, opportunities, results, runs) | `prisma/schema.prisma`, `prisma/migrations/` |
| 1 | Manually seed 3-5 partner profiles as JSON fixtures | `scripts/seed-demo.ts` |
| 2 | Newsletter extraction endpoint — accepts markdown, returns structured opportunities | `src/app/api/extract/newsletter/route.ts`, `src/lib/prompts/extract-newsletter.ts` |
| 2 | Date classification utility (confirmed/inferred/unknown + auto-expiry) | `src/lib/utils/date-classifier.ts` |
| 2 | Feed Issue #44 through the extraction endpoint | Manual test |
| 3 | Batch matching engine — 1 Claude call per opportunity with ALL profiles in context | `src/lib/matching/engine.ts`, `src/lib/prompts/match-opportunities.ts` |
| 3 | Slack output — Block Kit formatter + posting | `src/lib/slack/formatter.ts`, `src/lib/clients/slack.ts` |
| 4 | Wire end-to-end, test, fix issues | All routes |

**Deliverable:** Working pipeline: newsletter markdown in → matching → Slack output. Data partially seeded but core logic is real.

---

## Phase 1B: Production Data Pipelines (Days 5-9)

**Goal:** Replace seeded data with real profiles. All 25-50 dossiers extracted and stored.

**Status:** Phase 1A is complete (all core logic built, compiles, 5 demo profiles seeded). Phase 1B builds the production ingestion infrastructure.

### What's already done (from Phase 1A)

These were built ahead of schedule during Phase 1A scaffolding:
- `src/lib/clients/anthropic.ts` — Claude API wrapper with retry/backoff (Opus + Sonnet)
- `src/lib/prompts/extract-profile.ts` — Dossier extraction prompt (outputs structured JSON + matchingSummary)
- `src/app/api/ingest/dossiers/route.ts` — Manual paste endpoint (paste mode only)
- `src/schemas/partner-profile.ts` — Zod validation schema
- Dependencies installed: `mammoth`, `googleapis`, `tsx` all in package.json

### What needs to be built

**New files (4):**

| File | Purpose |
|------|---------|
| `src/lib/utils/docx-parser.ts` | Mammoth wrapper: Buffer → plain text |
| `src/lib/clients/google-drive.ts` | Drive API client: service account auth, list files, download .docx |
| `src/lib/ingest/extract-and-upsert.ts` | Shared extraction pipeline (used by both API route + CLI script) |
| `scripts/import-dossiers.ts` | CLI batch import script for all Drive dossiers |

**Modified files (2):**

| File | Change |
|------|--------|
| `src/app/api/ingest/dossiers/route.ts` | Replace inline logic with shared function; add `mode: "drive"` support |
| `package.json` | Add `"import:dossiers"` npm script |

### Key architectural decision: CLI script for batch, API for singles

Vercel serverless functions timeout at 60s (Pro) / 300s (streaming). Processing 25-50 dossiers at ~15-30s each per Claude Opus call = 12-25 min total. **Batch import must be a CLI script**, not an API route.

- **`scripts/import-dossiers.ts`** — Runs locally via `npm run import:dossiers`. Sequential processing with 2s delay. No timeout constraint. Reports progress per file + summary. Idempotent (re-running updates existing profiles via upsert).
- **API route** — Handles single-file operations: `{ mode: "paste", rawText, name, company }` (existing) or `{ mode: "drive", fileId }` (new, for incremental additions).

### Implementation detail: shared extraction function

`src/lib/ingest/extract-and-upsert.ts` extracts the common pipeline used by both the API route and CLI script:

```
extractAndUpsertProfile(rawText, { sourceType, sourceReference })
  → buildDossierExtractionPrompt(rawText)
  → callClaude(prompt, { model: "opus" })
  → JSON.parse + strip markdown fences
  → PartnerProfileSchema.parse(json)
  → prisma.partnerProfile.upsert({ where: { name_company } })
  → returns { profile: { id, name, company }, extracted, isNew }
```

### Implementation detail: Google Drive client

`src/lib/clients/google-drive.ts`:
- Auth: `google.auth.GoogleAuth` with service account credentials from `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` env vars
- `listDossierFiles(folderId)` — queries `.docx` files, handles pagination, returns `{ fileId, name }[]`
- `downloadFile(fileId)` — downloads as Buffer via `alt: "media"` + `responseType: "arraybuffer"`

### Implementation detail: updated API route

`src/app/api/ingest/dossiers/route.ts` uses Zod discriminated union:
- `{ mode: "paste", rawText, name, company }` → calls `extractAndUpsertProfile(rawText, ...)`
- `{ mode: "drive", fileId }` → `downloadFile(fileId)` → `parseDocxToText(buffer)` → `extractAndUpsertProfile(rawText, ...)`
- Backward compatible: if `mode` is absent and `rawText` exists, defaults to paste mode

### Build order (dependency chain)

1. `docx-parser.ts` — no deps on new files
2. `google-drive.ts` — no deps on new files
3. `extract-and-upsert.ts` — deps on existing modules only (refactor from route)
4. `route.ts` (modify) — deps on steps 1-3
5. `import-dossiers.ts` — deps on steps 1-3
6. `package.json` (modify) — add npm script

Steps 1 and 2 are parallel. Steps 4 and 5 are parallel (both depend on 1-3).

### Verification

1. **Docx parser:** Parse a known .docx → verify text output is non-empty and readable
2. **Drive client:** `IMPORT_DRY_RUN=true npm run import:dossiers` → lists files without processing
3. **Single file via API:** `POST /api/ingest/dossiers { mode: "drive", fileId: "..." }` → verify profile created
4. **Paste backward compat:** `POST /api/ingest/dossiers { rawText: "...", name: "...", company: "..." }` → still works
5. **Full batch import:** `npm run import:dossiers` → all 25-50 profiles loaded, summary printed
6. **Idempotency:** Run import again → all show "UPDATED", DB count unchanged
7. **Re-run matching:** `POST /api/match/weekly` with full partner set → compare quality to demo run

**Deliverable:** All 25-50 partner profiles extracted and stored. Both ingestion paths (Drive batch + text paste) working. Matching re-validated with full data.

---

## Phase 1C: Automation + Human Review Loop (Days 10-13)

**Goal:** Automate the weekly cycle. Add Google Sheet status review. Configure dual cron (reminder + match).

**Status:** Phases 1A-1B complete. Idempotency already implemented in `engine.ts` (lines 20-26, checks `match_runs` table). Vercel cron already configured at 5PM UTC Monday. `GOOGLE_SHEET_OPPORTUNITIES_ID` already in `.env.example`.

### What's already done

- `vercel.json` — cron at `0 17 * * 1` (5PM UTC Monday)
- `src/app/api/cron/weekly-match/route.ts` — cron route with secret auth
- `src/lib/matching/engine.ts` — idempotency via `match_runs` table
- `src/lib/slack/formatter.ts` — `postSlackMessage()` function
- `.env.example` — `GOOGLE_SHEET_OPPORTUNITIES_ID` placeholder

### What needs to be built

**New files (2):**

| File | Purpose |
|------|---------|
| `src/lib/clients/google-sheets.ts` | Sheets API client: read/write, same service account auth as Drive client |
| `src/app/api/cron/sheet-reminder/route.ts` | Monday morning Slack reminder cron route |

**Modified files (4):**

| File | Change |
|------|--------|
| `src/app/api/extract/newsletter/route.ts` | After extraction, auto-push opportunity rows to Google Sheet |
| `src/app/api/cron/weekly-match/route.ts` | Before matching, sync Sheet status overrides to DB |
| `src/lib/slack/formatter.ts` | Add `formatSheetReminder()` function |
| `vercel.json` | Add second cron for Monday morning reminder |

### Architecture: Sheet as bidirectional sync layer

The Google Sheet serves as the human review interface. Data flows both ways:

```
WRITE (after extraction):
  Newsletter extraction → DB → auto-push summary rows to Sheet
  (columns: ID, Title, Category, Date Info, Status, Notes)

READ (before matching):
  Cron reads Sheet "Status" column → updates DB opportunity statuses → matching engine queries DB
```

This means the human's only job is scanning the Sheet and flipping Status values. The system populates everything else.

### Google Sheets client design

`src/lib/clients/google-sheets.ts`:
- Auth: same service account pattern as `google-drive.ts` (reuse `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`)
- Scope: `spreadsheets` (read/write — NOT readonly)
- Sheet ID from `GOOGLE_SHEET_OPPORTUNITIES_ID` env var

Two exported functions:

**`pushOpportunitiesToSheet(opportunities)`**
- Appends rows to the "Opportunities" tab
- Columns: `ID | Week | Title | Category | Date Info | Status | Notes`
- Called by newsletter extraction route after writing to DB
- Idempotent: clears existing rows for the same week before writing (prevents duplicates on re-extraction)

**`fetchStatusOverrides(weekIdentifier)`**
- Reads all rows from the "Opportunities" tab
- Filters to rows matching the weekIdentifier
- Returns `{ opportunityId, status }[]` for any row where Status differs from "active"
- Called by cron route before matching

### Cron architecture: two separate jobs

| Cron | Schedule | Route | Purpose |
|------|----------|-------|---------|
| Reminder | `0 14 * * 1` (2PM UTC Mon) | `GET /api/cron/sheet-reminder` | Posts Slack reminder with Sheet link |
| Match | `0 17 * * 1` (5PM UTC Mon) | `GET /api/cron/weekly-match` | Syncs Sheet → runs matching → posts results |

3-hour gap gives the team time to review the Sheet after the reminder.

### Sheet override integration into matching

Approach: update DB statuses from Sheet BEFORE the matching engine runs. This way the existing `where: { status: "active" }` query in `engine.ts` (line 29-34) works without modification.

In the cron route (`weekly-match/route.ts`), before `runWeeklyMatching()`:
```
1. fetchStatusOverrides(weekIdentifier)
2. For each override: prisma.newsletterOpportunity.update({ status })
3. Auto-expire opportunities past defaultExpiry
4. runWeeklyMatching(weekIdentifier) — existing logic, unchanged
```

The matching engine itself does NOT change — the DB is updated upstream.

### Slack reminder format

`formatSheetReminder()` returns KnownBlock[] with:
- Header: "Review Newsletter Opportunities"
- Context: "Weekly matching runs at 5PM UTC. Please review opportunity statuses before then."
- Section: Direct link to Google Sheet
- Section: Status legend — `active` (included in matching), `expired` (skipped), `needs_review` (skipped, flagged for follow-up)
- Section: Count of opportunities awaiting review for the current week

### Auto-expiry logic

Added to the cron route before matching:
```sql
UPDATE newsletter_opportunities
SET status = 'expired'
WHERE status = 'active'
AND default_expiry < NOW()
```

This handles evergreen opportunities that have aged past their 4-week TTL without requiring human intervention.

### Build order

1. `google-sheets.ts` — new client (no deps on other new files)
2. `formatter.ts` — add `formatSheetReminder()` (no deps on new files)
3. `extract/newsletter/route.ts` — add Sheet push after extraction (deps on step 1)
4. `cron/sheet-reminder/route.ts` — new reminder route (deps on steps 1-2)
5. `cron/weekly-match/route.ts` — add Sheet sync before matching (deps on step 1)
6. `vercel.json` — add second cron entry

### Verification

1. **Sheet push**: POST newsletter extraction → verify rows appear in Google Sheet with correct columns
2. **Sheet read**: Manually change a status in Sheet → call `fetchStatusOverrides()` → verify override returned
3. **Auto-expiry**: Create opportunity with past `defaultExpiry` → run cron → verify status flipped to "expired"
4. **Reminder cron**: `GET /api/cron/sheet-reminder` → verify Slack message with Sheet link and opportunity count
5. **Full Monday workflow**: Extract newsletter → push to Sheet → manually review → trigger reminder → trigger match → verify Slack output respects status overrides
6. **Idempotency**: Trigger match cron twice → second run blocked (existing behavior, unchanged)

**Deliverable:** Fully automated weekly cycle with human review layer. Two cron jobs (reminder + match). Sheet auto-populated on extraction, statuses synced before matching.

---

## Phase 1D: Validation & Tuning (Weeks 4-5, ~2 active dev days)

Run 2-3 live weekly cycles. Collect pod feedback on match quality and language tone. Tune confidence threshold (starting at 0.6), adjust prompts, calibrate output density.

---

## Phase 2: Disco Matching (Weeks 6-8, ~6-7 dev days)

**Goal:** After any client call, the team can trigger transcript analysis that surfaces (a) which newsletter opportunities match this person's needs and (b) which existing partners would benefit from an intro to this person.

**Trigger model:** Manual only. Team calls `POST /api/match/disco` with a Fireflies transcript ID after reviewing a call they want to process. No webhook, no auto-processing — the team controls which calls are worth matching.

### Phase 2A: Fireflies Client + Data Model (Days 1-2)

**New files (3):**

| File | Purpose |
|------|---------|
| `src/lib/clients/fireflies.ts` | GraphQL client: auth, get transcript, get summary, list recent meetings |
| `src/schemas/disco-transcript.ts` | Zod schemas for extracted transcript data (needs, offers, intro-worthiness) |
| `prisma/migrations/1_disco_matching/migration.sql` | New tables: `processed_meetings`, `disco_match_results` |

**Prisma schema additions (2 new tables):**

`ProcessedMeeting`:
- id, firefliesTranscriptId (unique), meetingTitle, meetingDate, participants (String[])
- transcriptText (full text for audit), extractedData (JSON — needs/offers/intro-worthiness)
- status ("processing" | "completed" | "failed"), errorMessage?
- model (which Claude model was used), processedAt, createdAt, updatedAt

`DiscoMatchResult`:
- id, processedMeetingId (FK), direction ("need_to_opportunity" | "offer_to_partner")
- sourceStatement (the need or offer being matched), targetId (opportunityId or partnerId)
- confidenceScore (0.0-1.0), rationale, clientFacingLanguage
- createdAt

**Key decision: Separate tables, not reusing MatchResult/MatchRun.** Weekly matching and disco matching have different shapes (weekly is opportunity-centric with matchRunId; disco is meeting-centric with bidirectional results). Separate tables avoid nullable FK confusion and keep queries clean.

**Fireflies GraphQL client design (`src/lib/clients/fireflies.ts`):**
- Auth: Bearer token from `FIREFLIES_API_KEY` env var
- Endpoint: `https://api.fireflies.ai/graphql`
- Singleton pattern (same as google-drive.ts)
- Retry/backoff logic (reuse pattern from anthropic.ts)

Three exported functions:
- `getTranscript(transcriptId)` — Full sentence-level transcript with speaker attribution + metadata
- `getTranscriptSummary(transcriptId)` — Keywords, action items, overview (for enrichment)
- `listRecentMeetings(options?)` — Recent meetings with filters (for browsing/selection UI)

### Phase 2B: Transcript Extraction Prompt (Days 2-3)

**New files (1):**

| File | Purpose |
|------|---------|
| `src/lib/prompts/extract-transcript.ts` | Claude prompt that extracts needs, offers, and intro-worthiness from transcript text |

**Extraction output schema (in `disco-transcript.ts`):**

```json
{
  "meetingContext": "string — 2-3 sentence description of what this call was about",
  "primaryPerson": {
    "name": "string",
    "company": "string | null",
    "role": "string | null"
  },
  "needs": [{
    "statement": "string — what they need, in their words or close paraphrase",
    "context": "string — surrounding context that explains urgency/specificity",
    "industries": ["string — relevant industry tags for matching"],
    "urgency": "high | medium | low"
  }],
  "offers": [{
    "statement": "string — what they offer",
    "context": "string",
    "industries": ["string"],
    "specificity": "concrete | moderate | vague"
  }],
  "introWorthiness": {
    "score": "number — 0.0-1.0",
    "rationale": "string — why this person is/isn't worth proactive intros",
    "suggestedTopics": ["string — topics that would make good intro hooks"]
  }
}
```

**Model: Claude Sonnet** (cost-efficient, transcripts are long but extraction is structured)
**Max tokens: 4096** (extraction output is structured JSON, shouldn't exceed this)

**System prompt approach:** "You extract structured intelligence from meeting transcripts for a professional services matchmaking agency. Focus on actionable business needs (problems to solve, resources sought) and offers (capabilities, services, expertise). Assess whether this person would value being introduced to others in the network."

**User prompt approach:** Meeting metadata (title, date, participants) + full transcript text + extraction instructions + JSON schema.

### Phase 2C: Disco Matching Engine (Days 3-5)

**New files (1):**

| File | Purpose |
|------|---------|
| `src/lib/matching/disco-engine.ts` | Bidirectional matching: needs → opportunities, offers → partners |

**Core function: `runDiscoMatching(processedMeetingId, options?)`**

**Algorithm:**
1. Fetch ProcessedMeeting with extractedData
2. Parse needs and offers from extractedData

**Direction 1 — Needs → Active Opportunities:**
3. Fetch all active newsletter opportunities from DB (`status: "active"`, `defaultExpiry > now`)
4. If opportunities exist: build prompt with ALL needs + ALL active opportunities in one call
5. Claude evaluates which opportunities address which needs
6. Parse response, filter by threshold (default 0.6)
7. Write DiscoMatchResult records with `direction: "need_to_opportunity"`

**Direction 2 — Offers → Partner Profiles:**
8. Fetch all partner profiles (id, name, company, matchingSummary)
9. Build prompt with ALL offers + ALL partner summaries in one call
10. Claude evaluates which partners would benefit from an intro to this person
11. Parse response, filter by threshold
12. Write DiscoMatchResult records with `direction: "offer_to_partner"`

**Token budget per disco run (2 calls):**
- Needs → Opportunities: ~500 (needs) + ~4,000 (14 opportunities) + ~500 (instructions) = ~5K tokens
- Offers → Partners: ~500 (offers) + ~25,000 (50 partner summaries) + ~500 (instructions) = ~26K tokens
- **Total: ~31K tokens per meeting** (~$0.10 at Sonnet pricing)

**Options:**
- `thresholdOverride?: number` — Override confidence threshold
- `skipSlack?: boolean` — Suppress Slack notification
- `dryRun?: boolean` — Return results without DB writes or Slack

**Reuses from Phase 1:**
- `callClaude()` from `src/lib/clients/anthropic.ts`
- `prisma` client from `src/lib/clients/db.ts`
- Partner profile fetching pattern from `engine.ts`
- Active opportunity query pattern from `engine.ts` (status + expiry check)
- Threshold filtering + score distribution tracking from `engine.ts`

### Phase 2D: Disco Matching Prompts (Days 3-4)

**New files (1):**

| File | Purpose |
|------|---------|
| `src/lib/prompts/match-disco.ts` | Two prompt builders: needs→opportunities and offers→partners |

**`buildNeedsToOpportunitiesPrompt(needs, opportunities, threshold)`**

System: "You match a person's expressed needs against available newsletter opportunities. Only surface genuinely relevant matches."

User prompt structure:
- PERSON'S NEEDS block: numbered list of need statements with context, industries, urgency
- ACTIVE OPPORTUNITIES block: numbered list with title, category, description, industries, dateDisplayText, contactMethod
- Instructions: For each need, evaluate which opportunities could help. Return matches with needIndex, opportunityId, confidenceScore, rationale, clientFacingLanguage.

Output: `{ matches: [{ needIndex, opportunityId, opportunityTitle, confidenceScore, rationale, clientFacingLanguage }] }`

**`buildOffersToPartnersPrompt(offers, partners, threshold)`**

System: "You identify which partners in a professional network would benefit from being introduced to someone with specific capabilities."

User prompt structure:
- PERSON'S OFFERS block: numbered list of offer statements with context, industries, specificity
- PARTNER PROFILES block: same format as weekly matching (numbered list with matchingSummary)
- Instructions: For each offer, evaluate which partners would benefit from an intro. Consider partners' currentChallenges, idealIntroProfile, and industry alignment.

Output: `{ matches: [{ offerIndex, partnerName, confidenceScore, rationale, clientFacingLanguage }] }`

### Phase 2E: Slack Output + API Route (Days 5-6)

**Modified files (1):**

| File | Change |
|------|--------|
| `src/lib/slack/formatter.ts` | Add `formatDiscoMatchesToSlack()` function |

**New files (1):**

| File | Purpose |
|------|---------|
| `src/app/api/match/disco/route.ts` | Manual trigger endpoint for disco matching |

**`formatDiscoMatchesToSlack()` design:**

Different from weekly format because it's person-centric (not opportunity-centric) and bidirectional.

```
Header: "Disco Matches — [Meeting Title]"
Context: "[Person Name] @ [Company] | [Meeting Date]"
---
Section: "What They Need → Matching Opportunities"
  Per need with matches:
    > Need: "[statement]" (urgency: high/medium/low)
    > → [Opportunity Title] (Confidence: 0.XX)
    >   [rationale]
    >   Client language: "[clientFacingLanguage]"
  If no matches for any needs: "No current opportunities match these needs."
---
Section: "What They Offer → Partners Who'd Benefit"
  Per offer with matches:
    > Offers: "[statement]"
    > → [Partner Name / Company] (Confidence: 0.XX)
    >   [rationale]
    >   Client language: "[clientFacingLanguage]"
  If no matches for any offers: "No partner matches for these offerings."
---
Section: "Intro-Worthiness"
  Score: X.XX | [rationale]
  Suggested intro topics: [topic1, topic2, ...]
---
Summary: X need→opportunity matches, Y offer→partner matches
```

**API route: `POST /api/match/disco`**

Input body:
```json
{
  "transcriptId": "fireflies-transcript-id",
  "threshold": 0.6,
  "skipSlack": false,
  "dryRun": false
}
```

Flow:
1. Validate API key (reuse `validateApiKey` from `api-auth.ts`)
2. Check for existing ProcessedMeeting with this transcriptId (idempotency)
3. Fetch transcript from Fireflies via GraphQL client
4. Fetch summary from Fireflies (optional enrichment)
5. Create ProcessedMeeting record with status "processing"
6. Call transcript extraction prompt (Claude Sonnet)
7. Parse + validate extracted data with Zod
8. Store extractedData as JSON on ProcessedMeeting record
9. Run disco matching engine (both directions)
10. Format results to Slack and post
11. Update ProcessedMeeting status to "completed"
12. Return summary JSON

### Phase 2F: CLI Script + Listing Endpoint (Days 6-7)

**New files (2):**

| File | Purpose |
|------|---------|
| `scripts/process-meeting.ts` | CLI script to process a meeting by transcript ID |
| `src/app/api/meetings/recent/route.ts` | Lists recent Fireflies meetings for team to browse and select |

**`scripts/process-meeting.ts`:**
- Usage: `npm run disco -- --id <transcriptId> [--threshold 0.5] [--dry-run]`
- Calls the same disco engine used by the API route
- Prints formatted results to console (useful for testing without Slack)

**`GET /api/meetings/recent`:**
- Calls `listRecentMeetings()` from Fireflies client
- Returns: list of recent meetings with id, title, date, participants, duration
- Protected by `validateApiKey`
- Used by team to find transcript IDs to process

### Build order (dependency chain)

1. `prisma/schema.prisma` + migration — New tables (no deps)
2. `src/schemas/disco-transcript.ts` — Zod schemas (no deps)
3. `src/lib/clients/fireflies.ts` — GraphQL client (no deps on new files)
4. `src/lib/prompts/extract-transcript.ts` — Extraction prompt (deps on step 2)
5. `src/lib/prompts/match-disco.ts` — Matching prompts (no deps on new files)
6. `src/lib/matching/disco-engine.ts` — Engine (deps on steps 2-5)
7. `src/lib/slack/formatter.ts` — Add disco formatter (no deps on new files)
8. `src/app/api/match/disco/route.ts` — API route (deps on steps 3, 6, 7)
9. `src/app/api/meetings/recent/route.ts` — Listing endpoint (deps on step 3)
10. `scripts/process-meeting.ts` — CLI (deps on step 6)
11. `.env.example` + `package.json` — Config updates

Steps 1-3 are parallel. Steps 4-5 are parallel. Steps 8-10 are parallel.

### Modified files summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add ProcessedMeeting + DiscoMatchResult models |
| `src/lib/slack/formatter.ts` | Add `formatDiscoMatchesToSlack()` |
| `.env.example` | Add `FIREFLIES_API_KEY` |
| `package.json` | Add `"disco"` npm script |

### Verification

1. **Fireflies client:** Call `listRecentMeetings()` → verify meetings returned with titles and IDs
2. **Transcript fetch:** Call `getTranscript(id)` on a known meeting → verify sentence-level text returned
3. **Extraction prompt:** Feed real transcript through extraction → verify JSON matches Zod schema (needs, offers, intro-worthiness)
4. **Disco matching (dry-run):** `npm run disco -- --id <transcriptId> --dry-run` → verify bidirectional results printed
5. **Needs → Opportunities:** Verify need statements matched against active opportunities with relevant rationale
6. **Offers → Partners:** Verify offer statements matched against partners whose challenges/needs align
7. **Freshness check:** Ensure expired opportunities are excluded, needs_review opportunities are flagged
8. **Slack output:** Trigger non-dry-run → verify disco-formatted Slack message appears with both directions
9. **Idempotency:** Process same transcript twice → second run returns existing results without re-calling Claude
10. **API listing:** `GET /api/meetings/recent` → verify browseable list of meetings

**Deliverable:** Team can process any Fireflies transcript on-demand. Bidirectional matching surfaces both "opportunities for this person" and "partners who'd benefit from meeting this person." Results posted to Slack in a person-centric format distinct from weekly batch output.

---

## Phase 3: Nurture Automation — Deferred

Requires strategy work to define:
- What constitutes a successful introduction (metrics, feedback mechanism)
- Nurture sequence timing and channels (email, Slack, manual)
- How success/failure signals feed back into future matching quality

Phase 3 will be designed after Phase 2 is validated and the team has defined intro tracking and follow-up strategy.

---

## Core Technical Design Decisions

### Batch Matching (the key architectural change)

Instead of evaluating each (opportunity, partner) pair individually (350-700 calls), send **one opportunity + ALL partner summaries** in a single Claude call. The model evaluates relevance holistically and returns only genuine matches.

**Why this is better:**
- 14 calls/week instead of 350-700
- Model considers *relative* fit (not just absolute), producing better rankings
- ~28K tokens per call (well within Sonnet's 200K context window)
- Cheaper: ~$1.60/week vs ~$2.50/week

**Token budget per call:**
- System prompt: ~200 tokens
- Opportunity: ~300 tokens
- 50 partner `matchingSummary` fields at ~500 tokens each: ~25,000 tokens
- Instructions: ~300 tokens
- Output (5-8 matches): ~2,000 tokens
- **Total: ~28K tokens**

### The `matchingSummary` Field

Each partner profile gets a ~500-token summary generated during dossier extraction, purpose-built for matching context. It captures: what they do, who they serve, what industries, what makes them unique, what challenges they face, what opportunities they'd value. This is NOT a lossy summary — it's a matching-optimized representation. The full structured profile remains in the DB for detailed lookups.

### Newsletter Extraction (replaces external Claude Project)

`POST /api/extract/newsletter` accepts raw newsletter markdown + issue number + publish date. Claude Sonnet parses the `*the* Category` structure and extracts each opportunity with: title, description, industries, dates, confidence levels, URLs, contact methods. Date classification happens in code after extraction (not by the LLM).

### Date Handling (integrated from v1)

Three categories, handled automatically:
1. **Time-bound events** (confirmed date) → `defaultExpiry = eventDate`
2. **Rolling deadlines** (inferred date) → `defaultExpiry = deadline or eventDate`
3. **Evergreen/unknowable** → `defaultExpiry = publishDate + 4 weeks`

Cron auto-expires past `defaultExpiry`. Google Sheet provides human override for edge cases.

### Dossier Ingestion (two paths)

- **Drive import:** `POST /api/ingest/dossiers/batch` — lists .docx files, parses with mammoth, extracts via Opus
- **Manual paste:** `POST /api/ingest/dossiers/paste` — accepts raw text, same extraction prompt
- Both produce identical `PartnerProfile` records with `matchingSummary`

---

## Database Schema (6 tables, no embeddings)

**Phase 1 tables:**
- **`partner_profiles`** — id, name, company, title, industries[], servicesOffered[], targetClients, geographicFocus[], keyStrengths[], uniquePositioning, currentChallenges[], idealIntroProfile, communicationStyle, **matchingSummary**, sourceType, sourceReference, lastExtractedAt, extractionModel
- **`newsletter_opportunities`** — id (e.g. "2026-W09-001"), newsletterIssue, newsletterDate, weekIdentifier, category, title, description, industries[], relevantFor, eventDate?, deadline?, dateConfidence, dateDisplayText, defaultExpiry, status, sourceUrl?, contactMethod
- **`match_results`** — id, opportunityId, partnerId, confidenceScore, rationale, internalLanguage, clientFacingLanguage, matchRunId
- **`match_runs`** — id, weekIdentifier (unique), status, opportunityCount, matchCount, model, startedAt, completedAt?, errorMessage?

**Phase 2 tables:**
- **`processed_meetings`** — id, firefliesTranscriptId (unique), meetingTitle, meetingDate, participants[], transcriptText, extractedData (JSON — needs/offers/intro-worthiness), status, errorMessage?, model, processedAt, createdAt, updatedAt
- **`disco_match_results`** — id, processedMeetingId (FK), direction ("need_to_opportunity" | "offer_to_partner"), sourceStatement, targetId, confidenceScore, rationale, clientFacingLanguage, createdAt

---

## File Structure (~35 files)

```
antonym-intelligence/
├── src/
│   ├── app/api/
│   │   ├── extract/newsletter/route.ts
│   │   ├── ingest/dossiers/route.ts
│   │   ├── match/
│   │   │   ├── weekly/route.ts
│   │   │   ├── disco/route.ts              ← Phase 2
│   │   │   ├── review/route.ts
│   │   │   └── reset/route.ts
│   │   ├── meetings/recent/route.ts         ← Phase 2
│   │   └── cron/
│   │       ├── weekly-match/route.ts
│   │       └── sheet-reminder/route.ts
│   ├── lib/
│   │   ├── clients/
│   │   │   ├── anthropic.ts
│   │   │   ├── db.ts
│   │   │   ├── fireflies.ts                ← Phase 2
│   │   │   ├── google-drive.ts
│   │   │   ├── google-sheets.ts
│   │   │   └── slack.ts
│   │   ├── prompts/
│   │   │   ├── extract-newsletter.ts
│   │   │   ├── extract-profile.ts
│   │   │   ├── extract-transcript.ts        ← Phase 2
│   │   │   ├── match-opportunities.ts
│   │   │   └── match-disco.ts               ← Phase 2
│   │   ├── matching/
│   │   │   ├── engine.ts
│   │   │   └── disco-engine.ts              ← Phase 2
│   │   ├── ingest/extract-and-upsert.ts
│   │   ├── slack/formatter.ts
│   │   └── utils/
│   │       ├── api-auth.ts
│   │       ├── docx-parser.ts
│   │       └── date-classifier.ts
│   ├── schemas/
│   │   ├── partner-profile.ts
│   │   ├── newsletter-opportunity.ts
│   │   ├── match-result.ts
│   │   └── disco-transcript.ts              ← Phase 2
│   └── types/index.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 0_baseline/migration.sql
│       └── 1_disco_matching/migration.sql   ← Phase 2
├── scripts/
│   ├── seed-demo.ts
│   ├── import-dossiers.ts
│   └── process-meeting.ts                   ← Phase 2
├── vitest.config.ts
├── vercel.json
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Tech Stack

| Component | Choice |
|-----------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase Postgres |
| ORM | Prisma |
| Validation | Zod |
| LLM (extraction from dossiers) | Claude Opus 4.6 |
| LLM (matching + newsletter extraction) | Claude Sonnet 4.5 |
| LLM SDK | `@anthropic-ai/sdk` |
| Docx parsing | `mammoth` |
| Slack | `@slack/web-api` |
| Google APIs | `googleapis` |
| Fireflies API | GraphQL (`fetch`-based, no extra library) |
| Deploy | Vercel Pro |

**Intentionally omitted:** vector DB/embeddings (unnecessary at 50 partners), LangChain (over-abstraction), Redis/queues (14 sequential calls take ~60s), pre-filter step (batch matching eliminates need).

---

## Monthly Cost (Steady State)

| Service | Cost |
|---------|------|
| Claude Sonnet (weekly matching + newsletter extraction) | ~$7/mo |
| Claude Sonnet (disco matching) | ~$3-5/mo (30-50 calls/mo × 2 directions × ~30K tokens) |
| Claude Opus (new dossiers) | ~$3-5/mo |
| Vercel Pro | $20/mo |
| Supabase / Slack / Google / Fireflies | Free tier |
| **Total** | **~$33-37/mo** |

---

## Timeline Summary

| Phase | Calendar | Dev Days | Key Deliverable |
|-------|----------|----------|-----------------|
| 1A: Proof of Life | Week 1 | 4 | Working demo with Slack output |
| 1B: Data Pipelines | Week 2-3 | 5 | All 25-50 profiles loaded |
| 1C: Automation | Week 3-4 | 4 | Vercel cron + Sheet review loop |
| 1D: Validation | Week 4-5 | 2 | Calibrated, team-validated |
| 2: Disco Matching | Week 6-8 | 6-7 | Manual post-call recommendations |
| 3: Nurture Automation | TBD | TBD | Deferred — requires strategy work |
| **Total (Phases 1-2)** | **~8-9 weeks** | **~21-22 days** | |

---

## Verification Plan

After each phase, validate:

1. **Phase 1A (day 4):** Feed Issue #44 markdown into extraction endpoint → verify 14 structured opportunities in DB → trigger matching → verify Slack message appears in test channel with reasonable matches against seeded profiles
2. **Phase 1B (day 9):** Spot-check 5 extracted partner profiles against source dossiers for accuracy. Re-run matching with full partner set → compare match quality/count to day-4 output
3. **Phase 1C (day 13):** Simulate full Monday workflow: paste newsletter → extract → review Sheet → cron fires → Slack output arrives. Verify idempotency: trigger cron twice → second run is skipped
4. **Phase 1D (week 5):** Strategist/pod rates match relevance for 2-3 live cycles. Target: 60%+ of surfaced matches deemed "relevant"
5. **Phase 2 (day 20):** Process 3-5 real meeting transcripts → verify extraction quality (needs/offers/intro-worthiness make sense) → verify bidirectional matches are relevant → collect pod feedback on disco Slack output format and match quality
