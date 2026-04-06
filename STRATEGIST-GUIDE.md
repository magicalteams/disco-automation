# How to Use Your Weekly Opportunity Matches

Every Monday, your client channel will receive a message when new opportunity matches are available. Here's how to review them and track your progress.

## Reading the Matches

The parent message in your channel tells you how many matches were found. Open the thread to see each match individually.

Each thread reply contains:
- The opportunity name, category, and confidence score
- **Why it matched** — a rationale explaining the connection to your client
- **Client Language** — a shareable excerpt you can customize and send to the client
- **Draft outreach email** (for strong matches) — a full email ready to edit and send

## Tracking With Emoji Reactions

React to each match in the thread to track what you've done with it. The system records your reactions automatically.

| Emoji | What it means |
|-------|--------------|
| ✅ | **Shared** — You shared this opportunity with the client |
| 👀 | **Reviewing** — You're looking into this one |
| ❌ | **Skipped** — Not relevant for this client |

Just click the emoji reaction on the specific thread reply. If you change your mind, remove the reaction and add a different one — the status updates automatically.

You don't have to react to every match. Unreacted matches stay as "pending."

## Improving Future Matches

If you notice patterns in what's relevant (or not) for your client, you can set matching notes that influence future results.

**Add or update notes for a client:**
```
/partner note [client name] [your notes]
```

**Examples:**
```
/partner note Erin Cunningham Based in Vermont, remote only. Not interested in tool-specific discounts.
/partner note Henry Fields Male. Do not match to women-only opportunities. Focus on speaking and editorial.
/partner note Amanda Aldinger Actively looking for podcast guest opportunities and editorial roles.
```

**View a client's current notes:**
```
/partner note [client name]
```

Notes replace (not append) each time, so include everything you want the system to know. These notes are passed directly to the matching engine and take effect on the next run.

## Excluding Recurring Opportunities

Some opportunities appear in every newsletter and match too broadly (e.g., a job board that isn't relevant for client matching). You can exclude them globally.

**Exclude an opportunity by title:**
```
/partner exclude Magical Match
```

**Remove an exclusion:**
```
/partner exclude remove Magical Match
```

**See all current exclusions:**
```
/partner exclusions
```

Excluded opportunities are filtered out before matching runs — they won't appear for any client.

## Checking Status at a Glance

To see a summary of all matches for the week and their current status:

```
/match status
```

This shows every match grouped by partner, with an emoji indicating what's been done:
- :white_circle: Pending — no one has reacted yet
- :eyes: Reviewing — someone is looking into it
- :white_check_mark: Shared — sent to the client
- :x: Skipped — not relevant

Anyone on the team can run this at any time to see where things stand.

## Other Useful Commands

| Command | What it does |
|---------|-------------|
| `/match status` | See all matches for the week and their reaction status |
| `/partner list` | Show all clients and their mapped Slack channels |
| `/partner set-channel [name] [#channel]` | Map a client to a Slack channel |
| `/match` | Manually trigger matching (if you don't want to wait for Monday) |
| `/match reset` | Clear this week's matches so you can re-run `/match` |
| `/disco` | Browse recent discovery call transcripts for intro matching |

## Quick Reference

**Every Monday:**
1. Check your client channel for the match notification
2. Open the thread to review each match
3. React with ✅ 👀 or ❌ to track your progress
4. Customize and send any drafts that look good (after Strategist review)

**Ongoing:**
- Use `/partner note` to refine what gets matched for your client
- Use `/partner exclude` to remove noisy recurring opportunities
- Type `/match status` to see what's been acted on across all partners
