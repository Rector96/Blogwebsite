import { database, json, koraRequest } from "../../src/lib/kora-server";

async function applyKoraPayment(reference: string, payload: any) {
  const db = database();
  if (!db) throw new Error("Database is not configured.");

  const { data: payment } = await db.from("sponsor_payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment) return { ok: false, reason: "payment_not_found" };

  if (String(payment.status || "").toLowerCase() === "paid") {
    return { ok: true, already_processed: true, payment };
  }

  const expectedCurrency = String(payment.currency || "USD").toUpperCase();
  const expectedAmount = Number(payment.amount ?? payment.amount_usd ?? 0);
  const actualCurrency = String(payload?.currency || "").toUpperCase();
  const actualAmount = Number(
    payload?.amount_paid ?? payload?.amount ?? payload?.amount_accepted ?? 0,
  );
  const transactionStatus = String(
    payload?.transaction_status ?? payload?.status ?? "",
  ).toLowerCase();

  const successful = transactionStatus === "success"
    && actualCurrency === expectedCurrency
    && Number.isFinite(actualAmount)
    && actualAmount === expectedAmount;

  if (!successful) {
    const failed = transactionStatus === "failed";
    await db.from("sponsor_payments").update({
      status: failed ? "failed" : "pending",
      provider_status: transactionStatus || "unknown",
      provider_transaction_id: payload?.payment_reference
        ? String(payload.payment_reference)
        : String(payload?.reference || ""),
      provider_currency: actualCurrency || null,
      updated_at: new Date().toISOString(),
    }).eq("reference", reference);
    return { ok: false, reason: "payment_not_successful" };
  }

  const paidAt = new Date().toISOString();
  await db.from("sponsor_payments").update({
    status: "paid",
    provider_status: "success",
    provider_transaction_id: payload?.payment_reference
      ? String(payload.payment_reference)
      : String(payload.reference),
    provider_currency: actualCurrency,
    paid_at: paidAt,
    updated_at: paidAt,
  }).eq("reference", reference);

  return { ok: true, payment, paidAt };
}

export { applyKoraPayment };

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const reference = new URL(req.url).searchParams.get("reference") || "";
  if (!reference) return json({ error: "Missing payment reference." }, 400);

  try {
    const response = await koraRequest("/api/v1/charges/" + encodeURIComponent(reference));
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status !== true || !payload?.data) {
      return json({ error: payload?.message || "Kora payment verification failed." }, 502);
    }
    const result = await applyKoraPayment(reference, payload.data);
    return json({ ...result, reference, payment_provider: "kora" });
  } catch (error) {
    console.error("[RockBrief] Kora verify failed", error);
    return json({ error: "Payment verification is temporarily unavailable." }, 500);
  }
};
