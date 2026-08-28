# Ubiquity --- Cooperative Gig Platform

> **SIH Prototype \| Decentralized Local Work Dispatch & PACS Worker
> Onboarding**

Ubiquity is a cooperative gig-work platform designed to connect
customers with local workers through a **PACS-based cooperative model**.
It combines AI-powered multilingual voice onboarding,
proximity-and-trust-based worker matching, transparent pricing,
OTP-based job settlement, and a cooperative welfare fund.

## ✨ Key Features

### 🎙️ Multilingual AI Voice Onboarding

Workers can register using their voice instead of filling out a lengthy
form.

-   Browser microphone recording with live audio visualizer
-   Supports Tamil, Telugu, Hindi, and English
-   Google Gemini 2.5 Flash extracts worker name, trade, sub-skills,
    experience, base rate, locality, and transcript
-   Deterministic demo profiles provide resilience when audio is
    unavailable
-   Extracted profiles enter the verification workflow before becoming
    verified workers

**API:** `POST /api/workers/voice-onboard`

### 🤝 Cooperative Worker Matching

Customers can request:

-   Plumbing
-   Electrical
-   Carpentry
-   House Cleaning

Workers are ranked using:

``` text
Match Score =
0.45 × Proximity
+ 0.35 × Trust Rating
+ 0.20 × Idle Days
```

The idle-days component helps prevent workers from being repeatedly
overlooked in favour of already-busy workers.

### 💰 Fair & Transparent Pricing

The customer flow displays:

-   Fair cooperative price
-   Commercial aggregator reference price
-   Customer savings

### 🔐 OTP Proof-of-Work Settlement

Completed jobs use OTP verification and a persistent three-way
settlement:

  Allocation                  Percentage
  ------------------------- ------------
  Worker Direct Payout         **98.0%**
  PACS Maintenance              **1.5%**
  Mutual-Aid Welfare Fund       **0.5%**

**API:** `POST /api/bookings/verify-settle`

### 📒 Worker Digital Passbook

Workers can view:

-   Earnings overview
-   Transaction history
-   Active worker profile
-   Emergency welfare claims

Emergency claim categories include Medical, Tool Loss, and Income Loss.

### 🏛️ PACS Admin Portal

The admin portal provides:

-   Ward-level gig analytics
-   PACS maintenance balance
-   Mutual-aid reserve
-   Worker verification queue
-   One-click worker approval/rejection
-   Welfare claim adjudication
-   Seasonal demand forecasting

Worker verification flow:

``` text
Voice Onboarding
      ↓
AI Profile Extraction
      ↓
Worker Registration
      ↓
Pending Verification
      ↓
PACS Admin Review
      ↓
Approved
      ↓
Verified Worker
```

## 🏗️ Architecture

``` text
                    ┌──────────────────────┐
                    │     React + Vite     │
                    │      Frontend        │
                    │       :3000          │
                    └──────────┬───────────┘
                               │
                         REST API / HTTP
                               │
                    ┌──────────▼───────────┐
                    │       FastAPI        │
                    │       Backend        │
                    │        :8000         │
                    └───────┬───────┬──────┘
                            │       │
                 ┌──────────▼──┐ ┌──▼─────────────┐
                 │   SQLite    │ │ Gemini 2.5     │
                 │  Database   │ │     Flash      │
                 └─────────────┘ └────────────────┘
```

## 🛠️ Technology Stack

### Frontend

-   React 19
-   TypeScript
-   Vite
-   Wouter
-   Tailwind CSS
-   Lucide React
-   Leaflet

### Backend

-   Python 3.10+
-   FastAPI
-   Uvicorn
-   Pydantic
-   SQLite

### AI

-   Google Gemini 2.5 Flash
-   Google GenAI Python SDK

## 📁 Project Structure

``` text
sih-ubiquity/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── ubiquity.db
│   ├── .env
│   └── ...
│
├── frontend/
│   └── jeswin-ubiquity-website/
│       └── ubiquity-demo/
│           ├── client/
│           ├── package.json
│           ├── vite.config.*
│           └── ...
│
├── README.md
└── ...
```

## 🚀 Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/SreeAnsh15/sih-ubiquity.git
cd sih-ubiquity
```

### 2. Backend Setup

``` bash
cd backend
python -m venv ../venv
```

Activate the virtual environment on Windows PowerShell:

``` powershell
..\venv\Scripts\Activate.ps1
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

Configure `backend/.env`:

``` env
GEMINI_API_KEY=your_api_key_here
```

Start the backend:

``` bash
uvicorn main:app --reload --port 8000
```

Backend: `http://localhost:8000`

### 3. Frontend Setup

Open another terminal:

``` bash
cd frontend/jeswin-ubiquity-website/ubiquity-demo
npm install
npm run dev
```

