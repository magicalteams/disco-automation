import type { ExtractedOpportunity } from "@/schemas/newsletter-opportunity";

interface DateClassification {
  eventDate: Date | null;
  deadline: Date | null;
  defaultExpiry: Date;
  status: "active" | "expired";
}

export function classifyAndSetExpiry(
  opportunity: ExtractedOpportunity,
  publishDate: Date,
  ttlWeeks: number = 4
): DateClassification {
  const now = new Date();
  const eventDate = opportunity.eventDate ? new Date(opportunity.eventDate) : null;
  const deadline = opportunity.deadline ? new Date(opportunity.deadline) : null;

  // Time-bound events: use event date as expiry
  if (eventDate) {
    return {
      eventDate,
      deadline,
      defaultExpiry: deadline ?? eventDate,
      status: (deadline ?? eventDate) > now ? "active" : "expired",
    };
  }

  // Rolling deadlines without event date
  if (deadline) {
    return {
      eventDate: null,
      deadline,
      defaultExpiry: deadline,
      status: deadline > now ? "active" : "expired",
    };
  }

  // Evergreen / unknowable: TTL from publish date
  const expiry = new Date(publishDate);
  expiry.setDate(expiry.getDate() + ttlWeeks * 7);

  return {
    eventDate: null,
    deadline: null,
    defaultExpiry: expiry,
    status: expiry > now ? "active" : "expired",
  };
}

/**
 * Compute ISO week identifier from a date (e.g. "2026-W09")
 */
export function getWeekIdentifier(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}
