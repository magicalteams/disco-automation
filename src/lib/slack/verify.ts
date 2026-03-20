import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify that an incoming request is genuinely from Slack using
 * HMAC-SHA256 signature validation.
 *
 * Slack sends application/x-www-form-urlencoded bodies for slash commands.
 * We need the raw body text to compute the signature, then parse it.
 */
export async function verifySlackRequest(
  request: Request
): Promise<{ valid: boolean; body: URLSearchParams }> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("SLACK_SIGNING_SECRET not configured");
    return { valid: false, body: new URLSearchParams() };
  }

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!timestamp || !signature) {
    return { valid: false, body: new URLSearchParams() };
  }

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return { valid: false, body: new URLSearchParams() };
  }

  const rawBody = await request.text();
  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;

  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);

  // timingSafeEqual throws if lengths differ — guard against that
  if (computedBuf.length !== signatureBuf.length) {
    console.error("Slack signature length mismatch — check SLACK_SIGNING_SECRET");
    return { valid: false, body: new URLSearchParams() };
  }

  const valid = timingSafeEqual(computedBuf, signatureBuf);

  return { valid, body: new URLSearchParams(rawBody) };
}
