# Ubiquity Cooperative Gig Services Network

Ubiquity is a Smart India Hackathon (SIH26089) prototype for PACS-backed cooperative gig services. The application connects customers with verified local workers using a transparent matching score, persists bookings and ledger settlements in SQLite, and provides voice-first worker onboarding when the required AI providers are configured.

## What changed in the hardened version

The original archive mixed UI-only simulations with backend contracts that could not be called successfully. This version removes the embedded Gemini credential, aligns every request and response shape, uses one Coimbatore–Gandhipuram operating cluster, persists workers/bookings/settlements/registrations in SQLite, validates booking ownership and OTP expiry, uploads real microphone recordings, and surfaces backend failures in the UI instead of returning fabricated success data.

The matching score is intentionally transparent: **45% proximity, 35% verified trust rating, and 20% idle-days equalizer**. Candidates must be verified, online, within 5 km, and below their active-booking capacity. Equal scores are resolved by distance and worker ID so list ordering cannot silently decide the result.

> **Important:** Settlement currently records the 98% / 1.5% / 0.5% allocation in the local cooperative ledger. It does not move money through UPI or a bank. A production payment gateway, webhook verification, and an audited payout service must be connected before real funds are handled.

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/main.py` | FastAPI service, SQLite schema, matching, bookings, OTP validation, ledger settlement, and voice processing |
| `backend/.env.example` | Safe backend configuration template |
| `frontend/lovable-ui/` | React/TanStack frontend with customer and worker flows |
| `frontend/lovable-ui/.env.example` | Frontend API URL and local identity template |

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add OPENAI_API_KEY and GEMINI_API_KEY only if voice onboarding is needed.
uvicorn main:app --reload --port 8000
```

The backend starts without AI keys so matching, booking, and ledger testing remain available. For local-only demo testing, set `DEMO_MODE=true`; the default is now `false`. In non-demo deployments, configure a strong server-side `AUTH_SECRET` and pass identities through the authenticated session/signature integration rather than trusting a bare client header. Voice onboarding returns a clear `503` until both provider keys are configured. Never place credentials in source files or commit `.env` files. Any credential that appeared in a previous public commit should be revoked and rotated outside this repository.

### Frontend

```bash
cd frontend/lovable-ui
pnpm install
cp .env.example .env.local
pnpm dev
```

The frontend reads `VITE_API_BASE_URL` rather than hardcoding an environment-specific deployment URL. The default local identity is `demo-customer`; replace it with a stable identity supplied by your authentication layer before production use. The backend requires the matching `X-User-Id` header as a temporary identity boundary for this prototype.

## API contract

| Method | Endpoint | Required input |
| --- | --- | --- |
| `GET` | `/api/health` | None |
| `POST` | `/api/bookings/match-and-price` | `customer_id`, `service_type`, `customer_lat`, `customer_lng`; matching user in `X-User-Id` |
| `POST` | `/api/bookings` | Matching fields plus `worker_id` and `agreed_amount`; returns a persisted booking and development-only OTP when `DEMO_MODE=true` |
| `POST` | `/api/bookings/verify-settle` | `booking_id`, `worker_id`, `cluster_id`, `gross_amount`, and a matching unexpired 4-digit `otp_code`; five failed attempts lock the booking |
| `DELETE` | `/api/bookings/{booking_id}/cancel` | Authorized customer cancellation while the booking is confirmed |
| `POST` | `/api/workers/voice-onboard` | Multipart `audio_file` plus `preferred_language`; requires both AI providers |
| `POST` | `/api/workers/register` | Extracted profile JSON and `X-User-Id`; persists a unique PACS member registration |

## Testing the booking flow

With the backend running, use the frontend to search for a worker, confirm a booking, and copy the development-only OTP shown in the confirmation card. Enter the OTP to record the ledger settlement. Repeating settlement for the same booking, altering the amount, using a wrong OTP, exceeding the OTP attempt limit, cancelling another customer’s booking, or omitting the identity boundary is rejected. Expired bookings no longer consume worker capacity.

For production, keep `DEMO_MODE=false`, provide a worker-facing OTP delivery channel, replace the prototype identity boundary with an authenticated session/token issuer, use a managed database with atomic reservation support, represent money in integer paise or `Decimal`, encrypt sensitive voice/identity data, configure retention and deletion policies, and integrate an actual payment provider with idempotent webhook handling.
