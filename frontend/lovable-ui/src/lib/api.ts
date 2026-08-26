export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type Worker = {
  id: string;
  name: string;
  skill: string;
  rating: number;
  idleDays: number;
  matchLabel: string;
  lat: number;
  lng: number;
  distanceKm: number;
  coopPrice: number;
  aggregatorPrice: number;
  verified: boolean;
};

export type MatchResult = {
  worker: Worker | null;
  nearby: Worker[];
  breakdown: { proximity: number; trust: number; idle: number };
  clusterId: string;
};

export type BookingConfirmation = {
  bookingId: string;
  workerId: string;
  grossAmount: number;
  otpExpiresAt: string;
  developmentOtp?: string;
  developmentNote?: string;
};

export type SettlementResult = {
  total: number;
  workerPayout: number;
  pacsMaintenance: number;
  mutualAidFund: number;
  reference: string;
};

export type VoiceProfile = {
  transcript: string;
  language: string;
  fullName: string;
  skill: string;
  experience: string;
  experienceYears: number;
  baseRate: number;
  zone: string;
  subSkills: string[];
};

export type RegistrationResult = {
  memberId: string;
  registeredAt: string;
};

export type HealthResult = {
  status: string;
  demo_mode: boolean;
  database: boolean;
  voice_transcription_configured: boolean;
  profile_extraction_configured: boolean;
};

export const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "House Cleaning",
  "Carpentry",
  "Masonry",
] as const;

export const LANGUAGES = [
  { code: "ta", label: "தமிழ் · Tamil" },
  { code: "hi", label: "हिन्दी · Hindi" },
  { code: "te", label: "తెలుగు · Telugu" },
  { code: "mr", label: "मराठी · Marathi" },
  { code: "en", label: "English" },
] as const;

export const API_BASE = (import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);
export const CUSTOMER_ID = import.meta.env["VITE_USER_ID"] ?? "demo-customer";
export const USER_SIGNATURE = import.meta.env["VITE_USER_SIGNATURE"] ?? "";
export const CUSTOMER_LOCATION = {
  lat: Number(import.meta.env["VITE_CUSTOMER_LAT"] ?? 11.0168),
  lng: Number(import.meta.env["VITE_CUSTOMER_LNG"] ?? 76.9558),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-User-Id", CUSTOMER_ID);
  if (USER_SIGNATURE) headers.set("X-User-Signature", USER_SIGNATURE);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      "Unable to reach the cooperative service. Check that the backend is running.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const detail =
      typeof payload?.["detail"] === "string"
        ? payload["detail"]
        : `Request failed (${response.status})`;
    throw new ApiError(detail, response.status);
  }
  return payload as T;
}

export async function checkBackend(): Promise<HealthResult> {
  return request<HealthResult>("/api/health", { method: "GET" });
}

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const str = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

function normaliseWorker(raw: Record<string, unknown>, index: number): Worker {
  const coopPrice = num(raw["fair_price_inr"], 0);
  const idleDays = num(raw["idle_days"], 0);
  const score = num(raw["fair_match_score"], 0);
  return {
    id: str(raw["worker_id"], `worker-${index + 1}`),
    name: str(raw["full_name"], "Cooperative worker"),
    skill: str(raw["skill"], "Local service"),
    rating: num(raw["trust_rating"], 0),
    idleDays,
    matchLabel:
      idleDays >= 8
        ? "Idle-days priority"
        : index === 0
          ? "Top community match"
          : "Nearby co-op member",
    lat: num(raw["lat"], CUSTOMER_LOCATION.lat),
    lng: num(raw["lng"], CUSTOMER_LOCATION.lng),
    distanceKm: num(raw["distance_km"], 0),
    coopPrice,
    aggregatorPrice: num(
      raw["commercial_aggregator_price_inr"],
      Math.round(coopPrice * 1.35 * 100) / 100,
    ),
    verified: raw["verified"] !== false && score >= 0,
  };
}

