import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/utils/api-auth";

/**
 * REST API endpoint for triggering weekly matching via GitHub Actions.
 * Kept for backward compatibility / external integrations.
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const githubPat = process.env.GITHUB_PAT;
  if (!githubPat) {
    return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun ? "true" : "false";

    const res = await fetch(
      "https://api.github.com/repos/magicalteams/disco-automation/actions/workflows/weekly-matching.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubPat}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs: { dry_run: dryRun } }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({
        message: `Weekly matching triggered (${dryRun === "true" ? "dry-run" : "production"} mode). Results will post to Slack when complete.`,
      });
    } else {
      const errorBody = await res.text();
      return NextResponse.json(
        { error: `GitHub API returned ${res.status}: ${errorBody}` },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger matching" },
      { status: 500 }
    );
  }
}
