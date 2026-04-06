import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/clients/db";

/**
 * Emoji → reactionStatus mapping.
 * Strategists react to individual match thread replies to track status.
 */
const REACTION_MAP: Record<string, string> = {
  white_check_mark: "shared",     // ✅ Shared with client
  eyes: "reviewing",              // 👀 Under review
  x: "skipped",                   // ❌ Not relevant / skipped
  heavy_check_mark: "shared",     // ✔️ Alternative checkmark
  thumbsup: "shared",             // 👍 Alternative shared
  no_entry_sign: "skipped",       // 🚫 Alternative skip
};

/**
 * Slack Events API endpoint.
 * Handles URL verification challenge and reaction_added/reaction_removed events.
 *
 * Setup: In your Slack app settings → Event Subscriptions:
 *   Request URL: https://[VERCEL_URL]/api/slack/events
 *   Subscribe to bot events: reaction_added, reaction_removed
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Slack URL verification challenge (sent when you first set up the events URL)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Must respond with 200 within 3 seconds — process async
  if (body.type === "event_callback") {
    const event = body.event;

    if (event.type === "reaction_added") {
      await handleReactionAdded(event);
    } else if (event.type === "reaction_removed") {
      await handleReactionRemoved(event);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleReactionAdded(event: {
  reaction: string;
  item: { type: string; channel: string; ts: string };
  user: string;
}): Promise<void> {
  if (event.item.type !== "message") return;

  const newStatus = REACTION_MAP[event.reaction];
  if (!newStatus) return; // Ignore unmapped reactions

  try {
    const result = await prisma.matchResult.updateMany({
      where: {
        slackMessageTs: event.item.ts,
        slackChannelId: event.item.channel,
      },
      data: { reactionStatus: newStatus },
    });

    if (result.count > 0) {
      console.log(
        `Reaction :${event.reaction}: on match → status "${newStatus}" (by <@${event.user}>)`
      );
    }
  } catch (error) {
    console.error("Failed to update reaction status:", error);
  }
}

async function handleReactionRemoved(event: {
  reaction: string;
  item: { type: string; channel: string; ts: string };
  user: string;
}): Promise<void> {
  if (event.item.type !== "message") return;

  const wasStatus = REACTION_MAP[event.reaction];
  if (!wasStatus) return;

  try {
    // Only revert to "pending" if the current status matches the removed reaction
    const result = await prisma.matchResult.updateMany({
      where: {
        slackMessageTs: event.item.ts,
        slackChannelId: event.item.channel,
        reactionStatus: wasStatus,
      },
      data: { reactionStatus: "pending" },
    });

    if (result.count > 0) {
      console.log(
        `Reaction :${event.reaction}: removed → status reverted to "pending" (by <@${event.user}>)`
      );
    }
  } catch (error) {
    console.error("Failed to revert reaction status:", error);
  }
}
