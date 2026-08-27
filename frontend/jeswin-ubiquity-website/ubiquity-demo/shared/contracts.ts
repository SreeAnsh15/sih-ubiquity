export type ServiceType = "Plumbing" | "Electrical" | "House Cleaning" | "Carpentry" | "Masonry";

export interface HealthResponse {
  status: string;
  database: boolean;
  voice_transcription_configured: boolean;
  profile_extraction_configured: boolean;
  demo_mode: boolean;
}

export interface BookingRequest {
  customer_id: string;
  service_type: ServiceType;
  customer_lat: number;
  customer_lng: number;
  emergency: boolean;
}

export interface WorkerMatch {
  worker_id: string;
  full_name: string;
  skill: string;
  distance_km: number;
  fair_match_score: number;
  fair_price_inr: number;
  commercial_aggregator_price_inr: number;
  customer_savings_inr: number;
  trust_rating: number;
  idle_days: number;
  lat: number;
  lng: number;
  verified: boolean;
  availability: string;
  phone: string;
  emergency_eligible: boolean;
}

export interface MatchResponse {
  status: string;
  cluster_id: string;
  service_requested: ServiceType;
  selected_best_match: WorkerMatch | null;
  all_ranked_candidates: WorkerMatch[];
  breakdown: { proximity: number; trust: number; idle: number };
  emergency_dispatch: {
    requested: boolean;
    radius_km: number;
    priority: "standard" | "high";
    requires_idle_worker: boolean;
  };
}

export interface CreateBookingRequest extends BookingRequest {
  worker_id: string;
  agreed_amount: number;
}

export interface BookingResponse {
  status: "confirmed";
  booking_id: string;
  worker_id: string;
  gross_amount: number;
  emergency: boolean;
  otp_expires_at: string;
  message: string;
  development_otp?: string;
  development_note?: string;
}

export interface SettlementResponse {
  status: "settled";
  booking_id: string;
  settlement_breakdown: {
    gross_amount_paid: number;
    direct_worker_payout_98pct: number;
    pacs_cooperative_maintenance_1_5pct: number;
    mutual_aid_emergency_pool_0_5pct: number;
  };
  reference: string;
}

export interface VoiceProfile {
  full_name: string;
  primary_skill: string;
  sub_skills: string[];
  experience_years: number;
  base_rate_inr: number;
  operating_zone: string;
}

export interface VoiceOnboardResponse {
  status: "success";
  transcript: string;
  transcription: string;
  name: string;
  trade: string;
  experience_years: number;
  base_rate: number;
  phone: string;
  locality: string;
  language: string;
  demo_fallback?: boolean;
  structured_profile: VoiceProfile;
}

export interface RegisterWorkerRequest extends VoiceProfile {
  transcript: string;
  language: string;
}

export interface RegisterWorkerResponse {
  status: "registered";
  member_id: string;
  pacs_member_id: string;
  verification_badge: "PACS_PENDING" | "PACS_VERIFIED";
  registered_at: string;
}

export interface AdminDashboard {
  status: string;
  cluster_id: string;
  registered_members: number;
  verified_workers: number;
  pending_verifications: number;
  active_cluster_gigs: number;
  pacs_maintenance_pool_inr: number;
  mutual_aid_reserve_fund_inr: number;
  fund_split: { pacs_maintenance_pct: number; mutual_aid_pct: number };
}

export interface VerificationItem {
  member_id: string;
  user_id: string;
  full_name: string;
  primary_skill: string;
  sub_skills: string[];
  experience_years: number;
  base_rate_inr: number;
  operating_zone: string;
  language: string;
  transcript: string;
  verification_status: "pending" | "approved";
  created_at: string;
}

export interface VerificationQueueResponse {
  status: string;
  items: VerificationItem[];
  count: number;
}

export interface ForecastItem {
  service_type: ServiceType;
  ward: string;
  historical_30d_jobs: number;
  predicted_next_30d_jobs: number;
  surge_percentage: number;
  signal: "high" | "watch" | "steady";
  driver: string;
}

export interface DemandForecastResponse {
  status: string;
  season: string;
  generated_at: string;
  seasonal_drivers: string[];
  forecast: ForecastItem[];
}

export interface WelfareClaim {
  claim_id: string;
  worker_id: string;
  amount_inr: number;
  reason: string;
  status: "pending" | "submitted" | "approved" | "rejected";
  created_at: string;
}

export interface WelfareLedgerRow {
  booking_id: string;
  date: string;
  service: string;
  customer_fee: number;
  worker_payout_98pct: number;
  reserve_contribution_0_5pct: number;
  reference: string;
}

export interface WelfareResponse {
  status: string;
  worker_id: string;
  member_id: string | null;
  full_name: string;
  primary_skill: string;
  verification_badge: "PACS_PENDING" | "PACS_VERIFIED";
  registration_status?: "pending_verification" | "approved";
  lifetime_jobs_completed: number;
  total_take_home_earnings_inr: number;
  accrued_mutual_aid_inr: number;
  emergency_relief_claimed_inr: number;
  available_relief_balance_inr: number;
  completed_jobs: WelfareLedgerRow[];
  emergency_relief_claims: WelfareClaim[];
}

export interface MutualAidClaimRequest {
  amount: number;
  reason: string;
}

export interface CancelResponse {
  status: "cancelled";
  booking_id: string;
}

export interface ApiErrorPayload {
  detail?: string;
}