export async function matchAndPrice(category: string): Promise<MatchResult> {
  const data = await request<Record<string, unknown>>("/api/bookings/match-and-price", {
    method: "POST",
    body: JSON.stringify({
      customer_id: CUSTOMER_ID,
      service_type: category,
      customer_lat: CUSTOMER_LOCATION.lat,
      customer_lng: CUSTOMER_LOCATION.lng,
    }),
  });
  const rawList = data["all_ranked_candidates"];
  const nearby = Array.isArray(rawList)
    ? rawList.map((worker, index) =>
        normaliseWorker((worker ?? {}) as Record<string, unknown>, index),
      )
    : [];
  const rawSelected = data["selected_best_match"];
  const rawBreakdown = (data["breakdown"] ?? {}) as Record<string, unknown>;
  return {
    worker: rawSelected
      ? normaliseWorker(rawSelected as Record<string, unknown>, 0)
      : (nearby[0] ?? null),
    nearby,
    clusterId: str(data["cluster_id"], "coimbatore-gandhipuram"),
    breakdown: {
      proximity: num(rawBreakdown["proximity"], 45),
      trust: num(rawBreakdown["trust"], 35),
      idle: num(rawBreakdown["idle"], 20),
    },
  };
}

export async function createBooking(
  category: string,
  worker: Worker,
): Promise<BookingConfirmation> {
  const data = await request<Record<string, unknown>>("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      customer_id: CUSTOMER_ID,
      service_type: category,
      customer_lat: CUSTOMER_LOCATION.lat,
      customer_lng: CUSTOMER_LOCATION.lng,
      worker_id: worker.id,
      agreed_amount: worker.coopPrice,
    }),
  });
  const confirmation: BookingConfirmation = {
    bookingId: str(data["booking_id"], ""),
    workerId: str(data["worker_id"], worker.id),
    grossAmount: num(data["gross_amount"], worker.coopPrice),
    otpExpiresAt: str(data["otp_expires_at"], ""),
  };
  if (typeof data["development_otp"] === "string")
    confirmation.developmentOtp = data["development_otp"];
  if (typeof data["development_note"] === "string")
    confirmation.developmentNote = data["development_note"];
  return confirmation;
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await request(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: "DELETE" });
}

export async function verifyAndSettle(
  otp: string,
  bookingId: string,
  amount: number,
  workerId: string,
  clusterId: string,
): Promise<SettlementResult> {
  const data = await request<Record<string, unknown>>("/api/bookings/verify-settle", {
    method: "POST",
    body: JSON.stringify({
      booking_id: bookingId,
      worker_id: workerId,
      cluster_id: clusterId,
      gross_amount: amount,
      otp_code: otp,
    }),
  });
  const settlement = (data["settlement_breakdown"] ?? {}) as Record<string, unknown>;
  return {
    total: num(settlement["gross_amount_paid"], amount),
    workerPayout: num(settlement["direct_worker_payout_98pct"], amount * 0.98),
    pacsMaintenance: num(settlement["pacs_cooperative_maintenance_1_5pct"], amount * 0.015),
    mutualAidFund: num(settlement["mutual_aid_emergency_pool_0_5pct"], amount * 0.005),
    reference: str(data["reference"], "Pending reference"),
  };
}

export async function voiceOnboard(lang: string, audio: Blob): Promise<VoiceProfile> {
  const form = new FormData();
  form.append("preferred_language", lang);
  form.append("audio_file", audio, `voice-${lang}.webm`);
  const data = await request<Record<string, unknown>>("/api/workers/voice-onboard", {
    method: "POST",
    body: form,
  });
  const raw = (data["structured_profile"] ?? {}) as Record<string, unknown>;
  const years = num(raw["experience_years"], 0);
  return {
    transcript: str(data["transcription"], ""),
    language: str(raw["language"], lang),
    fullName: str(raw["full_name"], "Local Worker"),
    skill: str(raw["primary_skill"], "General services"),
    experience: `${years} year${years === 1 ? "" : "s"}`,
    experienceYears: years,
    baseRate: num(raw["base_rate_inr"], 0),
    zone: str(raw["operating_zone"], "Local service area"),
    subSkills: Array.isArray(raw["sub_skills"])
      ? raw["sub_skills"].filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function registerWorker(profile: VoiceProfile): Promise<RegistrationResult> {
  const data = await request<Record<string, unknown>>("/api/workers/register", {
    method: "POST",
    body: JSON.stringify({
      transcript: profile.transcript,
      language: profile.language,
      full_name: profile.fullName,
      primary_skill: profile.skill,
      sub_skills: profile.subSkills,
      experience_years: profile.experienceYears,
      base_rate_inr: profile.baseRate,
      operating_zone: profile.zone,
    }),
  });
  return {
    memberId: str(data["member_id"], ""),
    registeredAt: str(data["registered_at"], ""),
  };
}

export const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
