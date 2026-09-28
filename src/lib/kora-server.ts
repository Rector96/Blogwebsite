import { database, env, json, cleanText, makeReference, type SponsorPackageCode, type SponsorCurrency, SPONSOR_PACKAGES, SPONSOR_MAX_MONTHS, sponsorTotalUsd } from "./paystack-server";

const KORA_BASE_URL = "https://api.korapay.com/merchant";

export async function koraRequest(path: string, init: RequestInit = {}) {
  const secret = env("KORA_SECRET_KEY");
  if (!secret) throw new Error("KORA_SECRET_KEY is not configured.");
  return fetch(KORA_BASE_URL + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export {
  database,
  env,
  json,
  cleanText,
  makeReference,
  SPONSOR_PACKAGES,
  SPONSOR_MAX_MONTHS,
  sponsorTotalUsd,
};

export type { SponsorPackageCode, SponsorCurrency };
