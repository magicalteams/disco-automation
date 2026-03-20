import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { verifySlackRequest } from "@/lib/slack/verify";
import { dispatch } from "@/lib/slack/commands";

export async function POST(request: NextRequest) {
  const { valid, body } = await verifySlackRequest(request);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const command = body.get("command");
  const text = body.get("text")?.trim() || "";
  const responseUrl = body.get("response_url");
  const userId = body.get("user_id") || "";

  if (!responseUrl) {
    return Response.json(
      { response_type: "ephemeral", text: "Missing response_url from Slack." },
      { status: 400 }
    );
  }

  const { ack, process } = dispatch(command, text, responseUrl, userId);

  // Schedule background processing — Vercel keeps the function alive
  waitUntil(process());

  // Immediate acknowledgment (must respond within 3 seconds)
  return Response.json({ response_type: "ephemeral", text: ack });
}
