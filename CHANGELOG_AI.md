# AI Technical Changelog — `jeswin`

**Repository:** [SreeAnsh15/sih-ubiquity](https://github.com/SreeAnsh15/sih-ubiquity)  
**Branch:** `jeswin`  
**Scope:** Chronological record of architectural updates, bug fixes, tests, dependency changes, and evaluator documentation.  
**Author:** Manus AI

## Current State

The branch is a FastAPI/SQLite cooperative gig-service prototype with a dedicated Jeswin React/Vite frontend. The core demo path is real rather than simulated: a customer requests a service, receives ranked PACS worker matches and transparent pricing, creates a persisted booking, verifies a four-digit completion OTP, and records the cooperative ledger split. The active frontend also includes a Leaflet map, resilient avatars, a customer dashboard, worker/profile route, and PACS admin dashboard.

The branch is **demo-ready for the matching, pricing, booking, settlement, and basic governance narrative**. It remains **not production-ready** for real authentication, payments, welfare claims, learned forecasting, and sensitive voice-data governance. See [`SIH_FEATURE_COMPLETION_REPORT.md`](./SIH_FEATURE_COMPLETION_REPORT.md) for the full evaluator matrix.

## Chronological History

### 2026-08-26 — `a5e3996` — Initial Ubiquity FastAPI backend

Created the initial backend service in `backend/main.py`. The implementation established FastAPI routes, SQLite initialization, seeded cooperative workers, service base rates, Haversine distance calculation, worker matching, booking creation, OTP generation, and settlement persistence. The first schema introduced `workers`, `bookings`, and `settlements`.

### 2026-08-26 — `2eafa80` — Initialize README with project overview

Added the initial project overview, local setup commands, repository structure, API contract, and booking-flow explanation. This established the SIH26089/PACS cooperative framing and documented the prototype’s intended 98% / 1.5% / 0.5% allocation.

### 2026-08-26 — `60d321a` — Add Lovable frontend prototype

Added the original frontend prototype under `frontend/lovable-ui/` with React/TanStack scaffolding, UI primitives, static/mock service concepts, and early customer/worker interaction surfaces. This was the visual and interaction baseline from which later Jeswin work diverged.

### 2026-08-26 — `23d74eb` — Harden booking security and fix frontend contracts

Strengthened backend booking lifecycle behavior and aligned the first frontend contracts with the API. The backend added or hardened OTP expiry, failed-attempt locking, cluster binding, cancellation, worker-capacity release after expiry, registration uniqueness, and ownership checks. The associated tests expanded to five cases covering matching/booking/settlement, identity and validation, registration uniqueness, expiry and cluster enforcement, and cancellation/OTP lockout.

The hardening pass also identified the remaining prototype security boundary: the application accepts a client-supplied `X-User-Id` and therefore requires a real session/token issuer before production use.

### 2026-08-26 — `7fbc4cd` — Merge booking hardening audit fixes

Merged the hardened backend and contract changes into the branch history. This preserved the test-backed booking lifecycle and documented production gaps around authentication, payment movement, SQLite concurrency, floating-point money, and data retention.

### 2026-08-27 — `045ebc1` — Create Jeswin web folder

Introduced the Jeswin-specific web workspace under `frontend/jeswin-ubiquity-website/`, providing the target location for the extracted `ubiquity-demo` application.

### 2026-08-27 — `1069db9` — Rename README to READMEpls

Renamed the Jeswin folder-level README as part of the imported frontend workspace history. This left root documentation and folder-level documentation temporarily out of sync, which remains a cleanup item for future maintainers.

### 2026-08-27 — `93c80ce` — Add files via upload

Added the archived Jeswin `ubiquity-demo` frontend source, including the Vite/React project, UI primitives, original mock data, page components, package metadata, and lockfile. The archive supplied the visual starting point for the dedicated frontend path.

### 2026-08-27 — `ec97259` — Update READMEpls

Updated the imported Jeswin workspace documentation. The root README remains the more authoritative architectural description, although some path/default references are now stale and should be synchronized.

### 2026-08-27 — `8ab1b42` — Fix Jeswin routing map and booking settlement UX

This was the principal frontend-backend integration pass.

**Backend changes in `backend/main.py`:**

- Added and aligned SQLite persistence for `worker_registrations`, including PACS member IDs, worker profile data, transcripts, language, and verification status.
- Added `POST /api/workers/register` for persisted PACS worker registration.
- Added PACS admin authorization via the configured `ADMIN_USER_IDS` allow-list.
- Added `GET /api/admin/dashboard` for registered members, verified workers, pending verifications, active cluster gigs, PACS maintenance pool, mutual-aid reserve, and fund split.
- Added `GET /api/admin/verification-queue` for pending worker registrations.
- Added `POST /api/admin/verification-queue/{member_id}/approve` to promote a registration into the verified worker roster.
- Added `GET /api/admin/demand-forecast` for seasonal and ward-level demand signals.
- Extended booking schemas and matching behavior for emergency dispatch, including the `< 2 km` priority radius in the later restoration pass.

**Frontend changes in `frontend/jeswin-ubiquity-website/ubiquity-demo/`:**

- Added `client/src/lib/api.ts`, a typed REST client for health, matching, booking, cancellation, settlement, voice onboarding, registration, admin, and welfare API paths, with centralized informative errors.
- Added `shared/contracts.ts` for TypeScript domain contracts covering workers, bookings, settlement, registration, admin, forecast, voice, and welfare concepts.
- Replaced the mock-driven customer page with a live API-backed `HomePage`.
- Added `BookingModal` for fair-price confirmation, development OTP handling, settlement, and ledger display.
- Added `Settlement` rendering for the 98% worker, 1.5% PACS, and 0.5% mutual-aid allocation.
- Added Leaflet `MapContainer`, OpenStreetMap tiles, customer location, worker pins, fit-to-results behavior, and pricing/trade popups.
- Added the Wouter route shell in `client/src/App.tsx` for `/`, `/worker`, `/profile`, and `/admin`.
- Added the PACS `AdminDashboardPage` with metrics, verification queue, approval controls, and demand forecast.
- Added inline SVG branding and initials avatars to avoid broken external images.
- Replaced the legacy stylesheet with the Bharat-DPI slate, saffron, and emerald visual system.
- Removed inactive mock data/services, obsolete image-based screens, and unused legacy map/tracker modules.
- Added the Leaflet runtime and type dependencies to `package.json` and `pnpm-lock.yaml`.
- Restored the retained `useComposition` / `usePersistFn` hooks needed by UI primitives.

### 2026-08-27 — `f0e1c0a` — Restore rich Jeswin dashboard and demo auth

Restored the richer customer workspace while preserving the real integration path.

**Authentication and backend:**

- Changed the backend `DEMO_MODE` default to `true` for isolated hackathon presentations, while keeping signed authentication required when `DEMO_MODE=false`.
- Updated `backend/.env.example` to document the presentation default and production override.
- Added the `emergency` request field to `BookingRequest` and `CreateBookingRequest`.
- Enforced the emergency `< 2 km` filter in both matching and booking creation.
- Added `emergency_dispatch` metadata to match responses.

**Frontend dashboard:**

- Hardened `getIdentity()` and the shared request helper so a non-empty `X-User-Id` is always sent, defaulting to `demo-customer`.
- Restored the “Good morning, Rahul” header, account pill, notification badge, and Tamil language switcher.
- Added the active trade carousel for Plumbing, Electrical, Cleaning, and Carpentry.
- Added Phase 2 cards for AC Repair, Appliance Repair, Painting, and Pest Control with a graceful expansion toast.
- Added the red Emergency Service toggle and priority state.
- Restored the richer worker-card presentation with avatar initials, PACS verification, distance, idle days, rating, fair quote, and booking CTA.
- Added the Next Service card, which updates when a booking is confirmed.
- Preserved the Leaflet map, cooperative transparency card, booking modal, OTP flow, settlement card, `/admin` route, and Admin Portal sidebar item.

## Current API Surface

| Method | Endpoint | Purpose | Status |
|---|---|---|---|
| `GET` | `/` | Service root and version | Implemented |
| `GET` | `/api/health` | Database, voice configuration, and demo-mode status | Implemented |
| `POST` | `/api/bookings/match-and-price` | Verified worker matching, fair price, aggregator comparison, emergency filtering | Implemented |
| `POST` | `/api/bookings` | Booking persistence and development OTP | Implemented |
| `DELETE` | `/api/bookings/{booking_id}/cancel` | Authorized cancellation | Implemented |
| `POST` | `/api/bookings/verify-settle` | OTP validation and ledger settlement | Implemented |
| `POST` | `/api/workers/voice-onboard` | Multipart transcription and profile extraction | Implemented but provider-dependent |
| `POST` | `/api/workers/register` | PACS worker registration | Implemented |
| `GET` | `/api/admin/dashboard` | Federation metrics | Implemented |
| `GET` | `/api/admin/verification-queue` | Pending PACS registrations | Implemented |
| `POST` | `/api/admin/verification-queue/{member_id}/approve` | Approve and roster a worker | Implemented |
| `GET` | `/api/admin/demand-forecast` | Seasonal and ward forecast ruleset | Implemented as deterministic prototype |
| `GET` | `/api/workers/welfare` | Intended welfare passbook | Not implemented; frontend client reference only |
| `POST` | `/api/workers/welfare/claims` | Intended emergency relief claim submission | Not implemented; frontend client reference only |

## Verification and Test Coverage

The backend suite in `backend/test_main.py` contains five tests. It covers the happy-path match/booking/settlement flow, wrong OTP and repeat settlement rejection, identity and invalid-service validation, worker-registration uniqueness, expiry release and cluster enforcement, cancellation, and OTP lockout. The admin, demand forecast, welfare, and voice-provider paths are not covered by automated tests.

The successful local verification commands are:

```bash
python -m py_compile backend/main.py
cd frontend/jeswin-ubiquity-website/ubiquity-demo
pnpm check
pnpm build
```

The current build emits non-blocking Vite warnings for unset Umami placeholders (`VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID`). These warnings do not prevent TypeScript checking or bundle generation.

## References

[1]: https://github.com/SreeAnsh15/sih-ubiquity/tree/jeswin "SreeAnsh15/sih-ubiquity — jeswin branch"

[2]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/backend/main.py "FastAPI backend and SQLite implementation"

[3]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/backend/test_main.py "Backend regression tests"

[4]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/frontend/jeswin-ubiquity-website/ubiquity-demo/client/src/pages/Home.tsx "Jeswin frontend page implementation"

[5]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/frontend/jeswin-ubiquity-website/ubiquity-demo/client/src/lib/api.ts "Jeswin frontend REST client"

[6]: https://github.com/SreeAnsh15/sih-ubiquity/commits/jeswin "Jeswin branch commit history"
