import { listRecentMeetings } from "@/lib/clients/fireflies";
import {
  processAndMatchTranscript,
} from "@/lib/matching/disco-engine";
import { runWeeklyMatching } from "@/lib/matching/engine";
import { syncAndExpireOpportunities } from "@/lib/matching/pre-match-sync";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";
import { fetchLatestNewsletter } from "@/lib/clients/linkedin-rss";
import { extractNewsletter } from "@/lib/ingest/extract-newsletter";
import {
  formatDiscoMatchesToSlack,
  postSlackMessage,
} from "@/lib/slack/formatter";

interface CommandResult {
  /** Immediate acknowledgment shown to the user (ephemeral) */
  ack: string;
  /** Background processing — runs after the ack is returned */
  process: () => Promise<void>;
}

/**
 * Dispatch a Slack slash command to the appropriate handler.
 */
export function dispatch(
  command: string | null,
  text: string,
  responseUrl: string,
  _userId: string
): CommandResult {
  switch (command) {
    case "/disco":
      return handleDisco(text, responseUrl);
    case "/match":
      return handleMatch(text, responseUrl);
    case "/ingest":
      return handleIngest(responseUrl);
    default:
      return {
        ack: `Unknown command: ${command}`,
        process: async () => {},
      };
  }
}

// ---------------------------------------------------------------------------
// /disco
// ---------------------------------------------------------------------------

function handleDisco(text: string, responseUrl: string): CommandResult {
  if (!text) {
    return {
      ack: ":mag: Fetching recent meetings...",
      process: () => discoListMeetings(responseUrl),
    };
  }

  // If the argument looks like a transcript ID (long alphanumeric), process it.
  // Otherwise treat it as a search term.
  const isTranscriptId = /^[a-zA-Z0-9_-]{16,}$/.test(text);

  if (isTranscriptId) {
    return {
      ack: `:hourglass_flowing_sand: Processing transcript \`${text}\`... Results will appear in the channel when ready.`,
      process: () => discoProcessTranscript(text, responseUrl),
    };
  }

  return {
    ack: `:mag: Searching meetings for "${text}"...`,
    process: () => discoSearchMeetings(text, responseUrl),
  };
}

