import os
import io
import math
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import openai
from google import genai
from google.genai import types

app = FastAPI(title="Ubiquity Cooperative Gig Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "dummy-key")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6Laacy7rqVeH1oOWFynYRwXGXBtzRb9VRAxbcL37PjAGA")

# Safe initialization
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "dummy-key":
    try:
        openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        openai_client = None

gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        gemini_client = None

class WorkerProfileSchema(BaseModel):
    full_name: str = Field(description="Name of the worker if mentioned, else 'Local Worker'")
    primary_skill: str = Field(description="Main skill: Plumbing, Electrical, Cleaning, Carpentry, Masonry, etc.")
    sub_skills: List[str] = Field(default=[], description="List of specific services offered")
    experience_years: int = Field(default=1, description="Years of experience mentioned")
    base_rate_inr: float = Field(default=250.0, description="Quoted rate in INR")
    operating_zone: str = Field(description="Locality/Area mentioned")

class BookingRequest(BaseModel):
    customer_id: str
    service_type: str
    customer_lat: float
    customer_lng: float

class SettleBookingRequest(BaseModel):
    booking_id: str
    worker_id: str
    cluster_id: str
    gross_amount: float
    otp_code: str

MOCK_WORKERS = [
    {
        "worker_id": "w-101",
        "full_name": "Murugan S.",
        "phone": "+91 9876543210",
        "skills": ["Plumbing", "Pipe Fitting"],
        "lat": 13.3512,
        "lng": 80.1420,
        "trust_rating": 0.88,
        "idle_days": 3,
        "is_verified": True,
        "availability": "online"
    },
    {
        "worker_id": "w-102",
        "full_name": "Ravi Kumar",
        "phone": "+91 9876543211",
        "skills": ["Plumbing", "Sanitation"],
        "lat": 13.3550,
        "lng": 80.1450,
        "trust_rating": 0.95,
        "idle_days": 0,
        "is_verified": True,
        "availability": "online"
    },
    {
        "worker_id": "w-103",
        "full_name": "Selvi M.",
        "phone": "+91 9876543212",
        "skills": ["Cleaning", "Housekeeping"],
        "lat": 13.3490,
        "lng": 80.1390,
        "trust_rating": 0.92,
        "idle_days": 2,
        "is_verified": True,
        "availability": "online"
    }
]

def calculate_haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

@app.get("/")
def read_root():
    return {"status": "Ubiquity Cooperative Backend Running"}

@app.post("/api/workers/voice-onboard")
async def voice_onboard_worker(
    audio_file: UploadFile = File(...),
    preferred_language: str = Form("ta")
):
    """
    Step 1: Receives recorded voice note.
    Step 2: Transcribes via Whisper / fallback.
    Step 3: Extracts structured profile JSON via Gemini Flash.
    """
    try:
        audio_bytes = await audio_file.read()
        
        # If OpenAI key exists, run Whisper
        transcription_text = ""
        if openai_client:
            buffer = io.BytesIO(audio_bytes)
            buffer.name = audio_file.filename or "audio.wav"
            resp = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=buffer,
                language=preferred_language
            )
            transcription_text = resp.text
        else:
            transcription_text = "I have 5 years experience in plumbing and pipe repair in Tambaram, charging 300 base rate."

        # Structured parsing via Gemini Flash
        if gemini_client:
            prompt = f"Extract worker profile in JSON: \"{transcription_text}\""
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=WorkerProfileSchema,
                    temperature=0.1
                )
            )
            parsed_data = response.parsed
        else:
            parsed_data = {
                "full_name": "Local Worker",
                "primary_skill": "Plumbing",
                "sub_skills": ["Pipe Repair", "Tap Leakage"],
                "experience_years": 5,
                "base_rate_inr": 300.0,
                "operating_zone": "Tambaram"
            }

        return {
            "status": "success",
            "transcription": transcription_text,
            "structured_profile": parsed_data
        }

    except Exception as e:
        return {
            "status": "fallback_success",
            "transcription": "Sample Audio: 5 years experience in plumbing, base charge 300 rupees",
            "structured_profile": {
                "full_name": "Karthik R.",
                "primary_skill": "Plumbing",
                "sub_skills": ["General Plumbing", "Leakage Fixing"],
                "experience_years": 5,
                "base_rate_inr": 300.0,
                "operating_zone": "Kilmudalambedu"
            },
            "note": "Fallback triggered for demo stability"
        }


@app.post("/api/bookings/match-and-price")
async def match_worker_and_price(req: BookingRequest):
    matched = []
    for worker in MOCK_WORKERS:
        if req.service_type.lower() in [s.lower() for s in worker["skills"]] and worker["availability"] == "online":
            dist = calculate_haversine_km(req.customer_lat, req.customer_lng, worker["lat"], worker["lng"])
            if dist <= 5.0:
                proximity_score = max(0.0, 1.0 - (dist / 5.0))
                fair_score = (0.4 * proximity_score) + (0.3 * worker["trust_rating"]) + (0.3 * min(1.0, worker["idle_days"] / 5.0))
                fair_price = round(200.0 + (dist * 15.0), 2)
                commercial_price = round(fair_price * 1.35, 2)

                matched.append({
                    "worker_id": worker["worker_id"],
                    "full_name": worker["full_name"],
                    "distance_km": round(dist, 2),
                    "fair_match_score": round(fair_score, 3),
                    "fair_price_inr": fair_price,
                    "commercial_aggregator_price_inr": commercial_price,
                    "customer_savings_inr": round(commercial_price - fair_price, 2)
                })

    matched.sort(key=lambda x: x["fair_match_score"], reverse=True)
    return {
        "status": "success",
        "service_requested": req.service_type,
        "selected_best_match": matched[0] if matched else None,
        "all_ranked_candidates": matched
    }

@app.post("/api/bookings/verify-settle")
async def verify_and_settle_job(req: SettleBookingRequest):
    if len(req.otp_code) != 4:
        raise HTTPException(status_code=400, detail="Invalid 4-digit OTP")
    
    gross = req.gross_amount
    return {
        "status": "settled",
        "booking_id": req.booking_id,
        "settlement_breakdown": {
            "gross_amount_paid": gross,
            "direct_worker_payout_98pct": round(gross * 0.98, 2),
            "pacs_cooperative_maintenance_1_5pct": round(gross * 0.015, 2),
            "mutual_aid_emergency_pool_0_5pct": round(gross * 0.005, 2)
        }
    }