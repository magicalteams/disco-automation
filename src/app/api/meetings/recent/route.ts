import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/utils/api-auth";
import { listRecentMeetings } from "@/lib/clients/fireflies";

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const meetings = await listRecentMeetings({ limit });

    return NextResponse.json({
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: new Date(m.date).toISOString(),
        duration: m.duration,
        participants: m.participants,
      })),
      count: meetings.length,
    });
  } catch (error) {
    console.error("Failed to list meetings:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list meetings",
      },
      { status: 500 }
    );
  }
}
