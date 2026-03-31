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
import { prisma } from "@/lib/clients/db";

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
    case "/partner":
      return handlePartner(text, responseUrl);
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

/**
 * Calendly event type names used for disco calls.
 * Meeting titles from Calendly follow the pattern "[Guest]: [Event Type] from [Org]".
 * We match on ": [event type]" to filter only disco-relevant meetings.
 *
 * Source Calendly links:
 *   calendly.com/mercedes-ballard/disco
 *   calendly.com/alex-magicalteams/meet
 *   calendly.com/csalerno/explore
 *   calendly.com/magicalteams/explore
 *   calendly.com/magicalteams/partnerships
 *   calendly.com/magicalteams/collaborations
 *   calendly.com/magicalteams/jam-with-mt
 *   calendly.com/cara-magicalteams/chat-with-cara
 */
const DISCO_EVENT_TYPES = [
  "Disco",
  "Meet",
  "Explore",
  "Partnerships",
  "Collaborations",
  "Jam with MT",
  "Chat with Cara",
];

function isDiscoMeeting(title: string): boolean {
  const lower = title.toLowerCase();
  return DISCO_EVENT_TYPES.some((eventType) =>
    lower.includes(`: ${eventType.toLowerCase()}`)
  );
}

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
    const allMeetings = await listRecentMeetings({ limit: 50 });
    const meetings = allMeetings.filter((m) => isDiscoMeeting(m.title));

    if (meetings.length === 0) {
      await respond(responseUrl, "No recent disco meetings found in Fireflies.");
      return;
    }

    const lines = meetings.slice(0, 10).map((m, i) => {
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
    const allMeetings = await listRecentMeetings({ limit: 50 });
    const discoMeetings = allMeetings.filter((m) => isDiscoMeeting(m.title));
    const q = query.toLowerCase();

    const matches = discoMeetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.participants.some((p) => p.toLowerCase().includes(q))
    );

    if (matches.length === 0) {
      await respond(
        responseUrl,
        `:mag: No disco meetings found matching "${query}". Try \`/disco\` to see all recent disco meetings.`
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
  const lower = text.toLowerCase();
  const isDryRun = lower.includes("dry-run") || lower.includes("dryrun");
  const isReset = lower === "reset";

  if (isReset) {
    return {
      ack: ":hourglass_flowing_sand: Resetting this week's match run...",
      process: () => runReset(responseUrl),
    };
  }

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

async function runReset(responseUrl: string): Promise<void> {
  try {
    const weekIdentifier = getWeekIdentifier(new Date());
    const matchRun = await prisma.matchRun.findUnique({
      where: { weekIdentifier },
    });

    if (!matchRun) {
      await respond(responseUrl, `:information_source: No match run found for ${weekIdentifier} — nothing to reset.`);
      return;
    }

    const deletedResults = await prisma.matchResult.deleteMany({
      where: { matchRunId: matchRun.id },
    });
    await prisma.matchRun.delete({ where: { id: matchRun.id } });

    await respond(
      responseUrl,
      `:white_check_mark: Reset match run for ${weekIdentifier} (was "${matchRun.status}", ${deletedResults.count} results deleted). You can now run \`/match\` again.`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Reset failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
// /partner
// ---------------------------------------------------------------------------

function handlePartner(text: string, responseUrl: string): CommandResult {
  const lower = text.trim().toLowerCase();

  if (!lower || lower === "list") {
    return {
      ack: ":mag: Fetching partner channel mappings...",
      process: () => partnerList(responseUrl),
    };
  }

  if (lower.startsWith("set-channel")) {
    return {
      ack: ":hourglass_flowing_sand: Updating partner channel...",
      process: () => partnerSetChannel(text.trim(), responseUrl),
    };
  }

  return {
    ack: `Unknown subcommand. Usage:\n\`/partner list\` — Show all partners and their channels\n\`/partner set-channel [partner name] [#channel or channel ID]\` — Map a partner to a Slack channel`,
    process: async () => {},
  };
}

async function partnerList(responseUrl: string): Promise<void> {
  try {
    const partners = await prisma.partnerProfile.findMany({
      select: { name: true, company: true, slackChannelId: true },
      orderBy: { name: "asc" },
    });

    if (partners.length === 0) {
      await respond(responseUrl, "No partner profiles found.");
      return;
    }

    const lines = partners.map((p) => {
      const channel = p.slackChannelId
        ? `<#${p.slackChannelId}>`
        : "_not set (falls back to default)_";
      return `- *${p.name}* / ${p.company} → ${channel}`;
    });

    await respond(
      responseUrl,
      `*Partner Channel Mappings*\n\n${lines.join("\n")}`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Failed to list partners: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function partnerSetChannel(
  text: string,
  responseUrl: string
): Promise<void> {
  try {
    // Parse: "set-channel Partner Name #channel" or "set-channel Partner Name C07XXXXXX"
    // Extract channel reference (last argument that looks like a channel)
    const afterSubcommand = text.replace(/^set-channel\s+/i, "").trim();
    if (!afterSubcommand) {
      await respond(
        responseUrl,
        `:warning: Usage: \`/partner set-channel [partner name] [#channel or channel ID]\``
      );
      return;
    }

    // Channel ID or <#C...> is always the last token
    const tokens = afterSubcommand.split(/\s+/);
    const lastToken = tokens[tokens.length - 1];

    // Extract channel ID from <#C07XXXXXX|channel-name> or plain C07XXXXXX
    let channelId: string | null = null;
    const slackChannelMatch = lastToken.match(/^<#(C[A-Z0-9]+)(?:\|[^>]*)?>$/);
    if (slackChannelMatch) {
      channelId = slackChannelMatch[1];
    } else if (/^C[A-Z0-9]{8,}$/.test(lastToken)) {
      channelId = lastToken;
    }

    if (!channelId) {
      await respond(
        responseUrl,
        `:warning: Could not parse a Slack channel from "${lastToken}". Use a #channel mention or a channel ID like C07XXXXXX.`
      );
      return;
    }

    // Partner name is everything before the channel token
    const partnerName = tokens.slice(0, -1).join(" ").trim();
    if (!partnerName) {
      await respond(
        responseUrl,
        `:warning: Please provide a partner name. Usage: \`/partner set-channel Amanda Antonym #client-amanda\``
      );
      return;
    }

    // Fuzzy match partner by name
    const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
    const searchName = normalize(partnerName);

    const partners = await prisma.partnerProfile.findMany({
      select: { id: true, name: true, company: true },
    });

    const partner = partners.find((p) => {
      const dbName = normalize(p.name);
      return dbName === searchName || dbName.startsWith(searchName) || searchName.startsWith(dbName);
    });

    if (!partner) {
      const available = partners.map((p) => p.name).join(", ");
      await respond(
        responseUrl,
        `:warning: No partner found matching "${partnerName}". Available: ${available}`
      );
      return;
    }

    // Update the partner's channel
    await prisma.partnerProfile.update({
      where: { id: partner.id },
      data: { slackChannelId: channelId },
    });

    await respond(
      responseUrl,
      `:white_check_mark: *${partner.name}* / ${partner.company} → <#${channelId}>. Weekly matches for this partner will now post to that channel.`
    );
  } catch (error) {
    await respond(
      responseUrl,
      `:x: Failed to set channel: ${error instanceof Error ? error.message : "Unknown error"}`
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
