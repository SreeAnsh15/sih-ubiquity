import io
import hmac
import json
import math
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

try:
    import openai
except ImportError:  # Optional when running only the booking demo.
    openai = None

try:
    from google import genai
    from google.genai import types
except ImportError:  # Optional until voice AI is configured.
    genai = None
    types = None


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DB_PATH", str(ROOT / "ubiquity.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
AUTH_SECRET = os.getenv("AUTH_SECRET", "")
MAX_AUDIO_BYTES = 10 * 1024 * 1024
OTP_TTL_MINUTES = 30
MAX_OTP_ATTEMPTS = 5
CLUSTER_ID = "coimbatore-gandhipuram"
ADMIN_USER_IDS = {item.strip() for item in os.getenv("ADMIN_USER_IDS", "demo-admin,admin").split(",") if item.strip()}
WORKER_ALIASES = {"worker_1": "w-103", "demo-worker": "w-103"}
SUPPORTED_LANGUAGES = {"ta", "hi", "te", "mr", "en"}
SUPPORTED_SERVICES = {
    "plumbing": "Plumbing",
    "pipe fitting": "Plumbing",
    "sanitation": "Plumbing",
    "electrical": "Electrical",
    "house cleaning": "House Cleaning",
    "cleaning": "House Cleaning",
    "housekeeping": "House Cleaning",
    "carpentry": "Carpentry",
    "masonry": "Masonry",
}
BASE_RATES = {
    "Plumbing": 198.4,
    "Electrical": 224.6,
    "House Cleaning": 168.2,
    "Carpentry": 246.8,
    "Masonry": 262.5,
}
DEMO_VOICE_PROFILES = {
    "ta": {
        "transcript": "என் பெயர் முருகன், காந்திபுரத்தில் 7 வருடங்களாக பிளம்பிங் வேலை செய்கிறேன், பேஸ் ரேட் 250 ரூபாய்.",
        "name": "Murugan S.",
        "trade": "Plumbing",
        "experience_years": 7,
        "base_rate": 250.0,
        "phone": "+91 98765 43219",
        "locality": "Gandhipuram",
        "language": "ta",
        "sub_skills": ["Pipe fitting", "Sanitation"],
    },
    "hi": {
        "transcript": "मेरा नाम राजेश शर्मा है, मैं गांधीपुरम में 5 साल से इलेक्ट्रीशियन का काम करता हूँ, बेसिक चार्ज 300 रुपये।",
        "name": "Rajesh Sharma",
        "trade": "Electrical",
        "experience_years": 5,
        "base_rate": 300.0,
        "phone": "+91 98765 43220",
        "locality": "Gandhipuram",
        "language": "hi",
        "sub_skills": ["Wiring", "Appliance repair"],
    },
    "en": {
        "transcript": "My name is David Joseph, experienced carpenter with 8 years of practice in Gandhipuram, base rate 350 rupees.",
        "name": "David Joseph",
        "trade": "Carpentry",
        "experience_years": 8,
        "base_rate": 350.0,
        "phone": "+91 98765 43221",
        "locality": "Gandhipuram",
        "language": "en",
        "sub_skills": ["Furniture repair", "Woodwork"],
    },
    "te": {
        "transcript": "నా పేరు సురేష్ రావు, గాంధీపురంలో 6 సంవత్సరాలుగా ప్లంబింగ్ పని చేస్తున్నాను, ప్రాథమిక ధర 275 రూపాయలు.",
        "name": "Suresh Rao",
        "trade": "Plumbing",
        "experience_years": 6,
        "base_rate": 275.0,
        "phone": "+91 98765 43222",
        "locality": "Gandhipuram",
        "language": "te",
        "sub_skills": ["Pipe fitting", "Sanitation"],
    },
}
SEED_WORKERS = [
    ("w-101", "Murugan S.", "+91 9876543210", ["Plumbing", "Pipe Fitting"], 11.0231, 76.9612, 0.88, 6),
    ("w-102", "Lakshmi R.", "+91 9876543211", ["Electrical", "Appliance Repair"], 11.0104, 76.9481, 0.95, 3),
    ("w-103", "Anbu Kumar", "+91 9876543212", ["Carpentry", "Furniture Repair"], 11.0272, 76.9439, 0.90, 9),
    ("w-104", "Selvi M.", "+91 9876543213", ["House Cleaning", "Housekeeping"], 11.0059, 76.9668, 0.92, 2),
    ("w-105", "Ravi Chandran", "+91 9876543214", ["Masonry", "Plastering"], 11.0325, 76.9702, 0.84, 11),
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def db_connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with db_connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS workers (
                worker_id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                skills_json TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                trust_rating REAL NOT NULL CHECK (trust_rating BETWEEN 0 AND 1),
                idle_days INTEGER NOT NULL DEFAULT 0 CHECK (idle_days >= 0),
                is_verified INTEGER NOT NULL DEFAULT 1,
                availability TEXT NOT NULL DEFAULT 'online',
                capacity INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bookings (
                booking_id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                worker_id TEXT NOT NULL REFERENCES workers(worker_id),
                service_type TEXT NOT NULL,
                customer_lat REAL NOT NULL,
                customer_lng REAL NOT NULL,
                gross_amount REAL NOT NULL CHECK (gross_amount > 0),
                otp_hash TEXT NOT NULL,
                otp_expires_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed',
                otp_attempts INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0),
                cluster_id TEXT NOT NULL DEFAULT 'coimbatore-gandhipuram',
                created_at TEXT NOT NULL,
                settled_at TEXT
            );
            CREATE TABLE IF NOT EXISTS settlements (
                settlement_id TEXT PRIMARY KEY,
                booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(booking_id),
                gross_amount REAL NOT NULL,
                worker_payout REAL NOT NULL,
                pacs_maintenance REAL NOT NULL,
                mutual_aid_fund REAL NOT NULL,
                reference TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS worker_registrations (
                member_id TEXT PRIMARY KEY,
                user_id TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '',
                primary_skill TEXT NOT NULL,
                sub_skills_json TEXT NOT NULL,
                experience_years INTEGER NOT NULL,
                base_rate_inr REAL NOT NULL,
                operating_zone TEXT NOT NULL,
                transcript TEXT NOT NULL,
                language TEXT NOT NULL,
                created_at TEXT NOT NULL,
                verification_status TEXT NOT NULL DEFAULT 'pending'
            );
            CREATE TABLE IF NOT EXISTS welfare_claims (
                id TEXT PRIMARY KEY,
                worker_id TEXT NOT NULL REFERENCES workers(worker_id),
                amount REAL NOT NULL CHECK (amount > 0),
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                created_at TEXT NOT NULL
            );
            """
        )
        columns = {row[1] for row in db.execute("PRAGMA table_info(bookings)").fetchall()}
        if "otp_attempts" not in columns:
            db.execute("ALTER TABLE bookings ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0")
        if "cluster_id" not in columns:
            db.execute("ALTER TABLE bookings ADD COLUMN cluster_id TEXT NOT NULL DEFAULT 'coimbatore-gandhipuram'")
        registration_columns = {row[1] for row in db.execute("PRAGMA table_info(worker_registrations)").fetchall()}
        if "phone" not in registration_columns:
            db.execute("ALTER TABLE worker_registrations ADD COLUMN phone TEXT NOT NULL DEFAULT ''")
        if "verification_status" not in registration_columns:
            db.execute("ALTER TABLE worker_registrations ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending'")
        if db.execute("SELECT COUNT(*) FROM workers").fetchone()[0] == 0:
            now = utc_now().isoformat()
            db.executemany(
                """
                INSERT INTO workers
                (worker_id, full_name, phone, skills_json, lat, lng, trust_rating, idle_days,
                 is_verified, availability, capacity, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'online', 1, ?)
                """,
                [
                    (worker_id, name, phone, json.dumps(skills), lat, lng, rating, idle_days, now)
                    for worker_id, name, phone, skills, lat, lng, rating, idle_days in SEED_WORKERS
                ],
            )


init_db()

app = FastAPI(title="Ubiquity Cooperative Gig Backend", version="2.0.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-User-Id", "X-User-Signature"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY) if openai and OPENAI_API_KEY else None
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None


class WorkerProfileSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: str = Field(min_length=2, max_length=120)
    primary_skill: str = Field(min_length=2, max_length=60)
    sub_skills: List[str] = Field(default_factory=list, max_length=12)
    experience_years: int = Field(default=1, ge=0, le=60)
    base_rate_inr: float = Field(default=250.0, gt=0, le=100000)
    operating_zone: str = Field(min_length=2, max_length=120)


class VoiceExtractionSchema(WorkerProfileSchema):
    transcript: str = Field(min_length=2, max_length=5000)


class BookingRequest(BaseModel):
    customer_id: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9._@+-]+$")
    service_type: str = Field(min_length=2, max_length=60)
    customer_lat: float = Field(ge=-90, le=90)
    customer_lng: float = Field(ge=-180, le=180)
    emergency: bool = False

    @field_validator("service_type")
    @classmethod
    def normalize_service(cls, value: str) -> str:
        normalized = SUPPORTED_SERVICES.get(value.strip().lower())
        if not normalized:
            raise ValueError(f"Unsupported service. Choose from: {', '.join(BASE_RATES)}")
        return normalized


class CreateBookingRequest(BookingRequest):
    worker_id: str = Field(min_length=3, max_length=80)
    agreed_amount: float = Field(gt=0, le=100000)


class SettleBookingRequest(BaseModel):
    booking_id: str = Field(min_length=8, max_length=80)
    worker_id: str = Field(min_length=3, max_length=80)
    cluster_id: str = Field(min_length=2, max_length=80)
    gross_amount: float = Field(gt=0, le=100000)
    otp_code: str = Field(pattern=r"^\d{4}$")


class WelfareClaimRequest(BaseModel):
    amount: float = Field(gt=0, le=100000)
    reason: str = Field(min_length=3, max_length=500)


class RegisterWorkerRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transcript: str = Field(min_length=2, max_length=5000)
    language: str = Field(min_length=2, max_length=40)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(default="", max_length=30)
    primary_skill: str = Field(min_length=2, max_length=60)
    sub_skills: List[str] = Field(default_factory=list, max_length=12)
    experience_years: int = Field(ge=0, le=60)
    base_rate_inr: float = Field(gt=0, le=100000)
    operating_zone: str = Field(min_length=2, max_length=120)


def require_actor(request: Request, user_id: str) -> str:
    actor = request.headers.get("X-User-Id", "").strip()
    if not actor or actor != user_id:
        raise HTTPException(status_code=401, detail="Authenticated identity is required")
    if not DEMO_MODE:
        signature = request.headers.get("X-User-Signature", "")
        if not AUTH_SECRET or not signature:
            raise HTTPException(status_code=503, detail="Production authentication is not configured")
        expected = hmac.new(AUTH_SECRET.encode(), actor.encode(), "sha256").hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid authenticated identity")
    return actor


@app.post("/api/auth/dev-token")
def issue_dev_identity(user_id: str = "demo-customer") -> dict[str, str]:
    if not DEMO_MODE:
        raise HTTPException(status_code=404, detail="Development identity is disabled")
    if not user_id or len(user_id) > 120:
        raise HTTPException(status_code=400, detail="Invalid development identity")
    return {"user_id": user_id, "signature": hmac.new((AUTH_SECRET or "demo").encode(), user_id.encode(), "sha256").hexdigest()}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def hash_otp(otp: str) -> str:
    import hashlib

    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def generate_otp() -> str:
    import secrets

    return f"{secrets.randbelow(10000):04d}"


def active_booking_count(db: sqlite3.Connection, worker_id: str) -> int:
    now = utc_now().isoformat()
    return int(
        db.execute(
            "SELECT COUNT(*) FROM bookings WHERE worker_id = ? AND status = 'confirmed' AND otp_expires_at > ?",
            (worker_id, now),
        ).fetchone()[0]
    )


def worker_payload(row: sqlite3.Row, distance_km: float, service: str, score: float) -> dict[str, Any]:
    fair_price = round(BASE_RATES[service] + distance_km * 15, 2)
    commercial_price = round(fair_price * 1.35, 2)
    return {
        "worker_id": row["worker_id"],
        "full_name": row["full_name"],
        "skill": service,
        "distance_km": round(distance_km, 2),
        "fair_match_score": round(score, 3),
        "fair_price_inr": fair_price,
        "commercial_aggregator_price_inr": commercial_price,
        "customer_savings_inr": round(commercial_price - fair_price, 2),
        "trust_rating": row["trust_rating"],
        "idle_days": row["idle_days"],
        "lat": row["lat"],
        "lng": row["lng"],
        "verified": bool(row["is_verified"]),
        "availability": row["availability"],
    }


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok", "service": "Ubiquity Cooperative Gig Backend", "version": app.version}


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "database": DB_PATH.exists(),
        "voice_transcription_configured": bool(OPENAI_API_KEY or GEMINI_API_KEY),
        "profile_extraction_configured": bool(GEMINI_API_KEY),
        "demo_mode": DEMO_MODE,
    }


@app.post("/api/workers/voice-onboard")
async def voice_onboard_worker(
    audio: UploadFile | None = File(None),
    audio_file: UploadFile | None = File(None),
    preferred_language: str = Form("ta"),
    language_hint: str | None = Form(None),
    language: str | None = Form(None),
) -> dict[str, Any]:
    requested_language = (language_hint or language or preferred_language or "ta").strip().lower()
    audio_upload = audio or audio_file
    if requested_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language")
    if not audio_upload:
        raise HTTPException(status_code=400, detail="Upload an audio recording")
    if not audio_upload.content_type or not audio_upload.content_type.startswith("audio/"):
        raise HTTPException(status_code=415, detail="Upload an audio recording")
    audio_bytes = await audio_upload.read(MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio recording must be 10 MB or smaller")
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio recording is empty")
    if DEMO_MODE or not gemini_client:
        profile = DEMO_VOICE_PROFILES.get(requested_language, DEMO_VOICE_PROFILES["ta"])
        return {
            "status": "success",
            **profile,
            "transcription": profile["transcript"],
            "structured_profile": {
                "full_name": profile["name"],
                "primary_skill": profile["trade"],
                "sub_skills": profile["sub_skills"],
                "experience_years": profile["experience_years"],
                "base_rate_inr": profile["base_rate"],
                "operating_zone": profile["locality"],
            },
            "demo_fallback": True,
        }

    try:
        response = gemini_client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=audio_upload.content_type or "audio/webm"),
                (
                    "Transcribe this worker voice recording and extract the profile in one pass. "
                    f"The requested language is {requested_language}. Return only JSON matching the worker profile schema. "
                    "Use the spoken language for the transcript, and infer only fields clearly stated in the recording."
                ),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VoiceExtractionSchema,
                temperature=0.1,
            ),
        )
        parsed = response.parsed
        if isinstance(parsed, BaseModel):
            extracted = parsed.model_dump()
        elif isinstance(parsed, dict):
            extracted = dict(parsed)
        else:
            raise HTTPException(status_code=502, detail="Profile extraction returned an invalid response")
        transcription_text = str(extracted.pop("transcript", "")).strip() or getattr(response, "text", "") or f"Voice profile extracted in {requested_language}."
        profile = {key: value for key, value in extracted.items() if key in VoiceProfileSchema.model_fields}
        return {"status": "success", "transcript": transcription_text, "transcription": transcription_text, "name": profile["full_name"], "trade": profile["primary_skill"], "experience_years": profile["experience_years"], "base_rate": profile["base_rate_inr"], "phone": "", "locality": profile["operating_zone"], "language": requested_language, **profile, "structured_profile": profile}
    except Exception as exc:
        print(f"voice onboarding provider failed: {exc}")
        profile = DEMO_VOICE_PROFILES.get(requested_language, DEMO_VOICE_PROFILES["ta"])
        return {
            "status": "success",
            **profile,
            "transcription": profile["transcript"],
            "structured_profile": {
                "full_name": profile["name"],
                "primary_skill": profile["trade"],
                "sub_skills": profile["sub_skills"],
                "experience_years": profile["experience_years"],
                "base_rate_inr": profile["base_rate"],
                "operating_zone": profile["locality"],
            },
            "demo_fallback": True,
        }



@app.post("/api/workers/register")
def register_worker(req: RegisterWorkerRequest, request: Request) -> dict[str, Any]:
    user_id = request.headers.get("X-User-Id", "").strip()
    require_actor(request, user_id)
    member_id = f"PACS-{uuid.uuid4().hex[:8].upper()}"
    now = utc_now().isoformat()
    with db_connect() as db:
        if db.execute("SELECT member_id FROM worker_registrations WHERE user_id = ?", (user_id,)).fetchone():
            raise HTTPException(status_code=409, detail="This user already has a PACS registration")
        db.execute(
            """
            INSERT INTO worker_registrations
            (member_id, user_id, full_name, phone, primary_skill, sub_skills_json, experience_years,
             base_rate_inr, operating_zone, transcript, language, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (member_id, user_id, req.full_name, req.phone, req.primary_skill, json.dumps(req.sub_skills), req.experience_years,
             req.base_rate_inr, req.operating_zone, req.transcript, req.language, now),
        )
    return {"status": "registered", "member_id": member_id, "registered_at": now}


def require_admin(request: Request) -> str:
    actor = request.headers.get("X-User-Id", "").strip()
    if actor not in ADMIN_USER_IDS:
        raise HTTPException(status_code=403, detail="PACS administrator access is required")
    if not DEMO_MODE:
        require_actor(request, actor)
    return actor


@app.get("/api/admin/dashboard")
def admin_dashboard(request: Request) -> dict[str, Any]:
    require_admin(request)
    with db_connect() as db:
        members = int(db.execute("SELECT COUNT(*) FROM worker_registrations").fetchone()[0])
        pending = int(db.execute("SELECT COUNT(*) FROM worker_registrations WHERE verification_status = 'pending'").fetchone()[0])
        gigs = int(db.execute("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND cluster_id = ?", (CLUSTER_ID,)).fetchone()[0])
        funds = db.execute("SELECT COALESCE(SUM(pacs_maintenance),0), COALESCE(SUM(mutual_aid_fund),0) FROM settlements").fetchone()
        verified = int(db.execute("SELECT COUNT(*) FROM workers WHERE is_verified = 1").fetchone()[0])
    return {"status": "success", "cluster_id": CLUSTER_ID, "registered_members": members, "verified_workers": verified, "pending_verifications": pending, "active_cluster_gigs": gigs, "pacs_maintenance_pool_inr": round(float(funds[0]), 2), "mutual_aid_reserve_fund_inr": round(float(funds[1]), 2), "fund_split": {"pacs_maintenance_pct": 1.5, "mutual_aid_pct": 0.5}}


@app.get("/api/admin/verification-queue")
def verification_queue(request: Request) -> dict[str, Any]:
    require_admin(request)
    with db_connect() as db:
        rows = db.execute("SELECT * FROM worker_registrations WHERE verification_status = 'pending' ORDER BY created_at DESC").fetchall()
    items = [{"member_id": row["member_id"], "user_id": row["user_id"], "full_name": row["full_name"], "primary_skill": row["primary_skill"], "sub_skills": json.loads(row["sub_skills_json"]), "experience_years": row["experience_years"], "base_rate_inr": row["base_rate_inr"], "operating_zone": row["operating_zone"], "language": row["language"], "transcript": row["transcript"], "verification_status": row["verification_status"], "created_at": row["created_at"]} for row in rows]
    return {"status": "success", "items": items, "count": len(items)}


@app.post("/api/admin/verification-queue/{member_id}/approve")
def approve_worker(member_id: str, request: Request) -> dict[str, Any]:
    require_admin(request)
    with db_connect() as db:
        registration = db.execute("SELECT * FROM worker_registrations WHERE member_id = ?", (member_id,)).fetchone()
        if not registration:
            raise HTTPException(status_code=404, detail="Worker registration not found")
        if registration["verification_status"] == "approved":
            raise HTTPException(status_code=409, detail="Worker registration is already approved")
        db.execute("UPDATE worker_registrations SET verification_status = 'approved' WHERE member_id = ?", (member_id,))
        worker_id = member_id.lower()
        if not db.execute("SELECT worker_id FROM workers WHERE worker_id = ?", (worker_id,)).fetchone():
            skills = [registration["primary_skill"], *json.loads(registration["sub_skills_json"])]
            db.execute("INSERT INTO workers (worker_id, full_name, phone, skills_json, lat, lng, trust_rating, idle_days, is_verified, availability, capacity, created_at) VALUES (?, ?, ?, ?, 11.0168, 76.9558, 0.75, 0, 1, 'online', 1, ?)", (worker_id, registration["full_name"], registration["phone"] or "PACS member", json.dumps(skills), utc_now().isoformat()))
    return {"status": "approved", "member_id": member_id, "worker_id": worker_id, "verification_badge": "PACS_VERIFIED"}


@app.get("/api/admin/demand-forecast")
def demand_forecast(request: Request) -> dict[str, Any]:
    require_admin(request)
    month = utc_now().month
    season = "Monsoon" if month in {6, 7, 8, 9} else "Festive and Northeast Monsoon" if month in {10, 11, 12, 1} else "Summer"
    drivers = ["Monsoon rainfall", "Drainage maintenance", "Leakage response demand"] if season == "Monsoon" else ["Festival preparation", "Seasonal household repairs"]
    multipliers = {"Plumbing": 1.34 if season == "Monsoon" else 1.08, "Electrical": 1.28 if season == "Summer" else 1.16, "House Cleaning": 1.18 if season.startswith("Festive") else 1.04, "Carpentry": 1.12 if season.startswith("Festive") else 1.03, "Masonry": 1.10 if season == "Monsoon" else 1.02}
    wards = ["Gandhipuram", "RS Puram", "Saibaba Colony", "Peelamedu"]
    forecast = [{"service_type": service, "ward": ward, "historical_30d_jobs": 0, "predicted_next_30d_jobs": max(1, round(3 * multiplier)), "surge_percentage": round((multiplier - 1) * 100), "signal": "high" if multiplier >= 1.25 else "watch" if multiplier >= 1.1 else "steady", "driver": drivers[0]} for service, multiplier in multipliers.items() for ward in wards]
    return {"status": "success", "season": season, "generated_at": utc_now().isoformat(), "seasonal_drivers": drivers, "forecast": forecast}


@app.post("/api/bookings/match-and-price")
def match_worker_and_price(req: BookingRequest, request: Request) -> dict[str, Any]:
    require_actor(request, req.customer_id)
    candidates: list[dict[str, Any]] = []
    with db_connect() as db:
        workers = db.execute("SELECT * FROM workers WHERE is_verified = 1 AND availability = 'online'").fetchall()
        for worker in workers:
            skills = {str(skill).lower() for skill in json.loads(worker["skills_json"])}
            if req.service_type.lower() not in skills and not any(
                SUPPORTED_SERVICES.get(skill) == req.service_type for skill in skills
            ):
                continue
            if active_booking_count(db, worker["worker_id"]) >= worker["capacity"]:
                continue
            distance = haversine_km(req.customer_lat, req.customer_lng, worker["lat"], worker["lng"])
            if distance > 5 or (req.emergency and distance >= 2):
                continue
            proximity_score = max(0.0, 1.0 - distance / 5.0)
            idle_score = min(1.0, worker["idle_days"] / 10.0)
            score = 0.45 * proximity_score + 0.35 * worker["trust_rating"] + 0.20 * idle_score
            candidates.append(worker_payload(worker, distance, req.service_type, score))

    candidates.sort(key=lambda item: (-item["fair_match_score"], item["distance_km"], item["worker_id"]))
    return {
        "status": "success",
        "cluster_id": CLUSTER_ID,
        "service_requested": req.service_type,
        "selected_best_match": candidates[0] if candidates else None,
        "all_ranked_candidates": candidates,
        "breakdown": {"proximity": 45, "trust": 35, "idle": 20},
        "emergency_dispatch": {"requested": req.emergency, "radius_km": 2 if req.emergency else 5, "priority": "high" if req.emergency else "standard", "requires_idle_worker": req.emergency},
    }


@app.post("/api/bookings")
def create_booking(req: CreateBookingRequest, request: Request) -> dict[str, Any]:
    require_actor(request, req.customer_id)
    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    otp = generate_otp()
    now = utc_now()
    expiry = now + timedelta(minutes=OTP_TTL_MINUTES)
    with db_connect() as db:
        db.execute("BEGIN IMMEDIATE")
        worker = db.execute(
            "SELECT * FROM workers WHERE worker_id = ? AND is_verified = 1 AND availability = 'online'",
            (req.worker_id,),
        ).fetchone()
        if not worker:
            raise HTTPException(status_code=404, detail="Worker is unavailable")
        distance = haversine_km(req.customer_lat, req.customer_lng, worker["lat"], worker["lng"])
        if distance > 5 or (req.emergency and distance >= 2):
            raise HTTPException(status_code=400, detail="Worker is outside the emergency service radius" if req.emergency else "Worker is outside the service radius")
        if active_booking_count(db, req.worker_id) >= worker["capacity"]:
            raise HTTPException(status_code=409, detail="Worker is already handling another booking")
        expected_amount = round(BASE_RATES[req.service_type] + distance * 15, 2)
        if abs(req.agreed_amount - expected_amount) > 0.02:
            raise HTTPException(status_code=409, detail="Price quote is stale; search again for a current quote")
        db.execute(
            """
            INSERT INTO bookings
            (booking_id, customer_id, worker_id, service_type, customer_lat, customer_lng, gross_amount,
             otp_hash, otp_expires_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
            """,
            (booking_id, req.customer_id, req.worker_id, req.service_type, req.customer_lat, req.customer_lng,
             req.agreed_amount, hash_otp(otp), expiry.isoformat(), now.isoformat()),
        )
    response: dict[str, Any] = {
        "status": "confirmed",
        "booking_id": booking_id,
        "worker_id": req.worker_id,
        "gross_amount": req.agreed_amount,
        "otp_expires_at": expiry.isoformat(),
        "message": "Booking confirmed. The completion OTP is issued to the worker app.",
    }
    if DEMO_MODE:
        response["development_otp"] = otp
        response["development_note"] = "Demo-only OTP; disable DEMO_MODE in production."
    return response


@app.delete("/api/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, request: Request) -> dict[str, str]:
    with db_connect() as db:
        booking = db.execute("SELECT * FROM bookings WHERE booking_id = ?", (booking_id,)).fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        require_actor(request, booking["customer_id"])
        if booking["status"] != "confirmed":
            raise HTTPException(status_code=409, detail="Booking is no longer cancellable")
        db.execute("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?", (booking_id,))
    return {"status": "cancelled", "booking_id": booking_id}


@app.post("/api/bookings/verify-settle")
def verify_and_settle_job(req: SettleBookingRequest, request: Request) -> dict[str, Any]:
    with db_connect() as db:
        booking = db.execute("SELECT * FROM bookings WHERE booking_id = ?", (req.booking_id,)).fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        require_actor(request, booking["customer_id"])
        if booking["worker_id"] != req.worker_id:
            raise HTTPException(status_code=403, detail="Worker does not own this booking")
        if booking["cluster_id"] != req.cluster_id or req.cluster_id != CLUSTER_ID:
            raise HTTPException(status_code=400, detail="Invalid booking cluster")
        if booking["status"] != "confirmed":
            raise HTTPException(status_code=409, detail="Booking has already been settled or cancelled")
        if abs(float(booking["gross_amount"]) - req.gross_amount) > 0.02:
            raise HTTPException(status_code=409, detail="Settlement amount does not match the booking quote")
        if utc_now() > datetime.fromisoformat(booking["otp_expires_at"]):
            db.execute("UPDATE bookings SET status = 'expired' WHERE booking_id = ?", (req.booking_id,))
            db.commit()
            raise HTTPException(status_code=410, detail="Completion OTP has expired")
        if hash_otp(req.otp_code) != booking["otp_hash"]:
            attempts = int(booking["otp_attempts"]) + 1
            if attempts >= MAX_OTP_ATTEMPTS:
                db.execute("UPDATE bookings SET otp_attempts = ?, status = 'locked' WHERE booking_id = ?", (attempts, req.booking_id))
                db.commit()
                raise HTTPException(status_code=429, detail="Too many incorrect OTP attempts")
            db.execute("UPDATE bookings SET otp_attempts = ? WHERE booking_id = ?", (attempts, req.booking_id))
            db.commit()
            raise HTTPException(status_code=400, detail="Incorrect completion OTP")

        gross = round(float(booking["gross_amount"]), 2)
        worker_payout = round(gross * 0.98, 2)
        pacs_maintenance = round(gross * 0.015, 2)
        mutual_aid_fund = round(gross - worker_payout - pacs_maintenance, 2)
        reference = f"UBQ-{uuid.uuid4().hex[:10].upper()}"
        now = utc_now().isoformat()
        db.execute("UPDATE bookings SET status = 'settled', settled_at = ? WHERE booking_id = ?", (now, req.booking_id))
        db.execute(
            """
            INSERT INTO settlements
            (settlement_id, booking_id, gross_amount, worker_payout, pacs_maintenance, mutual_aid_fund, reference, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (f"st_{uuid.uuid4().hex[:12]}", req.booking_id, gross, worker_payout, pacs_maintenance, mutual_aid_fund, reference, now),
        )
    return {
        "status": "settled",
        "booking_id": req.booking_id,
        "settlement_breakdown": {
            "gross_amount_paid": gross,
            "direct_worker_payout_98pct": worker_payout,
            "pacs_cooperative_maintenance_1_5pct": pacs_maintenance,
            "mutual_aid_emergency_pool_0_5pct": mutual_aid_fund,
        },
        "reference": reference,
    }


def resolve_worker_identity(request: Request, requested_worker_id: str) -> tuple[str, str]:
    actor = request.headers.get("X-User-Id", "").strip()
    if not actor:
        raise HTTPException(status_code=401, detail="Worker identity is required")
    canonical_id = WORKER_ALIASES.get(requested_worker_id.strip(), requested_worker_id.strip())
    actor_worker_id = WORKER_ALIASES.get(actor, actor)
    if actor_worker_id != canonical_id:
        raise HTTPException(status_code=403, detail="Worker does not own this welfare profile")
    if not DEMO_MODE:
        require_actor(request, actor)
    return actor, canonical_id


@app.get("/api/workers/welfare")
def worker_welfare(request: Request, worker_id: str = "worker_1") -> dict[str, Any]:
    actor = request.headers.get("X-User-Id", "").strip()
    requested_worker_id = worker_id.strip() or "worker_1"
    canonical_worker_id = WORKER_ALIASES.get(requested_worker_id, requested_worker_id)
    if not actor:
        raise HTTPException(status_code=401, detail="Worker identity is required")
    if not DEMO_MODE:
        require_actor(request, actor)
    with db_connect() as db:
        registration = db.execute("SELECT * FROM worker_registrations WHERE user_id = ?", (actor,)).fetchone()
        if registration and registration["verification_status"] == "approved":
            canonical_worker_id = registration["member_id"].lower()
        worker = db.execute("SELECT * FROM workers WHERE worker_id = ?", (canonical_worker_id,)).fetchone()
        if not worker:
            if registration and requested_worker_id in {actor, "worker_1"}:
                return {
                    "status": "success",
                    "worker_id": actor,
                    "member_id": registration["member_id"],
                    "full_name": registration["full_name"],
                    "primary_skill": registration["primary_skill"],
                    "verification_badge": "PACS_PENDING",
                    "lifetime_jobs_completed": 0,
                    "total_take_home_earnings_inr": 0,
                    "accrued_mutual_aid_inr": 0,
                    "emergency_relief_claimed_inr": 0,
                    "available_relief_balance_inr": 0,
                    "completed_jobs": [],
                    "emergency_relief_claims": [],
                    "registration_status": "pending_verification",
                }
            raise HTTPException(status_code=404, detail="Worker profile not found")
        rows = db.execute(
            """
            SELECT b.booking_id, b.service_type, b.customer_id, b.gross_amount,
                   b.settled_at, s.worker_payout, s.mutual_aid_fund, s.reference
            FROM bookings b
            JOIN settlements s ON s.booking_id = b.booking_id
            WHERE b.worker_id = ? AND b.status = 'settled'
            ORDER BY b.settled_at DESC
            """,
            (canonical_worker_id,),
        ).fetchall()
        accrued = float(db.execute("SELECT COALESCE(SUM(mutual_aid_fund), 0) FROM settlements WHERE booking_id IN (SELECT booking_id FROM bookings WHERE worker_id = ?)", (canonical_worker_id,)).fetchone()[0])
        approved_claims = float(db.execute("SELECT COALESCE(SUM(amount), 0) FROM welfare_claims WHERE worker_id = ? AND status = 'approved'", (canonical_worker_id,)).fetchone()[0])
        claims = db.execute("SELECT id, amount, reason, status, created_at FROM welfare_claims WHERE worker_id = ? ORDER BY created_at DESC LIMIT 10", (canonical_worker_id,)).fetchall()
    lifetime_jobs = len(rows)
    total_earnings = round(sum(float(row["worker_payout"]) for row in rows), 2)
    ledger_rows = [
        {
            "booking_id": row["booking_id"],
            "date": row["settled_at"],
            "service": row["service_type"],
            "customer_fee": round(float(row["gross_amount"]), 2),
            "worker_payout_98pct": round(float(row["worker_payout"]), 2),
            "reserve_contribution_0_5pct": round(float(row["mutual_aid_fund"]), 2),
            "reference": row["reference"],
        }
        for row in rows
    ]
    return {
        "status": "success",
        "worker_id": canonical_worker_id,
        "member_id": canonical_worker_id,
        "full_name": worker["full_name"],
        "primary_skill": json.loads(worker["skills_json"])[0],
        "verification_badge": "PACS_VERIFIED" if worker["is_verified"] else "PACS_PENDING",
        "registration_status": "approved" if canonical_worker_id not in WORKER_ALIASES else None,
        "lifetime_jobs_completed": lifetime_jobs,
        "total_take_home_earnings_inr": total_earnings,
        "accrued_mutual_aid_inr": round(accrued, 2),
        "emergency_relief_claimed_inr": round(approved_claims, 2),
        "available_relief_balance_inr": round(max(0.0, accrued - approved_claims), 2),
        "completed_jobs": ledger_rows,
        "emergency_relief_claims": [
            {"claim_id": row["id"], "worker_id": canonical_worker_id, "amount_inr": row["amount"], "reason": row["reason"], "status": row["status"], "created_at": row["created_at"]}
            for row in claims
        ],
    }


@app.post("/api/workers/welfare/claims")
def submit_welfare_claim(req: WelfareClaimRequest, request: Request, worker_id: str = "worker_1") -> dict[str, Any]:
    _actor, canonical_worker_id = resolve_worker_identity(request, worker_id)
    claim_id = f"claim_{uuid.uuid4().hex[:12]}"
    now = utc_now().isoformat()
    with db_connect() as db:
        worker = db.execute("SELECT worker_id FROM workers WHERE worker_id = ?", (canonical_worker_id,)).fetchone()
        if not worker:
            raise HTTPException(status_code=404, detail="Worker profile not found")
        accrued = float(db.execute("SELECT COALESCE(SUM(mutual_aid_fund), 0) FROM settlements WHERE booking_id IN (SELECT booking_id FROM bookings WHERE worker_id = ?)", (canonical_worker_id,)).fetchone()[0])
        reserved = float(db.execute("SELECT COALESCE(SUM(amount), 0) FROM welfare_claims WHERE worker_id = ? AND status IN ('pending', 'approved')", (canonical_worker_id,)).fetchone()[0])
        if req.amount > round(accrued - reserved, 2):
            raise HTTPException(status_code=400, detail="Claim exceeds the available mutual-aid balance")
        db.execute("INSERT INTO welfare_claims (id, worker_id, amount, reason, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)", (claim_id, canonical_worker_id, round(req.amount, 2), req.reason.strip(), now))
    return {"status": "submitted", "claim_id": claim_id, "worker_id": canonical_worker_id, "amount_inr": round(req.amount, 2), "submitted_at": now}
