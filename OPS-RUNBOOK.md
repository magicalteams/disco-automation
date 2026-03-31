# Disco Automation — Operations Runbook

This is the admin guide for running the weekly matching automation and disco matching system.

## Quick Reference

| Task | When | Who |
|------|------|-----|
| Create partner dossiers | When new partners onboard (1-3/month) | Admin |
| Newsletter ingestion | Runs automatically Monday 11 AM UTC | Automated |
| Review opportunity sheet | Monday between 2-5 PM UTC (after Slack reminder) | Admin or team |
| Weekly matching | Runs automatically Monday 5 PM UTC | Automated |
| Review match drafts | After matching posts to Slack | Admin + Strategist |
| Disco matching | After any discovery call (1-3/month) | Admin (via `/disco` in Slack) |

---

## 1. Creating Partner Dossiers

Every client partner needs a dossier before they can be matched against opportunities. Currently 3 dossiers exist; the rest need to be created.

### How to Create a Dossier

1. Gather source materials for the partner:
   - LinkedIn profile PDF
   - Recent LinkedIn posts/activity
   - Resume/CV if available
   - Company profile information
   - Meeting transcripts (from Fireflies) where they've spoken
   - Any published articles, blog posts, or portfolio work

2. Open Claude (claude.ai) and upload the gathered materials

3. Use the dossier creation prompt from `dossier-creation-prompt.md` in this repo:
   - Replace `[SUBJECT NAME]` with the partner's full name
   - Replace `[LENGTH]` with 15-25 pages (typical range)

4. Review the generated dossier for accuracy

5. Save the dossier as a Google Doc in the **Client Dossiers** folder on the Shared Drive, OR upload as a `.docx` file to the same folder

6. The next time the batch import runs (or you can trigger it manually), the dossier will be extracted and loaded into the matching database

---

## 2. Weekly Newsletter Process

Each Monday, newsletter opportunities are automatically ingested from the Business Village LinkedIn newsletter and matched against partner profiles.

### Step 1: Newsletter Ingestion (Automated — Monday 11 AM UTC)

The system automatically:
1. Fetches the latest Business Village newsletter via RSS from LinkedIn
2. Extracts the issue number and publish date
3. Runs Claude extraction to parse each opportunity (title, category, dates, contact info)
4. Saves opportunities to the database
5. Pushes them to the Google Sheet for review
6. Posts a Slack confirmation (or error alert if something goes wrong)

### Step 2: Review Opportunities (Monday 2-5 PM UTC)

At 2 PM UTC Monday, a Slack reminder will be posted with a link to the Google Sheet. Before 5 PM UTC:

1. Open the Opportunities Sheet (link is in the Slack message)
2. Scan the **Status** column — every new opportunity defaults to `active`
3. Change any stale, irrelevant, or past-due opportunities to `expired`
4. Flag anything you're unsure about as `needs_review` (it will be skipped)
5. Don't touch any other columns — they're auto-populated

If you don't change anything, all opportunities will be matched as-is.

### Step 3: Matching Runs Automatically (Monday 5 PM UTC)

The system will:
1. Sync any status changes you made in the sheet
2. Auto-expire any opportunities past their deadline
3. Match all `active` opportunities against every partner profile
4. Post results to Slack, grouped by partner

The Slack output for each partner includes:
- Matching opportunities with confidence scores and rationale
- Pod language (internal shorthand) and client language (shareable excerpt)
- For high-confidence matches (0.7+): a **draft outreach email** ready to customize and send to the client partner
- A review footer reminding you to get Strategist sign-off before sending

No action needed until you see the results — then review drafts and submit for approval (see Review Process below).

### Manual Trigger (if needed)

To run matching outside the cron schedule, use the Slack slash command:

```
/match           — Run matching for this week (posts results to channel)
/match dry-run   — Preview matches without writing to DB or posting
```

See **Section 5: Slack Commands** for full details.

---

## 3. Disco Matching (Post-Call)

After a discovery call, the system can analyze the Fireflies transcript and match the person's needs against active opportunities, and their offers against existing partners.

