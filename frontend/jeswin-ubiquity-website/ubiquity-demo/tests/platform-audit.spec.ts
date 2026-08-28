import { test, expect, type Page } from "@playwright/test";

const workers = [
  { worker_id: "worker_1", full_name: "Anbu Kumar", skill: "Plumbing", distance_km: 0.8, fair_match_score: 0.91, fair_price_inr: 262, commercial_aggregator_price_inr: 354, customer_savings_inr: 92, trust_rating: 0.92, idle_days: 9, lat: 11.0168, lng: 76.9558, verified: true, availability: "online" },
  { worker_id: "worker_2", full_name: "Vikram Malhotra", skill: "Electrical", distance_km: 1.4, fair_match_score: 0.84, fair_price_inr: 321, commercial_aggregator_price_inr: 433, customer_savings_inr: 112, trust_rating: 0.88, idle_days: 5, lat: 11.0200, lng: 76.9600, verified: true, availability: "online" },
  { worker_id: "worker_3", full_name: "Warna S.", skill: "Carpentry", distance_km: 2.1, fair_match_score: 0.79, fair_price_inr: 382, commercial_aggregator_price_inr: 516, customer_savings_inr: 134, trust_rating: 0.84, idle_days: 3, lat: 11.0120, lng: 76.9490, verified: true, availability: "online" },
];

const matchResponse = (emergency = false) => ({ status: "success", cluster_id: "coimbatore-gandhipuram", service_requested: "Plumbing", selected_best_match: workers[0], all_ranked_candidates: emergency ? [workers[0]] : workers, breakdown: { proximity: 45, trust: 35, idle: 20 }, emergency_dispatch: { requested: emergency, radius_km: emergency ? 2 : 5, priority: emergency ? "high" : "standard", requires_idle_worker: emergency } });

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/workers" || path === "/api/matching/roster") return route.fulfill({ json: matchResponse(url.searchParams.get("emergency") === "true") });
    if (path === "/api/bookings/match-and-price") return route.fulfill({ json: matchResponse(true) });
    if (path === "/api/bookings" && route.request().method() === "POST") return route.fulfill({ json: { status: "confirmed", booking_id: "bk_e2e_123456", worker_id: "worker_1", gross_amount: 262, emergency: true, otp_expires_at: "2099-01-01T00:00:00+00:00", message: "Booking confirmed", development_otp: "2468", development_note: "Demo OTP" } });
    if (path === "/api/bookings/verify-settle") return route.fulfill({ json: { status: "settled", booking_id: "bk_e2e_123456", settlement_breakdown: { gross_amount_paid: 262, direct_worker_payout_98pct: 256.76, pacs_cooperative_maintenance_1_5pct: 3.93, mutual_aid_emergency_pool_0_5pct: 1.31 }, reference: "LEDGER-E2E" } });
    if (path === "/api/workers/welfare") return route.fulfill({ json: { status: "success", worker_id: "worker_1", member_id: "PACS-E2E", full_name: "Anbu Kumar", primary_skill: "Plumbing", verification_badge: "PACS_VERIFIED", lifetime_jobs_completed: 8, total_take_home_earnings_inr: 15680, accrued_mutual_aid_inr: 80, emergency_relief_claimed_inr: 0, available_relief_balance_inr: 80, completed_jobs: [], emergency_relief_claims: [], registration_status: "approved" } });
    if (path === "/api/workers/welfare/claims") return route.fulfill({ json: { status: "submitted", claim_id: "claim-e2e", submitted_at: new Date().toISOString() } });
    if (path === "/api/admin/dashboard") return route.fulfill({ json: { status: "success", cluster_id: "coimbatore-gandhipuram", registered_members: 3, verified_workers: 3, pending_verifications: 0, active_cluster_gigs: 1, pacs_maintenance_pool_inr: 120, mutual_aid_reserve_fund_inr: 40, fund_split: { pacs_maintenance_pct: 1.5, mutual_aid_pct: 0.5 } } });
    if (path === "/api/admin/verification-queue") return route.fulfill({ json: { status: "success", items: [], count: 0 } });
    if (path === "/api/admin/mutual-aid-claims") return route.fulfill({ json: { status: "success", claims: [{ claim_id: "claim-e2e", worker_id: "worker_1", amount_inr: 40, reason: "Medical: clinic visit", status: "pending", created_at: "2099-01-01T00:00:00Z" }], count: 1 } });
    if (path.includes("/api/admin/mutual-aid-claims/") && path.endsWith("/approve")) return route.fulfill({ json: { status: "approved", claim_id: "claim-e2e" } });
    if (path === "/api/admin/demand-forecast") return route.fulfill({ json: { status: "success", season: "Monsoon", generated_at: "2099-01-01T00:00:00Z", seasonal_drivers: ["Rainfall"], forecast: [] } });
    if (path === "/api/workers/voice-onboard") return route.fulfill({ json: { status: "success", transcript: "My name is David Joseph.", transcription: "My name is David Joseph.", name: "David Joseph", trade: "Carpentry", experience_years: 8, base_rate: 350, phone: "+919876543221", locality: "Gandhipuram", language: "en", demo_fallback: false, structured_profile: { full_name: "David Joseph", primary_skill: "Carpentry", sub_skills: ["Woodwork"], experience_years: 8, base_rate_inr: 350, operating_zone: "Gandhipuram" } } });
    return route.fulfill({ json: { status: "success" } });
  });
}

