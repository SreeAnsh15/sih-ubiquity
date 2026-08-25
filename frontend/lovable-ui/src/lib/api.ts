export const API_BASE = "http://localhost:8000";

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
  worker: Worker;
  nearby: Worker[];
  breakdown: { proximity: number; trust: number; idle: number };
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
  baseRate: number;
  zone: string;
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

export const CUSTOMER_LOCATION = { lat: 11.0168, lng: 76.9558 };

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------- normalisation helpers (backend shape may vary) ---------- */

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);

const SEED_WORKERS: Omit<Worker, "coopPrice" | "aggregatorPrice" | "skill">[] = [
  { id: "w1", name: "Murugan S.", rating: 4.8, idleDays: 6, matchLabel: "Top Community Match", lat: 11.0231, lng: 76.9612, distanceKm: 1.2, verified: true },
  { id: "w2", name: "Lakshmi R.", rating: 4.6, idleDays: 3, matchLabel: "Nearby Co-op Member", lat: 11.0104, lng: 76.9481, distanceKm: 1.9, verified: true },
  { id: "w3", name: "Anbu K.", rating: 4.5, idleDays: 9, matchLabel: "Idle-Days Priority", lat: 11.0272, lng: 76.9439, distanceKm: 2.6, verified: true },
  { id: "w4", name: "Selvi M.", rating: 4.7, idleDays: 2, matchLabel: "Nearby Co-op Member", lat: 11.0059, lng: 76.9668, distanceKm: 2.1, verified: true },
  { id: "w5", name: "Ravi Chandran", rating: 4.4, idleDays: 11, matchLabel: "Idle-Days Priority", lat: 11.0325, lng: 76.9702, distanceKm: 3.4, verified: false },
];

const BASE_RATE: Record<string, number> = {
  Plumbing: 198.4,
  Electrical: 224.6,
  "House Cleaning": 168.2,
  Carpentry: 246.8,
  Masonry: 262.5,
};

function mockMatch(category: string): MatchResult {
  const base = BASE_RATE[category] ?? 198.4;
  const nearby = SEED_WORKERS.map((w, i) => {
    const coopPrice = Math.round((base + i * 11.3) * 100) / 100;
    return {
      ...w,
      skill: category,
      coopPrice,
      aggregatorPrice: Math.round(coopPrice * 1.355 * 100) / 100,
    } satisfies Worker;
  });
  return {
    worker: nearby[0]!,
    nearby,
    breakdown: { proximity: 40, trust: 30, idle: 30 },
  };
}

function normaliseWorker(raw: Record<string, unknown>, fallback: Worker): Worker {
  const coop = num(raw["fair_price"] ?? raw["coop_price"] ?? raw["price"], fallback.coopPrice);
  return {
    id: str(raw["id"] ?? raw["worker_id"], fallback.id),
    name: str(raw["name"] ?? raw["worker_name"], fallback.name),
    skill: str(raw["skill"] ?? raw["category"], fallback.skill),
    rating: num(raw["rating"] ?? raw["trust_rating"], fallback.rating),
    idleDays: num(raw["idle_days"], fallback.idleDays),
    matchLabel: str(raw["match_label"], fallback.matchLabel),
    lat: num(raw["lat"] ?? raw["latitude"], fallback.lat),
    lng: num(raw["lng"] ?? raw["lon"] ?? raw["longitude"], fallback.lng),
    distanceKm: num(raw["distance_km"] ?? raw["distance"], fallback.distanceKm),
    coopPrice: coop,
    aggregatorPrice: num(
      raw["aggregator_price"] ?? raw["commercial_price"],
      Math.round(coop * 1.355 * 100) / 100,
    ),
    verified: raw["verified"] === false ? false : true,
  };
}

export async function matchAndPrice(category: string): Promise<MatchResult> {
  const fallback = mockMatch(category);
  const data = await post<Record<string, unknown>>("/api/bookings/match-and-price", {
    category,
    service: category,
    lat: CUSTOMER_LOCATION.lat,
    lng: CUSTOMER_LOCATION.lng,
  });
  if (!data) return fallback;

  const rawList = (data["workers"] ?? data["matches"] ?? data["nearby"]) as unknown;
  const list = Array.isArray(rawList) ? rawList : [];
  const nearby = list.length
    ? list
        .slice(0, 6)
        .map((r, i) =>
          normaliseWorker(
            (r ?? {}) as Record<string, unknown>,
            fallback.nearby[i % fallback.nearby.length]!,
          ),
        )
    : fallback.nearby;

  const rawTop = (data["worker"] ?? data["best_match"] ?? data["match"]) as unknown;
  const worker = rawTop
    ? normaliseWorker(rawTop as Record<string, unknown>, nearby[0]!)
    : nearby[0]!;

  const bd = (data["breakdown"] ?? data["weights"] ?? {}) as Record<string, unknown>;
  return {
    worker,
    nearby,
    breakdown: {
      proximity: num(bd["proximity"], 40),
      trust: num(bd["trust"] ?? bd["trust_rating"], 30),
      idle: num(bd["idle"] ?? bd["idle_days"], 30),
    },
  };
}

