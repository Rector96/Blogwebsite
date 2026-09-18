import { database, json, paystackRequest } from "./_paystack";

async function applyPayment(reference: string, payload: any) {
  const db = database();
  if (!db) throw new Error("Database is not configured.");
  const { data: payment } = await db.from("sponsor_payments").select("*").eq("reference", reference).maybeSingle();
  if (!payment) return { ok: false, reason: "payment_not_found" };

  const successful = payload?.status === "success" && String(payload?.currency || "NGN") === "NGN" && Number(payload?.amount) === Number(payment.amount_kobo);
  if (!successful) {
    await db.from("sponsor_payments").update({
      status: payload?.status === "failed" ? "failed" : "pending",
      paystack_status: String(payload?.status || "unknown"),
      paystack_transaction_id: payload?.id ? String(payload.id) : null,
      updated_at: new Date().toISOString(),
    }).eq("reference", reference);
    return { ok: false, reason: "payment_not_successful" };
  }

  const paidAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + Number(payment.duration_days || 30) * 86400000).toISOString();
  await db.from("sponsor_payments").update({
    status: "paid",
    paystack_status: "success",
    paystack_transaction_id: payload.id ? String(payload.id) : null,
    paid_at: paidAt,
    updated_at: paidAt,
  }).eq("reference", reference);

  return { ok: true, payment, paidAt, endsAt };
}

export { applyPayment };

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const reference = new URL(req.url).searchParams.get("reference") || "";
  if (!reference) return json({ error: "Missing payment reference." }, 400);

  try {
    const response = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.status) return json({ error: payload?.message || "Payment verification failed." }, 502);
    const result = await applyPayment(reference, payload.data);
    return json({ ...result, reference });
  } catch (error) {
    console.error("[RWDNEWS] Paystack verify failed", error);
    return json({ error: "Payment verification is temporarily unavailable." }, 500);
  }
};