### How to Run Disco Matching

1. In Slack, type `/disco` to see recent meetings:

```
/disco              — List recent meetings from Fireflies
/disco Jane         — Search meetings by name or title
/disco [id]         — Process a specific transcript
```

2. Find the meeting you want, then run `/disco [id]` with the transcript ID shown in the list.

3. The system will process the transcript and post results to the channel.

The Slack output will show:
- What the person needs, matched to relevant opportunities
- What the person offers, matched to partners who'd benefit from an intro
- For high-confidence intro matches (0.7+): a **double-sided intro email** addressing both parties, explaining the connection, ready to customize and send
- An intro-worthiness assessment
- A review footer reminding you to get Strategist sign-off before sending

---

## 4. Review Process

All match outputs (weekly and disco) include draft emails. These are drafts — do not send without a review pass.

1. Check the Slack output after matching runs
2. Review each draft email for accuracy and tone — customize as needed
3. Tag your Strategist/pod lead for sign-off (the Slack message includes a review reminder)
4. Only send after a Strategist has reviewed

---

## 5. Slack Commands

All manual operations are available as Slack slash commands. No terminal or API keys needed.

### `/disco` — Process a Discovery Call

| Usage | What it does |
|-------|-------------|
| `/disco` | List the 10 most recent Fireflies meetings |
| `/disco Jane` | Search meetings by participant name or title |
| `/disco abc123def456` | Process a specific transcript and post matches |

After processing, the full match output (needs, offers, intros, draft emails) appears in the channel.

### `/match` — Run Weekly Matching

| Usage | What it does |
|-------|-------------|
| `/match` | Run matching for the current week (live — writes to DB, posts to channel) |
| `/match dry-run` | Preview matches without writing to DB or posting to channel |
| `/match reset` | Delete this week's match run so you can re-run `/match` |

Before matching, the system automatically syncs any status changes from the Google Sheet and auto-expires past-due opportunities.

### `/ingest` — Ingest Newsletter

| Usage | What it does |
|-------|-------------|
| `/ingest` | Fetch the latest newsletter from RSS and extract opportunities |

Use this if the Monday 11 AM automated ingestion failed, or if you need to re-trigger ingestion for any reason. If the newsletter was already ingested, it will tell you.

### `/partner` — Manage Partner Channel Mappings

| Usage | What it does |
|-------|-------------|
| `/partner list` | Show all partners and their mapped Slack channels |
| `/partner set-channel [name] [#channel]` | Map a partner to their dedicated Slack channel |

Weekly matches for each partner are posted to their mapped channel. Partners without a channel configured fall back to the default `SLACK_CHANNEL_MATCHES` channel.

Example: `/partner set-channel Amanda Antonym #client-amanda`

---

## 6. Slack App Setup (One-Time)

These steps configure the slash commands in your Slack workspace. You only need to do this once (or when adding the app to a new workspace).

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and select your app (or create one)
2. Under **Slash Commands**, add four commands — all pointing to the same URL:

| Command | Request URL | Description |
|---------|------------|-------------|
| `/disco` | `https://[VERCEL_URL]/api/slack/commands` | Process a discovery call for matching |
| `/match` | `https://[VERCEL_URL]/api/slack/commands` | Run weekly opportunity matching |
| `/ingest` | `https://[VERCEL_URL]/api/slack/commands` | Ingest this week's newsletter from RSS |
| `/partner` | `https://[VERCEL_URL]/api/slack/commands` | Manage partner channel mappings |

Replace `[VERCEL_URL]` with your Vercel deployment URL (e.g. `disco-automation.vercel.app`).

3. Under **OAuth & Permissions**, ensure these scopes are added:
   - `commands` — lets the app receive slash commands
   - `chat:write` — lets the app post match results to the channel

4. Under **Basic Information → App Credentials**, copy the **Signing Secret** and set it as `SLACK_SIGNING_SECRET` in Vercel (Settings → Environment Variables).

5. Reinstall the app to the workspace if you changed scopes.

