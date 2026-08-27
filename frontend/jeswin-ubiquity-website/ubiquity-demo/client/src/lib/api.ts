import type {
  AdminDashboard,
  BookingRequest,
  BookingResponse,
  CancelResponse,
  CreateBookingRequest,
  DemandForecastResponse,
  HealthResponse,
  MatchResponse,
  MutualAidClaimRequest,
  RegisterWorkerRequest,
  RegisterWorkerResponse,
  SettlementResponse,
  VerificationQueueResponse,
  VoiceOnboardResponse,
  WelfareResponse,
} from "@shared/contracts";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const USER_ID_KEY = "ubiquity.user-id";
const USER_SIGNATURE_KEY = "ubiquity.user-signature";

export const apiConfig = { baseUrl: API_BASE_URL };

export function getIdentity(): { userId: string; signature?: string } {
  const storedUserId = localStorage.getItem(USER_ID_KEY)?.trim();
  const userId = storedUserId || "demo-customer";
  const signature = localStorage.getItem(USER_SIGNATURE_KEY) || undefined;
  return { userId, signature };
}

export function setIdentity(userId: string, signature?: string) {
  localStorage.setItem(USER_ID_KEY, userId.trim() || "demo-customer");
  if (signature) localStorage.setItem(USER_SIGNATURE_KEY, signature);
  else localStorage.removeItem(USER_SIGNATURE_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const identity = getIdentity();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-User-Id", identity.userId || "demo-customer");
  if (identity.signature) headers.set("X-User-Signature", identity.signature);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = typeof payload === "object" && payload && "detail" in payload ? String(payload.detail) : "The service returned an unexpected error.";
    throw new Error(`${detail} (${response.status})`);
  }
  return payload as T;
}

function jsonRequest<T>(path: string, body: unknown, method = "POST") {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  matchWorkers: (body: BookingRequest) => jsonRequest<MatchResponse>("/api/bookings/match-and-price", body),
  createBooking: (body: CreateBookingRequest) => jsonRequest<BookingResponse>("/api/bookings", body),
  cancelBooking: (bookingId: string) => request<CancelResponse>(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: "DELETE" }),
  settleBooking: (body: { booking_id: string; worker_id: string; cluster_id: string; gross_amount: number; otp_code: string }) => jsonRequest<SettlementResponse>("/api/bookings/verify-settle", body),
  voiceOnboard: async (audio: Blob, language: string, sample = false) => {
    const form = new FormData();
    form.append("audio_file", audio, sample ? "sample-voice.webm" : "voice.webm");
    form.append("preferred_language", language);
    form.append("language_hint", language);
    return request<VoiceOnboardResponse>("/api/workers/voice-onboard", { method: "POST", body: form });
  },
  registerWorker: (body: RegisterWorkerRequest) => jsonRequest<RegisterWorkerResponse>("/api/workers/register", body),
  adminDashboard: () => request<AdminDashboard>("/api/admin/dashboard"),
  verificationQueue: () => request<VerificationQueueResponse>("/api/admin/verification-queue"),
  approveWorker: (memberId: string) => jsonRequest<{ status: string; member_id: string; worker_id: string; verification_badge: string }>(`/api/admin/verification-queue/${encodeURIComponent(memberId)}/approve`, {}),
  demandForecast: () => request<DemandForecastResponse>("/api/admin/demand-forecast"),
  workerWelfare: (workerId?: string) => request<WelfareResponse>(`/api/workers/welfare${workerId ? `?worker_id=${encodeURIComponent(workerId)}` : ""}`),
  submitClaim: (body: MutualAidClaimRequest) => jsonRequest<{ status: string; claim_id: string; submitted_at: string }>("/api/workers/welfare/claims", body),
};

export { API_BASE_URL };