export async function verifyAndSettle(
  otp: string,
  amount: number,
  workerId: string,
): Promise<SettlementResult> {
  const round = (n: number) => Math.round(n * 100) / 100;
  const fallback: SettlementResult = {
    total: round(amount),
    workerPayout: round(amount * 0.98),
    pacsMaintenance: round(amount * 0.015),
    mutualAidFund: round(amount * 0.005),
    reference: `UBQ${Date.now().toString().slice(-8)}`,
  };
  const data = await post<Record<string, unknown>>("/api/bookings/verify-settle", {
    otp,
    amount,
    worker_id: workerId,
  });
  if (!data) return fallback;
  const s = (data["settlement"] ?? data) as Record<string, unknown>;
  return {
    total: num(s["total"] ?? s["amount"], fallback.total),
    workerPayout: num(s["worker_payout"] ?? s["worker"], fallback.workerPayout),
    pacsMaintenance: num(s["pacs_maintenance"] ?? s["pacs"], fallback.pacsMaintenance),
    mutualAidFund: num(s["mutual_aid_fund"] ?? s["mutual_aid"], fallback.mutualAidFund),
    reference: str(s["reference"] ?? s["txn_id"], fallback.reference),
  };
}

const VOICE_SAMPLES: Record<string, VoiceProfile> = {
  ta: {
    transcript:
      "என் பெயர் முருகன். நான் பத்து வருஷம் பிளம்பிங் வேலை செய்கிறேன். காந்திபுரம் பகுதியில் வேலை செய்வேன், ஒரு நாளுக்கு அறுநூறு ரூபாய்.",
    language: "Tamil",
    fullName: "Murugan S.",
    skill: "Plumbing",
    experience: "10 years",
    baseRate: 600,
    zone: "Gandhipuram, Coimbatore",
  },
  hi: {
    transcript:
      "मेरा नाम रमेश कुमार है। मैं आठ साल से बिजली का काम करता हूँ। करोल बाग इलाके में काम करता हूँ, दिन का पाँच सौ पचास रुपये।",
    language: "Hindi",
    fullName: "Ramesh Kumar",
    skill: "Electrical",
    experience: "8 years",
    baseRate: 550,
    zone: "Karol Bagh, Delhi",
  },
  te: {
    transcript:
      "నా పేరు వెంకటేష్. నేను ఏడు సంవత్సరాలు వడ్రంగి పని చేస్తున్నాను. కూకట్‌పల్లి ప్రాంతంలో పని, రోజుకు ఆరు వందల రూపాయలు.",
    language: "Telugu",
    fullName: "Venkatesh G.",
    skill: "Carpentry",
    experience: "7 years",
    baseRate: 620,
    zone: "Kukatpally, Hyderabad",
  },
  mr: {
    transcript:
      "माझं नाव संजय पाटील. मी बारा वर्षे गवंडी काम करतो. हडपसर भागात काम करतो, दिवसाचे सातशे रुपये.",
    language: "Marathi",
    fullName: "Sanjay Patil",
    skill: "Masonry",
    experience: "12 years",
    baseRate: 700,
    zone: "Hadapsar, Pune",
  },
  en: {
    transcript:
      "My name is Fatima Begum. I have six years of house cleaning experience. I work around Whitefield and my daily rate is five hundred rupees.",
    language: "English",
    fullName: "Fatima Begum",
    skill: "House Cleaning",
    experience: "6 years",
    baseRate: 500,
    zone: "Whitefield, Bengaluru",
  },
};

export async function voiceOnboard(lang: string): Promise<VoiceProfile> {
  const fallback = VOICE_SAMPLES[lang] ?? VOICE_SAMPLES["en"]!;
  const data = await post<Record<string, unknown>>("/api/workers/voice-onboard", {
    language: lang,
    transcript: fallback.transcript,
  });
  if (!data) return fallback;
  const p = (data["profile"] ?? data) as Record<string, unknown>;
  return {
    transcript: str(data["transcript"] ?? p["transcript"], fallback.transcript),
    language: str(p["language"], fallback.language),
    fullName: str(p["full_name"] ?? p["name"], fallback.fullName),
    skill: str(p["skill"] ?? p["primary_skill"], fallback.skill),
    experience: str(p["experience"], fallback.experience),
    baseRate: num(p["base_rate"] ?? p["rate"], fallback.baseRate),
    zone: str(p["zone"] ?? p["service_zone"], fallback.zone),
  };
}

export const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
