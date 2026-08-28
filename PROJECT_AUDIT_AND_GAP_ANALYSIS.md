# Project Audit and Gap Analysis

**Repository:** [SreeAnsh15/sih-ubiquity](https://github.com/SreeAnsh15/sih-ubiquity)  
**Branch audited:** `jeswin`  
**Audit date:** 28 August 2026  
**Author:** Manus AI  
**Scope:** Backend FastAPI/SQLite services, React/Vite client, shared contracts, Playwright audit coverage, and the cooperative-gig problem-space requirements stated in the project brief.

> **Executive assessment.** The repository is a strong hackathon demonstration of a cooperative local-services network, with the core narrative implemented end to end: a citizen selects a service, the platform ranks PACS workers, a booking is confirmed, completion is verified by OTP, and the payment is split atomically into worker, PACS, and mutual-aid shares. Governance, welfare, voice onboarding, multilingual fallbacks, a live Leaflet map, and browser-level audit tests materially strengthen the submission. The implementation is **approximately 78% complete against the full production-oriented cooperative gig-platform vision**. The remaining gap is concentrated in operational depth rather than the core demo: offline access, dispute handling, insurance underwriting and payout, federation hierarchy, and production-grade identity/payment integrations are not yet implemented.

## 1. Current Implemented Feature Inventory

### 1.1 System architecture at a glance

The current system uses a React/Vite single-page frontend with Wouter routing and a FastAPI backend backed by SQLite. The frontend centralizes HTTP access in `client/src/lib/api.ts`, shares request and response shapes through `shared/contracts.ts`, and exposes three principal personas: Citizen, Worker Passbook, and PACS Admin. The backend owns matching, booking, OTP settlement, worker registration, welfare accounting, and governance endpoints. The application is intentionally demo-friendly: when `DEMO_MODE=true` or no production authentication secret is configured, local requests can use a safe demo identity instead of failing with a production-authentication 503.[1] [2]

| Layer | Current implementation | Audit finding |
|---|---|---|
| Presentation | React 19, Vite, Wouter, Tailwind-oriented component styling, Lucide icons, Leaflet/react-leaflet | A cohesive demo UI exists across citizen, worker, onboarding, and admin routes. |
| API client | Centralized `api` object with typed request helpers, identity headers, and JSON/multipart request handling | Good separation from page components; API error normalization is designed for toast feedback. |
| Backend | FastAPI route handlers, Pydantic request models, SQLite persistence | The core business workflow is executable locally and covered by regression tests. |
| Persistence | SQLite tables for workers, bookings, settlements, registrations, and welfare claims | Suitable for a hackathon demo; not yet a production multi-tenant datastore. |
| Automation | Playwright Chromium suite with Vite `webServer` startup | Four browser scenarios cover the strongest presentation paths. |
| Security posture | Header-based demo identity locally; signed/strict actor validation when production configuration is present | Appropriate for demo resilience, but production authentication, authorization, and secret management remain incomplete. |

### 1.2 Voice Onboarding and Multilingual Extraction

The worker onboarding flow is available at `/worker/onboard` and can be launched from the worker persona. It supports microphone recording through `MediaRecorder`, prefers WebM Opus, requests a mono 16 kHz stream, accumulates short audio chunks, and uses `AudioContext`/`AnalyserNode` metering to display active listening and voice-detected states. The UI also provides a sample voice demonstration and a manual review path so a judge can complete the flow without microphone permissions.

The backend endpoint `POST /api/workers/voice-onboard` accepts multipart audio and a language hint. When Gemini is available, uploaded audio is sent as inline media to `gemini-2.5-flash` for transcription and structured extraction. The prompt explicitly instructs the model to handle Tamil, Telugu, Hindi, and English, transliterate names into English script, normalize trades to standard English categories, preserve the original-language transcript, and use sensible defaults for unspecified experience and rate. The accepted category dictionary includes Electrical, Plumbing, Carpentry, Masonry, Painting, Appliance Repair, Welding, and Cleaning, with Tamil and Telugu trade examples.

When no audio is supplied, or the provider/client fails, deterministic language-tailored profiles are returned for demo continuity. When an uploaded file reaches Gemini but contains no intelligible speech or lacks the minimum identity fields, the endpoint returns HTTP 400 with a direct re-recording instruction rather than silently returning a dummy profile. This is an important distinction between an intentional no-audio demo fallback and a failed real recording.[1]

| Capability | Current status | Evidence and judge readiness |
|---|---|---|
| Tamil fallback | Implemented | Murugan/Plumbing profile and Tamil transcript are deterministic and presentation-safe. |
| Hindi fallback | Implemented | Rajesh Sharma/Electrical profile is available. |
| English fallback | Implemented | David Joseph/Carpentry profile is available. |
| Telugu fallback | Implemented | Suresh Rao/Plumbing profile is available in the existing fallback dictionary. |
| Real Gemini upload | Implemented with resilience | Uploaded files attempt Gemini even in demo mode; provider failure falls back safely. |
| Speech intelligibility feedback | Implemented | 400 response clearly asks the worker to speak closer to the microphone. |
| Review and PACS submission | Implemented | Extracted or manually edited fields submit to `POST /api/workers/register` with pending verification status. |
| Production speech observability | Partial | There is no durable extraction audit record, model-cost telemetry, confidence score, or human-review queue for low-confidence transcripts. |

### 1.3 Algorithmic Dispatch and Idle-Rotation Engine

Citizen matching is implemented through `POST /api/bookings/match-and-price`, with supporting read endpoints `GET /api/workers` and `GET /api/matching/roster`. The backend filters workers by verification, online availability, trade compatibility, active-booking capacity, distance, and emergency radius. Distance is computed using a haversine function from the customer coordinates to each worker coordinate.

The current ranking score is a weighted combination of proximity, trust, and idle-day rotation:

```text
fair_match_score =
    0.45 × proximity_score
  + 0.35 × trust_rating
  + 0.20 × min(1, idle_days / 10)
```

The service-specific query uses a five-kilometre normal radius. Emergency matching uses a strict two-kilometre radius and requires an eligible idle/available worker. The idle-day term gives workers who have waited longer a measurable boost, which is the platform’s starvation-prevention mechanism. The UI exposes the result ranking, worker distance, trust signal, idle days, fair quote, and map position so the judge can see that selection is not a black box.

The Citizen route uses service cards rather than a hidden service selector: choosing Plumbing, Electrical, Cleaning, or Carpentry updates the active trade and queries the roster. Future service cards return a Phase-2 notice. The “Request Automated Cooperative Dispatch” action selects the backend’s `selected_best_match` rather than allowing the citizen to cherry-pick a worker. This directly supports the cooperative-allocation narrative.[1] [3]

| Matching requirement | Current implementation | Residual limitation |
|---|---|---|
| Proximity | Haversine distance and radius filtering | Coordinates are seeded/local; there is no geocoding, GPS freshness, or map-based geofence enforcement. |
| Trust | Worker `trust_rating` participates in rank | Trust is seeded and not yet updated by a verified rating/review event. |
| Idle-day equalizer | `idle_days` contributes 20% of score | There is no scheduled reset, historical allocation ledger, or fairness dashboard showing distribution over time. |
| Capacity protection | Active booking count is compared with worker capacity | No shift calendar, travel-time model, or multi-job route optimization. |
| Emergency dispatch | Strict `<2 km` query path and priority UI | No escalation timer, SMS blast, or dispatch timeout/escalation policy. |
| Fair-price quote | Base rate plus distance component; aggregator comparison displayed | No dynamic supply/demand pricing model, rate-card governance, or invoice/tax integration. |

### 1.4 Proof-of-Work OTP Settlement and Split Flow

The booking flow is implemented through `POST /api/bookings`, followed by `POST /api/bookings/verify-settle`. A booking stores the worker, citizen, service, coordinates, gross quote, OTP hash, expiry, attempts, status, and timestamps. The frontend presents a transparent rate breakdown before confirmation and opens the completion step after the booking is confirmed.

In the demo environment, the booking response exposes a completion OTP alias for evaluator convenience. The completion modal displays `Worker Completion OTP: {otp}` and provides the one-click `⚡ Auto-fill OTP` action. The settlement endpoint validates the real hashed booking OTP and also accepts the cooperative demo master codes `1234`, `0000`, `8888`, and `1232`. Incorrect OTP attempts are counted, repeated failures can lock the booking, and expired codes receive an explicit expiry response.

Settlement calculations are persisted as a single ledger row using the following split:

| Ledger destination | Share | Current behavior |
|---|---:|---|
| Worker direct payout | 98.0% | Calculated from gross booking amount and persisted in `settlements.worker_payout`. |
| PACS cooperative maintenance | 1.5% | Calculated and persisted in `settlements.pacs_maintenance`. |
| Mutual-aid emergency pool | 0.5% | Calculated and persisted in `settlements.mutual_aid_fund`. |

The API returns a completed status, `payout_released: true`, `mutual_aid_accrued`, the gross amount, each split, and a ledger reference. The frontend renders the three-way settlement card and success state. This is one of the strongest fully demonstrable features in the repository.[1] [2]

The primary gap is that the current “proof of work” is an OTP rather than a richer proof bundle. There is no photo/signature evidence, worker/customer geotag verification, service checklist, digital invoice, payment-gateway capture, or asynchronous payout rail. The current implementation proves the cooperative accounting concept but not the entire production payment lifecycle.

### 1.5 Worker Digital Passbook and Welfare Ledger

The Worker route `/worker` calls `GET /api/workers/welfare` and displays the active worker’s identity, PACS verification state, total take-home earnings, accrued mutual-aid reserve, claimed relief, completed job ledger, and claim history. The ledger contains date, service, customer fee, 98% payout, 0.5% reserve contribution, and a settlement reference.

The worker profile pill opens a styled live-roster dropdown. It requests the all-worker roster dynamically rather than hardcoding only the original demo workers. Selecting a worker updates the active identity and dispatches a browser event that reloads the passbook context. The dropdown retains a shortcut to `/worker/onboard` for new registration.

Emergency welfare claims use a modal with category options—Medical, Tool Repair, and Income Loss—plus amount and reason fields. `POST /api/workers/welfare/claims` validates the available reserve, creates a pending claim in SQLite, and returns a claim ID. The admin portal lists claims and can approve them through the mutual-aid governance endpoints. This creates a complete demo loop from accumulated reserve to worker request to PACS action.[1] [2]

The limitations are material for production: no disbursement account, no evidence attachments, no claim adjudication policy, no claims SLA, and no separation between reserve accounting and actual payout execution. The passbook is a strong product surface but currently represents the welfare balance rather than moving money to a bank or wallet.

### 1.6 PACS Society Admin Portal

The dedicated `/admin` route presents the PACS federation dashboard. It calls `GET /api/admin/dashboard`, `GET /api/admin/verification-queue`, `GET /api/admin/demand-forecast`, and `GET /api/admin/mutual-aid-claims`. The dashboard exposes registered members, verified workers, pending verifications, active cluster gigs, the 1.5% PACS pool, and the 0.5% mutual-aid reserve.

The verification queue supports approval through `POST /api/admin/verification-queue/{member_id}/approve`. Approval marks the registration as approved and promotes the worker into the live `workers` table. The demand-forecast card provides seasonal and ward-level signals, including monsoon plumbing and other service drivers. The Mutual-Aid Claims section lists pending requests and allows an administrator to approve them.

| Admin capability | Current status | Judge readiness |
|---|---|---|
| Member metrics | Implemented | Visible as dashboard cards. |
| Worker verification queue | Implemented | New onboarding registrations can be approved and promoted. |
| Demand forecasting | Implemented as rule-based demo | Good narrative value; not yet an ML model or trained forecasting pipeline. |
| Mutual-aid governance | Implemented | Claim queue and approve action are visible. |
| Multi-PACS governance | Partial | Current data is centered on one Gandhipuram cluster/PACS; hierarchy and inter-PACS federation are not modeled. |
| Audit trail | Partial | Settlement references exist, but admin actions do not have a comprehensive actor/time/reason audit log. |

### 1.7 Live Transparency Map

The Citizen view uses `react-leaflet` with OpenStreetMap tiles. It places a customer marker and dynamically renders worker pins from the current matching/roster response. Each worker popup shows name, trade, distance, and fair quote. The map label changes between the standard live cooperative roster and emergency priority roster. The result list and map share the same backend-derived worker array, reducing the risk of visual data diverging from the actual selection state.

The map is effective for a hackathon demonstration, but the production gap includes GPS freshness, worker consent, privacy-preserving location precision, offline tiles, geocoding, network quality handling, and authoritative spatial storage. The current UI uses seeded worker coordinates and should be described to judges as a prototype locality map rather than a production tracking system.

### 1.8 Navigation, multilingual UI, resilience, and QA

The landing page lets a user choose Citizen, Worker, or PACS Admin. Workspace pages have a global Home control and top-level persona switcher. The global language state supports English, Tamil, and Telugu for key greetings, buttons, headings, and service labels. The frontend API client sends the active identity header to avoid the earlier local-development authentication 503.

The repository now includes a Playwright configuration targeting `http://localhost:3000` and `tests/platform-audit.spec.ts`. The suite mocks backend responses for deterministic browser testing and covers citizen search/dispatch/OTP settlement, worker switching/claims, admin governance, and voice onboarding recorder states. The latest audit run passed all four scenarios. This is valuable evidence of presentation reliability, although the tests are primarily contract/UI tests with mocked API responses rather than full-stack browser tests against a live FastAPI instance.

## 2. Problem Statement Gap Analysis: SIH Cooperative Gig Platform

### 2.1 Completion summary

The assessment below distinguishes between **demo-complete**, **partially implemented**, and **missing** capabilities. “Complete” means the feature is visible, connected to a backend path, persisted where applicable, and demonstrable in the current branch. It does not mean that all production controls, external integrations, or operational policies exist.

| Requirement area | Status | Approximate completion | Assessment |
|---|---|---:|---|
| Cooperative matching and idle rotation | Complete for demo | 90% | Core algorithm, proximity, trust, capacity, and idle-day equalizer are implemented. Long-term fairness analytics are absent. |
| Transparent fair pricing | Complete for demo | 85% | Quote, aggregator comparison, and savings are visible; rate governance, taxes, invoicing, and dynamic policy controls are not. |
| OTP settlement and 98/1.5/0.5 split | Complete for demo | 90% | Persisted settlement and demo-friendly OTP flow work; payment rail and richer proof-of-work are missing. |
| Worker passbook and mutual aid | Complete for demo | 85% | Earnings, reserve, claims, and admin approval are wired; actual disbursement and adjudication are not. |
| PACS governance portal | Complete for demo | 80% | Verification, metrics, forecast, and claims queue exist; federation hierarchy and audit controls are limited. |
| Voice/multilingual onboarding | Complete for demo | 80% | Gemini path, multilingual fallbacks, recorder UX, editable review, and PACS queue exist; confidence review and offline channels are absent. |
| Offline SMS/USSD access | Missing | 10% | No SMS gateway, USSD session handler, IVR, or offline command queue. |
| Dispute resolution/arbitration | Missing | 5% | No case model, evidence workflow, SLA, mediator role, or arbitration decision path. |
| Seasonal surge pooling | Partial | 35% | Rule-based demand forecast exists; no reserve-backed surge pool allocation or operational dispatch campaign. |
| Micro-insurance underwriting and payouts | Missing | 5% | Mutual aid is an internal reserve ledger, not insurance underwriting or claim settlement. |
| Multi-PACS federation hierarchy | Partial | 20% | A cluster/PACS concept is present, but no federation-level organization, inter-PACS routing, or delegated authority model exists. |
| Production identity, payment, observability, and compliance | Partial | 35% | Demo auth and SQLite are intentional; production IAM, payments, monitoring, backups, and compliance controls are not complete. |

**Overall estimate: approximately 78% of the stated hackathon demonstration and near-term product vision.** The core cooperative workflow itself is closer to 88–90% complete; the lower overall score reflects the missing real-world channels and governance depth explicitly called out in the original vision.

### 2.2 Fully satisfied core requirements

The repository fully satisfies the most important judge-facing narrative requirements. A citizen can select a supported trade, see live PACS-verified workers, receive a transparent fair quote, request an automated match, confirm a booking, complete it with an OTP, and observe the 98% worker / 1.5% PACS / 0.5% mutual-aid ledger split. The worker can see a passbook and submit a reserve claim. The PACS administrator can approve a worker and a claim. These are not isolated mock screens: the main transitions call FastAPI endpoints and persist data in SQLite.[1] [2]

The platform also satisfies a meaningful accessibility and presentation requirement. A judge can complete voice onboarding through a sample demo or manual form when browser microphone permissions are unavailable. Tamil, Hindi, Telugu, and English fallback profiles make the onboarding loop resilient. The map, idle rotation, fair quote, and governance metrics make the cooperative value proposition visible rather than purely textual.

### 2.3 Partially implemented or demo-only requirements

**Production authentication and identity.** The local demo fallback is appropriate for a hackathon, but the branch does not implement a production identity provider, phone OTP login, role claims, token rotation, account recovery, or device/session revocation. Header-based demo identity must not be presented as production authentication.

**Payment and payout execution.** The backend calculates and stores settlement splits, but it does not capture money from a payment gateway, release funds to a worker bank account, reconcile failed payouts, generate tax invoices, or handle refunds. The phrase “payout released” currently means the cooperative ledger has recorded the release, not that a bank or wallet transfer completed.

**Demand forecasting.** The admin endpoint produces explainable seasonal/ward signals using rule-based multipliers. This is valuable for a prototype and gives judges a strong AI-assisted allocation story, but it is not yet trained forecasting. There is no historical event ingestion, accuracy evaluation, confidence interval, or feedback loop from actual completed jobs.

**Emergency dispatch.** The strict radius and ranking filter are implemented. The operational mechanics are not: there is no worker push notification, SMS escalation, countdown timer, dispatch acceptance/rejection, reassignment, or SLA breach handling. A “30-minute dispatch” should therefore be described as a priority matching policy in the current build, not a guaranteed service-level commitment.

**Mutual aid versus insurance.** The 0.5% reserve and claim process are implemented as cooperative welfare accounting. There is no underwriting, risk pool actuarial model, policy issuance, premium calculation, fraud review, beneficiary model, hospital/vendor settlement, or regulated insurance payout workflow. The correct product language is “mutual-aid reserve,” not “insurance,” unless the system is extended and legally structured for insurance.

**Federation hierarchy.** The cluster ID and PACS labels establish the right domain vocabulary, but the data model does not represent a state/national federation, multiple PACS societies, inter-PACS membership, delegated admin scopes, or routing across neighboring clusters. There is one primary Gandhipuram presentation context.

### 2.4 Completely missing requirements from the broader vision

| Missing capability | Why it matters | Current consequence |
|---|---|---|
| Offline SMS/USSD/IVR fallback | Many target workers may have feature phones, unreliable data, or limited literacy. | The platform is currently smartphone/browser dependent. |
| Dispute and arbitration | A cooperative needs a trusted process when service quality, price, attendance, or damage is contested. | A failed or disputed gig has no case lifecycle after booking/settlement. |
| Actual seasonal surge pool | Forecasting alone does not allocate money, shifts, or reserve capacity during peaks. | Monsoon signals are informative but not operationally binding. |
| Micro-insurance underwriting and payout | Worker welfare requires protection against injury, illness, or income interruption beyond a small mutual-aid balance. | Claims are capped by accrued reserve and do not cover externally settled risk. |
| Multi-PACS federation hierarchy | The problem is a network of cooperative societies, not only one ward dashboard. | Cross-ward and inter-society scaling is not represented. |
| Production payment rails | Ledger entries do not move funds. | The demo proves accounting logic, not financial settlement execution. |
| Privacy/consent controls for location | Worker location is sensitive personal data. | Map privacy, retention, and precision policies are not yet explicit. |
| Workforce credential verification | PACS approval is a governance status, not identity/document verification. | Skills, certificates, criminal/background checks, and expiry dates are not modeled. |
| Observability and SRE controls | A public service needs uptime, auditability, and incident response. | No metrics, tracing, alerting, backup/restore procedure, or operational dashboard is implemented. |

## 3. Recommended High-Impact Additions: Prioritized Roadmap

The following roadmap is intentionally prioritized for evaluation score, feasibility, and narrative strength rather than for exhaustive production completeness.

### Priority 1 — Offline SMS/USSD cooperative access

**Feature and user story.** A worker with a feature phone can dial a USSD code or send an SMS such as `JOB PLUMBING GANDHIPURAM` and receive a localized nearest-job offer, accept or decline it, and receive a completion OTP. A citizen can request a basic service without a smartphone. Tamil, Hindi, and English templates should be supported first.

**Technical architecture.** Add an adapter layer for an SMS provider and a USSD/IVR provider, with routes such as `POST /api/channels/sms/inbound`, `POST /api/channels/ussd/session`, `POST /api/channels/sms/outbound`, and `GET /api/channels/messages/{phone}`. Store channel sessions, normalized phone identities, pending commands, delivery status, and opt-in consent. Reuse the existing matching service as a channel-agnostic application service rather than duplicating ranking logic.

**Expected evaluation impact.** Very high. This directly addresses inclusion, rural usability, digital divide constraints, and real-world feasibility. It also turns the platform from a polished browser demo into a public-infrastructure design that works across device classes.

### Priority 2 — Dispute resolution and cooperative arbitration

**Feature and user story.** A citizen or worker can open a dispute after a gig, attach structured evidence, pause final release when policy allows, and route the case to a PACS mediator. The mediator records a decision, partial refund, worker remediation, or no-fault outcome with a reason and audit trail.

**Technical architecture.** Add `disputes`, `dispute_events`, `dispute_evidence`, and `arbitrators` tables. Expose `POST /api/bookings/{booking_id}/disputes`, `GET /api/disputes/{id}`, `POST /api/admin/disputes/{id}/assign`, and `POST /api/admin/disputes/{id}/resolve`. Add a state machine such as `opened → evidence_requested → mediation → resolved → appealed`. Link each decision to the booking, settlement, actor, timestamp, and policy version.

**Expected evaluation impact.** High. It demonstrates institutional trust, worker protection, accountable governance, and a credible alternative to opaque aggregator support systems. It also makes the platform’s cooperative identity materially stronger.

### Priority 3 — Forecast-driven seasonal surge pooling

**Feature and user story.** Before monsoon peaks, PACS administrators see a ward/service forecast, reserve a surge pool, pre-position workers, and broadcast prioritized jobs. The system explains why plumbing capacity is being allocated to a specific ward and reports whether the forecast was correct.

**Technical architecture.** Extend the existing forecast endpoint with `forecast_runs`, `surge_pools`, `allocation_campaigns`, and `worker_shift_offers`. Add `POST /api/admin/surge-pools`, `POST /api/admin/allocation-campaigns`, `GET /api/admin/campaigns/{id}`, and `POST /api/workers/shift-offers/{id}/respond`. Feed completed bookings back into a simple evaluation table with predicted versus actual demand. Keep the first version explainable and rule-based, then introduce a trained model only when adequate historical data exists.

**Expected evaluation impact.** High. It connects the AI card to a real operational outcome and shows that cooperative funds are used to prepare for predictable public-service demand rather than merely visualized.

### Priority 4 — Mutual-aid claim adjudication and micro-insurance bridge

**Feature and user story.** A worker submits a medical, tool-loss, or income-interruption claim, provides evidence, and sees the status, reserve contribution, decision reason, and payout status. For risks beyond the cooperative reserve, an optional insurance partner policy can be attached without confusing mutual aid with regulated insurance.

**Technical architecture.** Add claim evidence storage, policy rules, adjudication events, payout instructions, and an external-insurer adapter. New endpoints could include `POST /api/workers/welfare/claims/{id}/evidence`, `POST /api/admin/welfare/claims/{id}/decision`, `POST /api/admin/welfare/claims/{id}/payout`, and `GET /api/workers/welfare/claims/{id}`. Keep reserve ledger entries immutable and introduce a separate payout ledger with idempotency keys.

**Expected evaluation impact.** High. It upgrades the current attractive passbook from a balance display into a credible worker-protection system and gives judges a concrete social-impact outcome.

### Priority 5 — Multi-PACS federation and trust credentials

**Feature and user story.** A worker approved by one PACS can receive jobs in a neighboring ward under federation rules, while each PACS sees only the members, funds, and disputes within its administrative scope. A portable worker credential records verified trade, training, language, and expiry information.

**Technical architecture.** Add `federations`, `pacs_societies`, `pacs_memberships`, `admin_scopes`, `worker_credentials`, and `credential_verifications`. Add endpoints such as `GET /api/federations/{id}/pacs`, `POST /api/pacs/{id}/memberships`, `POST /api/credentials/verify`, and `GET /api/workers/{id}/portable-profile`. Add scoped authorization so a PACS admin cannot approve or alter another society’s records without federation permission.

**Expected evaluation impact.** High for architectural maturity. It addresses the difference between a single-ward app and a cooperative network of societies, which is central to long-term scalability and public-sector adoption.

## 4. Production Readiness and Presentation Demo Checklist

### 4.1 Production-readiness checklist

| Area | Current state | Before production deployment |
|---|---|---|
| Identity | Demo identity/header fallback available | Integrate a production identity provider, phone verification, role claims, token rotation, and secure session storage. |
| Database | SQLite persistence | Move to managed PostgreSQL/MySQL, add migrations, backups, indexes, connection pooling, and disaster recovery tests. |
| Payments | Split calculated and persisted | Integrate payment collection and payout rails, idempotency, reconciliation, refunds, invoices, and financial audit controls. |
| Voice | Gemini path plus fallback | Add consent, retention policy, confidence scores, provider quotas, redaction, cost monitoring, and human-review escalation. |
| Location | Leaflet with seeded coordinates | Add consent, coarse display precision, GPS freshness, geocoding, privacy retention, and secure spatial queries. |
| Governance | Verification and claim approval | Add scoped roles, immutable admin audit log, dual approval for funds, policy versions, and appeals. |
| Welfare | Reserve ledger and pending claims | Add evidence, adjudication, disbursement, fraud controls, and external insurance boundary. |
| Reliability | Playwright and unit/regression coverage | Add API integration tests, load tests, monitoring, tracing, alerting, rate limits, and incident runbooks. |
| Accessibility | Visual fallback and multilingual labels | Add keyboard/screen-reader audits, low-bandwidth mode, font scaling, and offline channel support. |

### 4.2 Three-minute evaluator walkthrough

**0:00–0:20 — Establish the problem and choose the citizen persona.** Open the landing page and say: “Ubiquity is a cooperative service network where value, allocation power, and welfare remain in the ward.” Select **Citizen / Book Services**. Point out the Rahul Kumar demo profile, Gandhipuram Ward 12 context, language selector, and the absence of a commercial aggregator dependency.

**0:20–0:55 — Demonstrate transparent discovery.** Click the **Plumbing** or **Electrical** category card. Explain that the card—not a hidden form field—sets the active service and refreshes the cooperative roster. Click **Search live roster**. Show the worker cards and Leaflet map pins. Point to distance, trust/verification, idle days, fair quote, and commercial comparison. Say: “The system is not simply returning the first worker; it ranks proximity, trust, and idle-day rotation so workers are not starved of gigs.”

**0:55–1:20 — Demonstrate automated cooperative dispatch.** Click **Request Automated Cooperative Dispatch**. Emphasize that the citizen does not cherry-pick a worker: the matching engine assigns the best eligible PACS worker using the active trade and current roster. Confirm the booking and show the transparent quote. If desired, toggle Emergency Service separately before searching to demonstrate the strict `<2 km` priority roster; make clear that this toggle is independent from standard automated dispatch.

**1:20–1:55 — Complete the proof-of-work settlement.** In the completion modal, show the **Worker Completion OTP** helper and click **⚡ Auto-fill OTP**. Explain that the real booking OTP is checked, while demo master codes keep an evaluator from being blocked by a typo. Click **Verify & Settle** and pause on the ledger card: **98% worker payout, 1.5% PACS maintenance, 0.5% mutual aid**. This is the central “cooperative economics made executable” moment.

**1:55–2:25 — Switch to the worker persona.** Use the top-right **Worker Passbook** dropdown and select a worker from the live roster. Show that the passbook context changes without leaving the product. Point to total earned, 98% take-home, mutual-aid balance, completed job ledger, and claim history. Open **Request Emergency Claim**, choose Medical or Tool Repair, enter an amount and reason, and submit it. Explain that the request is reserve-bounded and enters PACS review rather than disappearing into an opaque support ticket.

**2:25–2:50 — Show PACS governance.** Switch to **PACS Admin**. Show registered members, active gigs, PACS pool, mutual-aid reserve, verification queue, demand forecast, and the Mutual-Aid Claims queue. Approve a new worker or claim if a prepared record is available. Explain that governance is part of the platform—not an afterthought—and that worker onboarding becomes a verified active roster member only through PACS action.

**2:50–3:00 — Close with the inclusion and scale message.** Open `/worker/onboard`, select Tamil, Hindi, Telugu, or English, and use the sample voice demo if microphone access is unavailable. Close with: “The current build proves the end-to-end cooperative loop. The next production additions are offline SMS/USSD, dispute arbitration, forecast-driven surge pooling, micro-insurance payout, and multi-PACS federation—so the same trusted infrastructure works for every worker, not only smartphone users in one demo ward.”

### 4.3 Final judge-facing claims to make precisely

The strongest claims are that Ubiquity has an executable cooperative matching and settlement loop, transparent economics, PACS governance, a worker welfare passbook, multilingual onboarding resilience, and an explainable idle-day fairness mechanism. The implementation should not overclaim production insurance, actual bank payouts, guaranteed 30-minute service, or nationwide federation support until those modules are built. Framing the current release accurately will increase evaluator trust: it is a substantial, testable SIH prototype with a clear production roadmap rather than a collection of disconnected mock screens.

## References

[1]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/backend/main.py "Ubiquity FastAPI backend and SQLite business logic"

[2]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/frontend/jeswin-ubiquity-website/ubiquity-demo/client/src/lib/api.ts "Ubiquity centralized frontend API client"

[3]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/frontend/jeswin-ubiquity-website/ubiquity-demo/client/src/pages/Home.tsx "Ubiquity React personas, booking, map, passbook, onboarding, and admin UI"

[4]: https://github.com/SreeAnsh15/sih-ubiquity/blob/jeswin/frontend/jeswin-ubiquity-website/ubiquity-demo/tests/platform-audit.spec.ts "Ubiquity Playwright platform audit suite"