async function prepare(page: Page, customer = false) {
  await mockApi(page);
  await page.addInitScript(({ customer }) => {
    localStorage.setItem("ubiquity.user-id", customer ? "demo-customer" : "worker_1");
    if (customer) sessionStorage.setItem("ubiquity.customer", JSON.stringify({ name: "Rahul Kumar", phone: "+91 98765 43210", ward: "Gandhipuram Ward 12" }));
  }, { customer });
}

test.describe("Ubiquity platform browser audit", () => {
  test("Citizen categories, live roster, emergency dispatch, and OTP autofill settle cleanly", async ({ page }) => {
    await prepare(page, true);
    const consoleErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto("/customer");
    await expect(page.getByRole("heading", { name: /Trusted help, close to home/i })).toBeVisible();
    await page.getByRole("button", { name: /Electrical/i }).click();
    await page.getByRole("button", { name: /Search live roster/i }).click();
    await expect(page.getByText("Anbu Kumar")).toBeVisible();
    await page.getByRole("button", { name: /Emergency Service/i }).click();
    await expect(page.getByText(/2 km priority/i).first()).toBeVisible();
    await page.getByRole("button", { name: /Request Automated Cooperative Dispatch/i }).click();
    await expect(page.getByRole("heading", { name: /Book Anbu Kumar/i })).toBeVisible();
    await page.getByRole("button", { name: /Confirm booking/i }).click();
    await expect(page.getByText(/Worker Completion OTP:.*2468/i)).toBeVisible();
    await page.getByRole("button", { name: /Auto-fill OTP/i }).click();
    await expect(page.getByLabel("Completion OTP")).toHaveValue("2468");
    await page.getByRole("button", { name: /Verify & Settle/i }).click();
    await expect(page.getByText(/Settlement complete/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });

  test("Worker dropdown switches sessions and emergency claim modal submits", async ({ page }) => {
    await prepare(page);
    await page.goto("/worker");
    await expect(page.getByText(/Your work, your welfare/i)).toBeVisible();
    await page.getByRole("button", { name: /Worker Passbook/i }).click();
    await expect(page.getByText("Vikram Malhotra")).toBeVisible();
    await page.getByRole("button", { name: /Vikram Malhotra/i }).click();
    await expect(page.getByText(/Your work, your welfare/i)).toBeVisible();
    await page.getByRole("button", { name: /Worker Passbook/i }).click();
    await page.getByRole("button", { name: /Request Emergency Claim/i }).click();
    await expect(page.getByRole("heading", { name: /Request emergency claim/i })).toBeVisible();
    await page.getByLabel("Claim category").selectOption({ label: "Medical" });
    await page.getByLabel("Amount requested").fill("20");
    await page.getByLabel("Reason").fill("Clinic visit");
    await page.getByRole("button", { name: /Submit emergency claim/i }).click();
    await expect(page.getByText(/Emergency claim submitted/i)).toBeVisible();
  });

  test("Admin dashboard exposes verification and mutual-aid governance controls", async ({ page }) => {
    await prepare(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Verification queue/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Mutual-Aid Claims/i })).toBeVisible();
    await expect(page.getByText(/Medical: clinic visit/i)).toBeVisible();
    await page.getByRole("button", { name: /Approve/i }).click();
  });

  test("Voice onboarding exposes editable review form and live recording state", async ({ page }) => {
    await prepare(page);
    await page.addInitScript(() => {
      class FakeRecorder { static isTypeSupported() { return true; } ondataavailable = (_event: unknown) => {}; onstop = () => {}; mimeType = "audio/webm;codecs=opus"; constructor() {} start() {} stop() {} }
      Object.defineProperty(window, "MediaRecorder", { value: FakeRecorder, configurable: true });
      Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => ({ getTracks: () => [] }) }, configurable: true });
      Object.defineProperty(window, "AudioContext", { value: class { createAnalyser() { return { fftSize: 256, smoothingTimeConstant: 0.7, getByteTimeDomainData: (data: Uint8Array) => data.fill(128) }; } createMediaStreamSource() { return { connect: () => {} }; } close() { return Promise.resolve(); } }, configurable: true });
    });
    await page.goto("/worker/onboard");
    await expect(page.getByText(/Register as a worker/i)).toBeVisible();
    await page.getByRole("button", { name: /Record microphone/i }).click();
    await expect(page.getByRole("button", { name: /Stop microphone/i })).toBeVisible();
    await expect(page.getByText(/Listening|Voice Detected/i)).toBeVisible();
    await page.getByRole("button", { name: /Stop microphone/i }).click();
    await page.getByRole("button", { name: /Sample Voice Demo/i }).click();
    await expect(page.getByRole("heading", { name: /Review before PACS submission/i })).toBeVisible();
  });
});
