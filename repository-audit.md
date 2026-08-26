# Complete Repository Audit: `maddy71247-max/SIH`

**Repository commit reviewed:** `4edf22ef9492589f8f8381602d24b036738aceaa`  
**Scope:** All 87 tracked files, including the FastAPI/SQLite backend, React/TanStack frontend, configuration, documentation, tests, lockfiles, and generated application wiring.  
**Author:** Manus AI

## Executive assessment

The repository is a coherent prototype and its core booking flow is covered by three passing backend tests. The frontend also produces a Vite/TanStack build. However, it is **not production-ready**: the application’s identity boundary is a spoofable client header, the frontend hardcodes one customer identity and one location, expired bookings permanently consume worker capacity, the four-digit OTP has no attempt throttling, and the TypeScript quality gate currently fails with **52 errors**. The most important issues affect authorization, booking correctness, and deployability rather than visual UI quality.

The report distinguishes defects that can cause security or business impact from documentation and maintainability gaps. It does not treat generated Radix/shadcn UI primitives as application defects unless they create a concrete runtime or security problem.

## Findings summary

| ID | Severity | Area | Finding | Impact |
|---|---|---|---|---|
| F-01 | Critical | Authentication | `X-User-Id` is accepted as the identity mechanism and is fully controlled by the client. | A caller can impersonate any customer or worker identity and access or mutate records when they know identifiers. |
| F-02 | High | OTP security | The completion OTP is only four digits, has no failed-attempt counter, no rate limit, and is returned to clients when `DEMO_MODE=true`, which is the sample default. | Brute-force attempts are practical; a misconfigured deployment exposes the secret directly. |
| F-03 | High | Booking lifecycle | OTP expiry is checked only during settlement. Expired `confirmed` bookings are still counted as active and there is no cancellation or automatic expiry transition. | Abandoned or expired bookings permanently block a worker’s capacity. |
| F-04 | High | Frontend identity/location | The frontend uses a build-time `VITE_USER_ID` and hardcoded Coimbatore coordinates for every customer and worker request. | All users share one prototype identity and every booking is priced/matched from the same location. |
| F-05 | High | Type safety/CI | `pnpm exec tsc --noEmit` fails with 52 errors in `src/lib/api.ts`, while `package.json` has no typecheck script. | The declared strict TypeScript configuration is not clean and CI can miss broken code. |
| F-06 | Medium | Settlement validation | The API accepts `cluster_id` but never validates it against the booking or an allowed cluster. | The API contract claims a cluster binding that does not exist; callers can submit arbitrary values. |
| F-07 | Medium | Concurrency | Capacity is checked with a read followed by a separate insert, without an atomic reservation or uniqueness/locking strategy. | Concurrent requests can oversubscribe a worker beyond `capacity=1`. |
| F-08 | Medium | Money handling | Prices and settlement allocations use binary floating-point values and tolerance comparisons. | Rounding and repeated percentage calculations can produce cent-level inconsistencies in financial records. |
| F-09 | Medium | Frontend state/lifecycle | Selecting another worker, changing service, or starting a new search clears the current booking from UI state without cancelling it on the backend. | Users can orphan confirmed bookings and lose the UI path needed to settle them, worsening F-03. |
| F-10 | Medium | SSR observability | Frontend error capture stores one process-global “last error” and globally replaces `console.error`; concurrent SSR requests can consume or misattribute another request’s error. | Error pages and logs can report the wrong failure, especially under concurrent traffic. |
| F-11 | Low | Health/status UX | The frontend labels any failed health request as “Demo Mode” instead of distinguishing outage, misconfiguration, and actual `demo_mode`. | Operators and users receive misleading operational status. |
| F-12 | Low | Reproducibility | Backend dependencies are broad/unpinned and tests are not listed as dependencies; frontend has no test or typecheck script and maintains both Bun and pnpm lockfiles. | Fresh environments can resolve different versions and quality checks are incomplete. |
| F-13 | Low | Documentation/contracts | The frontend README is stale: it specifies 40/30/30 scoring, omits booking creation and registration endpoints, hardcodes localhost, and documents npm while the project includes pnpm/bun setup. | Contributors and evaluators can follow instructions that disagree with the running implementation. |
| F-14 | Low | Data governance | Voice transcripts and worker profile data are stored in SQLite without encryption, retention, deletion, or consent/audit controls. | Sensitive identity and voice-derived information can persist indefinitely in a local database. |

