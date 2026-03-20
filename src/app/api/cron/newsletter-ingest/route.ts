import { NextRequest, NextResponse } from "next/server";
import { fetchLatestNewsletter } from "@/lib/clients/linkedin-rss";
import { extractNewsletter } from "@/lib/ingest/extract-newsletter";
import { postSlackMessage } from "@/lib/slack/formatter";
import type { KnownBlock } from "@slack/web-api";

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
    const fetchResult = await fetchLatestNewsletter();

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
    const result = await extractNewsletter({
      markdown: newsletter.markdownContent,
      issueNumber: newsletter.issueNumber,
      publishDate: newsletter.publishDate,
    });

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
      `:x: *Newsletter auto-ingest failed* — ${errorMsg}. Submit manually via the extraction API.`
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
