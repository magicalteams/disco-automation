import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the API key from the Authorization header.
 * Returns null if valid, or a 401 NextResponse if invalid.
 *
 * Usage in route handlers:
 *   const authError = validateApiKey(request);
 *   if (authError) return authError;
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  const apiKey = process.env.API_KEY;

  // If no API_KEY is configured, skip auth (development mode)
  if (!apiKey) return null;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
