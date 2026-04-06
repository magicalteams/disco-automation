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
  clientFacingLanguage: string;
  outreachDraftEmail?: string;
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

function buildReviewFooter(): KnownBlock[] {
  const reviewTag = process.env.SLACK_REVIEW_TAG;
  const tagText = reviewTag
    ? `${reviewTag} — please review before sending.`
    : "Tag your Strategist/pod lead for review before sending.";

  return [
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Review required* — These are drafts. ${tagText} Do not send without a review pass.`,
        },
      ],
    },
  ];
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

  // Build lookup for opportunities by ID
  const oppLookup = new Map<string, NewsletterOpportunity>();
  for (const opp of opportunities) {
    oppLookup.set(opp.id, opp);
  }

  // Group matches by partner
  const matchesByPartner = new Map<string, MatchData[]>();
  for (const m of matches) {
    const existing = matchesByPartner.get(m.partnerName) || [];
    existing.push(m);
    matchesByPartner.set(m.partnerName, existing);
  }

  const matchedPartnerNames = new Set<string>();
  const matchedOppIds = new Set<string>();

  // Sort partners alphabetically for consistent output
  const sortedPartnerNames = [...matchesByPartner.keys()].sort();

  for (const partnerName of sortedPartnerNames) {
    const partnerMatches = matchesByPartner.get(partnerName)!;
    matchedPartnerNames.add(partnerName);

    const partner = allPartners.find((p) => p.name === partnerName);
    const partnerLabel = partner
      ? `${partner.name} / ${partner.company}`
      : partnerName;

    // Partner header
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${partnerLabel}* — ${partnerMatches.length} matching ${partnerMatches.length === 1 ? "opportunity" : "opportunities"}`,
      },
    });

    // Each matching opportunity (sorted by confidence)
    for (const match of partnerMatches.sort((a, b) => b.confidenceScore - a.confidenceScore)) {
      matchedOppIds.add(match.opportunityId);
      const opp = oppLookup.get(match.opportunityId);
      const emoji = opp ? getEmoji(opp.category) : "\ud83d\udccc";
      const oppTitle = opp?.title || match.opportunityTitle;
      const dateInfo = opp?.dateDisplayText || "";
      const category = opp?.category || "";

      const dateWarning =
        opp?.dateConfidence === "unknown"
          ? "\n> :warning: No set deadline — open until filled"
          : "";
      const link = opp?.sourceUrl ? `\n> :link: ${opp.sourceUrl}` : "";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `> ${emoji} *${oppTitle}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
            category || dateInfo ? `> _${[category, dateInfo].filter(Boolean).join(" | ")}_` : null,
            `> _Why:_ ${match.rationale}`,
            `>`,
            `> :speech_balloon: *Client Language:* "${match.clientFacingLanguage}"`,
            dateWarning || null,
            link || null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });

      if (match.outreachDraftEmail) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:email: *Draft Outreach Email:*\n\`\`\`${match.outreachDraftEmail}\`\`\``,
          },
        });
      }
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

  blocks.push(...buildReviewFooter());

  return blocks;
}

/**
 * Format matches for a single partner (used when routing to partner-specific channels).
 */
