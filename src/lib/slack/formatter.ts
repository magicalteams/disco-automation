import { WebClient, type KnownBlock } from "@slack/web-api";
import type { NewsletterOpportunity } from "@prisma/client";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL = process.env.SLACK_CHANNEL_MATCHES || "";

interface MatchData {
  opportunityId: string;
  opportunityTitle: string;
  partnerName: string;
  confidenceScore: number;
  rationale: string;
  internalLanguage: string;
  clientFacingLanguage: string;
}

interface PartnerInfo {
  name: string;
  company: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "Networking Event": "\ud83e\udd1d",
  "Angel Investment Opportunity": "\ud83d\udcb0",
  "Community Membership": "\ud83c\udf31",
  "Conference Discount": "\ud83c\udf9f\ufe0f",
  "Leadership Workshop": "\ud83c\udf93",
  "Buildathon": "\ud83d\udee0\ufe0f",
  "Editorial Role": "\u270f\ufe0f",
  "Storytelling Project": "\ud83d\udcd6",
  "Open DMs": "\ud83d\udcec",
  "Free Build Day": "\ud83d\ude80",
  "Podcast Guest Call": "\ud83c\udfa4",
  "Panel Opportunity": "\ud83d\udde3\ufe0f",
  "Speaking Call": "\ud83c\udfaa",
  "Founder Letter Request": "\u2709\ufe0f",
};

function getEmoji(category: string): string {
  return CATEGORY_EMOJI[category] || "\ud83d\udccc";
}

export function formatMatchesToSlack(
  opportunities: NewsletterOpportunity[],
  matches: MatchData[],
  allPartners: PartnerInfo[]
): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  // Header
  const firstOpp = opportunities[0];
  const issueLabel = firstOpp?.newsletterIssue || "Unknown Issue";
  const dateLabel = firstOpp?.newsletterDate
    ? new Date(firstOpp.newsletterDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Opportunity Matches — ${issueLabel} (${dateLabel})`,
    },
  });

  blocks.push({ type: "divider" });

  // Group matches by opportunity
  const matchesByOpp = new Map<string, MatchData[]>();
  for (const m of matches) {
    const existing = matchesByOpp.get(m.opportunityId) || [];
    existing.push(m);
    matchesByOpp.set(m.opportunityId, existing);
  }

  const matchedPartnerNames = new Set<string>();
  const matchedOppIds = new Set<string>();

  for (const opp of opportunities) {
    const oppMatches = matchesByOpp.get(opp.id);
    if (!oppMatches || oppMatches.length === 0) continue;

    matchedOppIds.add(opp.id);
    const emoji = getEmoji(opp.category);

    // Opportunity header
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${opp.title}*\n_Category: ${opp.category} | ${opp.dateDisplayText}_`,
      },
    });

    // Each match
    for (const match of oppMatches.sort((a, b) => b.confidenceScore - a.confidenceScore)) {
      matchedPartnerNames.add(match.partnerName);
      const partner = allPartners.find((p) => p.name === match.partnerName);
      const partnerLabel = partner
        ? `${partner.name} / ${partner.company}`
        : match.partnerName;

      const dateWarning =
        opp.dateConfidence === "unknown"
          ? "\n\n:warning: No set deadline — open until filled"
          : "";
      const link = opp.sourceUrl ? `\n:link: ${opp.sourceUrl}` : "";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `> *\u2192 ${partnerLabel}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
            `> _Why:_ ${match.rationale}`,
            `>`,
            `> :speech_balloon: *Pod Language:* "${match.internalLanguage}"`,
            `>`,
            `> :speech_balloon: *Client Language:* "${match.clientFacingLanguage}"`,
            dateWarning ? `> ${dateWarning}` : null,
            link ? `> ${link}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });
    }

    blocks.push({ type: "divider" });
  }

  // Summary
  const unmatchedPartners = allPartners
    .filter((p) => !matchedPartnerNames.has(p.name))
    .map((p) => p.name);
  const unmatchedOpps = opportunities
    .filter((o) => !matchedOppIds.has(o.id))
    .map((o) => o.title);

  const summaryLines = [
    `*Summary:* ${opportunities.length} opportunities scanned, ${matches.length} matches found for ${matchedPartnerNames.size} partners`,
  ];
  if (unmatchedPartners.length > 0) {
    summaryLines.push(
      `_Partners with no matches this week:_ ${unmatchedPartners.join(", ")}`
    );
  }
  if (unmatchedOpps.length > 0) {
    summaryLines.push(
      `_Opportunities with no matches:_ ${unmatchedOpps.join(", ")}`
    );
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: summaryLines.join("\n"),
    },
  });

  return blocks;
}

