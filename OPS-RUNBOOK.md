# Disco Automation — Operations Runbook

This is the admin guide for running the weekly matching automation and disco matching system.

## Quick Reference

| Task | When | Who |
|------|------|-----|
| Create partner dossiers | When new partners onboard (1-3/month) | Admin |
| Paste newsletter content | Monday morning (before 2 PM UTC) | Admin |
| Review opportunity sheet | Monday between 2-5 PM UTC (after Slack reminder) | Admin or team |
| Weekly matching | Runs automatically Monday 5 PM UTC | Automated |
| Disco matching | After any discovery call | Admin (triggered manually) |

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

### Manual Single-Partner Import (Alternative)

If you have the dossier text ready and want to load it immediately without saving to Drive:

```bash
curl -X POST https://[VERCEL_URL]/api/ingest/dossiers \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "paste",
    "rawText": "[paste the full dossier text here]",
    "name": "Partner Full Name",
    "company": "Company Name"
  }'
```

---

## 2. Weekly Newsletter Process

Each Monday, newsletter opportunities need to be fed into the system so they can be matched against partner profiles.

### Step 1: Extract Newsletter (Monday Morning)

1. Get this week's Business Village newsletter content from Cara (Flodesk email or LinkedIn newsletter)
2. Copy the full text content
3. Submit it to the extraction endpoint:

```bash
curl -X POST https://[VERCEL_URL]/api/extract/newsletter \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "[paste the newsletter content here]",
    "issueNumber": 45,
    "publishDate": "2026-03-24"
  }'
```

- `issueNumber`: Increment from the previous week
- `publishDate`: The Monday the newsletter was published (YYYY-MM-DD format)

The system will:
- Extract each opportunity with metadata (title, category, dates, contact info)
- Save them to the database
- Push them to the Google Sheet for review

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

No action needed — just check Slack for the results.

### Manual Trigger (if needed)

To run matching outside the cron schedule:

```bash
# Dry run (no Slack post, just see results)
curl -X POST https://[VERCEL_URL]/api/match/weekly \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Live run (posts to Slack)
curl -X POST https://[VERCEL_URL]/api/match/weekly \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 3. Disco Matching (Post-Call)

After a discovery call, the system can analyze the Fireflies transcript and match the person's needs against active opportunities, and their offers against existing partners.

### Step 1: Find the Transcript ID

List recent Fireflies meetings:

```bash
curl https://[VERCEL_URL]/api/meetings/recent \
  -H "Authorization: Bearer [API_KEY]"
```

Find the meeting and copy its transcript ID.

### Step 2: Process the Transcript

```bash
# Dry run first
curl -X POST https://[VERCEL_URL]/api/match/disco \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"transcriptId": "[TRANSCRIPT_ID]", "dryRun": true}'

# Live run (posts to Slack)
curl -X POST https://[VERCEL_URL]/api/match/disco \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"transcriptId": "[TRANSCRIPT_ID]"}'
```

The Slack output will show:
- What the person needs, matched to relevant opportunities
- What the person offers, matched to partners who'd benefit from an intro
- For high-confidence intro matches: a draft email you can customize and send
- An intro-worthiness assessment

---

## API Endpoints Reference

All non-cron endpoints require `Authorization: Bearer [API_KEY]` header.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extract/newsletter` | POST | Extract opportunities from newsletter |
| `/api/ingest/dossiers` | POST | Import a partner dossier |
| `/api/match/weekly` | POST | Trigger weekly matching |
| `/api/match/disco` | POST | Process a Fireflies transcript |
| `/api/match/reset` | POST | Reset a match run for re-processing |
| `/api/match/review` | POST | Review match results |
| `/api/meetings/recent` | GET | List recent Fireflies meetings |

## Environment

- **App URL**: Your Vercel deployment URL
- **API Key**: The `API_KEY` value from your environment variables
- **Slack Channel**: Matches are posted to the configured `SLACK_CHANNEL_MATCHES`
- **Slack Review Tag** (optional): Set `SLACK_REVIEW_TAG` to a Slack user or group mention (e.g. `<@U12345>`) to tag a reviewer on every match output. If not set, a generic "Tag your Strategist" reminder appears.
- **Google Sheet**: Opportunity review sheet (linked in the Monday Slack reminder)
