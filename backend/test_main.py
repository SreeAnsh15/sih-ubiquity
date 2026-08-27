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
            "otp_code": "0000" if confirmation["development_otp"] != "0000" else "1111",
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
    assert settled.json()["status"] == "settled"
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
                "otp_code": "0000" if created["development_otp"] != "0000" else "1111",
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
            "otp_code": "0000" if created["development_otp"] != "0000" else "1111",
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
        files={"audio_file": ("voice.webm", b"demo-audio", "audio/webm")},
        data={"preferred_language": "ta"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["transcript"] == "என் பெயர் முருகன், காந்திபுரத்தில் 7 வருடங்களாக பிளம்பிங் வேலை செய்கிறேன்."
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