Frontend: `http://localhost:3000`

## 🔌 Important API Endpoints

  -----------------------------------------------------------------------------------------------------
  Method                  Endpoint                                              Purpose
  ----------------------- ----------------------------------------------------- -----------------------
  `GET`                   `/api/health`                                         Backend
                                                                                health/configuration
                                                                                check

  `POST`                  `/api/workers/voice-onboard`                          AI voice profile
                                                                                extraction

  `POST`                  `/api/workers/register`                               Register extracted
                                                                                worker

  `GET`                   `/api/admin/verification-queue`                       View pending
                                                                                registrations

  `POST`                  `/api/admin/verification-queue/{member_id}/approve`   Approve a worker

  `GET`                   `/api/admin/dashboard`                                Admin dashboard
                                                                                statistics

  `POST`                  `/api/bookings/match-and-price`                       Match worker and
                                                                                calculate pricing

  `POST`                  `/api/bookings`                                       Create a booking

  `POST`                  `/api/bookings/verify-settle`                         Verify completion and
                                                                                settle payment
  -----------------------------------------------------------------------------------------------------

## 🎯 Typical Demo Flow

### Worker

1.  Open `/worker/onboard`.
2.  Record a worker introduction.
3.  Gemini processes the recording.
4.  Review the extracted profile.
5.  Submit the registration.
6.  The worker enters the PACS verification queue.

### Admin

1.  Open `/admin`.
2.  Open the worker verification queue.
3.  Review the worker information.
4.  Approve the worker.
5.  The worker becomes verified.

### Customer

1.  Open `/customer`.
2.  Select a required service.
3.  View eligible workers.
4.  Review cooperative pricing.
5.  Request automated cooperative dispatch.
6.  Confirm the booking.
7.  Complete the job.
8.  Verify completion using the OTP.
9.  The settlement is split between the worker, PACS maintenance, and
    mutual-aid fund.

### Worker Passbook

1.  Open `/worker`.
2.  Select the active worker profile.
3.  View earnings and transactions.
4.  Submit an emergency welfare claim when applicable.

## 🧠 AI Voice Extraction

Example spoken input:

``` text
"My name is Vikram Malhotra, professional carpenter
from Gandhipuram with eight years experience,
base rate 500 rupees."
```

Gemini can extract structured information such as:

``` json
{
  "full_name": "Vikram Malhotra",
  "primary_skill": "carpenter",
  "experience_years": 8,
  "base_rate_inr": 500,
  "operating_zone": "Gandhipuram"
}
```

## 🏛️ Cooperative Model

Ubiquity is built around three principles:

1.  **Fair Worker Allocation** --- matching considers proximity, trust,
    and idle time.
2.  **Transparent Economics** --- customers can see the cooperative
    price and commercial reference.
3.  **Shared Worker Welfare** --- a portion of completed-job value
    supports PACS maintenance and the mutual-aid fund.

## 🗃️ Data Model

Core SQLite entities include:

``` text
workers
    └── Verified worker profiles

worker_registrations
    └── Pending/approved PACS registrations

bookings
    └── Customer-worker jobs

settlements
    ├── Worker payout
    ├── PACS maintenance
    └── Mutual-aid contribution

welfare_claims
    └── Worker emergency claims
```

## 🔒 Environment Variables

Never commit API keys or other secrets to GitHub.

Example:

``` env
GEMINI_API_KEY=your_api_key_here
AUTH_SECRET=your_secret_here
DEMO_MODE=true
```

Use appropriate production values and disable demo-only behaviour before
production deployment.

## 🧪 Demo & Development

The prototype contains demo-oriented resilience features so major
workflows can still be demonstrated when external services or real-world
inputs are unavailable.

The backend also exposes:

``` text
GET /api/health
```

for checking service and AI configuration.

## 📌 Project Status

**Current status: Prototype / SIH Demonstration**

-   [x] Multilingual AI voice onboarding
-   [x] Worker profile extraction
-   [x] PACS worker registration
-   [x] Admin worker verification
-   [x] Cooperative worker matching
-   [x] Fair-price calculation
-   [x] Automated cooperative dispatch
-   [x] OTP job completion
-   [x] Atomic settlement split
-   [x] Worker digital passbook
-   [x] Emergency welfare claims
-   [x] PACS admin dashboard
-   [x] Seasonal demand forecasting
-   [x] SQLite persistence

## 👥 Team

**SIH Ubiquity Team**

Built as a Smart India Hackathon prototype focused on cooperative
local-work dispatch, worker empowerment, and transparent gig-work
economics.

## 📄 License

This repository is currently intended as a project/prototype repository.
Add the appropriate open-source license if the project is released under
one.