async function discoListMeetings(responseUrl: string): Promise<void> {
  try {
    const meetings = await listRecentMeetings({ limit: 10 });

    if (meetings.length === 0) {
      await respond(responseUrl, "No recent meetings found in Fireflies.");
      return;
    }

    const lines = meetings.map((m, i) => {
      const date = new Date(m.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const participants = m.participants.join(", ");
      return `${i + 1}. *${m.title}* (${date})\n    _${participants}_\n    \`/disco ${m.id}\``;
    });

    await respond(
      responseUrl,
      `*Recent Meetings*\nType \`/disco [id]\` to process one.\n\n${lines.join("\n\n")}`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Failed to fetch meetings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function discoSearchMeetings(
  query: string,
  responseUrl: string
): Promise<void> {
  try {
    const meetings = await listRecentMeetings({ limit: 20 });
    const q = query.toLowerCase();

    const matches = meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.participants.some((p) => p.toLowerCase().includes(q))
    );

    if (matches.length === 0) {
      await respond(
        responseUrl,
        `:mag: No meetings found matching "${query}". Try \`/disco\` to see all recent meetings.`
      );
      return;
    }

    const lines = matches.map((m, i) => {
      const date = new Date(m.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const participants = m.participants.join(", ");
      return `${i + 1}. *${m.title}* (${date})\n    _${participants}_\n    \`/disco ${m.id}\``;
    });

    await respond(
      responseUrl,
      `*Meetings matching "${query}":*\n\n${lines.join("\n\n")}`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function discoProcessTranscript(
  transcriptId: string,
  responseUrl: string
): Promise<void> {
  try {
    const summary = await processAndMatchTranscript(transcriptId);

    // Post full results to the channel (same as cron/API path)
    const blocks = formatDiscoMatchesToSlack({
      summary,
      needs: summary.extraction.needs,
      offers: summary.extraction.offers,
    });
    await postSlackMessage(blocks);

    await respond(
      responseUrl,
      `:white_check_mark: Disco matching complete for *${summary.meetingTitle}* — ${summary.needToOpportunityMatches.length} need matches, ${summary.offerToPartnerMatches.length} offer matches. Results posted to the channel.`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Disco matching failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
// /match
// ---------------------------------------------------------------------------

function handleMatch(text: string, responseUrl: string): CommandResult {
  const isDryRun = text.toLowerCase().includes("dry-run") || text.toLowerCase().includes("dryrun");

  if (isDryRun) {
    return {
      ack: ":hourglass_flowing_sand: Running matching in dry-run mode... Results will appear here when ready.",
      process: () => runMatch(responseUrl, true),
    };
  }

  return {
    ack: ":hourglass_flowing_sand: Running weekly matching... Results will appear in the channel when ready.",
    process: () => runMatch(responseUrl, false),
  };
}

async function runMatch(
  responseUrl: string,
  dryRun: boolean
): Promise<void> {
  try {
    const weekIdentifier = getWeekIdentifier(new Date());

    // Sync sheet overrides and auto-expire before matching
    const sync = await syncAndExpireOpportunities(weekIdentifier);

    const result = await runWeeklyMatching(weekIdentifier, {
      dryRun,
      skipSlack: dryRun, // Dry-run keeps results ephemeral
    });

    const syncInfo = [];
    if (sync.overrideCount > 0) syncInfo.push(`${sync.overrideCount} sheet overrides applied`);
    if (sync.expiredCount > 0) syncInfo.push(`${sync.expiredCount} auto-expired`);
    const syncNote = syncInfo.length > 0 ? ` (${syncInfo.join(", ")})` : "";

    if (dryRun) {
      const matchLines = (result.matches || []).map(
        (m) =>
          `- *${m.partnerName}* / ${m.company} \u2192 ${m.opportunityTitle} (${m.confidenceScore.toFixed(2)})`
      );

      await respond(
        responseUrl,
        `:clipboard: *Dry-run results for ${weekIdentifier}*${syncNote}\n${result.opportunitiesScanned} opportunities, ${result.matchesFound} matches, ${result.partnersMatched} partners\n\n${matchLines.length > 0 ? matchLines.join("\n") : "_No matches found._"}`
      );
    } else {
      await respond(
        responseUrl,
        `:white_check_mark: Weekly matching complete for ${weekIdentifier}${syncNote} — ${result.matchesFound} matches for ${result.partnersMatched} partners. Results posted to the channel.`
      );
    }
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Matching failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
// /ingest
// ---------------------------------------------------------------------------

function handleIngest(responseUrl: string): CommandResult {
  return {
    ack: ":hourglass_flowing_sand: Fetching newsletter from RSS and extracting opportunities...",
    process: () => runIngest(responseUrl),
  };
}

async function runIngest(responseUrl: string): Promise<void> {
  try {
    const fetchResult = await fetchLatestNewsletter();

    if (!fetchResult.found) {
      await respond(
        responseUrl,
        `:warning: No new newsletter found: ${fetchResult.reason}`
      );
      return;
    }

    const { newsletter } = fetchResult;
    const result = await extractNewsletter({
      markdown: newsletter.markdownContent,
      issueNumber: newsletter.issueNumber,
      publishDate: newsletter.publishDate,
    });

    if (result.isExisting) {
      await respond(
        responseUrl,
        `:information_source: Newsletter #${newsletter.issueNumber} was already extracted (${result.weekIdentifier}, ${result.opportunities.length} opportunities).`
      );
      return;
    }

    // Post confirmation to channel (same as cron)
    await postSlackMessage([
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *Newsletter #${newsletter.issueNumber} ingested* — ${result.opportunities.length} opportunities extracted and pushed to the review sheet.`,
        },
      },
    ]);

    await respond(
      responseUrl,
      `:white_check_mark: Newsletter #${newsletter.issueNumber} ingested — ${result.opportunities.length} opportunities extracted. Confirmation posted to the channel.`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Newsletter ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Post a follow-up message to Slack's response_url.
 * These appear as ephemeral messages visible only to the command invoker.
 */
async function respond(responseUrl: string, text: string): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "ephemeral",
      text,
    }),
  });
}
