import RSSParser from "rss-parser";
import TurndownService from "turndown";

const RSS_FEED_URL =
  process.env.RSS_FEED_URL ||
  "https://linkedinrss.cns.me/7321382186887139328";

const parser = new RSSParser();
const turndown = new TurndownService({ headingStyle: "atx" });

export interface LatestNewsletter {
  issueNumber: number;
  publishDate: string; // YYYY-MM-DD
  markdownContent: string;
  articleUrl: string;
}

export type FetchResult =
  | { found: true; newsletter: LatestNewsletter }
  | { found: false; reason: string };

export async function fetchLatestNewsletter(): Promise<FetchResult> {
  const feed = await parser.parseURL(RSS_FEED_URL);

  if (!feed.items || feed.items.length === 0) {
    return { found: false, reason: "RSS feed returned no items" };
  }

  const latest = feed.items[0];

  // Extract issue number from title like "The Business Village Newsletter \\ #48"
  const issueMatch = latest.title?.match(/#(\d+)/);
  if (!issueMatch) {
    return {
      found: false,
      reason: `Could not parse issue number from title: "${latest.title}"`,
    };
  }
  const issueNumber = parseInt(issueMatch[1], 10);

  // Parse publish date
  const pubDate = latest.pubDate ? new Date(latest.pubDate) : null;
  if (!pubDate || isNaN(pubDate.getTime())) {
    return {
      found: false,
      reason: `Could not parse publish date: "${latest.pubDate}"`,
    };
  }

  // Check that the latest item is from the current week (within 7 days)
  const now = new Date();
  const daysSincePublish =
    (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePublish > 7) {
    return {
      found: false,
      reason: `Latest newsletter (#${issueNumber}) was published ${Math.floor(daysSincePublish)} days ago — no new issue this week`,
    };
  }

  // Get content from description (HTML in CDATA)
  const htmlContent = latest.content || latest["content:encoded"] || latest.contentSnippet || "";
  if (!htmlContent) {
    return {
      found: false,
      reason: `Newsletter #${issueNumber} has no content in RSS feed`,
    };
  }

  // Convert HTML to markdown
  const markdownContent = turndown.turndown(htmlContent);

  // Format date as YYYY-MM-DD
  const publishDate = pubDate.toISOString().split("T")[0];

  return {
    found: true,
    newsletter: {
      issueNumber,
      publishDate,
      markdownContent,
      articleUrl: latest.link || "",
    },
  };
}