## Detailed findings

### F-01 — Client-controlled identity is not authentication

`require_actor()` compares the `X-User-Id` header with the request body, but the header itself is supplied by the caller. The frontend unconditionally sets the header from `VITE_USER_ID`. This proves consistency between two attacker-controlled strings, not authentication or authorization [1][2]. Worker registration also obtains the user ID from the same header and then passes that value back into `require_actor`, so any non-empty header is accepted.

**Impact.** A user can claim another customer ID, create bookings under it, register an arbitrary PACS member for it, and attempt operations against records if they can obtain identifiers or OTPs. This is acceptable only as a clearly isolated local demo, not as a security boundary.

**Fix.** Replace the header with server-validated sessions or short-lived signed access tokens. Derive the actor from the verified token rather than request JSON or a caller-provided header. Enforce separate customer and worker roles, and authorize every booking and settlement operation against the authenticated principal.

### F-02 — OTP protection is insufficient

The backend generates a four-digit OTP and stores only a SHA-256 hash. The settlement endpoint has no attempt counter, lockout, rate limiting, or abuse monitoring [1]. The sample environment explicitly sets `DEMO_MODE=true`, which causes the OTP to be returned in the booking response [3]. The frontend then displays the OTP in a toast and inline message [4].

A plain SHA-256 hash is not ideal for a low-entropy secret because all 10,000 possibilities can be tested cheaply. Returning it in an API response defeats the purpose of an OTP outside a controlled demo.

**Fix.** Generate a longer, cryptographically random code or use a signed one-time completion token; deliver it through a worker-authenticated channel; use a password-hashing/KDF approach if storing a code hash; enforce per-booking and per-identity attempt limits; add expiry cleanup; and make production-safe configuration the default. Keep demo OTP behavior behind an explicit local-only profile, not the general `.env.example` default.

### F-03 — Expired bookings remain active forever

`active_booking_count()` counts every booking with `status = 'confirmed'` and does not consider `otp_expires_at` [1]. Expiry is only checked inside settlement. There is no scheduled cleanup, lazy transition from `confirmed` to `expired`, cancellation endpoint, or worker/admin recovery path.

An isolated runtime check confirmed that after changing a booking’s expiry into the past, matching still returned no worker because the expired booking continued to consume capacity. This is a reproducible business-logic defect.

**Fix.** Make active-count logic exclude expired records, or atomically transition expired bookings before matching and booking creation. Add explicit `expired` and `cancelled` statuses, a customer cancellation flow, and a cleanup job/index strategy. Preserve settlement idempotency and record lifecycle events for auditing.

### F-04 — The frontend is single-user and single-location

`src/lib/api.ts` defines `CUSTOMER_ID` from a build-time environment variable and `CUSTOMER_LOCATION` as a fixed coordinate. Every match and booking request uses those same values [2]. The map centers on and labels that same coordinate as the customer’s current location [5]. The README says the demo identity must be replaced before production, but no authentication/session or live location implementation exists [6].

**Impact.** Different users of one deployment share an identity, and users outside the fixed area are matched/priced as if they were in Gandhipuram. This is a correctness and privacy problem, not merely a demo limitation, unless the application is explicitly restricted to one local demo user.

**Fix.** Obtain the authenticated principal from the session, request location permission with a clear fallback, validate coordinates server-side, and do not expose a mutable build-time identity as an authorization input. Make location sharing optional and disclose how it is stored and used.

### F-05 — Strict TypeScript compilation fails

The repository’s `tsconfig.json` enables strict options including `noPropertyAccessFromIndexSignature` [7]. The API adapter casts responses to `Record<string, unknown>` and then accesses fields using dot notation. Running `pnpm exec tsc --noEmit` produced **52 errors**, beginning at `src/lib/api.ts:83`; the failures cover API response fields such as `booking_id`, `reference`, `structured_profile`, and settlement keys.

