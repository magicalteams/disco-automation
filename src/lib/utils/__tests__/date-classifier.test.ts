import { describe, it, expect } from "vitest";
import { classifyAndSetExpiry, getWeekIdentifier } from "../date-classifier";

describe("getWeekIdentifier", () => {
  it("returns correct ISO week for a known date", () => {
    // March 3, 2026 is a Tuesday in ISO week 10
    expect(getWeekIdentifier(new Date("2026-03-03"))).toBe("2026-W10");
  });

  it("handles Jan 1 correctly (may be previous year's week)", () => {
    // Jan 1, 2026 is a Thursday — ISO week 1 of 2026
    expect(getWeekIdentifier(new Date("2026-01-01"))).toBe("2026-W01");
  });

  it("handles end of year correctly", () => {
    // Dec 31, 2025 is a Wednesday — ISO week 1 of 2026
    expect(getWeekIdentifier(new Date("2025-12-31"))).toBe("2026-W01");
  });
});

describe("classifyAndSetExpiry", () => {
  // Use a fixed future date string — the classifier parses strings to midnight UTC
  const futureDateStr = "2028-06-15";
  const futureDate = new Date(futureDateStr); // midnight UTC

  const publishDate = new Date("2026-03-01");

  const baseOpportunity = {
    sequenceNumber: 1,
    category: "Test",
    title: "Test Opportunity",
    description: "Description",
    industries: ["tech"],
    relevantFor: "founders",
    dateConfidence: "unknown" as const,
    dateDisplayText: "No date",
    sourceUrl: null,
    contactMethod: "email",
    eventDate: null,
    deadline: null,
  };

  it("classifies time-bound events with future event date as active", () => {
    const result = classifyAndSetExpiry(
      { ...baseOpportunity, eventDate: futureDateStr, dateConfidence: "confirmed" },
      publishDate,
    );
    expect(result.status).toBe("active");
    expect(result.eventDate).toEqual(futureDate);
    expect(result.defaultExpiry).toEqual(futureDate);
  });

  it("classifies time-bound events with past event date as expired", () => {
    const result = classifyAndSetExpiry(
      { ...baseOpportunity, eventDate: "2020-01-01", dateConfidence: "confirmed" },
      publishDate,
    );
    expect(result.status).toBe("expired");
  });

  it("uses deadline as expiry for rolling deadlines", () => {
    const result = classifyAndSetExpiry(
      { ...baseOpportunity, deadline: futureDateStr, dateConfidence: "inferred" },
      publishDate,
    );
    expect(result.status).toBe("active");
    expect(result.defaultExpiry).toEqual(futureDate);
    expect(result.eventDate).toBeNull();
  });

  it("uses TTL from publish date for evergreen opportunities", () => {
    const result = classifyAndSetExpiry(baseOpportunity, publishDate, 4);
    const expectedExpiry = new Date(publishDate);
    expectedExpiry.setDate(expectedExpiry.getDate() + 28);

    expect(result.eventDate).toBeNull();
    expect(result.deadline).toBeNull();
    expect(result.defaultExpiry).toEqual(expectedExpiry);
  });

  it("prefers deadline over event date for expiry when both present", () => {
    const deadlineStr = "2029-01-10";

    const result = classifyAndSetExpiry(
      { ...baseOpportunity, eventDate: futureDateStr, deadline: deadlineStr },
      publishDate,
    );
    expect(result.defaultExpiry).toEqual(new Date(deadlineStr));
  });
});