export function formatSheetReminder(
  sheetUrl: string,
  weekIdentifier: string,
  opportunityCount: number
): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Review Newsletter Opportunities",
    },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Week ${weekIdentifier} | Weekly matching runs at 5 PM UTC today. Please review opportunity statuses before then.`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${opportunityCount} opportunities* are queued for matching this week.\n\n:point_right: <${sheetUrl}|Open the Opportunities Sheet> to review statuses.`,
    },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: [
        "*Status legend:*",
        "\u2022 `active` \u2014 Included in matching (default)",
        "\u2022 `expired` \u2014 Skipped, opportunity has passed",
        "\u2022 `needs_review` \u2014 Skipped, flagged for follow-up",
      ].join("\n"),
    },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Only change the *Status* column. All other columns are auto-populated.",
      },
    ],
  });

  return blocks;
}

// --- Disco Matching Formatter (Phase 2) ---

import type { DiscoMatchSummary } from "@/lib/matching/disco-engine";
import type {
  NeedToOpportunityMatch,
  OfferToPartnerMatch,
  Need,
  Offer,
} from "@/schemas/disco-transcript";

interface DiscoFormatInput {
  summary: DiscoMatchSummary;
  needs: Need[];
  offers: Offer[];
}

export function formatDiscoMatchesToSlack(input: DiscoFormatInput): KnownBlock[] {
  const { summary, needs, offers } = input;
  const blocks: KnownBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Disco Matches — ${summary.meetingTitle}`,
    },
  });

  const personLabel = [
    summary.primaryPerson.name,
    summary.primaryPerson.company ? `@ ${summary.primaryPerson.company}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: personLabel,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // --- Section: Needs → Opportunities ---
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*What They Need \u2192 Matching Opportunities*",
    },
  });

  if (summary.needToOpportunityMatches.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No current opportunities match these needs._",
      },
    });
  } else {
    // Group by needIndex
    const matchesByNeed = new Map<number, NeedToOpportunityMatch[]>();
    for (const m of summary.needToOpportunityMatches) {
      const existing = matchesByNeed.get(m.needIndex) || [];
      existing.push(m);
      matchesByNeed.set(m.needIndex, existing);
    }

    for (const [needIdx, matches] of matchesByNeed) {
      const need = needs[needIdx];
      if (need) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `> :mag: *Need:* "${need.statement}" _(urgency: ${need.urgency})_`,
          },
        });
      }

      for (const match of matches.sort(
        (a, b) => b.confidenceScore - a.confidenceScore
      )) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `> \u2192 *${match.opportunityTitle}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
              `>   _${match.rationale}_`,
              `>   :speech_balloon: "${match.clientFacingLanguage}"`,
            ].join("\n"),
          },
        });
      }
    }
  }

  blocks.push({ type: "divider" });

  // --- Section: Offers → Partners ---
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*What They Offer \u2192 Partners Who'd Benefit*",
    },
  });

  if (summary.offerToPartnerMatches.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No partner matches for these offerings._",
      },
    });
  } else {
    const matchesByOffer = new Map<number, OfferToPartnerMatch[]>();
    for (const m of summary.offerToPartnerMatches) {
      const existing = matchesByOffer.get(m.offerIndex) || [];
      existing.push(m);
      matchesByOffer.set(m.offerIndex, existing);
    }

    for (const [offerIdx, matches] of matchesByOffer) {
      const offer = offers[offerIdx];
      if (offer) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `> :bulb: *Offers:* "${offer.statement}" _(${offer.specificity})_`,
          },
        });
      }

      for (const match of matches.sort(
        (a, b) => b.confidenceScore - a.confidenceScore
      )) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `> \u2192 *${match.partnerName}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
              `>   _${match.rationale}_`,
              `>   :speech_balloon: "${match.clientFacingLanguage}"`,
            ].join("\n"),
          },
        });
      }
    }
  }

  blocks.push({ type: "divider" });

  // --- Section: Intro-Worthiness ---
  const iw = input.summary.extraction.introWorthiness;
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: [
        "*Intro-Worthiness*",
        `Score: ${iw.score.toFixed(2)} | ${iw.rationale}`,
        iw.suggestedTopics.length > 0
          ? `Suggested intro topics: ${iw.suggestedTopics.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  blocks.push({ type: "divider" });

  // --- Summary ---
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Summary:* ${summary.needToOpportunityMatches.length} need\u2192opportunity matches, ${summary.offerToPartnerMatches.length} offer\u2192partner matches`,
    },
  });

  return blocks;
}

export async function postSlackMessage(blocks: KnownBlock[]): Promise<void> {
  if (!CHANNEL) {
    console.log("SLACK_CHANNEL_MATCHES not set, logging blocks instead:");
    console.log(JSON.stringify(blocks, null, 2));
    return;
  }

  // Slack has a 50-block limit per message. Split if needed.
  const BLOCK_LIMIT = 50;
  for (let i = 0; i < blocks.length; i += BLOCK_LIMIT) {
    const chunk = blocks.slice(i, i + BLOCK_LIMIT);
    await slack.chat.postMessage({
      channel: CHANNEL,
      blocks: chunk,
      text: "Weekly Opportunity Matches", // Fallback for notifications
    });
  }
}
