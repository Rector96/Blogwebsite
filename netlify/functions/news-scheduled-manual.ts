import type { Handler } from "@netlify/functions";
import scheduledHandler from "./news-scheduled";

function getProvidedSecret(event: Parameters<Handler>[0]) {
  const headers = event.headers || {};
  const direct = headers["x-rockbrief-bot-secret"] || headers["X-RockBrief-Bot-Secret"];
  if (direct) return direct;
  const authorization = headers.authorization || headers.Authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return "";
}

export const handler: Handler = async (event) => {
  const expected = process.env["BOT_MANUAL_SECRET"] || "";
  if (!expected) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Manual bot trigger is not configured" }),
    };
  }

  const provided = getProvidedSecret(event);
  if (!provided || provided !== expected) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Unauthorized" }),
    };
  }

  return scheduledHandler();
};

export default handler;
