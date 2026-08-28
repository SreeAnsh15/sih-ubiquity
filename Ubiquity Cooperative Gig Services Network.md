# Ubiquity Cooperative Gig Services Network

> **A PACS-powered digital public infrastructure for fair, local, and welfare-aware gig services.**

Ubiquity is a Smart India Hackathon prototype for **SIH26089**, designed to connect citizens with verified local service workers through cooperative societies such as PACS. Instead of treating workers as anonymous supply for a commercial aggregator, Ubiquity combines explainable matching, transparent pricing, OTP-backed completion, cooperative settlement, worker welfare, multilingual onboarding, and PACS governance in one platform.

The current prototype demonstrates the complete service loop:

```text
Citizen selects a service
        ↓
Live PACS worker roster and transparent quote
        ↓
Automated proximity + trust + idle-rotation dispatch
        ↓
Booking confirmation and completion OTP
        ↓
98% worker payout · 1.5% PACS maintenance · 0.5% mutual aid
        ↓
Worker passbook, welfare reserve, and PACS governance
```

## Table of Contents

- [Why Ubiquity](#why-ubiquity)
- [Implemented capabilities](#implemented-capabilities)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Environment configuration](#environment-configuration)
- [Running the platform](#running-the-platform)
- [Core API endpoints](#core-api-endpoints)
- [Matching and cooperative economics](#matching-and-cooperative-economics)
- [Three persona demo](#three-persona-demo)
- [Testing](#testing)
- [Security and production limitations](#security-and-production-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why Ubiquity

Local service workers often face irregular demand, opaque pricing, limited bargaining power, and little protection when work stops. Citizens, meanwhile, may not know whether a worker is verified, whether a quote is fair, or where their money goes after a service is completed.

Ubiquity addresses these problems with five design principles:

| Principle | Platform behavior |
|---|---|
| **Cooperative ownership** | PACS societies verify workers, govern the network, receive a maintenance share, and administer mutual-aid claims. |
| **Explainable allocation** | Matching exposes proximity, trust, availability, and idle-day rotation instead of returning an opaque recommendation. |
| **Transparent economics** | Citizens see the cooperative quote and comparison amount before confirming a booking. |
| **Worker welfare** | Every completed settlement contributes to a mutual-aid reserve visible in the worker passbook. |
| **Inclusive onboarding** | Workers can use voice onboarding in regional languages, a sample demo, or an editable manual form. |

## Implemented capabilities

### Citizen services and automated dispatch

The `/customer` experience provides service categories for Plumbing, Electrical, Carpentry, and Cleaning. Selecting a supported category queries the live backend roster. The citizen can see PACS-verified workers, distance, trust rating, idle days, fair pricing, commercial-aggregator comparison, and map pins.

The primary booking action is **Request Automated Cooperative Dispatch**. It uses the backend’s ranked result rather than requiring the citizen to cherry-pick a worker. Emergency Service is an independent priority mode that narrows matching to a strict radius of less than two kilometres for urgent repair scenarios.

### Cooperative matching and anti-starvation rotation

The backend calculates distance using the haversine formula and ranks eligible workers using an explainable score:

```text
match score =
    0.45 × proximity score
  + 0.35 × trust rating
  + 0.20 × idle-day equalizer
```

Candidates must be verified, online, compatible with the requested trade, within the relevant radius, and below their active booking capacity. The idle-day component gives workers who have waited longer a fairer opportunity to receive the next gig.

### Fair pricing and settlement

The prototype calculates a cooperative quote from a service base rate and distance component. Before booking, the customer can compare the cooperative amount with a commercial aggregator estimate and see the savings.

After the service is finished, the booking is completed through an OTP-protected settlement flow. The persisted cooperative ledger split is:

| Recipient | Share | Purpose |
|---|---:|---|
| Worker | **98.0%** | Direct worker take-home payout |
| PACS society | **1.5%** | Cooperative maintenance pool |
| Mutual aid | **0.5%** | Worker emergency welfare reserve |

The demo completion modal displays the booking OTP and provides an **Auto-fill OTP** helper. The backend also accepts the demo master OTPs `1234`, `0000`, `8888`, and `1232` for evaluator convenience when demo mode is enabled or during local presentation flows.

> The current settlement records the split in the cooperative ledger. It does not transfer real money through UPI, a bank, or a payment gateway.

### Worker passbook and welfare

The `/worker` persona provides a worker-facing digital passbook with:

- Total 98% take-home earnings.
- Accrued and available mutual-aid balance.
- Completed job ledger with customer fee, worker payout, reserve contribution, and settlement reference.
- Dynamic worker dropdown for switching between registered worker profiles.
- Emergency claim modal with Medical, Tool Repair, and Income Loss categories.
- Pending and approved claim history.

Claims are reserve-bounded, stored in SQLite, and made available to PACS administrators for review.

### PACS administration

The `/admin` persona provides a PACS governance dashboard with:

- Registered member and verified worker metrics.
- Active cluster gig counts.
- PACS maintenance and mutual-aid reserve totals.
- Worker verification queue with approval action.
- Seasonal and ward-level demand forecast card.
- Mutual-aid claims queue with approval action.

Approving a worker registration promotes that profile into the active worker roster.

### Voice onboarding and multilingual extraction

The `/worker/onboard` flow supports browser microphone capture with a real-time visualizer and softer-voice detection. The frontend prefers `audio/webm;codecs=opus`, requests mono 16 kHz audio, and sends the recording as multipart form data.

When configured, the backend sends uploaded audio to **Google Gemini 2.5 Flash** for one-call transcription and structured extraction. The extraction prompt supports Tamil, Telugu, Hindi, and English and normalizes worker trades to standard English categories such as Plumbing, Electrical, Carpentry, Masonry, Painting, Appliance Repair, Welding, and Cleaning.

The flow remains demo-safe when microphone permissions or AI credentials are unavailable:

1. Use the sample voice profile.
2. Review and edit the extracted fields.
3. Submit the profile to the PACS verification queue.

If a real uploaded recording reaches Gemini but contains no intelligible speech, the backend returns an explicit re-recording error rather than silently substituting a dummy worker.

### Live transparency map

The Citizen view uses Leaflet and OpenStreetMap tiles to render:

- The citizen’s service location.
- Current worker pins returned by the backend.
- Worker trade, distance, and fair quote in map popups.
- A visual emergency-radius state when the strict priority filter is active.

### Multilingual and resilient demo UX

The global language selector supports English, Tamil, and Telugu for key headings, greetings, service labels, and actions. Local demo identity initialization prevents a presentation from being blocked by missing production authentication configuration. API failures are surfaced through readable UI notifications rather than silent fabricated success states.

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ React + Vite frontend :3000                                 │
│ Wouter routes · Leaflet map · MediaRecorder · persona UI     │
│ Shared TypeScript contracts · centralized API client         │
└───────────────────────────────┬──────────────────────────────┘
                                │ HTTP/JSON + multipart audio
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ FastAPI backend :8000                                        │
│ Auth boundary · matching · booking · OTP · welfare · admin  │
│ Gemini voice extraction · fair pricing · settlement logic    │
└───────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ SQLite                                                         │
│ workers · bookings · settlements · registrations             │
│ welfare_claims                                                 │
└──────────────────────────────────────────────────────────────┘
```

The frontend API client reads `VITE_API_BASE_URL`, defaults to `http://localhost:8000`, and sends the active `X-User-Id` identity header. The backend uses a local demo identity when `DEMO_MODE=true` or when no production authentication secret is configured. Production deployments must replace this prototype identity boundary with a real authenticated session or token provider.

## Repository structure

```text
.
├── backend/
│   ├── main.py                 # FastAPI service and SQLite business logic
│   ├── test_main.py            # Backend regression tests
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Backend environment template
├── frontend/
│   └── jeswin-ubiquity-website/
│       └── ubiquity-demo/
│           ├── client/
│           │   ├── src/pages/  # Landing, Citizen, Worker, Admin, onboarding UI
│           │   ├── src/lib/    # Centralized API client and utilities
│           │   └── src/index.css
│           ├── shared/
│           │   └── contracts.ts # Shared frontend/backend TypeScript shapes
│           ├── tests/
│           │   └── platform-audit.spec.ts # Playwright browser audit
│           ├── package.json
│           └── playwright.config.ts
├── PROJECT_AUDIT_AND_GAP_ANALYSIS.md
├── SIH_FEATURE_COMPLETION_REPORT.md
├── CHANGELOG_AI.md
└── README.md
```

## Prerequisites

Install the following before starting local development:

| Requirement | Recommended version |
|---|---|
| Python | 3.10 or newer |
| Node.js | 20 or newer |
| pnpm | 10 or newer |
| Git | Current stable version |
| Chromium | Installed automatically by Playwright when needed |

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/SreeAnsh15/sih-ubiquity.git
cd sih-ubiquity
```

The current integrated frontend is under the Jeswin workspace:

```text
frontend/jeswin-ubiquity-website/ubiquity-demo/
```

### 2. Configure and start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend initializes the SQLite database at the path configured by `DB_PATH`. The default `.env.example` is suitable for a local hackathon demo. Do not commit `.env` or real credentials.

### 3. Configure and start the frontend

In a second terminal:

```bash
cd frontend/jeswin-ubiquity-website/ubiquity-demo
pnpm install
pnpm dev -- --host 0.0.0.0 --port 3000
```

Open [http://localhost:3000](http://localhost:3000). The landing page provides links to Citizen, Worker, Worker Onboarding, and PACS Admin personas.

## Environment configuration

### Backend: `backend/.env`

Start from the committed template:

```bash
cp backend/.env.example backend/.env
```

| Variable | Local demo behavior | Production guidance |
|---|---|---|
| `DEMO_MODE` | Set `true` to enable demo identity and evaluator OTP helpers. | Set `false`. |
| `AUTH_SECRET` | Optional for local demo. | Use a strong secret and a real signed/session identity integration. |
| `DB_PATH` | Defaults to `./ubiquity.db`. | Use managed database configuration and migrations. |
| `ALLOWED_ORIGINS` | Allows local ports 5173 and 3000 by default. | Restrict to deployed frontend origins. |
| `GEMINI_API_KEY` | Enables real Gemini audio extraction. | Store in a secret manager; configure quotas and monitoring. |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash`. | Pin and monitor the approved production model. |
| `OPENAI_API_KEY` | Optional legacy transcription/provider configuration. | Configure only if the deployment uses it. |
| `OPENAI_TRANSCRIPTION_MODEL` | Defaults to `whisper-1`. | Use the approved provider/model policy. |

### Frontend: optional `.env.local`

```bash
cd frontend/jeswin-ubiquity-website/ubiquity-demo
printf 'VITE_API_BASE_URL=http://localhost:8000\n' > .env.local
```

If `VITE_API_BASE_URL` is omitted, the client defaults to `http://localhost:8000`.

## Core API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Reports backend and AI configuration status. |
| `POST` | `/api/auth/dev-token` | Issues a local development identity response. |
| `POST` | `/api/workers/voice-onboard` | Transcribes/extracts uploaded audio or returns a language fallback. |
| `POST` | `/api/workers/register` | Creates a PACS-pending worker registration. |
| `GET` | `/api/workers` | Returns the live worker roster with optional service and emergency filters. |
| `GET` | `/api/matching/roster` | Returns the matching-shaped live roster response. |
| `POST` | `/api/bookings/match-and-price` | Ranks eligible workers and calculates fair quotes. |
| `POST` | `/api/bookings` | Creates a confirmed booking. |
| `POST` | `/api/bookings/verify-settle` | Verifies completion OTP and records the cooperative settlement split. |
| `DELETE` | `/api/bookings/{booking_id}/cancel` | Cancels an eligible confirmed booking. |
| `GET` | `/api/workers/welfare` | Returns passbook earnings, reserve balance, ledger, and claims. |
| `POST` | `/api/workers/welfare/claims` | Submits a reserve-bounded emergency welfare claim. |
| `GET` | `/api/admin/dashboard` | Returns PACS metrics and cooperative pool totals. |
| `GET` | `/api/admin/verification-queue` | Lists pending worker registrations. |
| `POST` | `/api/admin/verification-queue/{member_id}/approve` | Approves and promotes a worker. |
| `GET` | `/api/admin/mutual-aid-claims` | Lists welfare claims for governance review. |
| `POST` | `/api/admin/mutual-aid-claims/{claim_id}/approve` | Approves a mutual-aid claim. |
| `GET` | `/api/admin/demand-forecast` | Returns seasonal and ward-level demand signals. |

All protected prototype requests use the `X-User-Id` header. The frontend adds it automatically from local storage, defaulting to `demo-customer` for a local demonstration.

## Matching and cooperative economics

The current matching implementation is intentionally explainable. For every eligible worker, it calculates distance, fair quote, trust contribution, and idle-day contribution. A normal search uses a five-kilometre cluster radius. Emergency mode uses a strict less-than-two-kilometre radius and prioritizes an urgent response.

The current fair-price formula is:

```text
fair price = service base rate + (distance in kilometres × ₹15)
```

The current demo ledger formula is:

```text
worker payout   = gross amount × 0.98
PACS maintenance = gross amount × 0.015
mutual aid       = gross amount − worker payout − PACS maintenance
```

For production financial systems, replace floating-point currency arithmetic with integer paise or a decimal money type, connect a payment provider, implement idempotent webhooks, and reconcile payout state against an external ledger.

## Three persona demo

### Citizen: `/customer`

1. Select **Citizen / Book Services** from the landing page.
2. Choose Plumbing, Electrical, Carpentry, or Cleaning.
3. Click **Search live roster** and show the worker cards plus Leaflet pins.
4. Explain the fair quote, distance, trust, verification, and idle-day rotation.
5. Optionally enable **Emergency Service** to show the `< 2 km` priority mode.
6. Click **Request Automated Cooperative Dispatch**.
7. Confirm the booking, display the completion OTP, and click **⚡ Auto-fill OTP**.
8. Click **Verify & Settle** and show the 98% / 1.5% / 0.5% cooperative ledger.

### Worker: `/worker`

1. Select **Worker Passbook** from the top persona switcher.
2. Open the worker dropdown and switch between registered worker profiles.
3. Show total take-home earnings, reserve balance, completed jobs, and ledger references.
4. Click **Request Emergency Claim**.
5. Select Medical, Tool Repair, or Income Loss, enter an amount and reason, and submit.

### PACS administrator: `/admin`

1. Select **PACS Admin**.
2. Show member metrics, active cluster gigs, PACS maintenance pool, and mutual-aid reserve.
3. Open the verification queue and approve a pending registration.
4. Show the demand forecast card and explain monsoon/service surge signals.
5. Open the Mutual-Aid Claims queue and approve a pending worker request.

### Worker onboarding: `/worker/onboard`

1. Select Tamil, Telugu, Hindi, or English.
2. Use the sample voice demo for a deterministic presentation, or record from the microphone.
3. Demonstrate the live listening/voice-detected visualizer.
4. Review and edit the extracted name, phone, trade, experience, rate, and locality.
5. Submit to the PACS verification queue.

## Testing

### Backend tests

From the repository root:

```bash
python -m py_compile backend/main.py
python -m pytest -q backend/test_main.py
```

The test suite covers matching, booking creation, cancellation, OTP expiry and lockout, demo master OTPs, settlement accounting, welfare passbook data, claims, worker registration, PACS approval, demand forecast, and multilingual voice fallbacks.

### Frontend type check and production build

```bash
cd frontend/jeswin-ubiquity-website/ubiquity-demo
pnpm check
pnpm build
```

### Playwright browser audit

Install the Chromium browser once:

```bash
cd frontend/jeswin-ubiquity-website/ubiquity-demo
npx playwright install chromium
```

Run the E2E suite:

```bash
pnpm test:e2e
```

The browser audit covers Citizen roster search, emergency state, automated dispatch, OTP autofill and settlement, worker switching and claims, PACS verification and mutual-aid governance, onboarding form behavior, recorder states, console errors, and horizontal overflow.

## Security and production limitations

This repository is a hackathon prototype and should not process real money or sensitive production identity data without additional controls.

| Prototype shortcut | Required production replacement |
|---|---|
| `X-User-Id` demo identity | Phone/email identity provider, signed sessions or JWTs, role claims, revocation, and recovery. |
| SQLite local database | Managed relational database, migrations, pooling, encrypted backups, and disaster recovery. |
| Demo OTP exposure/master OTPs | Worker-delivered OTP over an authenticated channel; remove all master/demo OTPs. |
| Ledger-only “payout released” state | Payment gateway, worker payout rail, webhook verification, idempotency, reconciliation, refunds, and invoices. |
| Browser-local audio processing/upload | Consent, encryption, retention/deletion policy, redaction, provider controls, confidence scores, and human review. |
| Seeded map coordinates | Consent-aware GPS, precision controls, freshness checks, privacy retention, and secure spatial queries. |
| Rule-based demand forecast | Historical data pipeline, model evaluation, confidence intervals, drift monitoring, and operational feedback. |
| Basic claim approval | Evidence capture, adjudication policy, fraud controls, appeals, payout workflow, and audit trail. |
| Single-cluster PACS context | Multi-PACS federation, scoped authorization, delegated administration, and cross-ward routing. |
| No offline channel | SMS, USSD, IVR, low-bandwidth mode, and queued synchronization. |

Never commit `.env` files, API keys, provider credentials, generated databases containing real personal data, or browser test artifacts.

## Roadmap

The highest-impact extensions for the full cooperative vision are:

1. **Offline SMS/USSD/IVR access:** Let feature-phone workers and citizens request, accept, and complete services without a smartphone.
2. **Dispute resolution and arbitration:** Add evidence, mediator assignment, decision states, appeals, and auditable settlement adjustments.
3. **Forecast-driven seasonal surge pooling:** Turn demand forecasts into pre-positioned workers, reserve-backed campaigns, and measurable forecast accuracy.
4. **Mutual-aid adjudication and insurance bridge:** Add claim evidence, policy rules, payout tracking, and a clear boundary between cooperative aid and regulated insurance.
5. **Multi-PACS federation:** Model multiple societies, administrative scopes, portable worker credentials, and cross-ward cooperation.

## Contributing

1. Create a feature branch from the current integration branch.
2. Keep frontend request/response changes synchronized with `shared/contracts.ts` and the FastAPI models.
3. Add or update backend regression tests for every new business rule.
4. Add Playwright coverage for user-visible interactions and error states.
5. Run `python -m py_compile backend/main.py`, `pytest`, `pnpm check`, `pnpm build`, and `pnpm test:e2e` before opening a pull request.
6. Do not commit credentials, local `.env` files, generated SQLite databases, or test reports.

## License

The project is released under the **MIT License** as declared by the frontend package. Add a root-level `LICENSE` file before making a formal public distribution if one is not already present.

## Project documents

- [`PROJECT_AUDIT_AND_GAP_ANALYSIS.md`](PROJECT_AUDIT_AND_GAP_ANALYSIS.md) — implementation inventory, SIH gap analysis, prioritized roadmap, and evaluator walkthrough.
- [`SIH_FEATURE_COMPLETION_REPORT.md`](SIH_FEATURE_COMPLETION_REPORT.md) — feature completion matrix and demo readiness.
- [`CHANGELOG_AI.md`](CHANGELOG_AI.md) — chronological technical changelog.
- [`backend/main.py`](backend/main.py) — FastAPI backend and SQLite business logic.
- [`frontend/jeswin-ubiquity-website/ubiquity-demo/`](frontend/jeswin-ubiquity-website/ubiquity-demo/) — current React/Vite frontend.
