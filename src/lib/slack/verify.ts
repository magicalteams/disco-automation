import { createHmac, timingSafeEqual } from "crypto";

/**
 * Body-format-agnostic Slack signature check. Reads timestamp + signature
 * headers, validates the HMAC over `v0:{timestamp}:{rawBody}`, and rejects
 * timestamps older than 5 minutes (replay protection).
 */
export function verifySlackSignature(
  rawBody: string,
  headers: Headers
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("SLACK_SIGNING_SECRET not configured");
    return false;
  }

  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");

  if (!timestamp || !signature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;

  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length) {
    console.error("Slack signature length mismatch — check SLACK_SIGNING_SECRET");
    return false;
  }

  return timingSafeEqual(computedBuf, signatureBuf);
}

/**
 * Slash-command flavor: reads form-encoded body and returns parsed params.
 */
export async function verifySlackRequest(
  request: Request
): Promise<{ valid: boolean; body: URLSearchParams }> {
  const rawBody = await request.text();
  const valid = verifySlackSignature(rawBody, request.headers);
  return { valid, body: new URLSearchParams(rawBody) };
}
