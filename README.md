# 🏛️ Ubiquity: Cooperative Gig Services Platform
**Smart India Hackathon (SIH26089) • Ministry of Cooperation**

Ubiquity is a decentralized, digital public infrastructure (DPI) cooperative platform designed to transition informal household gig workers (plumbers, electricians, cleaners) away from exploitative 25-30% aggregator commissions into direct, democratic PACS-backed cooperatives.

---

## 🚀 Core Architectural Features

1. **Zero-Literacy Voice AI Onboarding:** Native dialect voice recording parsed via Whisper STT and converted into structured skill profiles using Gemini Flash.
2. **Fair-Pool Algorithmic Matching:** Replaces lowest-bidder races with a balanced metric:
   $$\text{Score} = 0.40 \cdot \text{Proximity} + 0.30 \cdot \text{Trust Rating} + 0.30 \cdot \text{Idle Days}$$
3. **Transparent 98% Direct Settlement:**
   - **98%** $\rightarrow$ Direct Worker UPI Payout
   - **1.5%** $\rightarrow$ Local PACS Server & Operational Maintenance
   - **0.5%** $\rightarrow$ Mutual-Aid Emergency Health/Accident Reserve Pool

---

## 🛠️ API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API Health Status Indicator |
| `POST` | `/api/workers/voice-onboard` | Voice note ingestion & structured profile extraction |
| `POST` | `/api/bookings/match-and-price` | Geospatial Fair-Pool matching & fair pricing comparison |
| `POST` | `/api/bookings/verify-settle` | 4-Digit OTP verification & 98/1.5/0.5 direct ledger split |

---

## 💻 Local Setup & Execution

### 1. Backend (FastAPI Engine)
```bash
cd sih-backend
python -m venv venv
# Windows: .\venv\Scripts\Activate.ps1
# Mac/Linux: source venv/bin/activate
pip install fastapi uvicorn google-genai openai pydantic
$env:GEMINI_API_KEY="your-gemini-api-key"
uvicorn main:app --reload --port 8000
