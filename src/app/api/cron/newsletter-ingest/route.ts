import { NextRequest, NextResponse } from "next/server";
import { fetchLatestNewsletter } from "@/lib/clients/linkedin-rss";
import { extractNewsletter } from "@/lib/ingest/extract-newsletter";
import { postSlackMessage } from "@/lib/slack/formatter";
import type { KnownBlock } from "@slack/web-api";

// Retry a fallible async operation with exponential backoff. Used to absorb
// transient blips from LinkedIn RSS and the Anthropic API during the daily
// auto-ingest cron — without it, a single 5xx requires a manual /ingest.
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `${label} attempt ${attempt}/${attempts} failed: ${err instanceof Error ? err.message : err}. Retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Cron triggered: newsletter auto-ingest");

    // 1. Fetch latest newsletter from RSS
    const fetchResult = await withRetry("fetchLatestNewsletter", () =>
      fetchLatestNewsletter()
    );

    if (!fetchResult.found) {
      console.log(`No new newsletter found: ${fetchResult.reason}`);
      await postSlackAlert(
        `:warning: *Newsletter auto-ingest skipped* — ${fetchResult.reason}. Submit manually if needed.`
      );
      return NextResponse.json({
        message: "No new newsletter found",
        reason: fetchResult.reason,
      });
    }

    const { newsletter } = fetchResult;
    console.log(
      `Found newsletter #${newsletter.issueNumber} (${newsletter.publishDate})`
    );

    // 2. Extract opportunities
    const result = await withRetry("extractNewsletter", () =>
      extractNewsletter({
        markdown: newsletter.markdownContent,
        issueNumber: newsletter.issueNumber,
        publishDate: newsletter.publishDate,
      })
    );

    if (result.isExisting) {
      console.log(
        `Newsletter #${newsletter.issueNumber} already extracted (${result.weekIdentifier})`
      );
      return NextResponse.json({
        message: `Newsletter #${newsletter.issueNumber} already extracted`,
        weekIdentifier: result.weekIdentifier,
        opportunityCount: result.opportunities.length,
        isExisting: true,
      });
    }

    // 3. Post success confirmation to Slack
    await postSlackAlert(
      `:white_check_mark: *Newsletter #${newsletter.issueNumber} auto-ingested* — ${result.opportunities.length} opportunities extracted and pushed to the review sheet.`
    );

    return NextResponse.json({
      message: `Auto-ingested newsletter #${newsletter.issueNumber}: ${result.opportunities.length} opportunities`,
      weekIdentifier: result.weekIdentifier,
      opportunityCount: result.opportunities.length,
      isExisting: false,
    });
  } catch (error) {
    console.error("Newsletter auto-ingest failed:", error);
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    await postSlackAlert(
      `:x: *Newsletter auto-ingest failed* — The LinkedIn newsletter feed was unavailable when the automation ran this morning. This happens occasionally and usually resolves on its own. Type \`/ingest\` to retry.`
    ).catch(() => {}); // Don't fail if Slack alert also fails

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

async function postSlackAlert(text: string): Promise<void> {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
  ];
  await postSlackMessage(blocks);
}