The package manifest provides lint and build scripts but no `typecheck` script [8]. The Vite build succeeds, so the current build path does not serve as a substitute for type checking.

**Fix.** Define typed response schemas/interfaces and access unknown records with bracket notation or a runtime validator such as Zod. Add `"typecheck": "tsc --noEmit"` and make it a required CI step. Avoid silent fallback values for required API fields such as booking IDs.

### F-06 — `cluster_id` is an unused contract field

`SettleBookingRequest` requires `cluster_id`, and the frontend sends one, but `verify_and_settle_job()` never compares it with the booking’s cluster or an allowed cluster [1][2]. A runtime check settled a valid booking with `cluster_id: "attacker-supplied-cluster"` and received HTTP 200.

**Fix.** Either remove the field if it is not part of settlement authorization, or persist the booking’s cluster and enforce an exact match against a server-owned value. Never treat a client-provided cluster identifier as proof of location or ownership.

### F-07 — Capacity reservation is race-prone

Booking creation calls `active_booking_count()`, checks the result against worker capacity, and then inserts the booking [1]. Two concurrent requests can both observe available capacity before either insert commits. SQLite’s default behavior does not make this application-level check an atomic reservation.

**Fix.** Use a transaction with an appropriate write lock, a reservation table/slot model, or an atomic update that increments a capacity counter only when capacity remains. Add a concurrency test that submits simultaneous booking requests and asserts no more than the worker’s capacity succeeds.

### F-08 — Financial values use floating point

`gross_amount`, base rates, percentage allocations, and tolerance checks use Python `float` and SQLite `REAL` [1]. This can create representation and rounding differences around cent boundaries. The current code rounds allocation components, then derives the mutual-aid amount as the residual; that is better than independently rounding all three values, but it still does not provide integer-cent accounting.

**Fix.** Represent money as integer paise throughout the API/database, or use `Decimal` with explicit quantization. Store the currency and rounding policy, and test boundary values and allocation invariants.

### F-09 — UI can orphan confirmed bookings

After a booking is persisted, `BookingPortal` clears `booking` when the user selects another map worker or changes service [4]. A new search also resets the booking state without calling a cancellation endpoint. The backend has no cancellation or booking-list/recovery endpoint.

**Impact.** The user can lose the OTP and settlement controls while the backend still counts the booking as confirmed. This creates a direct frontend-to-backend lifecycle mismatch and compounds F-03.

**Fix.** Lock worker selection and service changes while a booking is active, or prompt for cancellation before clearing state. Add a `GET /api/bookings` recovery view and a cancellation endpoint with authorization and audit logging.

### F-10 — Global SSR error slot is unsafe under concurrency

`error-capture.ts` stores one module-global error and overrides the process-global `console.error` [9]. `server.ts` later consumes that one error while normalizing an HTTP 500 response [10]. Concurrent requests can overwrite the slot or consume a previous request’s error, causing incorrect diagnostics. The global console override also affects unrelated server code.

**Fix.** Use request-scoped context, structured logging with correlation IDs, and an error object passed through the request lifecycle. Avoid global mutable state for request diagnostics and avoid monkey-patching `console.error` in application code.

### F-11 — Health status is misleading

The backend health response exposes `demo_mode` and database/voice configuration state [1]. The frontend only calls `checkBackend()`, which returns a boolean, and renders “Demo Mode” whenever the request fails [11]. An outage, CORS error, DNS failure, or backend crash therefore appears as an intentional demo state.

**Fix.** Return and model a structured health state such as `connected`, `demoMode`, `database`, and `voiceConfigured`. Display “Offline” or “Unavailable” for failed health requests and reserve “Demo Mode” for an actual successful response with `demo_mode=true`.

### F-12 — Dependency and quality gates are incomplete

