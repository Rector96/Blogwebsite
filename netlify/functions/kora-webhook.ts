import { createHmac, timingSafeEqual } from "node:crypto";
import { applyKoraPayment } from "./kora-verify";
import { database, env, json } from "../../src/lib/kora-server";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();
  const signature = req.headers.get("x-korapay-signature") || "";
  const secret = env("KORA_SECRET_KEY");
  if (!secret) return json({ error: "Webhook is not configured." }, 503);

  let event: any;
  try {
    event = JSON.parse(raw || "{}");
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const dataJson = JSON.stringify(event?.data ?? {});
  const expected = createHmac("sha256", secret).update(dataJson).digest("hex");
  if (signature.length !== expected.length) return json({ error: "Invalid signature." }, 200);

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return json({ error: "Invalid signature." }, 200);
    }
  } catch {
    return json({ error: "Invalid signature." }, 200);
  }

  const eventName = String(event?.event || "");
  if (eventName !== "charge.success" && eventName !== "charge.failed") {
    return json({ ok: true, ignored: true });
  }

  const reference = String(event?.data?.payment_reference || event?.data?.reference || "");
  if (!reference) return json({ ok: true, ignored: true });

  try {
    /*
     * The webhook is signature-verified. Apply the signed transaction data
     * directly so Kora receives a fast 200 acknowledgement and does not
     * retry a successful notification because a second API request timed out.
     */
    const result = await applyKoraPayment(reference, event.data);
    const db = database();
    if (db && result.ok) {
      await db.from("admin_audit_logs").insert({
        action: "kora_payment_success",
        entity_type: "sponsor_payment",
        entity_id: reference,
        details: {
          amount: event.data?.amount,
          amount_paid: event.data?.amount_paid ?? null,
          currency: event.data?.currency,
          customer_email: event.data?.customer?.email || null,
        },
      });
    }
    return json({ ok: true });
  } catch (error) {
    console.error("[RockBrief] Kora webhook failed", error);
    return json({ error: "Webhook processing failed." }, 500);
  }
};