---

## 7. Troubleshooting

### Slash commands return "dispatch_failed" or 401

The `SLACK_SIGNING_SECRET` environment variable is missing or incorrect in Vercel. Go to your Vercel project → Settings → Environment Variables and confirm it matches the Signing Secret from your Slack app's Basic Information page. Redeploy after updating.

### Prisma error: "prepared statement s0 already exists"

Your `DATABASE_URL` is missing the `?pgbouncer=true` parameter. Supabase's pooled connection (port 6543) requires this. Update the env var in Vercel to include it:

```
postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true
```

### `/match` says "Match run already completed"

A match run already exists for this week. Reset it first:

```
/match reset
```

Then run `/match` again.

### Matching times out (Vercel 60s limit)

The Vercel Hobby plan has a hard 60-second function timeout. The system uses Claude Haiku (fastest model) to stay within this budget. If you're hitting timeouts consistently, check:
- Whether the number of opportunities or partners has grown significantly
- Vercel runtime logs for timing details

### Newsletter ingestion says "already extracted"

This is normal — the newsletter was already processed for this week. The system deduplicates by issue number. If you need to re-extract, delete the existing newsletter record from the database first.

---

## 8. API Endpoints Reference

All non-cron endpoints require `Authorization: Bearer [API_KEY]` header.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/slack/commands` | POST | Slack slash commands (`/disco`, `/match`, `/ingest`, `/partner`) |
| `/api/cron/newsletter-ingest` | GET | Auto-ingest newsletter from LinkedIn RSS (cron) |
| `/api/cron/sheet-reminder` | GET | Post Google Sheet review reminder to Slack (cron) |
| `/api/cron/weekly-match` | GET | Run weekly matching (cron) |
| `/api/extract/newsletter` | POST | Extract opportunities from newsletter (manual fallback) |
| `/api/ingest/dossiers` | POST | Import a partner dossier |
| `/api/match/weekly` | POST | Trigger weekly matching |
| `/api/match/disco` | POST | Process a Fireflies transcript |
| `/api/match/reset` | POST | Reset a match run for re-processing |
| `/api/match/review` | POST | Review match results |
| `/api/meetings/recent` | GET | List recent Fireflies meetings |

---

## 9. Environment

### Key Variables

- **`API_KEY`**: Bearer token for non-cron API endpoints
- **`SLACK_BOT_TOKEN`**: Slack bot token for posting messages
- **`SLACK_CHANNEL_MATCHES`**: Channel ID where match results are posted
- **`SLACK_SIGNING_SECRET`**: Signing secret for slash command verification (Slack app → Basic Information → App Credentials)
- **`SLACK_REVIEW_TAG`** (optional): Slack user or group mention (e.g. `<@U12345>`) to tag on every match output. If not set, a generic "Tag your Strategist" reminder appears.
- **`DATABASE_URL`**: Supabase pooled connection string — must include `?pgbouncer=true` (port 6543)
- **`CRON_SECRET`**: Shared secret for authenticating Vercel cron requests
- **`RSS_FEED_URL`** (optional): Override the default newsletter RSS feed URL
- **`ANTHROPIC_API_KEY`**: Claude API key for AI-powered extraction and matching

### Cron Schedule

All crons run on Mondays. Configured in `vercel.json`.

| Cron | Schedule | Path |
|------|----------|------|
| Newsletter ingest | Monday 11:00 UTC | `/api/cron/newsletter-ingest` |
| Sheet review reminder | Monday 14:00 UTC | `/api/cron/sheet-reminder` |
| Weekly matching | Monday 17:00 UTC | `/api/cron/weekly-match` |

### External Services

- **Google Sheet**: Opportunity review sheet (linked in the Monday Slack reminder)
- **Vercel**: Hosting — Hobby plan (60s function timeout)
- **Supabase**: PostgreSQL database (pooled connection via PgBouncer)
- **Fireflies.ai**: Meeting transcription for disco matching
- **Anthropic Claude**: AI extraction and matching (Haiku model for speed)