The backend requirements specify minimum versions rather than a reproducible lock, and test tooling is absent from `backend/requirements.txt` [12]. The frontend retains both `bun.lock` and `pnpm-lock.yaml`, has no automated tests, and has no typecheck script [8]. Lint reports six `react-refresh/only-export-components` warnings, all in reusable UI files; it reports no lint errors.

**Fix.** Select one package manager, commit one lockfile, pin or constrain compatible production versions, maintain a development/test dependency group, add backend and frontend tests, and enforce typecheck, lint, and build in CI.

### F-13 — Documentation conflicts with the implementation

The frontend README specifies a 40/30/30 matching breakdown, while the backend and main README implement 45/35/20 [1][13]. It lists only a subset of endpoints, says to keep localhost hardcoded, and instructs contributors to use npm despite the project containing pnpm and Bun lockfiles [13]. The root README more accurately describes the current backend contract, but the two documents are not synchronized.

**Fix.** Generate or maintain one canonical API contract, update the frontend README, document the actual environment variables and commands, and add a CI check or contract tests so endpoint changes cannot silently diverge.

### F-14 — Voice and identity data lack lifecycle controls

Worker registration persists the transcript, name, skill, rate, zone, and language in SQLite [1]. The repository includes no encryption-at-rest configuration, retention period, deletion endpoint, consent record, access audit, or role-based read path. The voice endpoint also accepts any browser-supplied audio MIME type and forwards the transcript to external AI providers [1].

**Fix.** Define consent and purpose limitation, minimize stored transcript data, encrypt sensitive fields and database backups, add retention/deletion controls, restrict access, validate actual media format/size, and document provider data-processing behavior.

## Verification performed

| Check | Result |
|---|---|
| Repository inventory | 87 tracked files reviewed at commit `4edf22e9492589f8f8381602d24b036738aceaa` |
| Python compilation | Passed with `python3 -m compileall -q backend` |
| Backend tests | **3 passed** after installing declared dependencies; one Starlette/httpx deprecation warning was emitted |
| Frontend dependency installation | Passed with `pnpm install --frozen-lockfile` |
| Frontend lint | Completed with 0 errors and 6 `react-refresh/only-export-components` warnings |
| Frontend production build | Passed with `pnpm build` |
| Frontend TypeScript check | **Failed: 52 errors**, all reported from `src/lib/api.ts` under the strict compiler configuration |
| Targeted booking lifecycle check | Confirmed expired confirmed bookings still block matching |
| Targeted settlement contract check | Confirmed arbitrary `cluster_id` is accepted with a valid OTP |

## Recommended repair order

First, replace the spoofable identity header with real authentication and remove demo identity/location values from production paths. Second, fix the booking lifecycle: add cancellation and expiry transitions, exclude expired bookings from capacity, and make capacity reservation atomic. Third, harden OTP delivery and attempts, and set a production-safe default. Fourth, fix the 52 TypeScript errors and add typecheck/CI gates. Fifth, introduce integer-cent money handling, contract tests, and structured request-scoped logging. Finally, update documentation and establish privacy/data-retention controls for voice onboarding.

## References

[1]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/backend/main.py "Backend implementation at audited commit"
[2]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/src/lib/api.ts "Frontend API adapter at audited commit"
[3]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/backend/.env.example "Backend environment template at audited commit"
[4]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/src/components/BookingPortal.tsx "Booking UI at audited commit"
[5]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/src/components/WorkerMapCanvas.tsx "Worker map at audited commit"
[6]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/README.md "Root project README at audited commit"
[7]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/tsconfig.json "TypeScript configuration at audited commit"
[8]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/package.json "Frontend package configuration at audited commit"
[9]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/src/lib/error-capture.ts "Frontend error capture at audited commit"
[10]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/src/server.ts "Frontend SSR server wrapper at audited commit"
[11]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/src/routes/index.tsx "Frontend home route at audited commit"
[12]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/backend/requirements.txt "Backend dependencies at audited commit"
[13]: https://github.com/maddy71247-max/SIH/blob/4edf22ef9492589f8f8381602d24b036738aceaa/frontend/lovable-ui/README.md "Frontend README at audited commit"
