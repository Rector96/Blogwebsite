import { createHmac, timingSafeEqual } from "node:crypto";
import { applyPayment } from "./paystack-verify";
import { database, env, json } from "../../src/lib/paystack-server";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  const secret = env("PAYSTACK_SECRET_KEY");
  if (!secret) return json({ error: "Webhook is not configured." }, 503);

  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  if (signature.length !== expected.length) return json({ error: "Invalid signature." }, 401);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return json({ error: "Invalid signature." }, 401);
  } catch {
    return json({ error: "Invalid signature." }, 401);
  }

  const event = JSON.parse(raw || "{}");
  if (event.event !== "charge.success") return json({ ok: true, ignored: true });

  const reference = String(event?.data?.reference || "");
  if (!reference) return json({ ok: true, ignored: true });

  try {
    const result = await applyPayment(reference, event.data);
    const db = database();
    if (db && result.ok) {
      await db.from("admin_audit_logs").insert({
        action: "paystack_payment_success",
        entity_type: "sponsor_payment",
        entity_id: reference,
        details: { amount_kobo: event.data?.amount, customer_email: event.data?.customer?.email || null },
      });
    }
    return json({ ok: true });
  } catch (error) {
    console.error("[RWDNEWS] Paystack webhook failed", error);
    return json({ error: "Webhook processing failed." }, 500);
  }
};
