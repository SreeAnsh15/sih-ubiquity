import importlib
import sys

from fastapi.testclient import TestClient


def load_app(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("DEMO_MODE", "true")
    sys.path.insert(0, str(tmp_path.parent.parent / "SIH" / "backend"))
    import main

    return importlib.reload(main)


def test_match_booking_and_settlement_flow(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    headers = {"X-User-Id": "customer-1"}

    match = client.post(
        "/api/bookings/match-and-price",
        headers=headers,
        json={
            "customer_id": "customer-1",
            "service_type": "Plumbing",
            "customer_lat": 11.0168,
            "customer_lng": 76.9558,
        },
    )
    assert match.status_code == 200
    result = match.json()
    worker = result["selected_best_match"]
    assert worker["worker_id"] == "w-101"
    assert result["cluster_id"] == "coimbatore-gandhipuram"

    booking = client.post(
        "/api/bookings",
        headers=headers,
        json={
            "customer_id": "customer-1",
            "service_type": "Plumbing",
            "customer_lat": 11.0168,
            "customer_lng": 76.9558,
            "worker_id": worker["worker_id"],
            "agreed_amount": worker["fair_price_inr"],
        },
    )
    assert booking.status_code == 200
    confirmation = booking.json()
    assert confirmation["booking_id"].startswith("bk_")
    assert len(confirmation["development_otp"]) == 4

    wrong_otp = client.post(
        "/api/bookings/verify-settle",
        headers=headers,
        json={
            "booking_id": confirmation["booking_id"],
            "worker_id": worker["worker_id"],
            "cluster_id": result["cluster_id"],
            "gross_amount": confirmation["gross_amount"],
            "otp_code": "9999",
        },
    )
    assert wrong_otp.status_code == 400

    settled = client.post(
        "/api/bookings/verify-settle",
        headers=headers,
        json={
            "booking_id": confirmation["booking_id"],
            "worker_id": worker["worker_id"],
            "cluster_id": result["cluster_id"],
            "gross_amount": confirmation["gross_amount"],
            "otp_code": confirmation["development_otp"],
        },
    )
    assert settled.status_code == 200
    assert settled.json()["status"] == "completed"
    assert settled.json()["payout_released"] is True
    assert settled.json()["mutual_aid_accrued"] > 0
    assert settled.json()["settlement_breakdown"]["gross_amount_paid"] == confirmation["gross_amount"]

    repeated = client.post(
        "/api/bookings/verify-settle",
        headers=headers,
        json={
            "booking_id": confirmation["booking_id"],
            "worker_id": worker["worker_id"],
            "cluster_id": result["cluster_id"],
            "gross_amount": confirmation["gross_amount"],
            "otp_code": confirmation["development_otp"],
        },
    )
    assert repeated.status_code == 409


def test_identity_and_validation_boundaries(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)

    missing_identity = client.post(
        "/api/bookings/match-and-price",
        json={
            "customer_id": "customer-1",
            "service_type": "Plumbing",
            "customer_lat": 11.0168,
            "customer_lng": 76.9558,
        },
    )
    assert missing_identity.status_code == 401

    invalid_service = client.post(
        "/api/bookings/match-and-price",
        headers={"X-User-Id": "customer-1"},
        json={
            "customer_id": "customer-1",
            "service_type": "Unknown",
            "customer_lat": 11.0168,
            "customer_lng": 76.9558,
        },
    )
    assert invalid_service.status_code == 422


def test_worker_registration_is_persisted_and_unique(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    headers = {"X-User-Id": "worker-1"}
    payload = {
        "transcript": "I am a plumber with five years experience in Gandhipuram.",
        "language": "English",
        "full_name": "Asha Worker",
        "primary_skill": "Plumbing",
        "sub_skills": ["Pipe repair"],
        "experience_years": 5,
        "base_rate_inr": 500,
        "operating_zone": "Gandhipuram",
    }
    created = client.post("/api/workers/register", headers=headers, json=payload)
    assert created.status_code == 200
    assert created.json()["member_id"].startswith("PACS-")

    duplicate = client.post("/api/workers/register", headers=headers, json=payload)
    assert duplicate.status_code == 409


def test_expired_booking_releases_worker_and_cluster_is_enforced(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    headers = {"X-User-Id": "customer-expiry"}
    payload = {
        "customer_id": "customer-expiry",
        "service_type": "Plumbing",
        "customer_lat": 11.0168,
        "customer_lng": 76.9558,
    }
    match = client.post("/api/bookings/match-and-price", headers=headers, json=payload).json()
    worker = match["selected_best_match"]
    created = client.post(
        "/api/bookings",
        headers=headers,
        json={**payload, "worker_id": worker["worker_id"], "agreed_amount": worker["fair_price_inr"]},
    ).json()
    with backend.db_connect() as db:
        db.execute(
            "UPDATE bookings SET otp_expires_at = '2000-01-01T00:00:00+00:00' WHERE booking_id = ?",
            (created["booking_id"],),
        )
    refreshed = client.post("/api/bookings/match-and-price", headers=headers, json=payload).json()
    assert refreshed["selected_best_match"] is not None
    invalid_cluster = client.post(
        "/api/bookings/verify-settle",
        headers=headers,
        json={
            "booking_id": created["booking_id"],
            "worker_id": worker["worker_id"],
            "cluster_id": "wrong-cluster",
            "gross_amount": created["gross_amount"],
            "otp_code": created["development_otp"],
        },
    )
    assert invalid_cluster.status_code == 400


def test_cancellation_and_otp_lock(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    headers = {"X-User-Id": "customer-cancel"}
    payload = {
        "customer_id": "customer-cancel",
        "service_type": "Electrical",
        "customer_lat": 11.0168,
        "customer_lng": 76.9558,
    }
    match = client.post("/api/bookings/match-and-price", headers=headers, json=payload).json()
    worker = match["selected_best_match"]
    created = client.post(
        "/api/bookings",
        headers=headers,
        json={**payload, "worker_id": worker["worker_id"], "agreed_amount": worker["fair_price_inr"]},
    ).json()
    cancelled = client.delete(f"/api/bookings/{created['booking_id']}/cancel", headers=headers)
    assert cancelled.status_code == 200
    repeated = client.delete(f"/api/bookings/{created['booking_id']}/cancel", headers=headers)
    assert repeated.status_code == 409

    created = client.post(
        "/api/bookings",
        headers=headers,
        json={**payload, "worker_id": worker["worker_id"], "agreed_amount": worker["fair_price_inr"]},
    ).json()
    for _ in range(4):
        wrong = client.post(
            "/api/bookings/verify-settle",
            headers=headers,
            json={
                "booking_id": created["booking_id"],
                "worker_id": worker["worker_id"],
                "cluster_id": "coimbatore-gandhipuram",
                "gross_amount": created["gross_amount"],
                "otp_code": "9999",
            },
        )
        assert wrong.status_code == 400
    locked = client.post(
        "/api/bookings/verify-settle",
        headers=headers,
        json={
            "booking_id": created["booking_id"],
            "worker_id": worker["worker_id"],
            "cluster_id": "coimbatore-gandhipuram",
            "gross_amount": created["gross_amount"],
            "otp_code": "9999",
        },
    )
    assert locked.status_code == 429


def test_worker_welfare_passbook_and_claim(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    customer_headers = {"X-User-Id": "welfare-customer"}
    match_payload = {
        "customer_id": "welfare-customer",
        "service_type": "Carpentry",
        "customer_lat": 11.0168,
        "customer_lng": 76.9558,
    }
    match = client.post("/api/bookings/match-and-price", headers=customer_headers, json=match_payload)
    assert match.status_code == 200
    worker = match.json()["selected_best_match"]
    booking = client.post("/api/bookings", headers=customer_headers, json={**match_payload, "worker_id": worker["worker_id"], "agreed_amount": worker["fair_price_inr"]})
    assert booking.status_code == 200
    confirmation = booking.json()
    settled = client.post("/api/bookings/verify-settle", headers=customer_headers, json={"booking_id": confirmation["booking_id"], "worker_id": worker["worker_id"], "cluster_id": "coimbatore-gandhipuram", "gross_amount": confirmation["gross_amount"], "otp_code": confirmation["development_otp"]})
    assert settled.status_code == 200

    worker_headers = {"X-User-Id": "worker_1"}
    welfare = client.get("/api/workers/welfare", headers=worker_headers)
    assert welfare.status_code == 200
    payload = welfare.json()
    assert payload["worker_id"] == "w-103"
    assert payload["full_name"] == "Anbu Kumar"
    assert payload["lifetime_jobs_completed"] == 1
    assert payload["total_take_home_earnings_inr"] > 0
    assert payload["accrued_mutual_aid_inr"] > 0
    assert len(payload["completed_jobs"]) == 1

    claim = client.post("/api/workers/welfare/claims", headers=worker_headers, json={"amount": 1, "reason": "Emergency medical support"})
    assert claim.status_code == 200
    assert claim.json()["status"] == "submitted"
    refreshed = client.get("/api/workers/welfare", headers=worker_headers).json()
    assert refreshed["emergency_relief_claims"][0]["status"] == "pending"


def test_registration_queue_and_admin_approval_promote_worker(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    registration = client.post(
        "/api/workers/register",
        headers={"X-User-Id": "worker-new"},
        json={
            "transcript": "I am Murugan, a plumber serving Gandhipuram.",
            "language": "ta",
            "full_name": "Murugan S.",
            "primary_skill": "Plumbing",
            "sub_skills": ["Pipe fitting"],
            "experience_years": 11,
            "base_rate_inr": 420,
            "operating_zone": "Gandhipuram",
        },
    )
    assert registration.status_code == 200
    member_id = registration.json()["member_id"]
    admin_headers = {"X-User-Id": "demo-admin"}
    queue = client.get("/api/admin/verification-queue", headers=admin_headers)
    assert queue.status_code == 200
    assert any(item["member_id"] == member_id for item in queue.json()["items"])
    approved = client.post(f"/api/admin/verification-queue/{member_id}/approve", headers=admin_headers, json={})
    assert approved.status_code == 200
    promoted = client.post(
        "/api/bookings/match-and-price",
        headers={"X-User-Id": "presentation-customer"},
        json={"customer_id": "presentation-customer", "service_type": "Plumbing", "customer_lat": 11.0168, "customer_lng": 76.9558},
    )
    assert promoted.status_code == 200
    assert any(item["worker_id"] == approved.json()["worker_id"] for item in promoted.json()["all_ranked_candidates"])


def test_voice_onboarding_returns_deterministic_demo_profile(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    response = client.post(
        "/api/workers/voice-onboard",
        data={"preferred_language": "ta"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["transcript"] == "என் பெயர் முருகன், காந்திபுரத்தில் 7 வருடங்களாக பிளம்பிங் வேலை செய்கிறேன், பேஸ் ரேட் 250 ரூபாய்."
    assert payload["name"] == "Murugan S."
    assert payload["trade"] == "Plumbing"
    assert payload["experience_years"] == 7
    assert payload["base_rate"] == 250.0
    assert payload["phone"] == "+91 98765 43219"
    assert payload["locality"] == "Gandhipuram"
    assert payload["language"] == "ta"
    assert payload["structured_profile"]["full_name"] == "Murugan S."
    assert payload["structured_profile"]["primary_skill"] == "Plumbing"
    assert payload["demo_fallback"] is True


def test_voice_onboarding_language_specific_fallbacks(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    for language, expected in {
        "hi": {"name": "Rajesh Sharma", "trade": "Electrical", "experience_years": 5, "base_rate": 300.0, "phone": "+91 98765 43220"},
        "en": {"name": "David Joseph", "trade": "Carpentry", "experience_years": 8, "base_rate": 350.0, "phone": "+91 98765 43221"},
        "te": {"name": "Suresh Rao", "trade": "Plumbing", "experience_years": 6, "base_rate": 275.0, "phone": "+91 98765 43222"},
    }.items():
        response = client.post(
            "/api/workers/voice-onboard",
            data={"language_hint": language},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["language"] == language
        for key, value in expected.items():
            assert payload[key] == value
        assert payload["structured_profile"]["primary_skill"] == expected["trade"]


def test_pending_worker_passbook_transitions_after_pacs_approval(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    worker_headers = {"X-User-Id": "worker-pending-flow"}
    payload = {
        "transcript": "My name is David Joseph, experienced carpenter in Gandhipuram.",
        "language": "en",
        "full_name": "David Joseph",
        "primary_skill": "Carpentry",
        "sub_skills": ["Woodwork"],
        "experience_years": 8,
        "base_rate_inr": 350,
        "operating_zone": "Gandhipuram",
    }
    created = client.post("/api/workers/register", headers=worker_headers, json=payload)
    assert created.status_code == 200
    pending = client.get("/api/workers/welfare", headers=worker_headers, params={"worker_id": "worker-pending-flow"})
    assert pending.status_code == 200
    assert pending.json()["verification_badge"] == "PACS_PENDING"
    assert pending.json()["registration_status"] == "pending_verification"

    member_id = created.json()["member_id"]
    approved = client.post(f"/api/admin/verification-queue/{member_id}/approve", headers={"X-User-Id": "demo-admin"}, json={})
    assert approved.status_code == 200
    verified = client.get("/api/workers/welfare", headers=worker_headers, params={"worker_id": "worker-pending-flow"})
    assert verified.status_code == 200
    assert verified.json()["verification_badge"] == "PACS_VERIFIED"
    assert verified.json()["registration_status"] == "approved"


def test_health_flags_reflect_individual_provider_keys(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    backend.OPENAI_API_KEY = None
    backend.GEMINI_API_KEY = "gemini-test-key"
    response = TestClient(backend.app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["voice_transcription_configured"] is True
    assert response.json()["profile_extraction_configured"] is True


def test_gemini_voice_path_does_not_require_openai(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    calls = []

    class FakeResponse:
        text = "My name is David Joseph, experienced carpenter in Gandhipuram."
        parsed = {
            "transcript": text,
            "full_name": "David Joseph",
            "primary_skill": "Carpentry",
            "sub_skills": ["Woodwork"],
            "experience_years": 8,
            "base_rate_inr": 350.0,
            "operating_zone": "Gandhipuram",
        }

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return FakeResponse()

    class FakeGemini:
        models = FakeModels()

    backend.DEMO_MODE = True
    backend.OPENAI_API_KEY = None
    backend.openai_client = None
    backend.GEMINI_API_KEY = "gemini-test-key"
    backend.gemini_client = FakeGemini()
    client = TestClient(backend.app)
    response = client.post(
        "/api/workers/voice-onboard",
        files={"audio_file": ("voice.webm", b"a" * 128, "application/octet-stream")},
        data={"preferred_language": "en"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "David Joseph" if "name" in payload else payload["structured_profile"]["full_name"] == "David Joseph"
    assert payload["structured_profile"]["primary_skill"] == "Carpentry"
    assert payload["demo_fallback"] is False
    assert len(calls) == 1
    assert calls[0]["model"] == "gemini-2.5-flash"
    assert backend.openai_client is None


def test_gemini_voice_path_reports_unintelligible_speech(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)

    class FakeResponse:
        text = ""
        parsed = {
            "transcript": "",
            "full_name": "",
            "primary_skill": "",
            "sub_skills": [],
            "experience_years": 3,
            "base_rate_inr": 350.0,
            "operating_zone": "",
        }

    class FakeModels:
        def generate_content(self, **kwargs):
            return FakeResponse()

    class FakeGemini:
        models = FakeModels()

    backend.DEMO_MODE = True
    backend.GEMINI_API_KEY = "gemini-test-key"
    backend.gemini_client = FakeGemini()
    response = TestClient(backend.app).post(
        "/api/workers/voice-onboard",
        files={"audio": ("silence.webm", b"a" * 128, "application/octet-stream")},
        data={"language": "en"},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Could not recognize speech clearly. Please speak closer to the mic."}


def test_custom_worker_registration_coerces_edge_case_values(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    response = client.post(
        "/api/workers/register",
        headers={"X-User-Id": "custom-worker-edge"},
        json={
            "full_name": "Custom Solar Specialist",
            "phone": "+91 98840-51502",
            "primary_skill": "Solar Panel Diagnostics",
            "sub_skills": ["Rooftop systems"],
            "experience_years": "not provided",
            "base_rate_inr": "₹2,500",
            "operating_zone": "Gandhipuram Ward 12",
            "transcript": "Manual custom profile",
            "language": "en",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "registered"
    queue = client.get("/api/admin/verification-queue", headers={"X-User-Id": "demo-admin"})
    assert queue.status_code == 200
    saved = next(item for item in queue.json()["items"] if item["member_id"] == payload["member_id"])
    assert saved["full_name"] == "Custom Solar Specialist"
    assert saved["phone"] == "9884051502"
    assert saved["primary_skill"] == "Solar Panel Diagnostics"
    assert saved["experience_years"] == 1
    assert saved["base_rate_inr"] == 250.0


def test_demo_master_otps_complete_booking(tmp_path, monkeypatch):
    backend = load_app(tmp_path, monkeypatch)
    client = TestClient(backend.app)
    headers = {"X-User-Id": "demo-master-otp"}
    payload = {"customer_id": "demo-master-otp", "service_type": "Plumbing", "customer_lat": 11.0168, "customer_lng": 76.9558}
    match = client.post("/api/bookings/match-and-price", headers=headers, json=payload).json()
    worker = match["selected_best_match"]
    for master_otp in ("1234", "0000", "8888", "1232"):
        created = client.post("/api/bookings", headers=headers, json={**payload, "worker_id": worker["worker_id"], "agreed_amount": worker["fair_price_inr"]}).json()
        completed = client.post("/api/bookings/verify-settle", headers=headers, json={"booking_id": created["booking_id"], "worker_id": worker["worker_id"], "cluster_id": "coimbatore-gandhipuram", "gross_amount": created["gross_amount"], "otp_code": master_otp})
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        assert completed.json()["payout_released"] is True