export function formatPartnerMatchesToSlack(
  opportunities: NewsletterOpportunity[],
  matches: MatchData[],
  partner: PartnerInfo,
  weekLabel?: string
): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  // Header
  const firstOpp = opportunities[0];
  const issueLabel = weekLabel || firstOpp?.newsletterIssue || "This Week";
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
      text: `Opportunity Matches — ${issueLabel}${dateLabel ? ` (${dateLabel})` : ""}`,
    },
  });

  blocks.push({ type: "divider" });

  // Build opportunity lookup
  const oppLookup = new Map<string, NewsletterOpportunity>();
  for (const opp of opportunities) {
    oppLookup.set(opp.id, opp);
  }

  const partnerLabel = `${partner.name} / ${partner.company}`;

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${partnerLabel}* — ${matches.length} matching ${matches.length === 1 ? "opportunity" : "opportunities"}`,
    },
  });

  // Each matching opportunity (sorted by confidence)
  for (const match of matches.sort((a, b) => b.confidenceScore - a.confidenceScore)) {
    const opp = oppLookup.get(match.opportunityId);
    const emoji = opp ? getEmoji(opp.category) : "\ud83d\udccc";
    const oppTitle = opp?.title || match.opportunityTitle;
    const dateInfo = opp?.dateDisplayText || "";
    const category = opp?.category || "";

    const dateWarning =
      opp?.dateConfidence === "unknown"
        ? "\n> :warning: No set deadline — open until filled"
        : "";
    const link = opp?.sourceUrl ? `\n> :link: ${opp.sourceUrl}` : "";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `> ${emoji} *${oppTitle}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
          category || dateInfo ? `> _${[category, dateInfo].filter(Boolean).join(" | ")}_` : null,
          `> _Why:_ ${match.rationale}`,
          `>`,
          `> :speech_balloon: *Client Language:* "${match.clientFacingLanguage}"`,
          dateWarning || null,
          link || null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    if (match.outreachDraftEmail) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:email: *Draft Outreach Email:*\n\`\`\`${match.outreachDraftEmail}\`\`\``,
        },
      });
    }
  }

  blocks.push(...buildReviewFooter());

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
      text: "Weekly Opportunity Review",
    },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${opportunityCount} opportunities* from this week's newsletter are ready for review (${weekIdentifier}).`,
    },
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: [
        "*What is this?*",
        "Each week, newsletter opportunities are extracted and matched against our client partners. Before matching runs automatically at *5 PM UTC today*, you have a chance to review and flag any opportunities that aren't relevant.",
        "",
        "*What to do:*",
        `1. <${sheetUrl}|Open the Opportunities Sheet>`,
        "2. Scan the *Status* column \u2014 everything defaults to `active`",
        "3. Change any stale or irrelevant opportunities to `expired`",
        "4. Flag anything uncertain as `needs_review` (it will be skipped this week)",
        "5. That's it \u2014 matching runs automatically at 5 PM UTC",
      ].join("\n"),
    },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Only change the *Status* column. All other columns are auto-populated. If you don't change anything, all opportunities will be matched as-is.",
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
        const matchLines = [
          `> \u2192 *${match.partnerName}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
          `>   _${match.rationale}_`,
          `>   :speech_balloon: "${match.clientFacingLanguage}"`,
        ];

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: matchLines.join("\n"),
          },
        });

        if (match.introDraftEmail) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:email: *Draft Intro Email:*\n\`\`\`${match.introDraftEmail}\`\`\``,
            },
          });
        }
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

  blocks.push(...buildReviewFooter());

  return blocks;
}

export async function postSlackMessage(
  blocks: KnownBlock[],
  channel?: string
): Promise<string | undefined> {
  const target = channel || CHANNEL;
  if (!target) {
    console.log("No Slack channel specified, logging blocks instead:");
    console.log(JSON.stringify(blocks, null, 2));
    return undefined;
  }

  // Slack has a 50-block limit per message. Split if needed.
  const BLOCK_LIMIT = 50;
  let firstTs: string | undefined;
  for (let i = 0; i < blocks.length; i += BLOCK_LIMIT) {
    const chunk = blocks.slice(i, i + BLOCK_LIMIT);
    const result = await slack.chat.postMessage({
      channel: target,
      blocks: chunk,
      text: "Weekly Opportunity Matches", // Fallback for notifications
    });
    if (!firstTs) firstTs = result.ts;
  }
  return firstTs;
}

/**
 * Format a single match as blocks for a thread reply.
 */
export function formatSingleMatchBlocks(
  match: MatchData,
  opportunity: NewsletterOpportunity | undefined
): KnownBlock[] {
  const emoji = opportunity ? getEmoji(opportunity.category) : "\ud83d\udccc";
  const oppTitle = opportunity?.title || match.opportunityTitle;
  const dateInfo = opportunity?.dateDisplayText || "";
  const category = opportunity?.category || "";

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `${emoji} *${oppTitle}* (Confidence: ${match.confidenceScore.toFixed(2)})`,
          category || dateInfo ? `_${[category, dateInfo].filter(Boolean).join(" | ")}_` : null,
          `_Why:_ ${match.rationale}`,
          "",
          `:speech_balloon: *Client Language:* "${match.clientFacingLanguage}"`,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      },
    },
  ];

  if (match.outreachDraftEmail) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:email: *Draft Outreach Email:*\n\`\`\`${match.outreachDraftEmail}\`\`\``,
      },
    });
  }

  return blocks;
}

/**
 * Post individual match messages as thread replies under a parent message.
 */
export async function postMatchThreadReplies(
  parentTs: string,
  channel: string,
  matches: MatchData[],
  opportunities: NewsletterOpportunity[]
): Promise<void> {
  const oppLookup = new Map<string, NewsletterOpportunity>();
  for (const opp of opportunities) {
    oppLookup.set(opp.id, opp);
  }

  const sorted = [...matches].sort((a, b) => b.confidenceScore - a.confidenceScore);

  for (const match of sorted) {
    const opp = oppLookup.get(match.opportunityId);
    const blocks = formatSingleMatchBlocks(match, opp);

    await slack.chat.postMessage({
      channel,
      thread_ts: parentTs,
      blocks,
      text: `Match: ${match.opportunityTitle} (${match.confidenceScore.toFixed(2)})`,
    });
  }
}
